import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/useProfile";
import { Link as RouterLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pin, FileText, Video, GitBranch, BookOpen, Wrench, MessageSquare,
  LayoutGrid, Filter, Clock, CheckCircle2, AlertCircle,
  ArrowUpDown, ArrowDown, ArrowUp, Settings, LogOut, Menu, PanelLeftClose, BarChart3, Copy, Trash2, Newspaper,
} from "lucide-react";
import { ImportDialog } from "@/components/ImportDialog";
import { ImportBookmarksDialog } from "@/components/ImportBookmarksDialog";
import { ExportDialog } from "@/components/ExportDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CollectionManager } from "@/components/CollectionManager";

interface FilterSidebarProps {
  contentType: string;
  setContentType: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  sortBy: string;
  setSortBy: (v: string) => void;
  showPinned: boolean;
  setShowPinned: (v: boolean) => void;
  linkCount: number;
  pendingCount: number;
  readyCount: number;
  failedCount: number;
  duplicateCount: number;
  deletedCount: number;
  userEmail?: string;
  onSignOut: () => void;
  onRefresh: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  selectedCollectionId: string | null;
  onSelectCollection: (id: string | null) => void;
  onStatClick?: (stat: string) => void;
  activeStatFilter?: string;
}

export function FilterSidebar({
  contentType, setContentType,
  statusFilter, setStatusFilter,
  sortBy, setSortBy,
  showPinned, setShowPinned,
  linkCount, pendingCount, readyCount, failedCount, duplicateCount, deletedCount,
  userEmail, onSignOut, onRefresh,
  collapsed = false, onToggleCollapse,
  selectedCollectionId, onSelectCollection,
  onStatClick,
  activeStatFilter,
}: FilterSidebarProps) {
  const { profile } = useProfile();
  const sidebarName = profile?.display_name || profile?.username || userEmail;
  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "shrink-0 border-r border-border bg-card/50 flex flex-col h-screen sticky top-0 transition-[width] duration-300 ease-in-out overflow-hidden",
          collapsed ? "w-12" : "w-56"
        )}
      >
        {/* Collapsed view */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center py-3 gap-2 transition-opacity duration-200",
            collapsed ? "opacity-100 pointer-events-auto delay-100" : "opacity-0 pointer-events-none"
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleCollapse}>
                <Menu className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <img src={logo} alt="Xenonowledge" className="h-5 w-5 mt-1" />
            </TooltipTrigger>
            <TooltipContent side="right">Xenonowledge</TooltipContent>
          </Tooltip>
          <div className="flex-1" />
          <ThemeToggle />
          <Tooltip>
            <TooltipTrigger asChild>
              <RouterLink to="/analytics">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <BarChart3 className="h-3.5 w-3.5" />
                </Button>
              </RouterLink>
            </TooltipTrigger>
            <TooltipContent side="right">Analytics</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <RouterLink to="/digest">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Newspaper className="h-3.5 w-3.5" />
                </Button>
              </RouterLink>
            </TooltipTrigger>
            <TooltipContent side="right">Digest</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <RouterLink to="/settings">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </RouterLink>
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onSignOut}>
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sign out</TooltipContent>
          </Tooltip>
        </div>

        {/* Expanded view */}
        <div
          className={cn(
            "flex flex-col h-full min-w-[14rem] transition-opacity duration-200",
            collapsed ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto delay-100"
          )}
        >
          {/* Logo & user */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <img src={logo} alt="Xenonowledge" className="h-5 w-5" />
                <h1 className="font-mono text-sm font-semibold whitespace-nowrap">Xenonowledge</h1>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleCollapse}>
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono truncate" title={userEmail}>
              {sidebarName}
            </p>
          </div>

          {/* Stats */}
          <div className="p-4 border-b border-border space-y-2">
            <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Overview</h3>
            <div className="grid grid-cols-2 gap-2">
              <StatCard
                value={linkCount}
                label="Total"
                className="bg-muted/50"
                active={activeStatFilter === "all"}
                onClick={() => onStatClick?.("all")}
              />
              <StatCard
                value={readyCount}
                label="Ready"
                className="bg-primary/10"
                valueClassName="text-primary"
                active={activeStatFilter === "ready"}
                onClick={() => onStatClick?.("ready")}
              />
              <StatCard
                value={pendingCount}
                label="Pending"
                className="bg-chart-3/10"
                valueClassName="text-chart-3"
                active={activeStatFilter === "pending"}
                onClick={() => onStatClick?.("pending")}
              />
              <StatCard
                value={failedCount}
                label="Failed"
                className="bg-destructive/10"
                valueClassName="text-destructive"
                active={activeStatFilter === "failed"}
                onClick={() => onStatClick?.("failed")}
              />
              <div className="col-span-2 grid grid-cols-2 gap-2">
                <StatCard
                  value={duplicateCount}
                  label="Duplicates"
                  className="bg-chart-4/10"
                  valueClassName="text-chart-4"
                  active={activeStatFilter === "duplicates"}
                  onClick={() => onStatClick?.("duplicates")}
                  icon={<Copy className="h-3 w-3 text-chart-4" />}
                />
                <StatCard
                  value={deletedCount}
                  label="Recycle Bin"
                  className="bg-muted/50"
                  valueClassName="text-muted-foreground"
                  active={activeStatFilter === "deleted"}
                  onClick={() => onStatClick?.("deleted")}
                  icon={<Trash2 className="h-3 w-3 text-muted-foreground" />}
                />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="p-4 space-y-3 flex-1 overflow-y-auto">
            <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Filters</h3>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-muted-foreground">Content Type</label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger className="h-8 text-xs font-mono">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all"><span className="flex items-center gap-1.5"><LayoutGrid className="h-3 w-3" />All types</span></SelectItem>
                  <SelectItem value="article"><span className="flex items-center gap-1.5"><FileText className="h-3 w-3" />Article</span></SelectItem>
                  <SelectItem value="video"><span className="flex items-center gap-1.5"><Video className="h-3 w-3" />Video</span></SelectItem>
                  <SelectItem value="repo"><span className="flex items-center gap-1.5"><GitBranch className="h-3 w-3" />Repo</span></SelectItem>
                  <SelectItem value="docs"><span className="flex items-center gap-1.5"><BookOpen className="h-3 w-3" />Docs</span></SelectItem>
                  <SelectItem value="tool"><span className="flex items-center gap-1.5"><Wrench className="h-3 w-3" />Tool</span></SelectItem>
                  <SelectItem value="thread"><span className="flex items-center gap-1.5"><MessageSquare className="h-3 w-3" />Thread</span></SelectItem>
                  <SelectItem value="other"><span className="flex items-center gap-1.5"><LayoutGrid className="h-3 w-3" />Other</span></SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-muted-foreground">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs font-mono">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all"><span className="flex items-center gap-1.5"><Filter className="h-3 w-3" />All</span></SelectItem>
                  <SelectItem value="pending"><span className="flex items-center gap-1.5"><Clock className="h-3 w-3" />Pending</span></SelectItem>
                  <SelectItem value="ready"><span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" />Ready</span></SelectItem>
                  <SelectItem value="failed"><span className="flex items-center gap-1.5"><AlertCircle className="h-3 w-3" />Failed</span></SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-muted-foreground">Sort By</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-8 text-xs font-mono">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_desc"><span className="flex items-center gap-1.5"><ArrowDown className="h-3 w-3" />Newest</span></SelectItem>
                  <SelectItem value="date_asc"><span className="flex items-center gap-1.5"><ArrowUp className="h-3 w-3" />Oldest</span></SelectItem>
                  <SelectItem value="title_asc"><span className="flex items-center gap-1.5"><ArrowUpDown className="h-3 w-3" />Title A-Z</span></SelectItem>
                  <SelectItem value="title_desc"><span className="flex items-center gap-1.5"><ArrowUpDown className="h-3 w-3" />Title Z-A</span></SelectItem>
                  <SelectItem value="domain_asc"><span className="flex items-center gap-1.5"><ArrowUpDown className="h-3 w-3" />Domain A-Z</span></SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant={showPinned ? "default" : "outline"}
              size="sm"
              className="w-full h-8 text-xs font-mono gap-1.5"
              onClick={() => setShowPinned(!showPinned)}
            >
              <Pin className="h-3 w-3" />
              {showPinned ? "Showing Pinned" : "Show Pinned Only"}
            </Button>

            <CollectionManager
              selectedCollectionId={selectedCollectionId}
              onSelectCollection={onSelectCollection}
              collapsed={collapsed}
            />
          </div>

          {/* Bottom actions */}
          <div className="p-4 border-t border-border space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <ImportDialog onSuccess={onRefresh} />
              <ImportBookmarksDialog onSuccess={onRefresh} />
              <ExportDialog />
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <RouterLink to="/analytics">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <BarChart3 className="h-3.5 w-3.5" />
                </Button>
              </RouterLink>
              <RouterLink to="/digest">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Newspaper className="h-3.5 w-3.5" />
                </Button>
              </RouterLink>
              <RouterLink to="/settings">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </RouterLink>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onSignOut}>
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}

function StatCard({
  value,
  label,
  className,
  valueClassName,
  active,
  onClick,
  icon,
}: {
  value: number;
  label: string;
  className?: string;
  valueClassName?: string;
  active?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md p-2 text-center transition-all duration-200 cursor-pointer border border-border",
        "hover:ring-2 hover:ring-primary/30 hover:scale-[1.02]",
        active && "ring-2 ring-primary shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-center gap-1">
        {icon}
        <span className={cn("text-lg font-semibold font-mono", valueClassName)}>{value}</span>
      </div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </button>
  );
}

