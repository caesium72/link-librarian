import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, Smartphone, LogOut, Loader2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";

interface SessionRow {
  id: string;
  session_token: string;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  last_active_at: string;
  created_at: string;
  is_current: boolean;
}

interface Props {
  session: Session | null;
  onSignedOut: () => void;
}

export function ActiveSessionsCard({ session, onSignedOut }: Props) {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const currentToken = session?.access_token?.slice(-16) ?? "";

  const fetchSessions = async () => {
    if (!session) return;
    setLoading(true);
    const { data } = await supabase
      .from("user_sessions")
      .select("*")
      .eq("user_id", session.user.id)
      .order("last_active_at", { ascending: false });

    if (data) {
      setSessions(
        data.map((s: any) => ({
          ...s,
          is_current: s.session_token === currentToken,
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSessions();
  }, [session]);

  const handleRevokeSession = async (id: string) => {
    setRevokingId(id);
    try {
      await supabase.from("user_sessions").delete().eq("id", id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast({ title: "Session removed" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setRevokingId(null);
    }
  };

  const handleSignOutCurrent = async () => {
    try {
      if (currentToken) {
        await supabase.from("user_sessions").delete().eq("session_token", currentToken);
      }
      await supabase.auth.signOut({ scope: "local" });
      onSignedOut();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleSignOutAll = async () => {
    try {
      if (session) {
        await supabase.from("user_sessions").delete().eq("user_id", session.user.id);
      }
      await supabase.auth.signOut({ scope: "global" });
      onSignedOut();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleSignOutOthers = async () => {
    try {
      if (session) {
        await supabase
          .from("user_sessions")
          .delete()
          .eq("user_id", session.user.id)
          .neq("session_token", currentToken);
      }
      const { error } = await supabase.auth.signOut({ scope: "others" as any });
      if (error) throw error;
      setSessions((prev) => prev.filter((s) => s.is_current));
      toast({ title: "Signed out from all other devices" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d ago`;
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-mono text-base">
          <Monitor className="h-4 w-4" />
          Active Sessions
        </CardTitle>
        <CardDescription className="text-sm">
          Devices where you're currently signed in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground font-mono">No tracked sessions.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  s.is_current
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-center h-9 w-9 rounded-full bg-muted">
                  {s.device_type === "mobile" ? (
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Monitor className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-medium truncate">
                    {s.browser ?? "Unknown"} on {s.os ?? "Unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {s.is_current ? "This device · " : ""}
                    Last active {formatTime(s.last_active_at)}
                  </p>
                </div>
                {s.is_current ? (
                  <span className="text-xs text-primary font-mono px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 shrink-0">
                    Current
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-destructive hover:text-destructive font-mono gap-1.5"
                    disabled={revokingId === s.id}
                    onClick={() => handleRevokeSession(s.id)}
                  >
                    {revokingId === s.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <LogOut className="h-3.5 w-3.5" />
                    )}
                    Sign out
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Bulk actions */}
        <div className="pt-2 border-t border-border space-y-2">
          <Button
            variant="default"
            className="font-mono gap-2 w-full"
            onClick={handleSignOutOthers}
            disabled={sessions.filter((s) => !s.is_current).length === 0}
          >
            <LogOut className="h-4 w-4" />
            Sign out all other devices
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="font-mono gap-2"
              onClick={handleSignOutCurrent}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out this device
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="font-mono gap-2"
              onClick={handleSignOutAll}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out everywhere
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
