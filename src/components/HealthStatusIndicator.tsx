import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Heart, HeartCrack, HelpCircle } from "lucide-react";

interface HealthStatusIndicatorProps {
  healthStatus?: string | null;
  healthStatusCode?: number | null;
  lastHealthCheck?: string | null;
  className?: string;
}

export function HealthStatusIndicator({ healthStatus, healthStatusCode, lastHealthCheck, className }: HealthStatusIndicatorProps) {
  if (!healthStatus || healthStatus === "unknown") return null;

  const isHealthy = healthStatus === "healthy";
  const isBroken = healthStatus === "broken";

  const Icon = isHealthy ? Heart : isBroken ? HeartCrack : HelpCircle;
  const label = isHealthy
    ? "Link is healthy"
    : isBroken
    ? `Link is broken${healthStatusCode ? ` (${healthStatusCode})` : ""}`
    : "Health unknown";

  const lastChecked = lastHealthCheck
    ? new Date(lastHealthCheck).toLocaleDateString()
    : "Never";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("inline-flex shrink-0", className)}>
            <Icon
              className={cn(
                "h-3 w-3",
                isHealthy && "text-chart-2",
                isBroken && "text-destructive animate-pulse"
              )}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{label}</p>
          <p className="text-[10px] text-muted-foreground">Checked: {lastChecked}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
