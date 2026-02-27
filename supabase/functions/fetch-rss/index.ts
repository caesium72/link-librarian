import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple XML parser for RSS/Atom feeds
function extractItems(xml: string): { title: string; url: string; published?: string }[] {
  const items: { title: string; url: string; published?: string }[] = [];

  // Try RSS <item> elements
  const rssItems = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const item of rssItems) {
    const titleMatch = item.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const linkMatch = item.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    const guidMatch = item.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
    const pubDateMatch = item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);

    const url = (linkMatch?.[1] || guidMatch?.[1] || "").trim();
    const title = (titleMatch?.[1] || "").trim();
    if (url && url.startsWith("http")) {
      items.push({ title, url, published: pubDateMatch?.[1]?.trim() });
    }
  }

  // Try Atom <entry> elements if no RSS items found
  if (items.length === 0) {
    const atomEntries = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
    for (const entry of atomEntries) {
      const titleMatch = entry.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const linkMatch = entry.match(/<link[^>]*href=["']([^"']+)["']/i);
      const updatedMatch = entry.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
      const publishedMatch = entry.match(/<published[^>]*>([\s\S]*?)<\/published>/i);

      const url = (linkMatch?.[1] || "").trim();
      const title = (titleMatch?.[1] || "").trim();
      if (url && url.startsWith("http")) {
        items.push({ title, url, published: (publishedMatch?.[1] || updatedMatch?.[1] || "").trim() });
      }
    }
  }

  return items;
}

function extractFeedTitle(xml: string): string {
  // For RSS
  const channelTitle = xml.match(/<channel[\s>][\s\S]*?<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
  if (channelTitle?.[1]) return channelTitle[1].trim();
  // For Atom
  const atomTitle = xml.match(/<feed[\s>][\s\S]*?<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
  if (atomTitle?.[1]) return atomTitle[1].trim();
  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { feedId, userId } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If feedId provided, fetch single feed; otherwise fetch all active feeds for user
    let feeds: any[] = [];
    if (feedId) {
      const { data, error } = await supabase
        .from("rss_feeds")
        .select("*")
        .eq("id", feedId)
        .single();
      if (error || !data) {
        return new Response(JSON.stringify({ error: "Feed not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      feeds = [data];
    } else if (userId) {
      const { data } = await supabase
        .from("rss_feeds")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true);
      feeds = data || [];
    } else {
      // Fetch all active feeds (for cron)
      const { data } = await supabase
        .from("rss_feeds")
        .select("*")
        .eq("is_active", true);
      feeds = data || [];
    }

    let totalNew = 0;

    for (const feed of feeds) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(feed.feed_url, {
          headers: { "User-Agent": "LinkLibrarian/1.0 RSS Reader" },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          await supabase
            .from("rss_feeds")
            .update({ last_error: `HTTP ${response.status}`, last_fetched_at: new Date().toISOString() })
            .eq("id", feed.id);
          continue;
        }

        const xml = await response.text();
        const items = extractItems(xml);
        const feedTitle = extractFeedTitle(xml);

        // Update feed title if we got one
        if (feedTitle && !feed.title) {
          await supabase.from("rss_feeds").update({ title: feedTitle }).eq("id", feed.id);
        }

        // Only process items newer than last fetch
        let newItems = items;
        if (feed.last_fetched_at) {
          const lastFetch = new Date(feed.last_fetched_at).getTime();
          newItems = items.filter((item) => {
            if (!item.published) return true; // If no date, assume new
            try {
              return new Date(item.published).getTime() > lastFetch;
            } catch {
              return true;
            }
          });
        }

        // Limit to 20 items per fetch to avoid overwhelming
        newItems = newItems.slice(0, 20);

        for (const item of newItems) {
          try {
            // Extract domain
            let domain = "";
            try { domain = new URL(item.url).hostname; } catch {}

            // Check for existing link
            const { data: existing } = await supabase
              .from("links")
              .select("id")
              .eq("user_id", feed.user_id)
              .eq("original_url", item.url)
              .maybeSingle();

            if (existing) {
              // Duplicate - increment count
              await supabase
                .from("links")
                .update({ duplicate_count: (existing as any).duplicate_count ? (existing as any).duplicate_count + 1 : 1 })
                .eq("id", existing.id);
              continue;
            }

            // Insert new link
            const { data: newLink, error: insertError } = await supabase
              .from("links")
              .insert({
                user_id: feed.user_id,
                original_url: item.url,
                title: item.title || null,
                domain,
                status: "pending",
              })
              .select("id")
              .single();

            if (insertError) {
              console.error("Failed to insert link:", insertError);
              continue;
            }

            totalNew++;

            // Trigger analysis
            try {
              await fetch(`${supabaseUrl}/functions/v1/analyze-link`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({ linkId: newLink.id }),
              });
            } catch (e) {
              console.error("Failed to trigger analysis:", e);
            }
          } catch (e) {
            console.error("Failed to process item:", e);
          }
        }

        // Update feed status
        await supabase
          .from("rss_feeds")
          .update({ last_fetched_at: new Date().toISOString(), last_error: null })
          .eq("id", feed.id);

      } catch (e) {
        console.error(`Failed to fetch feed ${feed.feed_url}:`, e);
        await supabase
          .from("rss_feeds")
          .update({
            last_error: e instanceof Error ? e.message : "Unknown error",
            last_fetched_at: new Date().toISOString(),
          })
          .eq("id", feed.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, feedsProcessed: feeds.length, newLinks: totalNew }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("RSS fetch error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
