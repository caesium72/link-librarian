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

    const { category, searchQuery } = await req.json().catch(() => ({ category: "all", searchQuery: "" }));

    const categoryPrompts: Record<string, string> = {
      all: "new AI tools, software development tools, developer frameworks, CLI utilities, code editors, DevOps platforms, cloud services, and technology products",
      ai: "new AI and machine learning tools, LLMs, AI agents, AI code assistants, AI-powered IDEs, computer vision tools, NLP libraries, vector databases, model fine-tuning platforms, prompt engineering tools, and AI infrastructure",
      dev: "new software development tools, IDEs, code editors, debugging tools, testing frameworks, build tools, package managers, CI/CD platforms, API development tools, database tools, and developer utilities",
      productivity: "new productivity and automation tools for software engineers including workflow automation, project management, documentation generators, note-taking for developers, time tracking, terminal tools, and developer experience platforms",
      opensource: "new trending open-source projects on GitHub including libraries, frameworks, CLI tools, self-hosted alternatives, developer tools, infrastructure tools, and community-driven projects",
    };

    const focus = categoryPrompts[category] || categoryPrompts.all;

    let searchContext = "";
    if (searchQuery && searchQuery.trim()) {
      searchContext = `\n\nIMPORTANT: The user is specifically searching for: "${searchQuery}". Focus your research heavily on tools related to this search query. Find tools that match this topic, solve problems in this domain, or are closely related alternatives.`;
    }

    const prompt = `You are an expert tech industry researcher and tool scout. Your job is to do DEEP research — not surface-level mainstream tools everyone already knows.

Find and list 30 recently launched, trending, or hidden-gem ${focus}.${searchContext}

RESEARCH DEPTH REQUIREMENTS:
- Go beyond the obvious top-10 lists. Include niche, specialized, and indie tools.
- Include tools from Product Hunt launches, GitHub trending, Hacker News discussions, indie hacker communities, and specialized tech blogs.
- Mix well-known new releases (30%) with lesser-known gems and indie tools (70%).
- Include tools at various stages: just launched, beta, growing traction, and recently pivoted.
- Cover the FULL ecosystem: CLI tools, browser extensions, VS Code extensions, SaaS platforms, self-hosted solutions, libraries, frameworks, APIs, and infrastructure.
- Prioritize tools from 2025-2026 but include standout 2024 tools gaining momentum now.

For each tool, provide:
1. name - The tool/product name (be precise)
2. url - The official website URL (must be accurate and real)
3. description - A detailed 2-3 sentence description explaining what it does, what problem it solves, and why it's notable
4. category - One of: "ai", "dev-tool", "productivity", "open-source", "framework", "saas"
5. tags - 3-5 relevant lowercase tags that help with filtering and discovery

Be thorough, accurate, and diverse in your selections. Avoid listing generic well-known tools like "GitHub" or "VS Code" unless they have significant new features worth highlighting.`;

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
            content: "You are a deep-research tech industry analyst specializing in discovering cutting-edge, niche, and emerging AI and software tools. You go far beyond surface-level mainstream tools. Always return accurate, real tools with valid URLs. Never make up tools or URLs.",
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
