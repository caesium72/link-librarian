import { useRequireAuth } from "@/hooks/useAuth";
import { KnowledgeReport } from "@/components/KnowledgeReport";
import { useQuery } from "@tanstack/react-query";
import { fetchLinks } from "@/lib/api/links";
import { Link as RouterLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  ArrowLeft, LinkIcon, CheckCircle2, Clock, AlertCircle, TrendingUp,
  CalendarIcon, Flame, Hash, Globe, Zap, BarChart3,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";
import { useState, useMemo } from "react";
import { format, subDays, isWithinInterval, startOfDay, endOfDay, differenceInDays, eachDayOfInterval } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import type { Link } from "@/types/links";

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

const PRESETS = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: 0 },
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const Analytics = () => {
  const { user, loading: authLoading } = useRequireAuth();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const { data: allLinks = [], isLoading } = useQuery({
    queryKey: ["links"],
    queryFn: () => fetchLinks(),
    enabled: !!user,
  });

  // Filter links by date range
  const links = useMemo(() => {
    if (!dateRange?.from) return allLinks;
    const from = startOfDay(dateRange.from);
    const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(new Date());
    return allLinks.filter((l) =>
      isWithinInterval(new Date(l.created_at), { start: from, end: to })
    );
  }, [allLinks, dateRange]);

  const rangeLabel = useMemo(() => {
    if (!dateRange?.from) return "All time";
    const from = format(dateRange.from, "MMM d");
    const to = dateRange.to ? format(dateRange.to, "MMM d, yyyy") : "now";
    return `${from} – ${to}`;
  }, [dateRange]);

  // Links saved per day
  const linksPerDay = useMemo(() => {
    if (!dateRange?.from) return [];
    const from = dateRange.from;
    const to = dateRange.to || new Date();
    const allDays = eachDayOfInterval({ start: from, end: to });
    const counts: Record<string, number> = {};
    allDays.forEach((d) => { counts[format(d, "yyyy-MM-dd")] = 0; });
    links.forEach((l) => {
      const day = l.created_at.slice(0, 10);
      if (day in counts) counts[day]++;
    });
    const showMonth = differenceInDays(to, from) > 14;
    return Object.entries(counts).map(([date, count]) => ({
      date: showMonth
        ? format(new Date(date), "MMM d")
        : format(new Date(date), "EEE d"),
      count,
    }));
  }, [links, dateRange]);

  // Top tags
  const topTags = useMemo(() => {
    const counts: Record<string, number> = {};
    links.forEach((l) => l.tags?.forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
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

  // Day of week activity radar
  const dayOfWeekActivity = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    links.forEach((l) => {
      counts[new Date(l.created_at).getDay()]++;
    });
    return DAY_NAMES.map((day, i) => ({ day, count: counts[i] }));
  }, [links]);

  // Activity streak
  const streak = useMemo(() => {
    if (links.length === 0) return 0;
    const uniqueDays = new Set(links.map((l) => l.created_at.slice(0, 10)));
    let count = 0;
    const d = new Date();
    while (uniqueDays.has(format(d, "yyyy-MM-dd"))) {
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }, [links]);

  // Average per day
  const avgPerDay = useMemo(() => {
    if (!dateRange?.from || links.length === 0) return 0;
    const to = dateRange.to || new Date();
    const days = Math.max(1, differenceInDays(to, dateRange.from) + 1);
    return (links.length / days).toFixed(1);
  }, [links, dateRange]);

  // Weekly heatmap (last 12 weeks) - saving activity
  const heatmapData = useMemo(() => {
    const weeks: { day: number; week: number; count: number; date: string }[] = [];
    const today = new Date();
    for (let w = 11; w >= 0; w--) {
      for (let d = 0; d < 7; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() - (w * 7 + (6 - d)));
        const key = format(date, "yyyy-MM-dd");
        weeks.push({ day: d, week: 11 - w, count: 0, date: key });
      }
    }
    allLinks.forEach((l) => {
      const day = l.created_at.slice(0, 10);
      const cell = weeks.find((c) => c.date === day);
      if (cell) cell.count++;
    });
    return weeks;
  }, [allLinks]);

  const maxHeatmap = Math.max(1, ...heatmapData.map((c) => c.count));

  // Reading heatmap (last 52 weeks) - GitHub-style contribution graph
  const readingHeatmapData = useMemo(() => {
    const weeks: { day: number; week: number; count: number; date: string; month: string }[] = [];
    const today = new Date();
    const totalWeeks = 52;
    for (let w = totalWeeks - 1; w >= 0; w--) {
      for (let d = 0; d < 7; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() - (w * 7 + (6 - d)));
        const key = format(date, "yyyy-MM-dd");
        weeks.push({ day: d, week: totalWeeks - 1 - w, count: 0, date: key, month: format(date, "MMM") });
      }
    }
    allLinks.forEach((l) => {
      if (l.reading_completed_at) {
        const day = l.reading_completed_at.slice(0, 10);
        const cell = weeks.find((c) => c.date === day);
        if (cell) cell.count++;
      }
    });
    return weeks;
  }, [allLinks]);

  const maxReadingHeatmap = Math.max(1, ...readingHeatmapData.map((c) => c.count));
  const totalWeeks = 52;

  // Month labels for reading heatmap
  const monthLabels = useMemo(() => {
    const labels: { label: string; week: number }[] = [];
    let lastMonth = "";
    for (let w = 0; w < totalWeeks; w++) {
      const cell = readingHeatmapData.find((c) => c.week === w && c.day === 0);
      if (cell && cell.month !== lastMonth) {
        labels.push({ label: cell.month, week: w });
        lastMonth = cell.month;
      }
    }
    return labels;
  }, [readingHeatmapData]);

  // Reading stats for the year
  const readingYearStats = useMemo(() => {
    const totalRead = readingHeatmapData.reduce((sum, c) => sum + c.count, 0);
    const activeDays = readingHeatmapData.filter((c) => c.count > 0).length;
    let currentStreak = 0;
    const sorted = [...readingHeatmapData].reverse();
    for (const cell of sorted) {
      if (cell.count > 0) currentStreak++;
      else break;
    }
    let longestStreak = 0;
    let tempStreak = 0;
    for (const cell of readingHeatmapData) {
      if (cell.count > 0) { tempStreak++; longestStreak = Math.max(longestStreak, tempStreak); }
      else tempStreak = 0;
    }
    return { totalRead, activeDays, currentStreak, longestStreak };
  }, [readingHeatmapData]);

  const selectPreset = (days: number) => {
    if (days === 0) {
      // All time — find earliest link
      const earliest = allLinks.length > 0
        ? new Date(allLinks.reduce((min, l) => l.created_at < min ? l.created_at : min, allLinks[0].created_at))
        : subDays(new Date(), 365);
      setDateRange({ from: earliest, to: new Date() });
    } else {
      setDateRange({ from: subDays(new Date(), days), to: new Date() });
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="font-mono text-muted-foreground animate-pulse">Loading analytics...</div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg backdrop-blur">
        <p className="text-xs font-mono text-foreground">{label || payload[0]?.name}</p>
        <p className="text-sm font-mono text-primary font-bold">{payload[0].value}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Decorative gradient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-chart-2/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-chart-4/3 blur-3xl" />
      </div>

      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-xl sticky top-0 z-10">
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
          <div className="flex items-center gap-2">
            {/* Date range presets */}
            <div className="hidden sm:flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
              {PRESETS.map((p) => (
                <Button
                  key={p.label}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 px-2.5 text-[10px] font-mono rounded-md",
                    dateRange?.from && differenceInDays(new Date(), dateRange.from) === p.days && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                  )}
                  onClick={() => selectPreset(p.days)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            {/* Calendar picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-mono">
                  <CalendarIcon className="h-3 w-3" />
                  <span className="hidden sm:inline">{rangeLabel}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  disabled={{ after: new Date() }}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 relative z-0">
        {/* Summary cards with animated counters */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard icon={<LinkIcon className="h-5 w-5" />} value={links.length} label="Total Links" color="primary" />
          <StatCard icon={<CheckCircle2 className="h-5 w-5" />} value={statusDist.ready} label="Ready" color="primary" />
          <StatCard icon={<Clock className="h-5 w-5" />} value={statusDist.pending} label="Pending" color="chart-3" />
          <StatCard icon={<AlertCircle className="h-5 w-5" />} value={statusDist.failed} label="Failed" color="destructive" />
          <div className="col-span-2 md:col-span-1 grid grid-cols-2 md:grid-cols-1 gap-4">
            <Card className="group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
              <CardContent className="p-3 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-chart-4/10 group-hover:bg-chart-4/20 transition-colors">
                  <Flame className="h-4 w-4 text-chart-4" />
                </div>
                <div>
                  <p className="text-lg font-bold font-mono">{streak}d</p>
                  <p className="text-[9px] text-muted-foreground font-mono uppercase">Streak</p>
                </div>
              </CardContent>
            </Card>
            <Card className="group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
              <CardContent className="p-3 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-chart-2/10 group-hover:bg-chart-2/20 transition-colors">
                  <Zap className="h-4 w-4 text-chart-2" />
                </div>
                <div>
                  <p className="text-lg font-bold font-mono">{avgPerDay}</p>
                  <p className="text-[9px] text-muted-foreground font-mono uppercase">Per Day</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Reading Heatmap - GitHub style */}
        <Card className="overflow-hidden group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Reading Activity (52 Weeks)
              <Badge variant="secondary" className="text-[9px] font-mono ml-auto">
                {readingYearStats.totalRead} articles read
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Stats row */}
            <div className="flex gap-4 mb-4">
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded bg-primary/10"><Flame className="h-3 w-3 text-primary" /></div>
                <div>
                  <p className="text-sm font-bold font-mono">{readingYearStats.currentStreak}</p>
                  <p className="text-[8px] text-muted-foreground font-mono uppercase">Current Streak</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded bg-chart-4/10"><Zap className="h-3 w-3 text-chart-4" /></div>
                <div>
                  <p className="text-sm font-bold font-mono">{readingYearStats.longestStreak}</p>
                  <p className="text-[8px] text-muted-foreground font-mono uppercase">Longest Streak</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded bg-chart-2/10"><CalendarIcon className="h-3 w-3 text-chart-2" /></div>
                <div>
                  <p className="text-sm font-bold font-mono">{readingYearStats.activeDays}</p>
                  <p className="text-[8px] text-muted-foreground font-mono uppercase">Active Days</p>
                </div>
              </div>
            </div>

            {/* Month labels */}
            <div className="flex gap-0 mb-1 ml-8">
              {monthLabels.map((m, i) => (
                <div
                  key={`${m.label}-${i}`}
                  className="text-[8px] font-mono text-muted-foreground"
                  style={{ position: "relative", left: `${m.week * 13}px` }}
                >
                  {m.label}
                </div>
              ))}
            </div>

            {/* Heatmap grid */}
            <div className="flex gap-1">
              <div className="flex flex-col gap-[2px] mr-1 pt-0.5">
                {DAY_NAMES.map((d, i) => (
                  i % 2 === 1
                    ? <div key={d} className="text-[7px] font-mono text-muted-foreground h-[11px] leading-[11px]">{d}</div>
                    : <div key={d} className="h-[11px]" />
                ))}
              </div>
              <div className="flex gap-[2px] flex-1 overflow-x-auto">
                {Array.from({ length: totalWeeks }, (_, w) => (
                  <div key={w} className="flex flex-col gap-[2px]">
                    {Array.from({ length: 7 }, (_, d) => {
                      const cell = readingHeatmapData.find((c) => c.week === w && c.day === d);
                      const intensity = cell ? cell.count / maxReadingHeatmap : 0;
                      return (
                        <div
                          key={d}
                          className="w-[11px] h-[11px] rounded-[2px] transition-all duration-200 hover:scale-[1.8] hover:z-10 cursor-default"
                          title={cell ? `${format(new Date(cell.date), "MMM d, yyyy")}: ${cell.count} read` : ""}
                          style={{
                            backgroundColor: intensity === 0
                              ? "hsl(var(--muted) / 0.5)"
                              : intensity <= 0.25
                              ? "hsl(var(--primary) / 0.25)"
                              : intensity <= 0.5
                              ? "hsl(var(--primary) / 0.5)"
                              : intensity <= 0.75
                              ? "hsl(var(--primary) / 0.75)"
                              : "hsl(var(--primary))",
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-1 mt-3 justify-end">
              <span className="text-[8px] font-mono text-muted-foreground">Less</span>
              {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                <div
                  key={v}
                  className="w-[11px] h-[11px] rounded-[2px]"
                  style={{
                    backgroundColor: v === 0
                      ? "hsl(var(--muted) / 0.5)"
                      : `hsl(var(--primary) / ${v})`,
                  }}
                />
              ))}
              <span className="text-[8px] font-mono text-muted-foreground">More</span>
            </div>
          </CardContent>
        </Card>

        {/* Activity Heatmap */}
        <Card className="overflow-hidden group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Flame className="h-4 w-4 text-chart-4" />
              Activity Heatmap (12 Weeks)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-1.5">
              <div className="flex flex-col gap-1 mr-1 pt-0.5">
                {DAY_NAMES.map((d, i) => (
                  i % 2 === 1 ? <div key={d} className="text-[8px] font-mono text-muted-foreground h-3 leading-3">{d}</div> : <div key={d} className="h-3" />
                ))}
              </div>
              <div className="flex gap-[3px] flex-1 overflow-x-auto">
                {Array.from({ length: 12 }, (_, w) => (
                  <div key={w} className="flex flex-col gap-[3px]">
                    {Array.from({ length: 7 }, (_, d) => {
                      const cell = heatmapData.find((c) => c.week === w && c.day === d);
                      const intensity = cell ? cell.count / maxHeatmap : 0;
                      return (
                        <div
                          key={d}
                          className="w-3 h-3 rounded-[3px] transition-all duration-200 hover:scale-150 hover:z-10"
                          title={cell ? `${cell.date}: ${cell.count} links` : ""}
                          style={{
                            backgroundColor: intensity === 0
                              ? "hsl(var(--muted))"
                              : `hsl(160, 84%, ${Math.max(20, 39 - intensity * 15)}%, ${0.3 + intensity * 0.7})`,
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1 ml-2 self-end">
                <span className="text-[8px] font-mono text-muted-foreground">Less</span>
                {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                  <div
                    key={v}
                    className="w-3 h-3 rounded-[3px]"
                    style={{
                      backgroundColor: v === 0
                        ? "hsl(var(--muted))"
                        : `hsl(160, 84%, ${Math.max(20, 39 - v * 15)}%, ${0.3 + v * 0.7})`,
                    }}
                  />
                ))}
                <span className="text-[8px] font-mono text-muted-foreground">More</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Links over time */}
        <Card className="overflow-hidden group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Links Saved Over Time
              <Badge variant="secondary" className="text-[9px] font-mono ml-auto">{rangeLabel}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={linksPerDay}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fontFamily: "JetBrains Mono" }} stroke="hsl(215, 12%, 45%)" interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} stroke="hsl(215, 12%, 45%)" allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="count" stroke="hsl(160, 84%, 39%)" fill="url(#colorCount)" strokeWidth={2} dot={linksPerDay.length <= 14} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Tags */}
          <Card className="overflow-hidden group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Hash className="h-4 w-4 text-chart-2" />
                Top Tags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {topTags.length === 0 ? (
                  <EmptyChart label="No tags yet" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topTags} layout="vertical" margin={{ left: 70 }}>
                      <XAxis type="number" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} stroke="hsl(215, 12%, 45%)" allowDecimals={false} />
                      <YAxis dataKey="tag" type="category" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} stroke="hsl(215, 12%, 45%)" width={65} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" radius={[0, 8, 8, 0]} animationDuration={800}>
                        {topTags.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Content Type Distribution */}
          <Card className="overflow-hidden group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-chart-4" />
                Content Types
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {contentTypes.length === 0 ? (
                  <EmptyChart label="No data yet" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        {contentTypes.map((_, i) => (
                          <linearGradient key={i} id={`pieGrad${i}`} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={1} />
                            <stop offset="100%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.6} />
                          </linearGradient>
                        ))}
                      </defs>
                      <Pie
                        data={contentTypes}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={50}
                        paddingAngle={4}
                        cornerRadius={6}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                        style={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
                        animationDuration={800}
                      >
                        {contentTypes.map((_, i) => (
                          <Cell key={i} fill={`url(#pieGrad${i})`} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Day of Week Radar */}
          <Card className="overflow-hidden group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-chart-3" />
                Day of Week Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {links.length === 0 ? (
                  <EmptyChart label="No activity yet" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={dayOfWeekActivity}>
                      <PolarGrid stroke="hsl(215, 12%, 25%)" />
                      <PolarAngleAxis
                        dataKey="day"
                        tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "hsl(215, 12%, 55%)" }}
                      />
                      <Radar
                        dataKey="count"
                        stroke="hsl(160, 84%, 39%)"
                        fill="hsl(160, 84%, 39%)"
                        fillOpacity={0.2}
                        strokeWidth={2}
                        animationDuration={800}
                      />
                      <Tooltip content={<CustomTooltip />} />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top Domains */}
          <Card className="overflow-hidden group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Globe className="h-4 w-4 text-chart-2" />
                Top Domains
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {topDomains.length === 0 ? (
                  <EmptyChart label="No domains yet" />
                ) : (
                  <div className="space-y-2 h-full overflow-y-auto py-1">
                    {topDomains.map((d, i) => {
                      const maxCount = topDomains[0].count;
                      const pct = (d.count / maxCount) * 100;
                      return (
                        <div key={d.domain} className="group/item flex items-center gap-3">
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${d.domain}&sz=32`}
                            alt=""
                            className="h-5 w-5 rounded shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-mono truncate">{d.domain}</span>
                              <span className="text-xs font-mono font-bold text-primary ml-2">{d.count}</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700 ease-out"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tag Cloud */}
        {topTags.length > 0 && (
          <Card className="overflow-hidden group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Hash className="h-4 w-4 text-primary" />
                Tag Cloud
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 py-2">
                {topTags.map((t, i) => {
                  const maxCount = topTags[0].count;
                  const scale = 0.7 + (t.count / maxCount) * 0.6;
                  const opacity = 0.5 + (t.count / maxCount) * 0.5;
                  return (
                    <Badge
                      key={t.tag}
                      variant="outline"
                      className="font-mono transition-all duration-200 hover:scale-110 cursor-default border-primary/20 hover:border-primary/50"
                      style={{
                        fontSize: `${scale * 0.75}rem`,
                        opacity,
                        padding: `${scale * 4}px ${scale * 10}px`,
                        color: CHART_COLORS[i % CHART_COLORS.length],
                        borderColor: `${CHART_COLORS[i % CHART_COLORS.length]}40`,
                      }}
                    >
                      {t.tag}
                      <span className="ml-1.5 opacity-60">{t.count}</span>
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Knowledge Report */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 font-mono">
            <span className="text-primary">✦</span> AI Knowledge Report
          </h2>
          <KnowledgeReport />
        </div>
      </div>
    </div>
  );
};

function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  return (
    <Card className="group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 overflow-hidden relative">
      <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-transparent", `to-${color}/5`)} />
      <CardContent className="p-4 flex items-center gap-3 relative">
        <div className={cn("p-2 rounded-xl transition-all duration-300 group-hover:scale-110", `bg-${color}/10`)}>
          <div className={cn(`text-${color}`)}>{icon}</div>
        </div>
        <div>
          <p className="text-2xl font-bold font-mono">{value}</p>
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        <BarChart3 className="h-5 w-5 text-muted-foreground/50" />
      </div>
      <p className="text-xs text-muted-foreground font-mono">{label}</p>
    </div>
  );
}

export default Analytics;
