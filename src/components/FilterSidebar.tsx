import logo from "@/assets/logo.png";
import { Link as RouterLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
  ArrowUpDown, ArrowDown, ArrowUp, Settings, LogOut,
} from "lucide-react";
import { ImportDialog } from "@/components/ImportDialog";
import { ThemeToggle } from "@/components/ThemeToggle";

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
  userEmail?: string;
  onSignOut: () => void;
  onRefresh: () => void;
}

export function FilterSidebar({
  contentType, setContentType,
  statusFilter, setStatusFilter,
  sortBy, setSortBy,
  showPinned, setShowPinned,
  linkCount, pendingCount, readyCount, failedCount,
  userEmail, onSignOut, onRefresh,
}: FilterSidebarProps) {
  return (
    <aside className="w-56 shrink-0 border-r border-border bg-card/50 flex flex-col h-screen sticky top-0 overflow-y-auto">
      {/* Logo & user */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <img src={logo} alt="Xenonowledge" className="h-5 w-5" />
          <h1 className="font-mono text-sm font-semibold">Xenonowledge</h1>
        </div>
        <p className="text-[10px] text-muted-foreground font-mono truncate">{userEmail}</p>
      </div>

      {/* Stats */}
      <div className="p-4 border-b border-border space-y-2">
        <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Overview</h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-muted/50 rounded-md p-2 text-center">
            <div className="text-lg font-semibold font-mono">{linkCount}</div>
            <div className="text-[10px] text-muted-foreground">Total</div>
          </div>
          <div className="bg-primary/10 rounded-md p-2 text-center">
            <div className="text-lg font-semibold font-mono text-primary">{readyCount}</div>
            <div className="text-[10px] text-muted-foreground">Ready</div>
          </div>
          <div className="bg-chart-3/10 rounded-md p-2 text-center">
            <div className="text-lg font-semibold font-mono text-chart-3">{pendingCount}</div>
            <div className="text-[10px] text-muted-foreground">Pending</div>
          </div>
          <div className="bg-destructive/10 rounded-md p-2 text-center">
            <div className="text-lg font-semibold font-mono text-destructive">{failedCount}</div>
            <div className="text-[10px] text-muted-foreground">Failed</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 space-y-3 flex-1">
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
      </div>

      {/* Bottom actions */}
      <div className="p-4 border-t border-border space-y-2">
        <ImportDialog onSuccess={onRefresh} />
        <div className="flex items-center gap-1">
          <ThemeToggle />
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
    </aside>
  );
}
