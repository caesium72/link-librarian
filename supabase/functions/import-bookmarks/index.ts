import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { format, bookmarks } = await req.json();

    if (!format || !bookmarks) {
      return new Response(JSON.stringify({ error: "format and bookmarks required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let links: { url: string; title?: string; tags?: string[]; created_at?: string }[] = [];

    if (format === "pocket") {
      // Pocket HTML export format - parse items
      links = parsePocketExport(bookmarks);
    } else if (format === "raindrop") {
      // Raindrop.io CSV export
      links = parseRaindropExport(bookmarks);
    } else if (format === "browser") {
      // Browser bookmarks HTML export
      links = parseBrowserBookmarks(bookmarks);
    } else {
      return new Response(JSON.stringify({ error: "Unknown format. Supported: pocket, raindrop, browser" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let imported = 0;
    let skipped = 0;

    for (const item of links) {
      if (!item.url) continue;

      // Check for duplicate
      const { data: existing } = await serviceClient
        .from("links")
        .select("id")
        .eq("user_id", user.id)
        .eq("original_url", item.url)
        .maybeSingle();

      if (existing) {
        await serviceClient
          .from("links")
          .update({ duplicate_count: 1 })
          .eq("id", existing.id);
        skipped++;
        continue;
      }

      let domain = "";
      try { domain = new URL(item.url).hostname; } catch { continue; }

      const insertData: Record<string, unknown> = {
        original_url: item.url,
        domain,
        user_id: user.id,
        status: "pending",
        source: format,
        title: item.title || null,
        tags: item.tags || [],
      };
      if (item.created_at) {
        insertData.created_at = item.created_at;
      }

      const { data: newLink, error: insertError } = await serviceClient
        .from("links")
        .insert(insertData)
        .select("id")
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        skipped++;
        continue;
      }

      imported++;

      // Trigger analysis (fire and forget)
      fetch(`${supabaseUrl}/functions/v1/analyze-link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ linkId: newLink.id }),
      }).catch(console.error);
    }

    return new Response(
      JSON.stringify({ success: true, imported, skipped, total: links.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Import error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parsePocketExport(html: string): { url: string; title?: string; tags?: string[]; created_at?: string }[] {
  const results: { url: string; title?: string; tags?: string[]; created_at?: string }[] = [];
  // Pocket exports as HTML with <a> tags containing href, time_added, and tags attributes
  const linkRegex = /<a\s+[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].trim();
    if (!url || url.startsWith("javascript:")) continue;

    // Extract time_added attribute
    const timeMatch = match[0].match(/time_added="(\d+)"/);
    const tagsMatch = match[0].match(/tags="([^"]+)"/);

    results.push({
      url,
      title: title || undefined,
      tags: tagsMatch ? tagsMatch[1].split(",").map(t => t.trim().toLowerCase()) : undefined,
      created_at: timeMatch ? new Date(parseInt(timeMatch[1]) * 1000).toISOString() : undefined,
    });
  }
  return results;
}

function parseRaindropExport(csv: string): { url: string; title?: string; tags?: string[]; created_at?: string }[] {
  const results: { url: string; title?: string; tags?: string[]; created_at?: string }[] = [];
  const lines = csv.split("\n");
  if (lines.length < 2) return results;

  // Find column indices from header
  const header = parseCSVLine(lines[0]);
  const urlIdx = header.findIndex(h => h.toLowerCase().includes("url") || h.toLowerCase().includes("link"));
  const titleIdx = header.findIndex(h => h.toLowerCase().includes("title"));
  const tagsIdx = header.findIndex(h => h.toLowerCase().includes("tag"));
  const dateIdx = header.findIndex(h => h.toLowerCase().includes("created") || h.toLowerCase().includes("date"));

  if (urlIdx === -1) return results;

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCSVLine(lines[i]);
    const url = cols[urlIdx]?.trim();
    if (!url) continue;

    results.push({
      url,
      title: titleIdx >= 0 ? cols[titleIdx]?.trim() : undefined,
      tags: tagsIdx >= 0 && cols[tagsIdx] ? cols[tagsIdx].split(",").map(t => t.trim().toLowerCase()).filter(Boolean) : undefined,
      created_at: dateIdx >= 0 && cols[dateIdx] ? tryParseDate(cols[dateIdx]) : undefined,
    });
  }
  return results;
}

function parseBrowserBookmarks(html: string): { url: string; title?: string; created_at?: string }[] {
  const results: { url: string; title?: string; created_at?: string }[] = [];
  const linkRegex = /<a\s+[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].trim();
    if (!url || url.startsWith("javascript:") || url.startsWith("place:")) continue;

    const addDateMatch = match[0].match(/add_date="(\d+)"/i);
    results.push({
      url,
      title: title || undefined,
      created_at: addDateMatch ? new Date(parseInt(addDateMatch[1]) * 1000).toISOString() : undefined,
    });
  }
  return results;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes;
    } else if (line[i] === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += line[i];
    }
  }
  result.push(current);
  return result;
}

function tryParseDate(str: string): string | undefined {
  try {
    const d = new Date(str.trim());
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  } catch {
    return undefined;
  }
}
