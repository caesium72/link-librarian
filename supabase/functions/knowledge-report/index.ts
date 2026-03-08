import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    // Fetch user's links from the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentLinks } = await supabase
      .from("links")
      .select("title, tags, domain, content_type, is_read, created_at, reading_time_estimate, summary")
      .eq("user_id", user.id)
      .gte("created_at", thirtyDaysAgo)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);

    // Fetch all links for broader analysis
    const { data: allLinks } = await supabase
      .from("links")
      .select("tags, domain, content_type, is_read")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .limit(1000);

    // Fetch reading streaks
    const { data: streaks } = await supabase
      .from("reading_streaks")
      .select("date, links_read, reading_minutes")
      .eq("user_id", user.id)
      .gte("date", thirtyDaysAgo)
      .order("date", { ascending: false });

    // Build context for AI
    const links = recentLinks || [];
    const all = allLinks || [];
    const readingData = streaks || [];

    const tagFrequency: Record<string, number> = {};
    const domainFrequency: Record<string, number> = {};
    const contentTypes: Record<string, number> = {};
    let readCount = 0;
    let unreadCount = 0;

    for (const link of all) {
      if (link.is_read) readCount++;
      else unreadCount++;
      for (const tag of (link.tags || [])) {
        tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
      }
      if (link.domain) domainFrequency[link.domain] = (domainFrequency[link.domain] || 0) + 1;
      if (link.content_type) contentTypes[link.content_type] = (contentTypes[link.content_type] || 0) + 1;
    }

    const recentTagFreq: Record<string, number> = {};
    for (const link of links) {
      for (const tag of (link.tags || [])) {
        recentTagFreq[tag] = (recentTagFreq[tag] || 0) + 1;
      }
    }

    const topTags = Object.entries(tagFrequency).sort((a, b) => b[1] - a[1]).slice(0, 15);
    const topDomains = Object.entries(domainFrequency).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topContentTypes = Object.entries(contentTypes).sort((a, b) => b[1] - a[1]);
    const recentTopTags = Object.entries(recentTagFreq).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const totalReadingMinutes = readingData.reduce((sum, s) => sum + s.reading_minutes, 0);
    const totalLinksRead = readingData.reduce((sum, s) => sum + s.links_read, 0);

    const recentTitles = links.slice(0, 20).map(l => l.title || "Untitled").join(", ");

    const prompt = `You are a knowledge analyst. Generate a comprehensive weekly knowledge report for a user based on their reading and saving data.

DATA SUMMARY:
- Total links in library: ${all.length}
- Links saved in last 30 days: ${links.length}
- Read: ${readCount}, Unread: ${unreadCount} (completion rate: ${all.length > 0 ? Math.round((readCount / all.length) * 100) : 0}%)
- Reading minutes (last 30 days): ${totalReadingMinutes}
- Links read (last 30 days): ${totalLinksRead}

TOP TAGS (all time): ${topTags.map(([t, c]) => `${t}(${c})`).join(", ")}
RECENT TAGS (30 days): ${recentTopTags.map(([t, c]) => `${t}(${c})`).join(", ")}
TOP DOMAINS: ${topDomains.map(([d, c]) => `${d}(${c})`).join(", ")}
CONTENT TYPES: ${topContentTypes.map(([t, c]) => `${t}(${c})`).join(", ")}
RECENT TITLES: ${recentTitles}

Generate a report with EXACTLY these sections using markdown headers:

## 📊 Weekly Summary
A brief overview of activity, pace, and engagement.

## 🔥 Trending Topics
What topics have been most active recently. Note any emerging interests.

## 🧠 Knowledge Strengths
Areas where the user has deep coverage and expertise.

## ⚠️ Knowledge Gaps
Topics that are underexplored or missing connections. Suggest related areas they should explore.

## 💡 Recommended Topics
5 specific new topics or subjects to explore next, based on their interests. For each, explain WHY it connects to their existing knowledge.

## 📈 Reading Habits
Analysis of reading pace, completion rate, and suggestions for improvement.

Keep the tone encouraging, insightful, and actionable. Use bullet points and be specific with data references. Keep the total report under 600 words.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a knowledge analyst that creates insightful, data-driven reports about someone's reading and learning patterns." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error("Failed to generate report");
    }

    const aiData = await aiResponse.json();
    const report = aiData.choices?.[0]?.message?.content || "Unable to generate report.";

    return new Response(JSON.stringify({
      report,
      stats: {
        totalLinks: all.length,
        recentLinks: links.length,
        readCount,
        unreadCount,
        completionRate: all.length > 0 ? Math.round((readCount / all.length) * 100) : 0,
        totalReadingMinutes,
        totalLinksRead,
        topTags: topTags.slice(0, 5),
      },
      generatedAt: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("knowledge-report error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
