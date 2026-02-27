import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

function getBrowserName() {
  const ua = navigator.userAgent;
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  return "Browser";
}

function getOSName() {
  const ua = navigator.userAgent;
  if (ua.includes("Win")) return "Windows";
  if (ua.includes("Mac")) return "macOS";
  if (ua.includes("Linux")) return "Linux";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  return "Unknown";
}

function getDeviceType() {
  return /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop";
}

/**
 * Tracks the current auth session in user_sessions table.
 * Call once at app root level.
 */
export function useSessionTracker() {
  const trackSession = useCallback(async (session: Session | null) => {
    if (!session) return;

    const token = session.access_token.slice(-16); // use last 16 chars as identifier
    const browser = getBrowserName();
    const os = getOSName();
    const deviceType = getDeviceType();

    // Upsert session record
    await supabase
      .from("user_sessions")
      .upsert(
        {
          user_id: session.user.id,
          session_token: token,
          browser,
          os,
          device_type: deviceType,
          last_active_at: new Date().toISOString(),
        },
        { onConflict: "session_token" }
      );
  }, []);

  useEffect(() => {
    // Track on initial load
    supabase.auth.getSession().then(({ data: { session } }) => {
      trackSession(session);
    });

    // Track on auth state changes (sign in, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          trackSession(session);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [trackSession]);
}
