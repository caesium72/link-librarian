import { useState } from "react";
import { Link } from "@/types/links";
import { LinkCard } from "@/components/LinkCard";
import { Clock, CheckCircle2, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";

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
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  indexOffset?: number;
  defaultOpen?: boolean;
}

export function LinkSection({
  status,
  links,
  onPin,
  onRetry,
  onDelete,
  onClick,
  selectionMode,
  selectedIds,
  onToggleSelect,
  indexOffset = 0,
  defaultOpen = true,
}: LinkSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (links.length === 0) return null;

  const config = sectionConfig[status as keyof typeof sectionConfig] || sectionConfig.ready;
  const Icon = config.icon;
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="flex items-center gap-2 py-1 w-full text-left cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => setOpen(!open)}
      >
        <Chevron className="h-3.5 w-3.5 text-muted-foreground" />
        <Icon className={`h-3.5 w-3.5 ${config.className}`} />
        <h3 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">
          {config.label}
        </h3>
        <span className="text-[10px] font-mono text-muted-foreground/60">
          ({links.length})
        </span>
      </button>
      {open &&
        links.map((link, index) => (
          <div
            key={link.id}
            className="animate-fade-in"
            style={{
              animationDelay: `${Math.min((indexOffset + index) * 0.03, 0.3)}s`,
              animationFillMode: "backwards",
            }}
          >
            <LinkCard
              link={link}
              onPin={onPin}
              onRetry={onRetry}
              onDelete={onDelete}
              onClick={onClick}
              selectionMode={selectionMode}
              isSelected={selectedIds?.has(link.id)}
              onToggleSelect={onToggleSelect}
            />
          </div>
        ))}
    </div>
  );
}
