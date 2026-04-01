import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { linkId } = await req.json();
    if (!linkId) {
      return new Response(JSON.stringify({ error: "linkId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the link
    const { data: link, error: fetchError } = await supabase
      .from("links")
      .select("*")
      .eq("id", linkId)
      .single();

    if (fetchError || !link) {
      return new Response(JSON.stringify({ error: "Link not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = link.original_url;

    // Step 1: Fetch page metadata
    let pageTitle = "";
    let pageDescription = "";
    let canonicalUrl = url;
    let finalDomain = link.domain || "";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const pageResponse = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LinkLibrarian/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // Get final URL after redirects
      canonicalUrl = pageResponse.url || url;
      try {
        finalDomain = new URL(canonicalUrl).hostname;
      } catch { /* keep existing */ }

      const html = await pageResponse.text();

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) pageTitle = titleMatch[1].trim();

      // Extract meta description
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
      if (descMatch) pageDescription = descMatch[1].trim();

      // Extract OG tags
      const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
      if (ogTitleMatch && !pageTitle) pageTitle = ogTitleMatch[1].trim();

      const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
      if (ogDescMatch && !pageDescription) pageDescription = ogDescMatch[1].trim();

    } catch (e) {
      console.error("Failed to fetch page:", e);
    }

    // Step 2: Call AI for analysis
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const prompt = `Analyze this web page and provide structured metadata.

URL: ${url}
${canonicalUrl !== url ? `Final URL: ${canonicalUrl}` : ""}
Domain: ${finalDomain}
Page Title: ${pageTitle || "Unknown"}
Page Description: ${pageDescription || "None available"}

Based on the URL, domain, title, and description, provide:
1. A clean, human-friendly title (not clickbait, specific and descriptive)
2. A 1-3 sentence summary of what this page contains
3. 3-10 relevant tags (lowercase, single words or short phrases)
4. Content type classification
5. 3-7 key bullet points about the content (if determinable)
6. Your confidence score (0.0 to 1.0) in the analysis quality`;

    const aiBody = JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content: "You are a link analysis assistant. Analyze URLs and provide structured metadata.",
        },
        { role: "user", content: prompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "analyze_link",
            description: "Provide structured analysis of a web page",
            parameters: {
              type: "object",
              properties: {
                clean_title: { type: "string", description: "Clean, descriptive title" },
                summary: { type: "string", description: "1-3 sentence summary" },
                tags: {
                  type: "array",
                  items: { type: "string" },
                  description: "3-10 relevant lowercase tags",
                },
                content_type: {
                  type: "string",
                  enum: ["article", "video", "repo", "docs", "tool", "thread", "other"],
                  description: "Type of content",
                },
                key_points: {
                  type: "array",
                  items: { type: "string" },
                  description: "3-7 key bullet points",
                },
                confidence: {
                  type: "number",
                  description: "Confidence score 0.0 to 1.0",
                },
              },
              required: ["clean_title", "summary", "tags", "content_type", "key_points", "confidence"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "analyze_link" } },
    });

    // Retry with exponential backoff for rate limits
    let aiResponse: Response | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: aiBody,
      });
      if (aiResponse.status !== 429 && aiResponse.status !== 502 && aiResponse.status !== 503) break;
      const wait = Math.pow(2, attempt) * 2000;
      console.log(`Retryable error ${aiResponse.status}, retrying in ${wait}ms (attempt ${attempt + 1}/4)`);
      await aiResponse.text(); // consume body
      await new Promise(r => setTimeout(r, wait));
    }

    if (!aiResponse || !aiResponse.ok) {
      const errText = aiResponse ? await aiResponse.text() : "No response";
      console.error("AI error:", aiResponse?.status, errText);

      // Mark as failed
      await supabase
        .from("links")
        .update({
          status: "failed",
          title: pageTitle || url,
          canonical_url: canonicalUrl,
          domain: finalDomain,
        })
        .eq("id", linkId);

      return new Response(JSON.stringify({ error: "AI analysis failed", status: aiResponse.status }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    let analysis;
    try {
      analysis = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      await supabase
        .from("links")
        .update({
          status: "failed",
          title: pageTitle || url,
          canonical_url: canonicalUrl,
          domain: finalDomain,
        })
        .eq("id", linkId);

      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Apply user's auto-tagging rules
    let finalTags = analysis.tags || [];
    try {
      const { data: rules } = await supabase
        .from("tagging_rules")
        .select("condition_type, condition_value, tag")
        .eq("user_id", link.user_id)
        .eq("is_active", true);

      if (rules) {
        for (const rule of rules) {
          let match = false;
          const val = rule.condition_value.toLowerCase();
          switch (rule.condition_type) {
            case "domain_contains":
              match = finalDomain.toLowerCase().includes(val);
              break;
            case "domain_equals":
              match = finalDomain.toLowerCase() === val;
              break;
            case "url_contains":
              match = url.toLowerCase().includes(val);
              break;
            case "title_contains":
              match = (analysis.clean_title || "").toLowerCase().includes(val);
              break;
          }
          if (match && !finalTags.includes(rule.tag)) {
            finalTags.push(rule.tag);
          }
        }
      }
    } catch (e) {
      console.error("Failed to apply tagging rules:", e);
    }

    // Step 4: Update link with analysis results
    const { error: updateError } = await supabase
      .from("links")
      .update({
        title: analysis.clean_title,
        summary: analysis.summary,
        tags: finalTags,
        content_type: analysis.content_type,
        key_points: analysis.key_points,
        confidence_score: Math.min(1, Math.max(0, analysis.confidence)),
        canonical_url: canonicalUrl,
        domain: finalDomain,
        status: "ready",
      })
      .eq("id", linkId);

    if (updateError) {
      console.error("Failed to update link:", updateError);
      throw updateError;
    }

    console.log("Analysis complete for:", url);

    return new Response(
      JSON.stringify({ success: true, linkId, title: analysis.clean_title }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Analysis error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
