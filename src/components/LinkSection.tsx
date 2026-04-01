import { Link } from "@/types/links";
import { LinkCard } from "@/components/LinkCard";
import { LinkGridCard } from "@/components/LinkGridCard";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

const sectionConfig = {
  ready: { icon: CheckCircle2, label: "Ready", className: "text-primary" },
  pending: { icon: Clock, label: "Pending", className: "text-chart-3" },
  failed: { icon: AlertCircle, label: "Failed", className: "text-destructive" },
};

interface LinkSectionProps {
  status: string;
  links: Link[];
  onPin: (id: string, pinned: boolean) => void;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
  onClick: (link: Link) => void;
  onUpdate?: (id: string, updates: Partial<Link>) => void;
  onReview?: (link: Link) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  indexOffset?: number;
  viewMode?: "list" | "grid";
  highlightedId?: string | null;
  showNumbers?: boolean;
  onRetryAll?: () => void;
  retryAllLoading?: boolean;
}

export function LinkSection({
  status,
  links,
  onPin,
  onRetry,
  onDelete,
  onClick,
  onUpdate,
  onReview,
  selectionMode,
  selectedIds,
  onToggleSelect,
  indexOffset = 0,
  viewMode = "list",
  highlightedId,
  showNumbers,
}: LinkSectionProps) {
  if (links.length === 0) return null;

  const config = sectionConfig[status as keyof typeof sectionConfig] || sectionConfig.ready;
  const Icon = config.icon;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 py-1">
        <Icon className={`h-3.5 w-3.5 ${config.className}`} />
        <h3 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">
          {config.label}
        </h3>
        <span className="text-[10px] font-mono text-muted-foreground/60">
          ({links.length})
        </span>
      </div>
      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          {links.map((link, index) => (
            <div
              key={link.id}
              className="animate-fade-in relative"
              style={{
                animationDelay: `${Math.min((indexOffset + index) * 0.03, 0.3)}s`,
                animationFillMode: "backwards",
              }}
            >
              {showNumbers && (
                <span className="absolute -left-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-mono font-bold shadow-sm">
                  {indexOffset + index + 1}
                </span>
              )}
              <LinkGridCard
                link={link}
                onPin={onPin}
                onDelete={onDelete}
                onClick={onClick}
                onReview={onReview}
                selectionMode={selectionMode}
                isSelected={selectedIds?.has(link.id)}
                onToggleSelect={onToggleSelect}
                isHighlighted={highlightedId === link.id}
              />
            </div>
          ))}
        </div>
      ) : (
        links.map((link, index) => (
          <div
            key={link.id}
            className="animate-fade-in flex items-start gap-2"
            style={{
              animationDelay: `${Math.min((indexOffset + index) * 0.03, 0.3)}s`,
              animationFillMode: "backwards",
            }}
          >
            {showNumbers && (
              <span className="flex h-6 w-6 mt-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-mono font-bold shrink-0 shadow-sm">
                {indexOffset + index + 1}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <LinkCard
                link={link}
                onPin={onPin}
                onRetry={onRetry}
                onDelete={onDelete}
                onClick={onClick}
                onUpdate={onUpdate}
                onReview={onReview}
                selectionMode={selectionMode}
                isSelected={selectedIds?.has(link.id)}
                onToggleSelect={onToggleSelect}
                isHighlighted={highlightedId === link.id}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
