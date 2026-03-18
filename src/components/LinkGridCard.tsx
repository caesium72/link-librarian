import { Link } from "@/types/links";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ExternalLink,
  Copy,
  Pin,
  Clock,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  BookCheck,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { HealthStatusIndicator } from "@/components/HealthStatusIndicator";
import { cn } from "@/lib/utils";

const statusConfig = {
  pending: { icon: Clock, dot: "bg-chart-3" },
  ready: { icon: CheckCircle2, dot: "bg-primary" },
  failed: { icon: AlertCircle, dot: "bg-destructive" },
};

const contentTypeColors: Record<string, string> = {
  article: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  video: "bg-chart-4/15 text-chart-4 border-chart-4/30",
  repo: "bg-primary/15 text-primary border-primary/30",
  docs: "bg-chart-3/15 text-chart-3 border-chart-3/30",
  tool: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  thread: "bg-chart-5/15 text-chart-5 border-chart-5/30",
  other: "bg-muted text-muted-foreground border-border",
};

interface LinkGridCardProps {
  link: Link;
  onPin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
  onClick: (link: Link) => void;
  onReview?: (link: Link) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  isHighlighted?: boolean;
}

export function LinkGridCard({
  link,
  onPin,
  onClick,
  onReview,
  selectionMode,
  isSelected,
  onToggleSelect,
  isHighlighted,
}: LinkGridCardProps) {
  const { toast } = useToast();
  const statusInfo = statusConfig[link.status as keyof typeof statusConfig] ?? statusConfig.pending;

  const copyUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(link.original_url);
    toast({ title: "Copied!", description: "URL copied to clipboard" });
  };

  const handleClick = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(link.id);
    } else {
      onClick(link);
    }
  };

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-300 group relative overflow-hidden h-full",
        "hover:shadow-lg hover:-translate-y-0.5",
        isSelected ? "border-primary ring-2 ring-primary/20 shadow-md" : "hover:border-primary/40",
        isHighlighted && "ring-2 ring-primary/40 border-primary",
        !(link as any).is_read && "border-l-2 border-l-primary"
      )}
      onClick={handleClick}
    >
      <div className={cn("absolute top-0 left-0 w-full h-0.5", statusInfo.dot)} />

      <CardContent className="p-3 flex flex-col h-full">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {selectionMode && (
              <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelect?.(link.id)}
                />
              </div>
            )}
            {link.is_pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
            {!(link as any).is_read && <Eye className="h-3 w-3 text-primary shrink-0" />}
            <HealthStatusIndicator
              healthStatus={(link as any).health_status}
              healthStatusCode={(link as any).health_status_code}
              lastHealthCheck={(link as any).last_health_check}
            />
            <span className={cn("h-2 w-2 rounded-full shrink-0", statusInfo.dot, link.status === "pending" && "animate-pulse")} />
          </div>
          {link.domain && (
            <img
              src={`https://www.google.com/s2/favicons?domain=${link.domain}&sz=32`}
              alt=""
              className="h-6 w-6 rounded shrink-0 object-contain ring-1 ring-border/50"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
        </div>

        <h3 className="font-medium text-sm line-clamp-2 mb-1.5 transition-colors hover:text-primary">
          {link.title || link.original_url}
        </h3>

        {link.summary && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2 flex-1">{link.summary}</p>
        )}

        <div className="flex items-center gap-1 flex-wrap mt-auto">
          {link.content_type && link.content_type !== "other" && (
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 font-mono", contentTypeColors[link.content_type] || "")}>
              {link.content_type}
            </Badge>
          )}
          {link.tags?.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">{tag}</Badge>
          ))}
          {(link.tags?.length ?? 0) > 2 && (
            <span className="text-[10px] text-muted-foreground font-mono">+{(link.tags?.length ?? 0) - 2}</span>
          )}
        </div>

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
          <span className="text-[10px] text-muted-foreground font-mono truncate">
            {link.domain || new Date(link.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </span>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-primary/10 hover:text-primary" onClick={copyUrl}>
              <Copy className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-primary/10 hover:text-primary"
              onClick={(e) => { e.stopPropagation(); window.open(link.original_url, "_blank"); }}>
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
