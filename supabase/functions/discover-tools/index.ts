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
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const { category } = await req.json().catch(() => ({ category: "all" }));

    const categoryPrompts: Record<string, string> = {
      all: "new AI tools, software development tools, and technology products",
      ai: "new AI and machine learning tools, LLMs, AI assistants, and AI-powered applications",
      dev: "new software development tools, IDEs, frameworks, libraries, and developer utilities",
      productivity: "new productivity and automation tools for software engineers and tech workers",
      opensource: "new trending open-source projects and tools on GitHub",
    };

    const focus = categoryPrompts[category] || categoryPrompts.all;

    const prompt = `You are a tech researcher. Find and list 25 recently launched or trending ${focus}.

For each tool, provide:
1. name - The tool/product name
2. url - The official website URL
3. description - A concise 1-2 sentence description of what it does
4. category - One of: "ai", "dev-tool", "productivity", "open-source", "framework", "saas"
5. tags - 2-4 relevant lowercase tags

Focus on tools launched or gaining traction in 2025-2026. Include a mix of well-known new releases and hidden gems. Be specific and accurate with URLs.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are a tech industry researcher specializing in discovering new AI and software tools. Always return accurate, real tools with valid URLs.",
          },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_tools",
              description: "Return a list of discovered tech tools",
              parameters: {
                type: "object",
                properties: {
                  tools: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        url: { type: "string" },
                        description: { type: "string" },
                        category: {
                          type: "string",
                          enum: ["ai", "dev-tool", "productivity", "open-source", "framework", "saas"],
                        },
                        tags: {
                          type: "array",
                          items: { type: "string" },
                        },
                      },
                      required: ["name", "url", "description", "category", "tags"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["tools"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_tools" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI research failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    let result;
    try {
      result = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, tools: result.tools }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Discover error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
