import { useRequireAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { fetchLinks } from "@/lib/api/links";
import { Link as RouterLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ArrowLeft, LinkIcon, CheckCircle2, Clock, AlertCircle, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from "recharts";
import { useMemo } from "react";
import logo from "@/assets/logo.png";

const CHART_COLORS = [
  "hsl(160, 84%, 39%)",
  "hsl(200, 80%, 45%)",
  "hsl(40, 90%, 45%)",
  "hsl(280, 65%, 50%)",
  "hsl(0, 72%, 50%)",
  "hsl(180, 60%, 40%)",
  "hsl(320, 70%, 55%)",
  "hsl(60, 80%, 45%)",
];

const Analytics = () => {
  const { user, loading: authLoading } = useRequireAuth();

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["links"],
    queryFn: () => fetchLinks(),
    enabled: !!user,
  });

  // Links saved per day (last 30 days)
  const linksPerDay = useMemo(() => {
    const now = new Date();
    const days: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days[d.toISOString().slice(0, 10)] = 0;
    }
    links.forEach((l) => {
      const day = l.created_at.slice(0, 10);
      if (day in days) days[day]++;
    });
    return Object.entries(days).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString("en", { month: "short", day: "numeric" }),
      count,
    }));
  }, [links]);

  // Top tags
  const topTags = useMemo(() => {
    const counts: Record<string, number> = {};
    links.forEach((l) => l.tags?.forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));
  }, [links]);

  // Top domains
  const topDomains = useMemo(() => {
    const counts: Record<string, number> = {};
    links.forEach((l) => {
      if (l.domain) counts[l.domain] = (counts[l.domain] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([domain, count]) => ({ domain, count }));
  }, [links]);

  // Content type distribution
  const contentTypes = useMemo(() => {
    const counts: Record<string, number> = {};
    links.forEach((l) => {
      const t = l.content_type || "other";
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [links]);

  // Status distribution
  const statusDist = useMemo(() => {
    const counts = { ready: 0, pending: 0, failed: 0 };
    links.forEach((l) => {
      if (l.status in counts) counts[l.status as keyof typeof counts]++;
    });
    return counts;
  }, [links]);

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="font-mono text-muted-foreground animate-pulse">Loading...</div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
        <p className="text-xs font-mono text-foreground">{label}</p>
        <p className="text-xs font-mono text-primary font-semibold">{payload[0].value}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RouterLink to="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </RouterLink>
            <img src={logo} alt="Xenonowledge" className="h-5 w-5" />
            <h1 className="font-mono text-sm font-semibold">Analytics</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <LinkIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono">{links.length}</p>
                <p className="text-[10px] text-muted-foreground font-mono uppercase">Total Links</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono">{statusDist.ready}</p>
                <p className="text-[10px] text-muted-foreground font-mono uppercase">Ready</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-3/10">
                <Clock className="h-5 w-5 text-chart-3" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono">{statusDist.pending}</p>
                <p className="text-[10px] text-muted-foreground font-mono uppercase">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono">{statusDist.failed}</p>
                <p className="text-[10px] text-muted-foreground font-mono uppercase">Failed</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Links over time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Links Saved (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={linksPerDay}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} stroke="hsl(215, 12%, 55%)" interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} stroke="hsl(215, 12%, 55%)" allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="count" stroke="hsl(160, 84%, 39%)" fill="url(#colorCount)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Tags */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono">Top Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {topTags.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground font-mono">No tags yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topTags} layout="vertical" margin={{ left: 60 }}>
                      <XAxis type="number" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} stroke="hsl(215, 12%, 55%)" allowDecimals={false} />
                      <YAxis dataKey="tag" type="category" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} stroke="hsl(215, 12%, 55%)" width={55} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" fill="hsl(200, 80%, 45%)" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Content Type Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono">Content Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {contentTypes.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground font-mono">No data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={contentTypes}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={40}
                        paddingAngle={3}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                        style={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
                      >
                        {contentTypes.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top Domains */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono">Top Domains</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {topDomains.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground font-mono">No domains yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topDomains}>
                      <XAxis dataKey="domain" tick={{ fontSize: 9, fontFamily: "JetBrains Mono" }} stroke="hsl(215, 12%, 55%)" angle={-30} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} stroke="hsl(215, 12%, 55%)" allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {topDomains.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
