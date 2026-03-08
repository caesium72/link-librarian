import { useState, useRef, useEffect, useCallback } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import logo from "@/assets/logo.png";
import { useRequireAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Flame, Clock, Star, Sparkles, ExternalLink,
  BookOpen, TrendingUp, Eye, RefreshCw, Share2, Box, Layers,
  Maximize2, Minimize2, Save, Loader2, Wand2, Atom, Globe,
  Zap, MessageSquare, Rocket, ArrowUpRight, BarChart3, Users,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { KnowledgeGraph } from "@/components/KnowledgeGraph";
import { KnowledgeGraph3D } from "@/components/KnowledgeGraph3D";
import { addLink } from "@/lib/api/links";
import { getOrCreateDiscoveredCollection, addLinkToCollection } from "@/lib/api/collections";
import type { Link } from "@/types/links";

interface RecommendedLink extends Link {
  reason?: string;
}

export default function Knowledge() {
  const { loading: authLoading } = useRequireAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("trending");
  const [graphMode, setGraphMode] = useState<"3d" | "2d">("3d");
  const [graph3DTheme, setGraph3DTheme] = useState<"cosmos" | "atomic" | "sphere" | "ocean" | "galaxy">("cosmos");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayMode, setDisplayMode] = useState<"3d" | "2d">("3d");
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const graphWrapperRef = useRef<HTMLDivElement>(null);

  // Auto-discover state
  const [autoDiscovering, setAutoDiscovering] = useState(false);
  const [autoDiscoverProgress, setAutoDiscoverProgress] = useState("");

  // Real trending state
  const [trendingTimeRange, setTrendingTimeRange] = useState<string>("7d");
  const [trendingCategory, setTrendingCategory] = useState<string>("all");
  const [trendingData, setTrendingData] = useState<any>(null);
  const [trendingRealLoading, setTrendingRealLoading] = useState(false);
  const [trendingRealLoaded, setTrendingRealLoaded] = useState(false);
  const [trendingView, setTrendingView] = useState<"library" | "global">("global");
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const CACHE_KEY = "trending-cache";
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  const getCacheKey = (timeRange: string, category: string) => `${timeRange}-${category}`;

  const readCache = (timeRange: string, category: string) => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const cache = JSON.parse(raw);
      const key = getCacheKey(timeRange, category);
      const entry = cache[key];
      if (!entry) return null;
      return { data: entry.data, timestamp: entry.timestamp, isFresh: Date.now() - entry.timestamp < CACHE_TTL };
    } catch { return null; }
  };

  const writeCache = (timeRange: string, category: string, data: any) => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      const cache = raw ? JSON.parse(raw) : {};
      cache[getCacheKey(timeRange, category)] = { data, timestamp: Date.now() };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch { /* ignore quota errors */ }
  };

  const fetchTrendingData = useCallback(async (auto = false) => {
    if (auto) setIsAutoRefresh(true);
    else setTrendingRealLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("trending-knowledge", {
        body: { timeRange: trendingTimeRange, category: trendingCategory },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTrendingData(data);
      writeCache(trendingTimeRange, trendingCategory, data);
      setLastFetchedAt(Date.now());
    } catch (e: any) {
      if (!auto) toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setTrendingRealLoading(false);
      setIsAutoRefresh(false);
      setTrendingRealLoaded(true);
    }
  }, [trendingTimeRange, trendingCategory, toast]);

  // Load from cache on mount and when filters change
  useEffect(() => {
    const cached = readCache(trendingTimeRange, trendingCategory);
    if (cached) {
      setTrendingData(cached.data);
      setLastFetchedAt(cached.timestamp);
      setTrendingRealLoaded(true);
      if (!cached.isFresh) {
        // Stale cache — show data but auto-refresh
        fetchTrendingData(true);
      }
    } else {
      setTrendingData(null);
      setTrendingRealLoaded(false);
      setLastFetchedAt(null);
    }
  }, [trendingTimeRange, trendingCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh interval (5 min) when on global trending view
  useEffect(() => {
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
      autoRefreshRef.current = null;
    }
    if (trendingView === "global" && trendingRealLoaded && activeTab === "trending") {
      autoRefreshRef.current = setInterval(() => fetchTrendingData(true), CACHE_TTL);
    }
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [trendingView, trendingRealLoaded, activeTab, fetchTrendingData]);

  // Save state for link cards
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const handleGraphModeSwitch = (mode: "3d" | "2d") => {
    if (mode === graphMode || isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setDisplayMode(mode);
      setGraphMode(mode);
      setTimeout(() => setIsTransitioning(false), 500);
    }, 350);
  };

  // Native browser fullscreen
  const toggleNativeFullscreen = useCallback(async () => {
    if (!graphWrapperRef.current) return;
    if (!document.fullscreenElement) {
      try {
        await graphWrapperRef.current.requestFullscreen();
      } catch {
        // Fallback to CSS fullscreen
        setIsFullscreen((f) => !f);
      }
    } else {
      await document.exitFullscreen();
    }
  }, []);

  // Sync fullscreen state with browser API
  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen && !document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  // Save a single link to library
  const handleSaveLink = async (link: Link) => {
    const id = link.id;
    if (savingIds.has(id) || savedIds.has(id)) return;
    setSavingIds((s) => new Set(s).add(id));
    try {
      await addLink(link.original_url, "manual");
      setSavedIds((s) => new Set(s).add(id));
      toast({ title: "Saved", description: `"${link.title || 'Link'}" saved to your library` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingIds((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  };

  // Auto-discover trending tools and save to Discovered collection
  const handleAutoDiscover = async () => {
    setAutoDiscovering(true);
    setAutoDiscoverProgress("Discovering trending tools...");
    try {
      const { data, error } = await supabase.functions.invoke("discover-tools", {
        body: { category: "all", searchQuery: "" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const tools = data?.tools || [];
      if (tools.length === 0) {
        toast({ title: "No tools found", description: "Try again later." });
        return;
      }

      setAutoDiscoverProgress(`Found ${tools.length} tools. Saving...`);
      const collectionId = await getOrCreateDiscoveredCollection();
      let saved = 0;
      let dupes = 0;

      for (const tool of tools) {
        try {
          const newLink = await addLink(tool.url, "discovered");
          await addLinkToCollection(collectionId, newLink.id);
          saved++;
          setAutoDiscoverProgress(`Saved ${saved}/${tools.length}...`);
        } catch {
          dupes++;
        }
      }

      toast({
        title: "Auto-Discovery Complete",
        description: `${saved} new tools saved, ${dupes} duplicates skipped.`,
      });
    } catch (e: any) {
      toast({ title: "Discovery failed", description: e.message, variant: "destructive" });
    } finally {
      setAutoDiscovering(false);
      setAutoDiscoverProgress("");
    }
  };

  // Trending: most read/completed links
  const { data: trendingLinks = [], isLoading: trendingLoading } = useQuery({
    queryKey: ["knowledge-trending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("links")
        .select("*")
        .eq("is_read", true)
        .eq("status", "ready")
        .is("deleted_at", null)
        .order("reading_completed_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  // Recently updated
  const { data: recentLinks = [], isLoading: recentLoading } = useQuery({
    queryKey: ["knowledge-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("links")
        .select("*")
        .eq("status", "ready")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  // Most valuable: pinned + high save count
  const { data: valuableLinks = [], isLoading: valuableLoading } = useQuery({
    queryKey: ["knowledge-valuable"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("links")
        .select("*")
        .eq("status", "ready")
        .is("deleted_at", null)
        .or("is_pinned.eq.true,save_count.gt.1,duplicate_count.gt.0")
        .order("save_count", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  // All links for graph
  const { data: allLinks = [], isLoading: allLinksLoading } = useQuery({
    queryKey: ["knowledge-all-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("links")
        .select("*")
        .eq("status", "ready")
        .is("deleted_at", null)
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const [recommendations, setRecommendations] = useState<RecommendedLink[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsLoaded, setRecsLoaded] = useState(false);

  const fetchRecommendations = async () => {
    setRecsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("knowledge-recommendations");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setRecommendations(data?.recommendations || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setRecsLoading(false);
      setRecsLoaded(true);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground font-mono text-sm">Loading...</div>
      </div>
    );
  }

  const renderLinkCard = (link: Link & { reason?: string }, index: number, showSave = false) => {
    const isSaving = savingIds.has(link.id);
    const isSaved = savedIds.has(link.id);

    return (
      <Card
        key={link.id}
        className="group hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom-3"
        style={{ animationDelay: `${index * 80}ms`, animationFillMode: "both", animationDuration: "500ms" }}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors duration-200">{link.title || "Untitled"}</h3>
              <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{link.domain || "unknown"}</p>
              {link.summary && (
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{link.summary}</p>
              )}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {link.content_type && link.content_type !== "other" && (
                  <Badge variant="secondary" className="text-[10px] h-5 animate-in fade-in zoom-in-95 duration-300">{link.content_type}</Badge>
                )}
                {(link.tags || []).slice(0, 3).map((tag, ti) => (
                  <Badge key={tag} variant="outline" className="text-[10px] h-5 animate-in fade-in zoom-in-95 duration-300" style={{ animationDelay: `${(index * 80) + (ti * 50)}ms` }}>{tag}</Badge>
                ))}
                {link.is_pinned && (
                  <Badge variant="default" className="text-[10px] h-5 animate-pulse">⭐ Pinned</Badge>
                )}
                {link.is_read && (
                  <Badge variant="secondary" className="text-[10px] h-5">✓ Read</Badge>
                )}
              </div>
              {(link as any).reason && (
                <div className="flex items-center gap-1 mt-2 animate-in fade-in slide-in-from-left-2 duration-500">
                  <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                  <span className="text-[11px] text-primary font-medium">{(link as any).reason}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {showSave && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-all duration-200"
                  onClick={(e) => { e.stopPropagation(); handleSaveLink(link); }}
                  disabled={isSaving || isSaved}
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isSaved ? <Save className="h-3.5 w-3.5 text-primary" /> : <Save className="h-3.5 w-3.5" />}
                </Button>
              )}
              <a
                href={link.original_url}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0 translate-x-1"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderSkeleton = () => (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="animate-in fade-in slide-in-from-bottom-2 duration-300 overflow-hidden" style={{ animationDelay: `${i * 100}ms`, animationFillMode: "both" }}>
          <CardContent className="p-4 space-y-2 relative">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-primary/5 to-transparent" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const tabConfig = [
    { value: "trending", icon: <Flame className="h-4 w-4" />, label: "Trending", emoji: "🔥" },
    { value: "recent", icon: <Clock className="h-4 w-4" />, label: "Recently Updated", emoji: "📚" },
    { value: "valuable", icon: <Star className="h-4 w-4" />, label: "Most Valuable", emoji: "⭐" },
    { value: "graph", icon: <Share2 className="h-4 w-4" />, label: "Graph", emoji: "🕸️" },
    { value: "recommendations", icon: <Sparkles className="h-4 w-4" />, label: "For You", emoji: "🤖" },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Floating gradient orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl animate-pulse" style={{ animationDuration: "6s" }} />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-chart-2/5 blur-3xl animate-pulse" style={{ animationDuration: "8s", animationDelay: "2s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-chart-4/3 blur-3xl animate-pulse" style={{ animationDuration: "10s", animationDelay: "4s" }} />
      </div>

      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 animate-in fade-in slide-in-from-top-2 duration-500">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RouterLink to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all duration-200 hover:-translate-x-0.5">
              <ArrowLeft className="h-4 w-4" />
            </RouterLink>
            <img src={logo} alt="Logo" className="h-6 w-6 animate-in zoom-in-50 spin-in-12 duration-500" />
            <div className="animate-in fade-in slide-in-from-left-3 duration-500" style={{ animationDelay: "100ms" }}>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary animate-bounce" style={{ animationDuration: "3s" }} />
                Knowledge Discovery
              </h1>
              <p className="text-xs text-muted-foreground">Explore and discover your knowledge</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs transition-all duration-300 hover:shadow-md hover:shadow-primary/10"
              onClick={handleAutoDiscover}
              disabled={autoDiscovering}
            >
              {autoDiscovering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              {autoDiscovering ? "Discovering..." : "Auto-Discover"}
            </Button>
            <ThemeToggle />
          </div>
        </div>
        {autoDiscoverProgress && (
          <div className="max-w-4xl mx-auto px-4 pb-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground animate-in fade-in duration-300">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{autoDiscoverProgress}</span>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 relative z-10">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 mb-6 animate-in fade-in slide-in-from-bottom-3 duration-500" style={{ animationDelay: "150ms", animationFillMode: "both" }}>
            {tabConfig.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="gap-1.5 text-xs transition-all duration-300 data-[state=active]:scale-[1.02]"
              >
                <span className="hidden sm:inline">{tab.emoji}</span>
                <span>{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Trending */}
          <TabsContent value="trending" className="animate-in fade-in slide-in-from-right-4 duration-400 space-y-6">
            {/* View toggle + filters */}
            <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-left-3 duration-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-destructive animate-pulse" style={{ animationDuration: "2s" }} />
                  <h2 className="text-base font-semibold">Trending Knowledge</h2>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant={trendingView === "global" ? "default" : "outline"} size="sm" className="text-xs h-7 gap-1" onClick={() => setTrendingView("global")}>
                    <Globe className="h-3 w-3" /> Global
                  </Button>
                  <Button variant={trendingView === "library" ? "default" : "outline"} size="sm" className="text-xs h-7 gap-1" onClick={() => setTrendingView("library")}>
                    <BookOpen className="h-3 w-3" /> My Library
                  </Button>
                </div>
              </div>

              {trendingView === "global" && (
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Time range */}
                  {["24h", "7d", "30d", "90d"].map((t) => (
                    <Button key={t} variant={trendingTimeRange === t ? "default" : "outline"} size="sm" className="text-xs h-6 px-2.5"
                      onClick={() => setTrendingTimeRange(t)}>
                      {t === "24h" ? "Today" : t === "7d" ? "This Week" : t === "30d" ? "This Month" : "3 Months"}
                    </Button>
                  ))}
                  <div className="w-px h-4 bg-border" />
                  {["all", "ai", "dev", "opensource", "startup"].map((c) => (
                    <Button key={c} variant={trendingCategory === c ? "secondary" : "ghost"} size="sm" className="text-xs h-6 px-2.5 capitalize"
                      onClick={() => setTrendingCategory(c)}>
                      {c === "all" ? "All" : c === "ai" ? "🤖 AI" : c === "dev" ? "🛠 Dev" : c === "opensource" ? "📦 OSS" : "🚀 Startups"}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Global Trending View */}
            {trendingView === "global" && (
              <>
                {!trendingRealLoaded && !trendingRealLoading && (
                  <Card className="animate-in fade-in zoom-in-95 duration-500 group hover:border-primary/20 transition-all">
                    <CardContent className="p-8 text-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 via-transparent to-chart-4/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <Flame className="h-8 w-8 text-destructive mx-auto mb-3 animate-bounce" style={{ animationDuration: "2s" }} />
                      <p className="text-sm font-medium mb-1">Real-Time Trending Analysis</p>
                      <p className="text-xs text-muted-foreground mb-4">AI-powered analysis of what's trending in tech right now</p>
                      <Button onClick={() => fetchTrendingData()} className="gap-2 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20 hover:scale-105">
                        <TrendingUp className="h-4 w-4" /> Fetch Trending
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {trendingRealLoading && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i}><CardContent className="p-3"><Skeleton className="h-12 w-full" /></CardContent></Card>
                      ))}
                    </div>
                    {renderSkeleton()}
                  </div>
                )}

                {trendingRealLoaded && !trendingRealLoading && trendingData && (
                  <div className="space-y-6">
                    {/* Insights Summary Banner */}
                    {trendingData.insights_summary && (
                      <Card className="border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-3 duration-500">
                        <CardContent className="p-4 flex items-start gap-3">
                          <Zap className="h-5 w-5 text-primary shrink-0 mt-0.5 animate-pulse" />
                          <div>
                            <p className="text-sm font-medium mb-0.5">Trending Insights</p>
                            <p className="text-xs text-muted-foreground">{trendingData.insights_summary}</p>
                          </div>
                          <Button variant="ghost" size="sm" className="shrink-0 text-xs h-7 gap-1" onClick={() => fetchTrendingData()}>
                            {isAutoRefresh ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                            {lastFetchedAt ? `${Math.round((Date.now() - lastFetchedAt) / 60000)}m ago` : "Refresh"}
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    {/* Trending Topics */}
                    {trendingData.trending_topics?.length > 0 && (
                      <div className="animate-in fade-in slide-in-from-bottom-3 duration-500" style={{ animationDelay: "100ms", animationFillMode: "both" }}>
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                          <BarChart3 className="h-4 w-4 text-chart-2" /> Hot Topics
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {trendingData.trending_topics.map((topic: any, i: number) => (
                            <Card key={i} className="group hover:border-primary/30 transition-all duration-300 hover:-translate-y-0.5 animate-in fade-in zoom-in-95 duration-300"
                              style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}>
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-xs font-medium truncate">{topic.name}</span>
                                  <Badge variant={topic.trend === "rising" ? "default" : topic.trend === "peak" ? "secondary" : "outline"} className="text-[9px] h-4 px-1.5">
                                    {topic.trend === "rising" ? "🔥" : topic.trend === "peak" ? "📈" : "📉"} {topic.trend}
                                  </Badge>
                                </div>
                                <Progress value={topic.heat} className="h-1.5 mb-1.5" />
                                <p className="text-[10px] text-muted-foreground line-clamp-2">{topic.description}</p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Community Pulse */}
                    {trendingData.community_pulse && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in slide-in-from-bottom-3 duration-500" style={{ animationDelay: "200ms", animationFillMode: "both" }}>
                        <Card className="hover:border-chart-1/30 transition-all duration-300">
                          <CardContent className="p-3">
                            <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                              <MessageSquare className="h-3.5 w-3.5 text-chart-1" /> Hot Discussions
                            </h4>
                            <ul className="space-y-1.5">
                              {(trendingData.community_pulse.hot_discussions || []).map((d: string, i: number) => (
                                <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                                  <span className="text-chart-1 shrink-0">•</span> {d}
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                        <Card className="hover:border-chart-2/30 transition-all duration-300">
                          <CardContent className="p-3">
                            <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                              <ArrowUpRight className="h-3.5 w-3.5 text-chart-2" /> Rising Tech
                            </h4>
                            <ul className="space-y-1.5">
                              {(trendingData.community_pulse.rising_technologies || []).map((t: string, i: number) => (
                                <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                                  <span className="text-chart-2 shrink-0">•</span> {t}
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                        <Card className="hover:border-chart-4/30 transition-all duration-300">
                          <CardContent className="p-3">
                            <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                              <Rocket className="h-3.5 w-3.5 text-chart-4" /> Notable Launches
                            </h4>
                            <ul className="space-y-1.5">
                              {(trendingData.community_pulse.notable_launches || []).map((l: string, i: number) => (
                                <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                                  <span className="text-chart-4 shrink-0">•</span> {l}
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {/* Trending Links */}
                    {trendingData.trending_links?.length > 0 && (
                      <div className="animate-in fade-in slide-in-from-bottom-3 duration-500" style={{ animationDelay: "300ms", animationFillMode: "both" }}>
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                          <TrendingUp className="h-4 w-4 text-primary" /> Trending Now
                          <span className="text-xs text-muted-foreground font-normal">· {trendingData.trending_links.length} resources</span>
                        </h3>
                        <div className="space-y-2">
                          {trendingData.trending_links.map((item: any, i: number) => (
                            <Card key={i} className="group hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 transition-all duration-300 animate-in fade-in slide-in-from-bottom-3"
                              style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both", animationDuration: "400ms" }}>
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <h4 className="text-sm font-medium truncate group-hover:text-primary transition-colors">{item.title}</h4>
                                      <Badge variant="outline" className="text-[9px] h-4 px-1.5 shrink-0">{item.category}</Badge>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground font-mono">{item.domain}</p>
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                                    <div className="flex items-center gap-1.5 mt-1.5">
                                      {(item.tags || []).slice(0, 4).map((tag: string) => (
                                        <Badge key={tag} variant="secondary" className="text-[9px] h-4 px-1.5">{tag}</Badge>
                                      ))}
                                      <div className="flex items-center gap-0.5 ml-auto">
                                        <Flame className="h-3 w-3 text-destructive" />
                                        <span className="text-[10px] font-medium text-destructive">{item.heat_score}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-all"
                                      onClick={() => handleSaveLink({ id: `trending-${i}`, original_url: item.url, title: item.title, domain: item.domain, summary: item.description, tags: item.tags } as Link)}>
                                      <Save className="h-3.5 w-3.5" />
                                    </Button>
                                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                                      className="opacity-0 group-hover:opacity-100 transition-all">
                                      <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                                    </a>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Library Trending View (original) */}
            {trendingView === "library" && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Your most read content</span>
                </div>
                {trendingLoading ? renderSkeleton() : trendingLinks.length === 0 ? (
                  <Card className="animate-in fade-in zoom-in-95 duration-500">
                    <CardContent className="p-8 text-center">
                      <Eye className="h-8 w-8 text-muted-foreground mx-auto mb-2 animate-bounce" style={{ animationDuration: "3s" }} />
                      <p className="text-sm text-muted-foreground">No read links yet. Start reading to see trends!</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {trendingLinks.map((link, i) => renderLinkCard(link, i, true))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Recently Updated */}
          <TabsContent value="recent" className="animate-in fade-in slide-in-from-right-4 duration-400">
            <div className="flex items-center gap-2 mb-4 animate-in fade-in slide-in-from-left-3 duration-500">
              <Clock className="h-5 w-5 text-chart-2 animate-spin" style={{ animationDuration: "8s" }} />
              <h2 className="text-base font-semibold">Recently Updated</h2>
              <span className="text-xs text-muted-foreground">· Latest changes in your library</span>
            </div>
            {recentLoading ? renderSkeleton() : recentLinks.length === 0 ? (
              <Card className="animate-in fade-in zoom-in-95 duration-500">
                <CardContent className="p-8 text-center">
                  <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No links yet. Add some to get started!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {recentLinks.map((link, i) => renderLinkCard(link, i, true))}
              </div>
            )}
          </TabsContent>

          {/* Most Valuable */}
          <TabsContent value="valuable" className="animate-in fade-in slide-in-from-right-4 duration-400">
            <div className="flex items-center gap-2 mb-4 animate-in fade-in slide-in-from-left-3 duration-500">
              <Star className="h-5 w-5 text-chart-4 animate-pulse" style={{ animationDuration: "2.5s" }} />
              <h2 className="text-base font-semibold">Most Valuable</h2>
              <span className="text-xs text-muted-foreground">· Pinned, saved & referenced often</span>
            </div>
            {valuableLoading ? renderSkeleton() : valuableLinks.length === 0 ? (
              <Card className="animate-in fade-in zoom-in-95 duration-500">
                <CardContent className="p-8 text-center">
                  <Star className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Pin or save links to see your most valuable knowledge.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {valuableLinks.map((link, i) => renderLinkCard(link, i, true))}
              </div>
            )}
          </TabsContent>

          {/* Knowledge Graph */}
          <TabsContent value="graph" className="animate-in fade-in zoom-in-[0.98] duration-500">
            <div
              ref={graphWrapperRef}
              className={`flex flex-col transition-all duration-300 ${isFullscreen ? "fixed inset-0 z-[9999] bg-background" : ""}`}
              style={isFullscreen ? { width: "100vw", height: "100vh" } : undefined}
            >
              <div className={`flex items-center justify-between animate-in fade-in slide-in-from-left-3 duration-500 shrink-0 ${isFullscreen ? "px-4 pt-4 pb-2" : "mb-4"}`}>
                <div className="flex items-center gap-2">
                  <Share2 className="h-5 w-5 text-primary animate-pulse" style={{ animationDuration: "3s" }} />
                  <h2 className="text-base font-semibold">Knowledge Graph</h2>
                  <span className="text-xs text-muted-foreground">· Tag connections across your library</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant={graphMode === "3d" ? "default" : "outline"}
                    size="sm"
                    className={`gap-1.5 text-xs h-7 transition-all duration-300 ${isTransitioning ? "pointer-events-none" : ""}`}
                    onClick={() => handleGraphModeSwitch("3d")}
                  >
                    <Box className="h-3 w-3" />
                    3D
                  </Button>
                  <Button
                    variant={graphMode === "2d" ? "default" : "outline"}
                    size="sm"
                    className={`gap-1.5 text-xs h-7 transition-all duration-300 ${isTransitioning ? "pointer-events-none" : ""}`}
                    onClick={() => handleGraphModeSwitch("2d")}
                  >
                    <Layers className="h-3 w-3" />
                    2D
                  </Button>
                  
                  {/* Theme selector (only for 3D mode) */}
                  {graphMode === "3d" && (
                    <>
                      <div className="w-px h-5 bg-border mx-1" />
                      <Button
                        variant={graph3DTheme === "cosmos" ? "default" : "outline"}
                        size="sm"
                        className="gap-1.5 text-xs h-7 transition-all duration-300"
                        onClick={() => setGraph3DTheme("cosmos")}
                      >
                        🪐 Cosmos
                      </Button>
                      <Button
                        variant={graph3DTheme === "atomic" ? "default" : "outline"}
                        size="sm"
                        className="gap-1.5 text-xs h-7 transition-all duration-300"
                        onClick={() => setGraph3DTheme("atomic")}
                      >
                        <Atom className="h-3 w-3" />
                        Atomic
                      </Button>
                      <Button
                        variant={graph3DTheme === "sphere" ? "default" : "outline"}
                        size="sm"
                        className="gap-1.5 text-xs h-7 transition-all duration-300"
                        onClick={() => setGraph3DTheme("sphere")}
                      >
                        <Globe className="h-3 w-3" />
                        Sphere
                      </Button>
                      <Button
                        variant={graph3DTheme === "ocean" ? "default" : "outline"}
                        size="sm"
                        className="gap-1.5 text-xs h-7 transition-all duration-300"
                        onClick={() => setGraph3DTheme("ocean")}
                      >
                        🌊 Ocean
                      </Button>
                      <Button
                        variant={graph3DTheme === "galaxy" ? "default" : "outline"}
                        size="sm"
                        className="gap-1.5 text-xs h-7 transition-all duration-300"
                        onClick={() => setGraph3DTheme("galaxy")}
                      >
                        🌌 Galaxy
                      </Button>
                    </>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-7 ml-1 transition-all duration-300"
                    onClick={toggleNativeFullscreen}
                  >
                    {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                    {isFullscreen ? "Exit" : "Fullscreen"}
                  </Button>
                </div>
              </div>
              <div
                ref={graphContainerRef}
                className={`transition-all duration-500 ease-out ${isFullscreen ? "flex-1 [&_.h-\\[500px\\]]:!h-full" : ""}`}
                style={{
                  opacity: isTransitioning ? 0 : 1,
                  transform: isTransitioning
                    ? graphMode === "3d"
                      ? "scale(0.92) rotateX(8deg) perspective(800px)"
                      : "scale(0.92) rotateX(-8deg) perspective(800px)"
                    : "scale(1) rotateX(0deg) perspective(800px)",
                  transformOrigin: "center center",
                  filter: isTransitioning ? "blur(4px)" : "blur(0px)",
                  ...(isFullscreen ? { height: "100%" } : {}),
                }}
              >
                {displayMode === "3d" ? (
                  <KnowledgeGraph3D links={allLinks} isLoading={allLinksLoading} theme={graph3DTheme} />
                ) : (
                  <KnowledgeGraph links={allLinks} isLoading={allLinksLoading} />
                )}
              </div>
            </div>
          </TabsContent>

          {/* AI Recommendations */}
          <TabsContent value="recommendations" className="animate-in fade-in slide-in-from-right-4 duration-400">
            <div className="flex items-center justify-between mb-4 animate-in fade-in slide-in-from-left-3 duration-500">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                <h2 className="text-base font-semibold">Recommended For You</h2>
                <span className="text-xs text-muted-foreground">· AI-powered suggestions</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs transition-all duration-300 hover:shadow-md hover:shadow-primary/10 hover:-translate-y-0.5"
                onClick={fetchRecommendations}
                disabled={recsLoading}
              >
                <RefreshCw className={`h-3 w-3 transition-transform duration-500 ${recsLoading ? "animate-spin" : ""}`} />
                {recsLoaded ? "Refresh" : "Get Recommendations"}
              </Button>
            </div>

            {!recsLoaded && !recsLoading && (
              <Card className="animate-in fade-in zoom-in-95 duration-500 group hover:border-primary/20 transition-all duration-300">
                <CardContent className="p-8 text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-chart-2/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <Sparkles className="h-8 w-8 text-primary mx-auto mb-3 animate-bounce" style={{ animationDuration: "2s" }} />
                  <p className="text-sm font-medium mb-1">AI Knowledge Recommendations</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Based on your reading history, AI will suggest what to read next.
                  </p>
                  <Button onClick={fetchRecommendations} className="gap-2 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20 hover:scale-105">
                    <Sparkles className="h-4 w-4" />
                    Generate Recommendations
                  </Button>
                </CardContent>
              </Card>
            )}

            {recsLoading && renderSkeleton()}

            {recsLoaded && !recsLoading && recommendations.length === 0 && (
              <Card className="animate-in fade-in zoom-in-95 duration-500">
                <CardContent className="p-8 text-center">
                  <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Read more links to unlock personalized recommendations!
                  </p>
                </CardContent>
              </Card>
            )}

            {recsLoaded && !recsLoading && recommendations.length > 0 && (
              <div className="space-y-3">
                {recommendations.map((link, i) => renderLinkCard(link, i, true))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
