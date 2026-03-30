import { useRequireAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link as RouterLink } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Progress } from "@/components/ui/progress";
import {
  Library, BookOpen, BookCheck, Clock, TrendingUp, Plus, Search,
  ArrowRight, Sparkles, BarChart3, Brain, FolderOpen,
  Flame, Calendar, ExternalLink, Settings, Compass
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow, subDays, format, startOfDay } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { LinksOverTimeChart, ContentTypePieChart, DayOfWeekRadar, ActivityHeatmap } from "@/components/dashboard/DashboardCharts";
import { DiscoverCategoryChart, MiniDiscoverWidget, TrendingTopicsCloud } from "@/components/dashboard/DiscoverWidgets";
import { AddLinkInput } from "@/components/AddLinkInput";

export default function Dashboard() {
  const { user, signOut, loading: authLoading } = useRequireAuth();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const now = new Date();
      const thirtyDaysAgo = subDays(now, 30).toISOString();
      const sevenDaysAgo = subDays(now, 7).toISOString();

      const [allLinks, recentLinks, readLinks, collections, streaks] = await Promise.all([
        supabase.from("links").select("id, status, is_read, content_type, tags, created_at, reading_time_estimate", { count: "exact" }).is("deleted_at", null),
        supabase.from("links").select("id", { count: "exact" }).is("deleted_at", null).gte("created_at", thirtyDaysAgo),
        supabase.from("links").select("id", { count: "exact" }).is("deleted_at", null).eq("is_read", true),
        supabase.from("collections").select("id", { count: "exact" }),
        supabase.from("reading_streaks").select("*").gte("date", subDays(now, 7).toISOString().split("T")[0]).order("date", { ascending: false }),
      ]);

      const links = allLinks.data || [];
      const totalLinks = allLinks.count || 0;
      const recentCount = recentLinks.count || 0;
      const readCount = readLinks.count || 0;
      const collectionsCount = collections.count || 0;
      const pendingCount = links.filter(l => l.status === "pending").length;
      const failedCount = links.filter(l => l.status === "failed").length;

      // Reading time
      const totalReadingMin = links.reduce((sum, l) => sum + (l.reading_time_estimate || 0), 0);

      // Tag frequency
      const tagMap: Record<string, number> = {};
      links.forEach(l => (l.tags || []).forEach((t: string) => { tagMap[t] = (tagMap[t] || 0) + 1; }));
      const topTags = Object.entries(tagMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

      // Content type distribution
      const typeMap: Record<string, number> = {};
      links.forEach(l => { const t = l.content_type || "other"; typeMap[t] = (typeMap[t] || 0) + 1; });
      const contentTypes = Object.entries(typeMap).sort((a, b) => b[1] - a[1]);

      // Streak
      const streakData = streaks.data || [];
      let currentStreak = 0;
      const today = startOfDay(now);
      for (let i = 0; i < 30; i++) {
        const checkDate = format(subDays(today, i), "yyyy-MM-dd");
        const found = streakData.find((s: any) => s.date === checkDate);
        if (found && found.links_read > 0) currentStreak++;
        else if (i > 0) break;
      }

      // Completion rate
      const completionRate = totalLinks > 0 ? Math.round((readCount / totalLinks) * 100) : 0;

      // Week-over-week
      const thisWeekLinks = links.filter(l => new Date(l.created_at) >= new Date(sevenDaysAgo)).length;

      return {
        totalLinks, recentCount, readCount, unreadCount: totalLinks - readCount,
        collectionsCount, pendingCount, failedCount, totalReadingMin,
        topTags, contentTypes, currentStreak, completionRate, thisWeekLinks,
      };
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const { data: recentActivity, isLoading: activityLoading } = useQuery({
    queryKey: ["dashboard-recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("links")
        .select("id, title, domain, original_url, created_at, is_read, content_type, tags")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(6);
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const { data: chartLinks = [] } = useQuery({
    queryKey: ["dashboard-chart-links"],
    queryFn: async () => {
      const { data } = await supabase
        .from("links")
        .select("created_at, content_type, tags, reading_completed_at, source")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <RouterLink to="/" className="text-lg font-bold tracking-tight">
            XenoKnowledge
          </RouterLink>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild>
              <RouterLink to="/settings"><Settings className="h-4 w-4" /></RouterLink>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-xs text-muted-foreground">
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Greeting + Quick Actions */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {greeting} 👋
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Here's your knowledge overview for today.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" asChild>
                <RouterLink to="/library"><Library className="h-3.5 w-3.5 mr-1.5" />Library</RouterLink>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <RouterLink to="/knowledge"><Compass className="h-3.5 w-3.5 mr-1.5" />Discover</RouterLink>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <RouterLink to="/analytics"><BarChart3 className="h-3.5 w-3.5 mr-1.5" />Analytics</RouterLink>
              </Button>
            </div>
          </div>
          {/* Quick Add Link */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Plus className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Quick Add</span>
              </div>
              <AddLinkInput onSuccess={() => queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })} />
            </CardContent>
          </Card>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={<Library className="h-4 w-4" />} label="Total Links" value={stats?.totalLinks} loading={statsLoading} to="/library" />
          <StatCard icon={<TrendingUp className="h-4 w-4" />} label="This Week" value={stats?.thisWeekLinks} loading={statsLoading} accent to="/library" />
          <StatCard icon={<BookCheck className="h-4 w-4" />} label="Read" value={stats?.readCount} loading={statsLoading} to="/library" />
          <StatCard icon={<BookOpen className="h-4 w-4" />} label="Unread" value={stats?.unreadCount} loading={statsLoading} to="/library" />
          <StatCard icon={<FolderOpen className="h-4 w-4" />} label="Collections" value={stats?.collectionsCount} loading={statsLoading} to="/library" />
          <StatCard icon={<Flame className="h-4 w-4" />} label="Day Streak" value={stats?.currentStreak} loading={statsLoading} accent to="/analytics" />
        </section>

        {/* Reading Progress */}
        {stats && (
          <RouterLink to="/library">
            <Card className="hover:border-primary/30 hover:shadow-md transition-all cursor-pointer">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Reading Progress</span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">
                    {stats.completionRate}% complete
                  </span>
                </div>
                <Progress value={stats.completionRate} className="h-2" />
                <div className="flex justify-between mt-2 text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                  <span>{stats.readCount} read</span>
                  <span>{stats.unreadCount} remaining</span>
                </div>
              </CardContent>
            </Card>
          </RouterLink>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Recent Activity
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <RouterLink to="/library" className="text-xs gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </RouterLink>
              </Button>
            </CardHeader>
            <CardContent className="space-y-1">
              {activityLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5">
                    <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-2.5 w-1/3" />
                    </div>
                  </div>
                ))
              ) : recentActivity?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No links yet. Start by adding your first link!
                </div>
              ) : (
                recentActivity?.map(link => (
                  <RouterLink
                    key={link.id}
                    to="/library"
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
                      {link.is_read ? <BookCheck className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{link.title || link.original_url}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground font-mono">{link.domain}</span>
                        <span className="text-[10px] text-muted-foreground">·</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(link.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    {link.is_read && (
                      <Badge variant="secondary" className="text-[9px] shrink-0">Read</Badge>
                    )}
                  </RouterLink>
                ))
              )}
            </CardContent>
          </Card>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Status Overview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Link Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {statsLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <>
                    <StatusRow label="Ready" count={stats ? stats.totalLinks - (stats.pendingCount + stats.failedCount) : 0} color="bg-emerald-500" to="/library" />
                    <StatusRow label="Pending" count={stats?.pendingCount || 0} color="bg-amber-500" to="/library" />
                    <StatusRow label="Failed" count={stats?.failedCount || 0} color="bg-destructive" to="/library" />
                  </>
                )}
              </CardContent>
            </Card>

            {/* Top Tags */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Top Knowledge Areas</CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : stats?.topTags.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">No tags yet</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {stats?.topTags.map(([tag, count]) => (
                      <RouterLink key={tag} to={`/library?search=${encodeURIComponent(tag)}`}>
                        <Badge variant="outline" className="text-[10px] gap-1 cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-colors">
                          {tag}
                          <span className="text-muted-foreground/50">{count}</span>
                        </Badge>
                      </RouterLink>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Content Types */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Content Mix</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {statsLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : stats?.contentTypes.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">No content yet</p>
                ) : (
                  stats?.contentTypes.slice(0, 5).map(([type, count]) => {
                    const pct = stats.totalLinks > 0 ? Math.round((count / stats.totalLinks) * 100) : 0;
                    return (
                      <RouterLink key={type} to={`/library?contentType=${encodeURIComponent(type)}`} className="flex items-center gap-2 text-xs hover:bg-muted/50 rounded-md p-1 -m-1 transition-colors">
                        <span className="w-14 capitalize text-muted-foreground font-mono">{type}</span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary/60 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-8 text-right font-mono text-muted-foreground">{pct}%</span>
                      </RouterLink>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Discover & Trending */}
        <section className="grid md:grid-cols-3 gap-4">
          <DiscoverCategoryChart links={chartLinks} />
          <MiniDiscoverWidget />
          <TrendingTopicsCloud />
        </section>

        {/* Charts */}
        <section className="grid md:grid-cols-2 gap-4">
          <RouterLink to="/analytics"><div className="hover:ring-2 hover:ring-primary/20 rounded-xl transition-all"><LinksOverTimeChart links={chartLinks} /></div></RouterLink>
          <RouterLink to="/analytics"><div className="hover:ring-2 hover:ring-primary/20 rounded-xl transition-all"><ContentTypePieChart links={chartLinks} /></div></RouterLink>
          <RouterLink to="/analytics"><div className="hover:ring-2 hover:ring-primary/20 rounded-xl transition-all"><DayOfWeekRadar links={chartLinks} /></div></RouterLink>
          <RouterLink to="/analytics"><div className="hover:ring-2 hover:ring-primary/20 rounded-xl transition-all"><ActivityHeatmap links={chartLinks} /></div></RouterLink>
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <NavCard to="/library" icon={<Library className="h-5 w-5" />} label="My Library" desc="Browse & manage links" />
          <NavCard to="/knowledge" icon={<Sparkles className="h-5 w-5" />} label="Knowledge" desc="Discover & explore" />
          <NavCard to="/analytics" icon={<BarChart3 className="h-5 w-5" />} label="Analytics" desc="Reading insights" />
          <NavCard to="/digest" icon={<Calendar className="h-5 w-5" />} label="Digest" desc="Weekly summaries" />
        </section>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, loading, accent, to }: {
  icon: React.ReactNode; label: string; value?: number; loading: boolean; accent?: boolean; to?: string;
}) {
  const [displayed, setDisplayed] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    if (value == null || loading) return;
    const start = prevRef.current;
    const end = value;
    const duration = 600;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    prevRef.current = end;
  }, [value, loading]);

  const card = (
    <Card className={`${accent ? "border-primary/20 bg-primary/5" : ""} ${to ? "hover:border-primary/30 hover:shadow-md transition-all cursor-pointer" : ""}`}>
      <CardContent className="p-3">
        <div className={`mb-1.5 ${accent ? "text-primary" : "text-muted-foreground"}`}>{icon}</div>
        {loading ? (
          <Skeleton className="h-6 w-12 mb-1" />
        ) : (
          <p className="text-xl font-bold font-mono leading-none">{displayed}</p>
        )}
        <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mt-1">{label}</p>
      </CardContent>
    </Card>
  );

  return to ? <RouterLink to={to}>{card}</RouterLink> : card;
}

function StatusRow({ label, count, color, to }: { label: string; count: number; color: string; to?: string }) {
  const content = (
    <div className={`flex items-center justify-between ${to ? "hover:bg-muted/50 rounded-md p-1 -m-1 cursor-pointer transition-colors" : ""}`}>
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${color}`} />
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-xs font-mono font-medium">{count}</span>
    </div>
  );
  return to ? <RouterLink to={to}>{content}</RouterLink> : content;
}

function NavCard({ to, icon, label, desc }: { to: string; icon: React.ReactNode; label: string; desc: string }) {
  return (
    <RouterLink to={to}>
      <Card className="hover:border-primary/30 hover:shadow-md transition-all group cursor-pointer h-full">
        <CardContent className="p-4 flex flex-col items-center text-center gap-2">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-[10px] text-muted-foreground">{desc}</p>
          </div>
        </CardContent>
      </Card>
    </RouterLink>
  );
}
