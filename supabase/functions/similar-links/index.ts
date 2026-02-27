import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { linkId } = await req.json();
    if (!linkId) throw new Error("linkId is required");

    // Fetch the target link
    const { data: targetLink, error: targetError } = await supabase
      .from("links")
      .select("id, title, original_url, domain, summary, tags, content_type, key_points")
      .eq("id", linkId)
      .single();

    if (targetError || !targetLink) throw new Error("Link not found");

    // Fetch other user links
    const { data: otherLinks, error: linksError } = await supabase
      .from("links")
      .select("id, title, original_url, domain, summary, tags, content_type, created_at, is_pinned, key_points")
      .eq("status", "ready")
      .is("deleted_at", null)
      .neq("id", linkId)
      .order("created_at", { ascending: false })
      .limit(300);

    if (linksError) throw linksError;
    if (!otherLinks || otherLinks.length === 0) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const linksContext = otherLinks.map((l, i) =>
      `[${i}] "${l.title || 'Untitled'}" | ${l.domain || 'unknown'} | tags: ${(l.tags || []).join(', ') || 'none'} | ${l.summary?.slice(0, 100) || 'no summary'}`
    ).join("\n");

    const targetContext = `Title: "${targetLink.title || 'Untitled'}"
Domain: ${targetLink.domain || 'unknown'}
Tags: ${(targetLink.tags || []).join(', ') || 'none'}
Summary: ${targetLink.summary || 'none'}
Key Points: ${(targetLink.key_points || []).join('; ') || 'none'}
Content Type: ${targetLink.content_type || 'unknown'}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You find similar/related links from a user's library. Given a target link and a list of other links, return the indices of the most related ones.

RULES:
- Return ONLY valid JSON: {"indices": [0, 3, 7], "reasons": ["shares same topic", "related framework", "complementary tool"]}
- Max 5 results, ordered by relevance.
- Match by topic similarity, shared tags, same domain/ecosystem, complementary content.
- Each reason should be 3-6 words explaining the connection.
- If nothing is related, return {"indices": [], "reasons": []}
- Return ONLY JSON, no markdown.`,
          },
          {
            role: "user",
            content: `TARGET LINK:\n${targetContext}\n\nOTHER LINKS:\n${linksContext}`,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let parsed: { indices: number[]; reasons: string[] };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = (parsed.indices || [])
      .filter((i: number) => i >= 0 && i < otherLinks.length)
      .map((i: number, idx: number) => ({
        ...otherLinks[i],
        reason: (parsed.reasons || [])[idx] || "Related content",
      }));

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("similar-links error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
