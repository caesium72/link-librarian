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
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { messages } = await req.json();

    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid format: expected { messages: [...] }" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const urlRegex = /https?:\/\/[^\s<>"')\]]+/gi;
    let imported = 0;
    let skipped = 0;
    let total = 0;

    for (const msg of messages) {
      // Extract text from message - Telegram export format
      let text = "";
      if (typeof msg.text === "string") {
        text = msg.text;
      } else if (Array.isArray(msg.text)) {
        // Telegram exports rich text as array of strings and objects
        text = msg.text
          .map((part: unknown) => {
            if (typeof part === "string") return part;
            if (part && typeof part === "object" && "text" in (part as Record<string, unknown>)) return (part as Record<string, string>).text;
            if (part && typeof part === "object" && "href" in (part as Record<string, unknown>)) return (part as Record<string, string>).href;
            return "";
          })
          .join("");
      }

      // Extract URLs
      const urls = text.match(urlRegex);
      if (!urls || urls.length === 0) continue;

      // Also check for text_link entities in the array format
      if (Array.isArray(msg.text)) {
        for (const part of msg.text) {
          if (part && typeof part === "object" && part.type === "link" && part.href) {
            if (!urls.includes(part.href)) urls.push(part.href);
          }
          if (part && typeof part === "object" && part.type === "text_link" && part.href) {
            if (!urls.includes(part.href)) urls.push(part.href);
          }
        }
      }

      for (const rawUrl of urls) {
        total++;
        let url = rawUrl.trim().replace(/[.,;:!?)}\]]+$/, ""); // trim trailing punctuation
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
          url = "https://" + url;
        }

        let domain = "";
        try {
          domain = new URL(url).hostname;
        } catch {
          continue;
        }

        // Skip Telegram internal links
        if (domain === "t.me" || domain === "telegram.me" || domain === "telegram.org") {
          skipped++;
          continue;
        }

        // Dedup check
        const { data: existing } = await supabase
          .from("links")
          .select("id, save_count")
          .eq("user_id", userId)
          .eq("original_url", url)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("links")
            .update({ save_count: existing.save_count + 1 })
            .eq("id", existing.id);

          await supabase.from("saves").insert({
            link_id: existing.id,
            user_id: userId,
            telegram_message_id: msg.id || null,
            raw_message_text: text.substring(0, 500),
          });

          skipped++;
        } else {
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
            console.error("Insert error:", error);
            continue;
          }

          await supabase.from("saves").insert({
            link_id: newLink.id,
            user_id: userId,
            telegram_message_id: msg.id || null,
            raw_message_text: text.substring(0, 500),
          });

          // Trigger analysis (fire and forget)
          const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-link`;
          fetch(analyzeUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseServiceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ linkId: newLink.id }),
          }).catch((e) => console.error("Analysis trigger failed:", e));

          imported++;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, imported, skipped, total }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Import error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
