import { useState } from "react";
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
  ChevronDown,
  Sparkles,
  Eye,
  ImageOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AddToCollectionMenu } from "@/components/AddToCollectionMenu";
import { HealthStatusIndicator } from "@/components/HealthStatusIndicator";
import { cn } from "@/lib/utils";

const statusConfig = {
  pending: { icon: Clock, label: "Pending", className: "bg-muted text-muted-foreground", dot: "bg-chart-3" },
  ready: { icon: CheckCircle2, label: "Ready", className: "bg-primary/10 text-primary", dot: "bg-primary" },
  failed: { icon: AlertCircle, label: "Failed", className: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
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
  onReview?: (link: Link) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  isHighlighted?: boolean;
}

export function LinkCard({ link, onPin, onRetry, onDelete, onClick, onReview, selectionMode, isSelected, onToggleSelect, isHighlighted }: LinkCardProps) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const statusInfo = statusConfig[link.status as keyof typeof statusConfig] ?? statusConfig.pending;
  const ogImage = (link as any).og_image as string | null;
  const hasPreview = ogImage && !imgError;

  const copyUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(link.original_url);
    toast({ title: "Copied!", description: "URL copied to clipboard" });
  };

  const handleClick = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(link.id);
    } else {
      setExpanded(!expanded);
    }
  };

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-300 group relative overflow-hidden",
        "hover:shadow-lg hover:-translate-y-0.5",
        "before:absolute before:inset-0 before:rounded-[inherit] before:opacity-0 before:transition-opacity before:duration-300",
        "hover:before:opacity-100 before:bg-gradient-to-r before:from-primary/[0.03] before:to-transparent before:pointer-events-none",
        isSelected ? "border-primary ring-2 ring-primary/20 shadow-md" : "hover:border-primary/40",
        expanded && "shadow-lg border-primary/30 ring-1 ring-primary/10",
        isHighlighted && "ring-2 ring-primary/40 border-primary",
        !(link as any).is_read && "border-l-2 border-l-primary"
      )}
      onClick={handleClick}
    >
      {/* Status indicator line */}
      <div className={cn(
        "absolute top-0 left-0 w-full h-0.5 transition-all duration-500",
        expanded ? "opacity-100" : "opacity-0 group-hover:opacity-60",
        statusInfo.dot
      )} />

      <CardContent className="p-4 relative">
        <div className="flex items-start justify-between gap-3">
          {selectionMode && (
            <div className="pt-0.5 shrink-0 animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect?.(link.id)}
                className="transition-transform duration-200 hover:scale-110"
              />
            </div>
          )}

          {/* OG Image thumbnail */}
          {hasPreview && (
            <div className="shrink-0 w-20 h-14 rounded-md overflow-hidden ring-1 ring-border/50 bg-muted">
              <img
                src={ogImage}
                alt=""
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={() => setImgError(true)}
                loading="lazy"
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {link.is_pinned && (
                <Pin className="h-3 w-3 text-primary shrink-0 animate-scale-in" />
              )}
              {!(link as any).is_read && (
                <Eye className="h-3 w-3 text-primary shrink-0" />
              )}
              <HealthStatusIndicator
                healthStatus={(link as any).health_status}
                healthStatusCode={(link as any).health_status_code}
                lastHealthCheck={(link as any).last_health_check}
              />
              <span className={cn(
                "h-2 w-2 rounded-full shrink-0 transition-all duration-300",
                statusInfo.dot,
                link.status === "pending" && "animate-pulse"
              )} />
              <h3
                className="font-medium text-sm truncate transition-colors duration-200 hover:text-primary cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(link.original_url, "_blank");
                }}
              >
                {link.title || link.original_url}
              </h3>
              <ChevronDown className={cn(
                "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-all duration-300 ml-auto",
                expanded ? "rotate-180 text-primary" : "group-hover:text-foreground"
              )} />
            </div>

            {link.summary && (
              <p className={cn(
                "text-xs text-muted-foreground mb-2 transition-all duration-300",
                expanded ? "line-clamp-none" : "line-clamp-2"
              )}>
                {link.summary}
              </p>
            )}

            <div className="flex items-center gap-1.5 flex-wrap">
              {link.content_type && link.content_type !== "other" && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5 py-0 font-mono transition-transform duration-200 hover:scale-105",
                    contentTypeColors[link.content_type] || ""
                  )}
                >
                  {link.content_type}
                </Badge>
              )}
              {link.tags?.slice(0, expanded ? undefined : 4).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 font-mono transition-transform duration-200 hover:scale-105">
                  {tag}
                </Badge>
              ))}
              {!expanded && (link.tags?.length ?? 0) > 4 && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  +{(link.tags?.length ?? 0) - 4}
                </span>
              )}
            </div>
          </div>

          {!hasPreview && link.domain && (
            <img
              src={`https://www.google.com/s2/favicons?domain=${link.domain}&sz=32`}
              alt=""
              className="h-8 w-8 rounded-md shrink-0 object-contain ring-1 ring-border/50 transition-transform duration-200 group-hover:scale-110"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}

          {!selectionMode && (
            <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0">
              <AddToCollectionMenu linkId={link.id} />
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-primary/10 hover:text-primary" onClick={copyUrl}>
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md hover:bg-primary/10 hover:text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(link.original_url, "_blank");
                }}
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
              {link.status === "failed" && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md hover:bg-chart-3/10 hover:text-chart-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRetry(link.id);
                    }}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                  {onReview && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-md hover:bg-primary/10 hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        onReview(link);
                      }}
                      title="Review failed link"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  )}
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md hover:bg-destructive/10 hover:text-destructive"
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

        {/* Expanded content with large preview */}
        <div className={cn(
          "grid transition-all duration-400 ease-in-out",
          expanded ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0"
        )}>
          <div className="overflow-hidden">
            <div className="border-t border-border/50 pt-3 space-y-3 animate-fade-in">
              {/* Large OG preview when expanded */}
              {ogImage && (
                <div className="rounded-lg overflow-hidden ring-1 ring-border/50 bg-muted max-h-48">
                  <img
                    src={ogImage}
                    alt={link.title || ""}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                    loading="lazy"
                  />
                </div>
              )}

              {/* Key points */}
              {link.key_points && link.key_points.length > 0 && (
                <div>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-primary" />
                    Key Points
                  </p>
                  <ul className="space-y-1.5">
                    {link.key_points.map((point, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-2 animate-fade-in" style={{ animationDelay: `${i * 0.05}s`, animationFillMode: "backwards" }}>
                        <span className="text-primary mt-0.5 text-sm">›</span>
                        <span className="leading-relaxed">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Notes */}
              {link.notes && (
                <div className="bg-muted/40 rounded-md p-2.5 border border-border/30">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-xs text-foreground/80 leading-relaxed">{link.notes}</p>
                </div>
              )}

              {/* Actions row */}
              <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs font-mono gap-1.5 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                  onClick={() => window.open(link.original_url, "_blank")}
                >
                  <ExternalLink className="h-3 w-3" /> Open
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs font-mono gap-1.5 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                  onClick={copyUrl}
                >
                  <Copy className="h-3 w-3" /> Copy
                </Button>
                <Button
                  variant={link.is_pinned ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-7 text-xs font-mono gap-1.5 transition-all",
                    !link.is_pinned && "hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                  )}
                  onClick={() => onPin(link.id, link.is_pinned)}
                >
                  <Pin className="h-3 w-3" /> {link.is_pinned ? "Pinned" : "Pin"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs font-mono gap-1.5 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                  onClick={() => onClick(link)}
                >
                  Edit Details
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground font-mono">
          {link.domain && <span className="truncate max-w-[120px]">{link.domain}</span>}
          <span>{new Date(link.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
          {link.save_count > 1 && (
            <span className="inline-flex items-center gap-1">
              saved {link.save_count}×
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}