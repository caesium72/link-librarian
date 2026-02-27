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
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500, headers: corsHeaders,
      });
    }

    // This can be called by cron (no auth) or manually (with auth)
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceKey);

    let userId: string | null = null;
    let userEmail: string | null = null;

    // If auth header present, send for that user only
    if (authHeader?.startsWith("Bearer ")) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        userId = user.id;
        userEmail = user.email || null;
      }
    }

    // Get users who have digest enabled
    let usersToDigest: { user_id: string; digest_frequency: string }[] = [];

    if (userId) {
      // Manual trigger for single user
      const { data: settings } = await serviceClient
        .from("user_settings")
        .select("user_id, digest_frequency")
        .eq("user_id", userId)
        .maybeSingle();
      if (settings) {
        usersToDigest = [{ user_id: settings.user_id, digest_frequency: settings.digest_frequency || "weekly" }];
      } else {
        usersToDigest = [{ user_id: userId, digest_frequency: "weekly" }];
      }
    } else {
      // Cron: get all users with digest enabled
      const { data: settings } = await serviceClient
        .from("user_settings")
        .select("user_id, digest_frequency, last_digest_sent_at")
        .eq("digest_enabled", true);
      usersToDigest = (settings || []).filter((s: any) => {
        if (!s.last_digest_sent_at) return true;
        const hoursSince = (Date.now() - new Date(s.last_digest_sent_at).getTime()) / (1000 * 60 * 60);
        return s.digest_frequency === "daily" ? hoursSince >= 20 : hoursSince >= 160;
      });
    }

    let sent = 0;

    for (const userSetting of usersToDigest) {
      try {
        // Get user email
        let email = userEmail;
        if (!email) {
          const { data: { users } } = await serviceClient.auth.admin.listUsers();
          const u = users?.find((u: any) => u.id === userSetting.user_id);
          email = u?.email || null;
        }
        if (!email) continue;

        // Generate digest data
        const daysBack = userSetting.digest_frequency === "daily" ? 1 : 7;
        const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

        const { data: newLinks } = await serviceClient
          .from("links")
          .select("title, original_url, domain, content_type, tags, summary")
          .eq("user_id", userSetting.user_id)
          .is("deleted_at", null)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(20);

        const { data: allLinks } = await serviceClient
          .from("links")
          .select("is_read, health_status, tags")
          .eq("user_id", userSetting.user_id)
          .is("deleted_at", null);

        const unreadCount = (allLinks || []).filter((l: any) => !l.is_read).length;
        const brokenCount = (allLinks || []).filter((l: any) => l.health_status === "broken").length;

        // Trending tags
        const tagCounts: Record<string, number> = {};
        (newLinks || []).forEach((l: any) => {
          (l.tags || []).forEach((tag: string) => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        });
        const trendingTags = Object.entries(tagCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);

        const periodLabel = userSetting.digest_frequency === "daily" ? "Daily" : "Weekly";

        // Build HTML email
        const linksHtml = (newLinks || []).slice(0, 10).map((l: any) => `
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
              <a href="${l.original_url}" style="color: #6d28d9; text-decoration: none; font-weight: 500;">${l.title || l.original_url}</a>
              <br/>
              <span style="color: #888; font-size: 12px;">${l.domain || ""} ${l.content_type ? `• ${l.content_type}` : ""}</span>
              ${l.summary ? `<br/><span style="color: #666; font-size: 13px;">${l.summary.slice(0, 120)}...</span>` : ""}
            </td>
          </tr>
        `).join("");

        const tagsHtml = trendingTags.map(([tag, count]) =>
          `<span style="display: inline-block; background: #f3e8ff; color: #6d28d9; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin: 2px 4px;">${tag} (${count})</span>`
        ).join("");

        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 4px;">📊 Your ${periodLabel} Digest</h1>
            <p style="color: #888; font-size: 14px; margin-top: 0;">Xenonowledge Link Library</p>
            
            <div style="display: flex; gap: 12px; margin: 20px 0;">
              <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; flex: 1; text-align: center;">
                <div style="font-size: 24px; font-weight: 700; color: #6d28d9;">${(newLinks || []).length}</div>
                <div style="font-size: 12px; color: #888;">New Links</div>
              </div>
              <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; flex: 1; text-align: center;">
                <div style="font-size: 24px; font-weight: 700; color: #f59e0b;">${unreadCount}</div>
                <div style="font-size: 12px; color: #888;">Unread</div>
              </div>
              <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; flex: 1; text-align: center;">
                <div style="font-size: 24px; font-weight: 700; color: #ef4444;">${brokenCount}</div>
                <div style="font-size: 12px; color: #888;">Broken</div>
              </div>
            </div>

            ${trendingTags.length > 0 ? `
              <h2 style="color: #1a1a1a; font-size: 16px; margin-top: 24px;">🔥 Trending Tags</h2>
              <div style="margin-bottom: 20px;">${tagsHtml}</div>
            ` : ""}

            ${(newLinks || []).length > 0 ? `
              <h2 style="color: #1a1a1a; font-size: 16px;">📎 Recently Saved</h2>
              <table style="width: 100%; border-collapse: collapse;">${linksHtml}</table>
            ` : "<p style='color: #888;'>No new links this period.</p>"}
          </div>
        `;

        // Send via Resend
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Xenonowledge <digest@resend.dev>",
            to: [email],
            subject: `${periodLabel} Digest: ${(newLinks || []).length} new links, ${unreadCount} unread`,
            html,
          }),
        });

        if (resendRes.ok) {
          sent++;
          // Update last sent timestamp
          await serviceClient
            .from("user_settings")
            .update({ last_digest_sent_at: new Date().toISOString() })
            .eq("user_id", userSetting.user_id);
        } else {
          const err = await resendRes.text();
          console.error(`Failed to send to ${email}:`, err);
        }
      } catch (err) {
        console.error(`Error processing user ${userSetting.user_id}:`, err);
      }
    }

    return new Response(JSON.stringify({ sent, total: usersToDigest.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
