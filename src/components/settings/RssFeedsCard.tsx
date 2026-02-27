import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Rss, Plus, Trash2, Loader2, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

interface RssFeed {
  id: string;
  feed_url: string;
  title: string | null;
  last_fetched_at: string | null;
  last_error: string | null;
  is_active: boolean;
  created_at: string;
}

export function RssFeedsCard({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [feeds, setFeeds] = useState<RssFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [fetching, setFetching] = useState<string | null>(null);
  const [feedUrl, setFeedUrl] = useState("");

  const fetchFeeds = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("rss_feeds")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (data) setFeeds(data as RssFeed[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchFeeds();
  }, [userId]);

  const handleAdd = async () => {
    if (!feedUrl.trim()) return;
    let url = feedUrl.trim();
    if (!url.startsWith("http")) url = `https://${url}`;

    setAdding(true);
    const { error } = await supabase.from("rss_feeds").insert({
      user_id: userId,
      feed_url: url,
    });

    if (error) {
      if (error.code === "23505") {
        toast({ title: "Feed already added", variant: "destructive" });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    } else {
      setFeedUrl("");
      toast({ title: "Feed added!" });
      await fetchFeeds();
      // Immediately fetch the new feed
      const { data: newFeed } = await supabase
        .from("rss_feeds")
        .select("id")
        .eq("user_id", userId)
        .eq("feed_url", url)
        .single();
      if (newFeed) {
        handleFetchFeed(newFeed.id);
      }
    }
    setAdding(false);
  };

  const handleFetchFeed = async (feedId: string) => {
    setFetching(feedId);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-rss", {
        body: { feedId, userId },
      });
      if (error) throw error;
      toast({
        title: "Feed synced!",
        description: `${data?.newLinks || 0} new link${data?.newLinks !== 1 ? "s" : ""} added.`,
      });
      fetchFeeds();
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    } finally {
      setFetching(null);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await supabase.from("rss_feeds").update({ is_active: !isActive }).eq("id", id);
    setFeeds((prev) => prev.map((f) => (f.id === id ? { ...f, is_active: !isActive } : f)));
  };

  const handleDelete = async (id: string) => {
    await supabase.from("rss_feeds").delete().eq("id", id);
    setFeeds((prev) => prev.filter((f) => f.id !== id));
    toast({ title: "Feed removed" });
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "Never";
    const d = new Date(iso);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return `${Math.floor(diffH / 24)}d ago`;
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-mono text-base">
          <Rss className="h-4 w-4" />
          RSS Feeds
        </CardTitle>
        <CardDescription className="text-sm">
          Subscribe to RSS feeds to automatically save new articles.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add feed */}
        <div className="flex gap-2">
          <Input
            placeholder="https://example.com/feed.xml"
            value={feedUrl}
            onChange={(e) => setFeedUrl(e.target.value)}
            className="font-mono text-sm h-9"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={adding || !feedUrl.trim()}
            className="font-mono gap-1.5 h-9 shrink-0"
          >
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add
          </Button>
        </div>

        {/* Feed list */}
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : feeds.length === 0 ? (
          <p className="text-sm text-muted-foreground font-mono text-center py-3">
            No feeds yet. Add an RSS/Atom feed URL above.
          </p>
        ) : (
          <div className="space-y-2">
            {feeds.map((feed) => (
              <div
                key={feed.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  feed.is_active ? "border-border" : "border-border/50 opacity-60"
                }`}
              >
                <Switch
                  checked={feed.is_active}
                  onCheckedChange={() => handleToggle(feed.id, feed.is_active)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-medium truncate">
                    {feed.title || feed.feed_url}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {feed.last_error ? (
                      <span className="text-[10px] text-destructive font-mono flex items-center gap-1">
                        <AlertCircle className="h-2.5 w-2.5" />
                        {feed.last_error}
                      </span>
                    ) : feed.last_fetched_at ? (
                      <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Synced {formatTime(feed.last_fetched_at)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground font-mono">Not yet synced</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  disabled={fetching === feed.id}
                  onClick={() => handleFetchFeed(feed.id)}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${fetching === feed.id ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                  onClick={() => handleDelete(feed.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
