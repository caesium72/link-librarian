import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const serviceClient = createClient(supabaseUrl, serviceKey);

    // Get optional linkId from body for single-link check
    let linkId: string | null = null;
    try {
      const body = await req.json();
      linkId = body?.linkId || null;
    } catch { /* no body = check all */ }

    // Fetch links to check
    let query = serviceClient
      .from("links")
      .select("id, original_url, health_status, last_health_check")
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (linkId) {
      query = query.eq("id", linkId);
    } else {
      // Only check links not checked in last 24 hours
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.or(`last_health_check.is.null,last_health_check.lt.${cutoff}`)
        .limit(50); // Batch of 50 at a time
    }

    const { data: links, error: fetchError } = await query;
    if (fetchError) throw fetchError;
    if (!links || links.length === 0) {
      return new Response(JSON.stringify({ checked: 0, message: "No links to check" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let healthy = 0;
    let broken = 0;
    let errors = 0;

    // Check each link
    const results = await Promise.allSettled(
      links.map(async (link) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);

          const response = await fetch(link.original_url, {
            method: "HEAD",
            signal: controller.signal,
            redirect: "follow",
            headers: { "User-Agent": "Xenonowledge-HealthCheck/1.0" },
          });
          clearTimeout(timeout);

          const statusCode = response.status;
          let healthStatus: string;

          if (statusCode >= 200 && statusCode < 400) {
            healthStatus = "healthy";
            healthy++;
          } else if (statusCode === 404 || statusCode === 410) {
            healthStatus = "broken";
            broken++;
          } else if (statusCode >= 400) {
            healthStatus = "broken";
            broken++;
          } else {
            healthStatus = "unknown";
            errors++;
          }

          await serviceClient
            .from("links")
            .update({
              health_status: healthStatus,
              health_status_code: statusCode,
              last_health_check: new Date().toISOString(),
            })
            .eq("id", link.id);

          return { id: link.id, status: healthStatus, code: statusCode };
        } catch (err) {
          errors++;
          // Network error / timeout = broken
          await serviceClient
            .from("links")
            .update({
              health_status: "broken",
              health_status_code: 0,
              last_health_check: new Date().toISOString(),
            })
            .eq("id", link.id);

          return { id: link.id, status: "broken", code: 0, error: String(err) };
        }
      })
    );

    return new Response(
      JSON.stringify({ checked: links.length, healthy, broken, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
