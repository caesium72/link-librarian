import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { url, title } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check for duplicate
    const { data: existing } = await serviceClient
      .from("links")
      .select("id, duplicate_count")
      .eq("user_id", user.id)
      .eq("original_url", url)
      .maybeSingle();

    if (existing) {
      // Increment duplicate_count on existing link
      await serviceClient
        .from("links")
        .update({ duplicate_count: (existing.duplicate_count || 0) + 1 })
        .eq("id", existing.id);

      return new Response(
        JSON.stringify({ success: true, id: existing.id, duplicate: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert link
    const { data: link, error: insertError } = await serviceClient
      .from("links")
      .insert({
        user_id: user.id,
        original_url: url,
        title: title || null,
        status: "pending",
        domain: (() => {
          try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
        })(),
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    // Trigger analysis (fire-and-forget)
    fetch(`${supabaseUrl}/functions/v1/analyze-link`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ linkId: link.id }),
    }).catch(() => {});

    return new Response(
      JSON.stringify({ success: true, id: link.id, duplicate: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
