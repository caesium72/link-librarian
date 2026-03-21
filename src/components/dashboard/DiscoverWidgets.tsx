import { useState, useEffect, useMemo } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis,
} from "recharts";
import {
  Sparkles, Bot, Code, Zap, Github, Box, Cloud,
  ArrowRight, RefreshCw, TrendingUp, Flame,
} from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  ai: "hsl(var(--primary))",
  "dev-tool": "hsl(200, 80%, 45%)",
  productivity: "hsl(40, 90%, 45%)",
  "open-source": "hsl(160, 84%, 39%)",
  framework: "hsl(280, 65%, 50%)",
  saas: "hsl(0, 72%, 50%)",
  other: "hsl(var(--muted-foreground))",
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  ai: <Bot className="h-3 w-3" />,
  "dev-tool": <Code className="h-3 w-3" />,
  productivity: <Zap className="h-3 w-3" />,
  "open-source": <Github className="h-3 w-3" />,
  framework: <Box className="h-3 w-3" />,
  saas: <Cloud className="h-3 w-3" />,
};

const ChartTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg backdrop-blur text-xs font-mono">
      <p className="text-muted-foreground capitalize">{payload[0]?.name || payload[0]?.payload?.name}</p>
      <p className="text-primary font-bold">{payload[0].value} tools</p>
    </div>
  );
};

// Category distribution of discovered links
export function DiscoverCategoryChart({ links }: { links: { content_type?: string | null; source?: string }[] }) {
  const data = useMemo(() => {
    const discovered = links.filter(l => l.source === "discovered");
    if (discovered.length === 0) return [];
    const counts: Record<string, number> = {};
    discovered.forEach(l => {
      const t = l.content_type || "other";
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));
  }, [links]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Discovered Categories
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 flex items-center justify-center">
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-mono mb-2">No discovered tools yet</p>
              <Button size="sm" variant="outline" asChild>
                <RouterLink to="/discover" className="text-xs gap-1">
                  <Sparkles className="h-3 w-3" /> Start Discovering
                </RouterLink>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-mono flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Discovered Categories
        </CardTitle>
        <Badge variant="secondary" className="text-[9px] font-mono">
          {links.filter(l => l.source === "discovered").length} tools
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={60} innerRadius={35}
                paddingAngle={3} cornerRadius={4}
                style={{ fontSize: 8, fontFamily: "monospace" }}
                animationDuration={600}
              >
                {data.map((d, i) => (
                  <Cell key={i} fill={CATEGORY_COLORS[d.name] || CATEGORY_COLORS.other} stroke="none" />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {data.map(d => (
            <Badge key={d.name} variant="outline" className="text-[9px] font-mono gap-1 capitalize">
              {CATEGORY_ICONS[d.name] || <Box className="h-2.5 w-2.5" />}
              {d.name} ({d.value})
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Mini discover widget
export function MiniDiscoverWidget() {
  const [tools, setTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const discover = async () => {
    setLoading(true);
    try {
      const cached = localStorage.getItem("dashboard-discover-cache");
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 10 * 60 * 1000) {
          setTools(data);
          setHasLoaded(true);
          setLoading(false);
          return;
        }
      }
      const { data, error } = await supabase.functions.invoke("discover-tools", {
        body: { category: "all" },
      });
      if (error) throw error;
      if (data?.tools) {
        const top = data.tools.slice(0, 4);
        setTools(top);
        localStorage.setItem("dashboard-discover-cache", JSON.stringify({ data: top, timestamp: Date.now() }));
      }
      setHasLoaded(true);
    } catch {
      setHasLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-mono flex items-center gap-2">
          <Bot className="h-4 w-4 text-chart-2" />
          Quick Discover
        </CardTitle>
        <div className="flex items-center gap-1">
          {hasLoaded && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { localStorage.removeItem("dashboard-discover-cache"); discover(); }}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild>
            <RouterLink to="/discover" className="text-[10px] gap-1">
              More <ArrowRight className="h-3 w-3" />
            </RouterLink>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!hasLoaded && !loading ? (
          <div className="text-center py-4">
            <Button size="sm" onClick={discover} className="gap-1.5 text-xs font-mono">
              <Sparkles className="h-3 w-3" /> Discover Tools
            </Button>
          </div>
        ) : loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-7 w-7 rounded-md shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : tools.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4 font-mono">No tools found</p>
        ) : (
          <div className="space-y-2">
            {tools.map((tool, i) => (
              <a
                key={i}
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 transition-colors group"
              >
                <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                  {CATEGORY_ICONS[tool.category] || <Box className="h-3 w-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">{tool.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{tool.description}</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Trending topics cloud
export function TrendingTopicsCloud() {
  const [topics, setTopics] = useState<{ name: string; heat: number; trend: string; description: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchTrending = async () => {
    setLoading(true);
    try {
      const cached = localStorage.getItem("dashboard-trending-cache");
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          setTopics(data);
          setHasLoaded(true);
          setLoading(false);
          return;
        }
      }
      const { data, error } = await supabase.functions.invoke("trending-knowledge", {
        body: { timeRange: "7d", category: "all" },
      });
      if (error) throw error;
      if (data?.trending_topics) {
        setTopics(data.trending_topics);
        localStorage.setItem("dashboard-trending-cache", JSON.stringify({ data: data.trending_topics, timestamp: Date.now() }));
      }
      setHasLoaded(true);
    } catch {
      setHasLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  const maxHeat = Math.max(1, ...topics.map(t => t.heat));

  const getTrendIcon = (trend: string) => {
    if (trend === "rising") return <TrendingUp className="h-2.5 w-2.5 text-emerald-500" />;
    if (trend === "peak") return <Flame className="h-2.5 w-2.5 text-amber-500" />;
    return null;
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-mono flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-chart-3" />
          Trending Topics
        </CardTitle>
        <div className="flex items-center gap-1">
          {hasLoaded && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { localStorage.removeItem("dashboard-trending-cache"); fetchTrending(); }}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild>
            <RouterLink to="/knowledge" className="text-[10px] gap-1">
              More <ArrowRight className="h-3 w-3" />
            </RouterLink>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!hasLoaded && !loading ? (
          <div className="text-center py-4">
            <Button size="sm" onClick={fetchTrending} className="gap-1.5 text-xs font-mono">
              <TrendingUp className="h-3 w-3" /> Load Trends
            </Button>
          </div>
        ) : loading ? (
          <div className="flex flex-wrap gap-1.5 py-2">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-6 rounded-full" style={{ width: 60 + Math.random() * 40 }} />
            ))}
          </div>
        ) : topics.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4 font-mono">No trends available</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 items-center">
            {topics.map((topic, i) => {
              const scale = 0.6 + (topic.heat / maxHeat) * 0.4;
              const opacity = 0.5 + (topic.heat / maxHeat) * 0.5;
              return (
                <Badge
                  key={i}
                  variant="outline"
                  className="font-mono gap-1 cursor-default transition-all hover:scale-105 hover:border-primary/50"
                  style={{
                    fontSize: `${Math.round(9 + (topic.heat / maxHeat) * 4)}px`,
                    opacity,
                  }}
                  title={topic.description}
                >
                  {getTrendIcon(topic.trend)}
                  {topic.name}
                  <span className="text-muted-foreground/50 ml-0.5">{topic.heat}</span>
                </Badge>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
