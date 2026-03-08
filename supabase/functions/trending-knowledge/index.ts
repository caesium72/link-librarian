import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { timeRange = "7d", category = "all" } = await req.json().catch(() => ({}));

    const timeLabel = { "24h": "last 24 hours", "7d": "past week", "30d": "past month", "90d": "past 3 months" }[timeRange] || "past week";

    const categoryFocus: Record<string, string> = {
      all: "AI, software engineering, developer tools, open-source, startups, cloud, and emerging technology",
      ai: "artificial intelligence, machine learning, LLMs, AI agents, AI coding assistants, and AI infrastructure",
      dev: "developer tools, frameworks, programming languages, DevOps, testing, and software architecture",
      opensource: "open-source projects, GitHub trending, community-driven tools, and self-hosted alternatives",
      startup: "startup launches, Product Hunt, indie hacking, SaaS tools, and new tech companies",
    };

    const focus = categoryFocus[category] || categoryFocus.all;

    const prompt = `You are an expert tech trend analyst with access to the latest industry knowledge. Analyze what's ACTUALLY trending in the ${focus} space during the ${timeLabel}.

Return a comprehensive trending report with:

1. **trending_topics**: The top 8 trending topics/themes right now. For each:
   - name: short topic name (2-4 words)
   - heat: score from 1-100 indicating how hot this topic is
   - trend: "rising", "peak", or "declining"
   - description: one sentence about why it's trending

2. **trending_links**: 15 specific articles, tools, repos, or resources that are trending RIGHT NOW. For each:
   - title: the article/tool title
   - url: real, accurate URL
   - domain: source domain
   - description: 1-2 sentence description
   - category: one of "article", "tool", "repo", "launch", "discussion"
   - tags: 2-4 relevant tags
   - heat_score: 1-100 trending score

3. **community_pulse**: What the developer community is buzzing about:
   - hot_discussions: 3 topics generating the most debate
   - rising_technologies: 3 technologies gaining rapid adoption
   - notable_launches: 3 most notable product/tool launches

4. **insights_summary**: A brief 2-3 sentence summary of the overall tech trending landscape right now.

Be accurate with URLs. Only include REAL, currently accessible resources. Prioritize recency and relevance.`;

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
            content: "You are a real-time tech trend analyst. Return accurate, current trending data. Never fabricate URLs or tools. Be precise and data-driven.",
          },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_trending",
              description: "Return trending knowledge data",
              parameters: {
                type: "object",
                properties: {
                  trending_topics: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        heat: { type: "number" },
                        trend: { type: "string", enum: ["rising", "peak", "declining"] },
                        description: { type: "string" },
                      },
                      required: ["name", "heat", "trend", "description"],
                    },
                  },
                  trending_links: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        url: { type: "string" },
                        domain: { type: "string" },
                        description: { type: "string" },
                        category: { type: "string", enum: ["article", "tool", "repo", "launch", "discussion"] },
                        tags: { type: "array", items: { type: "string" } },
                        heat_score: { type: "number" },
                      },
                      required: ["title", "url", "domain", "description", "category", "tags", "heat_score"],
                    },
                  },
                  community_pulse: {
                    type: "object",
                    properties: {
                      hot_discussions: { type: "array", items: { type: "string" } },
                      rising_technologies: { type: "array", items: { type: "string" } },
                      notable_launches: { type: "array", items: { type: "string" } },
                    },
                    required: ["hot_discussions", "rising_technologies", "notable_launches"],
                  },
                  insights_summary: { type: "string" },
                },
                required: ["trending_topics", "trending_links", "community_pulse", "insights_summary"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_trending" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Failed to fetch trending data" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    let result;
    try {
      result = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse trending data" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Trending error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
