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

    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      throw new Error("Query is required");
    }

    // Fetch user's links (up to 500 most recent ready links)
    const { data: links, error: linksError } = await supabase
      .from("links")
      .select("id, title, original_url, domain, summary, tags, content_type, created_at, is_pinned, is_read, key_points")
      .eq("status", "ready")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);

    if (linksError) throw linksError;
    if (!links || links.length === 0) {
      return new Response(JSON.stringify({ results: [], message: "No links in your library yet." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build a compact representation for the AI
    const linksContext = links.map((l, i) => 
      `[${i}] "${l.title || 'Untitled'}" | ${l.domain || 'unknown'} | tags: ${(l.tags || []).join(', ') || 'none'} | ${l.summary?.slice(0, 120) || 'no summary'} | saved: ${l.created_at?.slice(0, 10)}`
    ).join("\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const today = new Date().toISOString().slice(0, 10);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a smart search assistant for a personal link library. Today is ${today}.
The user will ask a natural language question about their saved links. Your job is to find the most relevant links.

RULES:
- Return ONLY a JSON object with this structure: {"indices": [0, 5, 12], "reason": "brief explanation"}
- "indices" = array of link indices (from the numbered list) that best match the query, ordered by relevance. Max 20 results.
- Interpret temporal references like "last week", "yesterday", "this month" relative to today (${today}).
- Match semantically — the user may not use exact titles or tags.
- If nothing matches, return {"indices": [], "reason": "No matching links found."}
- Return ONLY valid JSON, no markdown, no extra text.`,
          },
          {
            role: "user",
            content: `My saved links:\n${linksContext}\n\nSearch query: "${query.trim()}"`,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from AI response
    let parsed: { indices: number[]; reason: string };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ results: [], reason: "Could not interpret search results." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resultLinks = (parsed.indices || [])
      .filter((i: number) => i >= 0 && i < links.length)
      .map((i: number) => links[i]);

    return new Response(JSON.stringify({ results: resultLinks, reason: parsed.reason || "" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("smart-search error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
