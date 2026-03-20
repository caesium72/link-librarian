import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";
import { TrendingUp, BarChart3, CalendarIcon, Flame } from "lucide-react";
import { format, subDays, eachDayOfInterval, differenceInDays } from "date-fns";

const CHART_COLORS = [
  "hsl(160, 84%, 39%)", "hsl(200, 80%, 45%)", "hsl(40, 90%, 45%)",
  "hsl(280, 65%, 50%)", "hsl(0, 72%, 50%)", "hsl(180, 60%, 40%)",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Link {
  created_at: string;
  content_type?: string | null;
  tags?: string[] | null;
  reading_completed_at?: string | null;
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg backdrop-blur text-xs font-mono">
      <p className="text-muted-foreground">{label || payload[0]?.name}</p>
      <p className="text-primary font-bold">{payload[0].value}</p>
    </div>
  );
};

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-full flex items-center justify-center">
      <p className="text-xs text-muted-foreground font-mono">{label}</p>
    </div>
  );
}

export function LinksOverTimeChart({ links }: { links: Link[] }) {
  const data = useMemo(() => {
    const from = subDays(new Date(), 30);
    const to = new Date();
    const days = eachDayOfInterval({ start: from, end: to });
    const counts: Record<string, number> = {};
    days.forEach(d => { counts[format(d, "yyyy-MM-dd")] = 0; });
    links.forEach(l => {
      const day = l.created_at.slice(0, 10);
      if (day in counts) counts[day]++;
    });
    return Object.entries(counts).map(([date, count]) => ({
      date: format(new Date(date), "MMM d"),
      count,
    }));
  }, [links]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Links Saved (30d)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          {data.length === 0 ? <EmptyChart label="No data yet" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="dashGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 8, fontFamily: "monospace" }} stroke="hsl(var(--muted-foreground))" interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fontFamily: "monospace" }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} width={24} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#dashGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ContentTypePieChart({ links }: { links: Link[] }) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    links.forEach(l => { const t = l.content_type || "other"; counts[t] = (counts[t] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [links]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-chart-4" />
          Content Types
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          {data.length === 0 ? <EmptyChart label="No data yet" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={70} innerRadius={40}
                  paddingAngle={3} cornerRadius={4}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                  style={{ fontSize: 9, fontFamily: "monospace" }}
                  animationDuration={600}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function DayOfWeekRadar({ links }: { links: Link[] }) {
  const data = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    links.forEach(l => { counts[new Date(l.created_at).getDay()]++; });
    return DAY_NAMES.map((day, i) => ({ day, count: counts[i] }));
  }, [links]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-chart-3" />
          Weekly Pattern
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          {links.length === 0 ? <EmptyChart label="No activity yet" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={data}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="day" tick={{ fontSize: 9, fontFamily: "monospace", fill: "hsl(var(--muted-foreground))" }} />
                <Radar dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} animationDuration={600} />
                <Tooltip content={<ChartTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ActivityHeatmap({ links }: { links: Link[] }) {
  const heatmapData = useMemo(() => {
    const weeks: { day: number; week: number; count: number; date: string }[] = [];
    const today = new Date();
    for (let w = 11; w >= 0; w--) {
      for (let d = 0; d < 7; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() - (w * 7 + (6 - d)));
        weeks.push({ day: d, week: 11 - w, count: 0, date: format(date, "yyyy-MM-dd") });
      }
    }
    links.forEach(l => {
      const day = l.created_at.slice(0, 10);
      const cell = weeks.find(c => c.date === day);
      if (cell) cell.count++;
    });
    return weeks;
  }, [links]);

  const maxCount = Math.max(1, ...heatmapData.map(c => c.count));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono flex items-center gap-2">
          <Flame className="h-4 w-4 text-chart-4" />
          Activity (12 Weeks)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-1">
          <div className="flex flex-col gap-[2px] mr-1 pt-0.5">
            {DAY_NAMES.map((d, i) => (
              i % 2 === 1
                ? <div key={d} className="text-[7px] font-mono text-muted-foreground h-[11px] leading-[11px]">{d}</div>
                : <div key={d} className="h-[11px]" />
            ))}
          </div>
          <div className="flex gap-[2px] flex-1 overflow-x-auto">
            {Array.from({ length: 12 }, (_, w) => (
              <div key={w} className="flex flex-col gap-[2px]">
                {Array.from({ length: 7 }, (_, d) => {
                  const cell = heatmapData.find(c => c.week === w && c.day === d);
                  const intensity = cell ? cell.count / maxCount : 0;
                  return (
                    <div
                      key={d}
                      className="w-[11px] h-[11px] rounded-[2px] transition-all duration-200 hover:scale-150 hover:z-10"
                      title={cell ? `${cell.date}: ${cell.count} links` : ""}
                      style={{
                        backgroundColor: intensity === 0
                          ? "hsl(var(--muted) / 0.5)"
                          : intensity <= 0.25 ? "hsl(var(--primary) / 0.25)"
                          : intensity <= 0.5 ? "hsl(var(--primary) / 0.5)"
                          : intensity <= 0.75 ? "hsl(var(--primary) / 0.75)"
                          : "hsl(var(--primary))",
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 mt-2 justify-end">
          <span className="text-[7px] font-mono text-muted-foreground">Less</span>
          {[0, 0.25, 0.5, 0.75, 1].map(v => (
            <div key={v} className="w-[9px] h-[9px] rounded-[2px]"
              style={{ backgroundColor: v === 0 ? "hsl(var(--muted) / 0.5)" : `hsl(var(--primary) / ${v})` }} />
          ))}
          <span className="text-[7px] font-mono text-muted-foreground">More</span>
        </div>
      </CardContent>
    </Card>
  );
}
