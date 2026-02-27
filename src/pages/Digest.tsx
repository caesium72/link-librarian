import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRequireAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  TrendingUp,
  BookOpen,
  Eye,
  HeartCrack,
  Mail,
  RefreshCw,
  ExternalLink,
  BarChart3,
  Tag,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DigestData {
  period: string;
  since: string;
  stats: {
    totalLinks: number;
    newLinksCount: number;
    unreadCount: number;
    brokenCount: number;
  };
  newLinks: Array<{
    id: string;
    title: string;
    original_url: string;
    domain: string;
    content_type: string;
    tags: string[];
    summary: string;
    created_at: string;
  }>;
  trendingTags: Array<{ tag: string; count: number }>;
  contentTypeCounts: Record<string, number>;
  topDomains: Array<{ domain: string; count: number }>;
  brokenLinks: Array<{
    id: string;
    title: string;
    original_url: string;
    domain: string;
    health_status_code: number;
  }>;
}

const contentTypeColors: Record<string, string> = {
  article: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  video: "bg-chart-4/15 text-chart-4 border-chart-4/30",
  repo: "bg-primary/15 text-primary border-primary/30",
  docs: "bg-chart-3/15 text-chart-3 border-chart-3/30",
  tool: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  thread: "bg-chart-5/15 text-chart-5 border-chart-5/30",
  other: "bg-muted text-muted-foreground border-border",
};

export default function Digest() {
  const { user, loading: authLoading } = useRequireAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [period, setPeriod] = useState<"daily" | "weekly">("weekly");
  const [sendingEmail, setSendingEmail] = useState(false);

  const { data: digest, isLoading, refetch } = useQuery<DigestData>({
    queryKey: ["digest", period],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-digest", {
        body: { period },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Load user digest settings
  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ["digest-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_settings")
        .select("digest_enabled, digest_frequency")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const handleToggleDigest = async (enabled: boolean) => {
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: user!.id, digest_enabled: enabled, digest_frequency: period } as any, { onConflict: "user_id" });
    if (!error) {
      refetchSettings();
      toast({ title: enabled ? "Digest enabled" : "Digest disabled" });
    }
  };

  const handleFrequencyChange = async (freq: string) => {
    setPeriod(freq as "daily" | "weekly");
    if (settings?.digest_enabled) {
      await supabase
        .from("user_settings")
        .update({ digest_frequency: freq } as any)
        .eq("user_id", user!.id);
      refetchSettings();
    }
  };

  const handleSendDigest = async () => {
    setSendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-digest");
      if (error) throw error;
      toast({ title: "Digest sent!", description: `Email sent to ${user?.email}` });
    } catch (e: any) {
      toast({ title: "Failed to send", description: e.message, variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="font-mono text-muted-foreground animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold font-mono">📊 Digest</h1>
              <p className="text-xs text-muted-foreground font-mono">Your link activity summary</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={handleFrequencyChange}>
              <SelectTrigger className="w-28 h-8 text-xs font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()}>
              <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            </Button>
            <ThemeToggle />
          </div>
        </div>

        {/* Email digest toggle */}
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-primary" />
              <div>
                <Label className="text-sm font-medium">Email Digest</Label>
                <p className="text-xs text-muted-foreground">Receive {period} summaries via email</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={settings?.digest_enabled || false}
                onCheckedChange={handleToggleDigest}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs font-mono gap-1.5"
                onClick={handleSendDigest}
                disabled={sendingEmail}
              >
                <Mail className="h-3 w-3" />
                {sendingEmail ? "Sending..." : "Send Now"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : digest ? (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={BookOpen} label="New Links" value={digest.stats.newLinksCount} color="text-primary" />
              <StatCard icon={Eye} label="Unread" value={digest.stats.unreadCount} color="text-chart-3" />
              <StatCard icon={BarChart3} label="Total Library" value={digest.stats.totalLinks} color="text-chart-2" />
              <StatCard icon={HeartCrack} label="Broken" value={digest.stats.brokenCount} color="text-destructive" />
            </div>

            {/* Trending Tags & Content Types */}
            <div className="grid md:grid-cols-2 gap-4">
              {digest.trendingTags.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-mono flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Trending Tags
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {digest.trendingTags.map(({ tag, count }) => (
                      <div key={tag} className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs font-mono">{tag}</Badge>
                        <span className="text-xs text-muted-foreground font-mono">{count}×</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {Object.keys(digest.contentTypeCounts).length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-mono flex items-center gap-2">
                      <Tag className="h-4 w-4 text-primary" />
                      Content Types
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(digest.contentTypeCounts).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <Badge variant="outline" className={cn("text-xs font-mono", contentTypeColors[type])}>
                          {type}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">{count}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Top Domains */}
            {digest.topDomains.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    Top Domains
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {digest.topDomains.map(({ domain, count }) => (
                      <div key={domain} className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-1.5">
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
                          alt="" className="h-4 w-4"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        <span className="text-xs font-mono">{domain}</span>
                        <span className="text-[10px] text-muted-foreground">({count})</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recently Saved Links */}
            {digest.newLinks.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    Recently Saved
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {digest.newLinks.map((link) => (
                    <div key={link.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors group">
                      {link.domain && (
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${link.domain}&sz=16`}
                          alt="" className="h-4 w-4 mt-0.5 shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <a
                          href={link.original_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium hover:text-primary transition-colors truncate block"
                        >
                          {link.title || link.original_url}
                        </a>
                        {link.summary && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{link.summary}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1">
                          {link.content_type && link.content_type !== "other" && (
                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 font-mono", contentTypeColors[link.content_type])}>
                              {link.content_type}
                            </Badge>
                          )}
                          {link.tags?.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                      <a href={link.original_url} target="_blank" rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                      </a>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Broken Links */}
            {digest.brokenLinks.length > 0 && (
              <Card className="border-destructive/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono flex items-center gap-2 text-destructive">
                    <HeartCrack className="h-4 w-4" />
                    Broken Links
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {digest.brokenLinks.map((link) => (
                    <div key={link.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-destructive/5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono text-destructive shrink-0">
                          {link.health_status_code || "ERR"}
                        </span>
                        <a
                          href={link.original_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm truncate hover:text-primary transition-colors"
                        >
                          {link.title || link.original_url}
                        </a>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-1">
        <Icon className={cn("h-5 w-5", color)} />
        <span className="text-2xl font-bold font-mono">{value}</span>
        <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{label}</span>
      </CardContent>
    </Card>
  );
}
