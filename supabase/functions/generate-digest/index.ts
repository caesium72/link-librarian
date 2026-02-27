import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Parse period from body
    let period = "weekly";
    try {
      const body = await req.json();
      period = body?.period || "weekly";
    } catch {}

    const daysBack = period === "daily" ? 1 : 7;
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

    // Get all non-deleted links
    const { data: allLinks, error: linksErr } = await userClient
      .from("links")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (linksErr) throw linksErr;

    const links = allLinks || [];

    // New links in period
    const newLinks = links.filter((l: any) => l.created_at >= since);

    // Unread links
    const unreadLinks = links.filter((l: any) => !l.is_read);

    // Trending tags (most frequently used in new links)
    const tagCounts: Record<string, number> = {};
    newLinks.forEach((l: any) => {
      (l.tags || []).forEach((tag: string) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    const trendingTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    // Content type breakdown for new links
    const contentTypeCounts: Record<string, number> = {};
    newLinks.forEach((l: any) => {
      const ct = l.content_type || "other";
      contentTypeCounts[ct] = (contentTypeCounts[ct] || 0) + 1;
    });

    // Top domains in new links
    const domainCounts: Record<string, number> = {};
    newLinks.forEach((l: any) => {
      if (l.domain) {
        domainCounts[l.domain] = (domainCounts[l.domain] || 0) + 1;
      }
    });
    const topDomains = Object.entries(domainCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([domain, count]) => ({ domain, count }));

    // Broken links (health check)
    const brokenLinks = links.filter((l: any) => l.health_status === "broken");

    const digest = {
      period,
      since,
      stats: {
        totalLinks: links.length,
        newLinksCount: newLinks.length,
        unreadCount: unreadLinks.length,
        brokenCount: brokenLinks.length,
      },
      newLinks: newLinks.slice(0, 20).map((l: any) => ({
        id: l.id,
        title: l.title,
        original_url: l.original_url,
        domain: l.domain,
        content_type: l.content_type,
        tags: l.tags,
        summary: l.summary,
        created_at: l.created_at,
      })),
      trendingTags,
      contentTypeCounts,
      topDomains,
      brokenLinks: brokenLinks.slice(0, 10).map((l: any) => ({
        id: l.id,
        title: l.title,
        original_url: l.original_url,
        domain: l.domain,
        health_status_code: l.health_status_code,
      })),
    };

    return new Response(JSON.stringify(digest), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
