import { useState, useCallback, useEffect } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useRequireAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchLinks, updateLink, retryAnalysis, deleteLink } from "@/lib/api/links";
import { LinkCard } from "@/components/LinkCard";
import { LinkDetail } from "@/components/LinkDetail";
import { Input } from "@/components/ui/input";
import { AddLinkInput } from "@/components/AddLinkInput";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, LogOut, Inbox, Pin, BookMarked, FileText, Video, GitBranch, BookOpen, Wrench, MessageSquare, LayoutGrid, Filter, Clock, CheckCircle2, AlertCircle, ArrowUpDown, ArrowDown, ArrowUp, Settings } from "lucide-react";
import { ImportDialog } from "@/components/ImportDialog";
import { useToast } from "@/hooks/use-toast";
import type { Link } from "@/types/links";

const Index = () => {
  const { user, signOut, loading: authLoading } = useRequireAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [contentType, setContentType] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedLink, setSelectedLink] = useState<Link | null>(null);
  const [showPinned, setShowPinned] = useState(false);
  const [sortBy, setSortBy] = useState("date_desc");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["links", debouncedSearch, contentType, statusFilter, showPinned, sortBy],
    queryFn: () =>
      fetchLinks({
        search: debouncedSearch || undefined,
        contentType: contentType !== "all" ? contentType : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        isPinned: showPinned ? true : undefined,
        sortBy,
      }),
    enabled: !!user,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Link> }) =>
      updateLink(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["links"] });
      if (selectedLink?.id === data.id) setSelectedLink(data);
      toast({ title: "Updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const retryMutation = useMutation({
    mutationFn: retryAnalysis,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["links"] });
      toast({ title: "Analysis queued", description: "The link will be re-analyzed." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLink,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["links"] });
      if (selectedLink) setSelectedLink(null);
      toast({ title: "Deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleUpdate = useCallback(
    (id: string, updates: Partial<Link>) => updateMutation.mutate({ id, updates }),
    [updateMutation]
  );

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="font-mono text-muted-foreground animate-pulse">Loading...</div>
      </div>
    );
  }

  const pendingCount = links.filter((l) => l.status === "pending").length;
  const readyCount = links.filter((l) => l.status === "ready").length;
  const failedCount = links.filter((l) => l.status === "failed").length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-10 bg-background/95 backdrop-blur">
        <div className="container flex items-center justify-between h-12 px-4">
          <div className="flex items-center gap-2">
            <BookMarked className="h-4 w-4 text-primary" />
            <h1 className="font-mono text-sm font-semibold">Link Librarian</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
              {user?.email}
            </span>
            <ImportDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: ["links"] })} />
            <RouterLink to="/settings">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </RouterLink>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={signOut}>
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container px-4 py-4 max-w-4xl">
        {/* Add Link */}
        <div className="mb-4">
          <AddLinkInput onSuccess={() => queryClient.invalidateQueries({ queryKey: ["links"] })} />
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search links..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 font-mono text-sm h-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={contentType} onValueChange={setContentType}>
              <SelectTrigger className="w-28 h-9 text-xs font-mono">
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-28 h-9 text-xs font-mono">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><span className="flex items-center gap-1.5"><Filter className="h-3 w-3" />All</span></SelectItem>
                <SelectItem value="pending"><span className="flex items-center gap-1.5"><Clock className="h-3 w-3" />Pending</span></SelectItem>
                <SelectItem value="ready"><span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" />Ready</span></SelectItem>
                <SelectItem value="failed"><span className="flex items-center gap-1.5"><AlertCircle className="h-3 w-3" />Failed</span></SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-28 h-9 text-xs font-mono">
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
            <Button
              variant={showPinned ? "default" : "outline"}
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setShowPinned(!showPinned)}
            >
              <Pin className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex gap-4 mb-4 text-xs font-mono text-muted-foreground">
          <span>{links.length} links</span>
          {pendingCount > 0 && <span className="text-chart-3">{pendingCount} pending</span>}
          {readyCount > 0 && <span className="text-primary">{readyCount} ready</span>}
          {failedCount > 0 && <span className="text-destructive">{failedCount} failed</span>}
        </div>

        {/* Links Grid */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-card rounded-lg animate-pulse border border-border" />
            ))}
          </div>
        ) : links.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BookMarked className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h2 className="font-mono text-sm text-muted-foreground mb-1">No links yet</h2>
            <p className="text-xs text-muted-foreground/70 max-w-sm">
              Add a link above or paste links in your Telegram channel and they'll appear here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {links.map((link) => (
              <LinkCard
                key={link.id}
                link={link}
                onPin={(id, pinned) => handleUpdate(id, { is_pinned: !pinned })}
                onRetry={(id) => retryMutation.mutate(id)}
                onDelete={(id) => deleteMutation.mutate(id)}
                onClick={setSelectedLink}
              />
            ))}
          </div>
        )}
      </main>

      {/* Link Detail Sheet */}
      <LinkDetail
        link={selectedLink}
        open={!!selectedLink}
        onClose={() => setSelectedLink(null)}
        onUpdate={handleUpdate}
        onRetry={(id) => retryMutation.mutate(id)}
        onDelete={(id) => deleteMutation.mutate(id)}
      />
    </div>
  );
};

export default Index;
