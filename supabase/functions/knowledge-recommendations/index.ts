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

    // Fetch recently read links to understand user interests
    const { data: readLinks, error: readError } = await supabase
      .from("links")
      .select("id, title, domain, summary, tags, content_type, key_points")
      .eq("is_read", true)
      .is("deleted_at", null)
      .order("reading_completed_at", { ascending: false })
      .limit(20);

    if (readError) throw readError;

    // Fetch unread links as candidates for recommendations
    const { data: unreadLinks, error: unreadError } = await supabase
      .from("links")
      .select("id, title, original_url, domain, summary, tags, content_type, created_at, is_pinned, key_points, reading_time_estimate")
      .eq("status", "ready")
      .eq("is_read", false)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (unreadError) throw unreadError;

    if (!readLinks || readLinks.length === 0 || !unreadLinks || unreadLinks.length === 0) {
      return new Response(JSON.stringify({ recommendations: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const readContext = readLinks.map((l) =>
      `"${l.title || 'Untitled'}" | tags: ${(l.tags || []).join(', ') || 'none'} | ${l.summary?.slice(0, 80) || 'no summary'}`
    ).join("\n");

    const candidateContext = unreadLinks.map((l, i) =>
      `[${i}] "${l.title || 'Untitled'}" | ${l.domain || 'unknown'} | tags: ${(l.tags || []).join(', ') || 'none'} | ${l.summary?.slice(0, 80) || 'no summary'}`
    ).join("\n");

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
            content: `You recommend unread links based on a user's reading history. Given their recently read links and a list of unread candidates, return indices of the most relevant unread links they should read next.

RULES:
- Return ONLY valid JSON: {"indices": [0, 3, 7], "reasons": ["builds on LLM knowledge", "related framework", "complementary concept"]}
- Max 8 results, ordered by relevance.
- Match by topic continuity, knowledge gaps, learning path progression.
- Each reason should be 3-8 words explaining why this is recommended.
- If nothing matches well, return {"indices": [], "reasons": []}
- Return ONLY JSON, no markdown.`,
          },
          {
            role: "user",
            content: `RECENTLY READ:\n${readContext}\n\nUNREAD CANDIDATES:\n${candidateContext}`,
          },
        ],
        temperature: 0.2,
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
      return new Response(JSON.stringify({ recommendations: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recommendations = (parsed.indices || [])
      .filter((i: number) => i >= 0 && i < unreadLinks.length)
      .map((i: number, idx: number) => ({
        ...unreadLinks[i],
        reason: (parsed.reasons || [])[idx] || "Recommended for you",
      }));

    return new Response(JSON.stringify({ recommendations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("knowledge-recommendations error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
