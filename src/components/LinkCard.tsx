import { Link } from "@/types/links";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ExternalLink,
  Copy,
  Pin,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const statusConfig = {
  pending: { icon: Clock, label: "Pending", className: "bg-muted text-muted-foreground" },
  ready: { icon: CheckCircle2, label: "Ready", className: "bg-primary/10 text-primary" },
  failed: { icon: AlertCircle, label: "Failed", className: "bg-destructive/10 text-destructive" },
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

interface LinkCardProps {
  link: Link;
  onPin: (id: string, pinned: boolean) => void;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
  onClick: (link: Link) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export function LinkCard({ link, onPin, onRetry, onDelete, onClick, selectionMode, isSelected, onToggleSelect }: LinkCardProps) {
  const { toast } = useToast();
  const StatusIcon = statusConfig[link.status as keyof typeof statusConfig]?.icon ?? Clock;

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
      className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group ${
        isSelected ? "border-primary ring-1 ring-primary/30" : "hover:border-primary/40"
      }`}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {selectionMode && (
            <div className="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect?.(link.id)}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {link.is_pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
              <StatusIcon className={`h-3 w-3 shrink-0 ${statusConfig[link.status as keyof typeof statusConfig]?.className?.split(" ").pop()}`} />
              <h3
                className="font-medium text-sm truncate hover:underline hover:text-primary cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(link.original_url, "_blank");
                }}
              >
                {link.title || link.original_url}
              </h3>
            </div>

            {link.summary && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                {link.summary}
              </p>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {link.content_type && link.content_type !== "other" && (
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 font-mono ${contentTypeColors[link.content_type] || ""}`}
                >
                  {link.content_type}
                </Badge>
              )}
              {link.tags?.slice(0, 4).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                  {tag}
                </Badge>
              ))}
              {(link.tags?.length ?? 0) > 4 && (
                <span className="text-[10px] text-muted-foreground">
                  +{(link.tags?.length ?? 0) - 4}
                </span>
              )}
            </div>
          </div>

          {!selectionMode && (
            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyUrl}>
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(link.original_url, "_blank");
                }}
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
              {link.status === "failed" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRetry(link.id);
                  }}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(link.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground font-mono">
          {link.domain && <span>{link.domain}</span>}
          <span>{new Date(link.created_at).toLocaleDateString()}</span>
          {link.save_count > 1 && <span>saved {link.save_count}×</span>}
        </div>
      </CardContent>
    </Card>
  );
}
