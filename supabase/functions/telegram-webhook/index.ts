import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const message = body?.message;

    if (!message) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const text = message.text || message.caption || "";
    const chatId = message.chat?.id;
    const messageId = message.message_id;

    // Extract URLs from message text and entities
    const urls: string[] = [];
    
    if (message.entities) {
      for (const entity of message.entities) {
        if (entity.type === "url") {
          urls.push(text.substring(entity.offset, entity.offset + entity.length));
        } else if (entity.type === "text_link" && entity.url) {
          urls.push(entity.url);
        }
      }
    }

    // Also check caption_entities for media messages
    if (message.caption_entities) {
      const captionText = message.caption || "";
      for (const entity of message.caption_entities) {
        if (entity.type === "url") {
          urls.push(captionText.substring(entity.offset, entity.offset + entity.length));
        } else if (entity.type === "text_link" && entity.url) {
          urls.push(entity.url);
        }
      }
    }

    // Fallback: regex extract URLs if no entities found
    if (urls.length === 0) {
      const urlRegex = /https?:\/\/[^\s<>\"']+/gi;
      const matches = text.match(urlRegex);
      if (matches) urls.push(...matches);
    }

    if (urls.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No URLs found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to bypass RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the first user (single-user app)
    const { data: users } = await supabase.auth.admin.listUsers();
    const userId = users?.users?.[0]?.id;

    if (!userId) {
      console.error("No user found in the system");
      return new Response(JSON.stringify({ ok: true, error: "No user configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const rawUrl of urls) {
      // Normalize URL
      let url = rawUrl.trim();
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
      }

      // Extract domain
      let domain = "";
      try {
        domain = new URL(url).hostname;
      } catch { /* ignore */ }

      // Check for existing link (dedup)
      const { data: existing } = await supabase
        .from("links")
        .select("id, save_count")
        .eq("user_id", userId)
        .eq("original_url", url)
        .maybeSingle();

      let linkId: string;

      if (existing) {
        // Increment save count
        await supabase
          .from("links")
          .update({ save_count: existing.save_count + 1 })
          .eq("id", existing.id);
        linkId = existing.id;
      } else {
        // Create new link
        const { data: newLink, error } = await supabase
          .from("links")
          .insert({
            user_id: userId,
            original_url: url,
            domain,
            status: "pending",
          })
          .select("id")
          .single();

        if (error) {
          console.error("Error creating link:", error);
          continue;
        }
        linkId = newLink.id;
      }

      // Create save record
      await supabase.from("saves").insert({
        link_id: linkId,
        user_id: userId,
        telegram_message_id: messageId,
        telegram_chat_id: chatId,
        raw_message_text: text,
      });

      results.push({ url, linkId, isNew: !existing });

      // Trigger analysis for new links
      if (!existing) {
        // Call analyze-link function asynchronously
        try {
          const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-link`;
          fetch(analyzeUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseServiceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ linkId }),
          }).catch(e => console.error("Failed to trigger analysis:", e));
        } catch (e) {
          console.error("Failed to trigger analysis:", e);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ ok: true, error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
