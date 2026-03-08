import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Sparkles, RefreshCw, Clock, BookOpen, TrendingUp, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface ReportData {
  report: string;
  stats: {
    totalLinks: number;
    recentLinks: number;
    readCount: number;
    unreadCount: number;
    completionRate: number;
    totalReadingMinutes: number;
    totalLinksRead: number;
    topTags: [string, number][];
  };
  generatedAt: string;
}

export function KnowledgeReport() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateReport = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("knowledge-report");
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setReportData(data);
      toast.success("Knowledge report generated!");
    } catch (err) {
      console.error("Report generation failed:", err);
      toast.error("Failed to generate report. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!reportData && !isGenerating) {
    return (
      <Card className="border-dashed border-2 hover:border-primary/30 transition-colors">
        <CardContent className="p-8 flex flex-col items-center justify-center gap-4 text-center">
          <div className="p-4 rounded-full bg-primary/10">
            <Brain className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">AI Knowledge Report</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Get an AI-powered analysis of your reading trends, knowledge gaps, and personalized topic recommendations.
            </p>
          </div>
          <Button onClick={generateReport} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Generate Report
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isGenerating) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-5 w-5 text-primary animate-pulse" />
            Analyzing your knowledge...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const { report, stats, generatedAt } = reportData!;

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat icon={<BookOpen className="h-4 w-4" />} label="Library Size" value={stats.totalLinks} />
        <MiniStat icon={<TrendingUp className="h-4 w-4" />} label="Recent (30d)" value={stats.recentLinks} />
        <MiniStat icon={<Target className="h-4 w-4" />} label="Completion" value={`${stats.completionRate}%`} />
        <MiniStat icon={<Clock className="h-4 w-4" />} label="Reading Min" value={stats.totalReadingMinutes} />
      </div>

      {/* Report card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">AI Knowledge Report</CardTitle>
            {generatedAt && (
              <Badge variant="secondary" className="text-[10px] font-mono">
                {format(new Date(generatedAt), "MMM d, h:mm a")}
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={generateReport} disabled={isGenerating} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? "animate-spin" : ""}`} />
            Regenerate
          </Button>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3 prose-h2:first:mt-0 prose-ul:my-2 prose-li:my-0.5">
            <ReactMarkdown>{report}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      {/* Top tags */}
      {stats.topTags.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Top Knowledge Areas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {stats.topTags.map(([tag, count]) => (
              <Badge key={tag} variant="outline" className="gap-1.5">
                {tag}
                <span className="text-muted-foreground/60">{count}</span>
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-2.5">
        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">{icon}</div>
        <div>
          <p className="text-lg font-bold font-mono leading-none">{value}</p>
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
