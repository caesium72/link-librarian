import { useState, useCallback, useEffect, useRef } from "react";
import { Link as RouterLink } from "react-router-dom";
import logo from "@/assets/logo.png";
import { useRequireAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchLinks, updateLink, retryAnalysis, deleteLink, bulkDeleteLinks, bulkAddTag, fetchDeletedLinks, restoreLink, emptyTrash, permanentDeleteLink } from "@/lib/api/links";
import { checkLinksHealth } from "@/lib/api/health";
import { fetchCollectionLinkIds } from "@/lib/api/collections";
import { supabase } from "@/integrations/supabase/client";
import { LinkCard } from "@/components/LinkCard";
import { LinkSection } from "@/components/LinkSection";
import { LinkDetail } from "@/components/LinkDetail";
import { LinkDetailPanel } from "@/components/LinkDetailPanel";
import { FilterSidebar } from "@/components/FilterSidebar";
import { Input } from "@/components/ui/input";
import { AddLinkInput } from "@/components/AddLinkInput";
import { Button } from "@/components/ui/button";
import { KeyboardShortcutsHelp } from "@/components/KeyboardShortcutsHelp";
import { FailedLinkReviewDialog } from "@/components/FailedLinkReviewDialog";
import { RecycleBinView } from "@/components/RecycleBinView";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, LogOut, Pin, FileText, Video, GitBranch, BookOpen, Wrench, MessageSquare, LayoutGrid, LayoutList, Filter, Clock, CheckCircle2, AlertCircle, ArrowUpDown, ArrowDown, ArrowUp, Settings, RefreshCw, CheckSquare, X, Trash2, Tag, Eye, EyeOff, Sparkles, HeartPulse, TrendingUp, ListOrdered } from "lucide-react";
import { SmartSearchDialog } from "@/components/SmartSearchDialog";
import { ImportDialog } from "@/components/ImportDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Link } from "@/types/links";

const Index = () => {
  const { user, signOut, loading: authLoading } = useRequireAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [contentType, setContentType] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedLink, setSelectedLink] = useState<Link | null>(null);
  const [showPinned, setShowPinned] = useState(false);
  const [sortBy, setSortBy] = useState("date_desc");
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true"; } catch { return false; }
  });
  const [viewMode, setViewMode] = useState<"list" | "grid">(() => {
    try { return (localStorage.getItem("view-mode") as "list" | "grid") || "list"; } catch { return "list"; }
  });
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");
  const [duplicateFilter, setDuplicateFilter] = useState(false);
  const [activeStatFilter, setActiveStatFilter] = useState("all");
  const [reviewLink, setReviewLink] = useState<Link | null>(null);
  const [showNumbers, setShowNumbers] = useState(() => {
    try { return localStorage.getItem("show-link-numbers") === "true"; } catch { return false; }
  });
  const searchInputRef = useRef<HTMLInputElement>(null);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem("sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  }, []);

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => {
      const next = prev === "list" ? "grid" : "list";
      try { localStorage.setItem("view-mode", next); } catch {}
      return next;
    });
  }, []);

  const toggleNumbers = useCallback(() => {
    setShowNumbers((prev) => {
      const next = !prev;
      try { localStorage.setItem("show-link-numbers", String(next)); } catch {}
      return next;
    });
  }, []);

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInput, setTagInput] = useState("");

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

  // Fetch collection link IDs for filtering
  const { data: collectionLinkIds } = useQuery({
    queryKey: ["collection-links", selectedCollectionId],
    queryFn: () => fetchCollectionLinkIds(selectedCollectionId!),
    enabled: !!selectedCollectionId,
  });

  // Filter links by collection, read status, and duplicates
  const filteredLinks = (() => {
    let result = selectedCollectionId && collectionLinkIds
      ? links.filter((l) => collectionLinkIds.includes(l.id))
      : links;
    if (readFilter === "unread") result = result.filter((l) => !(l as any).is_read);
    if (readFilter === "read") result = result.filter((l) => (l as any).is_read);
    if (duplicateFilter) result = result.filter((l) => ((l as any).duplicate_count || 0) > 0);
    return result;
  })();

  // Fetch deleted links count
  const { data: deletedLinks = [] } = useQuery({
    queryKey: ["deleted-links"],
    queryFn: fetchDeletedLinks,
    enabled: !!user,
  });
  const deletedCount = deletedLinks.length;

  // Compute stats
  const pendingCount = filteredLinks.filter((l) => l.status === "pending").length;
  const readyCount = filteredLinks.filter((l) => l.status === "ready").length;
  const failedCount = filteredLinks.filter((l) => l.status === "failed").length;
  const duplicateCount = links.reduce((sum, l) => sum + ((l as any).duplicate_count || 0), 0);

  // Handle stat card clicks
  const handleStatClick = useCallback((stat: string) => {
    if (stat === "deleted") {
      setActiveStatFilter((prev) => prev === "deleted" ? "all" : "deleted");
      setDuplicateFilter(false);
      setStatusFilter("all");
    } else if (stat === "duplicates") {
      setDuplicateFilter((prev) => !prev);
      setStatusFilter("all");
      setActiveStatFilter((prev) => prev === "duplicates" ? "all" : "duplicates");
    } else {
      setDuplicateFilter(false);
      if (stat === "all") {
        setStatusFilter("all");
        setActiveStatFilter("all");
      } else {
        const newStatus = activeStatFilter === stat ? "all" : stat;
        setStatusFilter(newStatus);
        setActiveStatFilter(newStatus === "all" ? "all" : stat);
      }
    }
  }, [activeStatFilter]);

  // Handle failed link click -> open review dialog
  const handleLinkClick = useCallback((link: Link) => {
    if (link.status === "failed") {
      setReviewLink(link);
    } else {
      setSelectedLink(link);
      if (!(link as any).is_read) {
        updateMutation.mutate({ id: link.id, updates: { is_read: true } as any });
      }
    }
  }, []);

  // Realtime subscription for live updates
  const linkCountRef = useRef(links.length);
  useEffect(() => { linkCountRef.current = links.length; }, [links.length]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('links-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'links' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["links"] });
          const title = (payload.new as any)?.title || (payload.new as any)?.original_url || "New link";
          toast({ title: "📥 New link added", description: title });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'links' },
        () => {
          queryClient.invalidateQueries({ queryKey: ["links"] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'links' },
        () => {
          queryClient.invalidateQueries({ queryKey: ["links"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient, toast]);

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Link> }) => updateLink(id, updates),
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
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["links"] });
      queryClient.invalidateQueries({ queryKey: ["deleted-links"] });
      if (selectedLink) setSelectedLink(null);
      toast({
        title: "Moved to recycle bin",
        description: "Link has been deleted.",
        action: (
          <ToastAction altText="Undo delete" onClick={() => restoreMutation.mutate(deletedId)}>
            Undo
          </ToastAction>
        ),
      });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const restoreMutation = useMutation({
    mutationFn: restoreLink,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["links"] });
      queryClient.invalidateQueries({ queryKey: ["deleted-links"] });
      toast({ title: "Link restored" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: permanentDeleteLink,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deleted-links"] });
      toast({ title: "Permanently deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const emptyTrashMutation = useMutation({
    mutationFn: emptyTrash,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deleted-links"] });
      toast({ title: "Recycle bin emptied" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => bulkDeleteLinks(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["links"] });
      queryClient.invalidateQueries({ queryKey: ["deleted-links"] });
      toast({ title: "Moved to recycle bin", description: `${selectedIds.size} links moved.` });
      exitSelectionMode();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const bulkTagMutation = useMutation({
    mutationFn: ({ ids, tag }: { ids: string[]; tag: string }) => bulkAddTag(ids, tag),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["links"] });
      toast({ title: "Tagged", description: `Tag added to ${selectedIds.size} links.` });
      setShowTagInput(false);
      setTagInput("");
      exitSelectionMode();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleUpdate = useCallback(
    (id: string, updates: Partial<Link>) => updateMutation.mutate({ id, updates }),
    [updateMutation]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = () => setSelectedIds(new Set(filteredLinks.map((l) => l.id)));

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setShowTagInput(false);
    setTagInput("");
  };

  const handleRefresh = () => queryClient.invalidateQueries({ queryKey: ["links"] });

  const [healthChecking, setHealthChecking] = useState(false);
  const handleHealthCheck = async () => {
    setHealthChecking(true);
    try {
      const result = await checkLinksHealth();
      toast({
        title: "Health check complete",
        description: `Checked ${result.checked} links: ${result.healthy} healthy, ${result.broken} broken`,
      });
      queryClient.invalidateQueries({ queryKey: ["links"] });
    } catch (e: any) {
      toast({ title: "Health check failed", description: e.message, variant: "destructive" });
    } finally {
      setHealthChecking(false);
    }
  };

  // Mark link as read when selected (non-failed)
  const handleSelectLink = useCallback((link: Link) => {
    handleLinkClick(link);
  }, [handleLinkClick]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onFocusSearch: () => searchInputRef.current?.focus(),
    onNavigateDown: () => setHighlightedIndex((prev) => Math.min(prev + 1, filteredLinks.length - 1)),
    onNavigateUp: () => setHighlightedIndex((prev) => Math.max(prev - 1, 0)),
    onOpenLink: () => {
      if (highlightedIndex >= 0 && highlightedIndex < filteredLinks.length) {
        handleSelectLink(filteredLinks[highlightedIndex]);
      }
    },
    onCloseDetail: () => {
      setSelectedLink(null);
      setHighlightedIndex(-1);
    },
    onToggleView: toggleViewMode,
    enabled: !selectionMode,
  });

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="font-mono text-muted-foreground animate-pulse">Loading...</div>
      </div>
    );
  }


  // Mobile: keep the old single-column layout with sheet detail
  if (isMobile) {
    return (
      <>
        <MobileLayout
          user={user} signOut={signOut} links={filteredLinks} isLoading={isLoading}
          search={search} setSearch={setSearch}
          contentType={contentType} setContentType={setContentType}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          sortBy={sortBy} setSortBy={setSortBy}
          showPinned={showPinned} setShowPinned={setShowPinned}
          selectedLink={selectedLink} setSelectedLink={handleSelectLink}
          selectionMode={selectionMode} setSelectionMode={setSelectionMode}
          selectedIds={selectedIds} toggleSelect={toggleSelect} selectAll={selectAll}
          exitSelectionMode={exitSelectionMode}
          showDeleteConfirm={showDeleteConfirm} setShowDeleteConfirm={setShowDeleteConfirm}
          showTagInput={showTagInput} setShowTagInput={setShowTagInput}
          tagInput={tagInput} setTagInput={setTagInput}
          handleUpdate={handleUpdate} retryMutation={retryMutation} deleteMutation={deleteMutation}
          bulkDeleteMutation={bulkDeleteMutation} bulkTagMutation={bulkTagMutation}
          handleRefresh={handleRefresh}
          pendingCount={pendingCount} readyCount={readyCount} failedCount={failedCount}
        />
        <FailedLinkReviewDialog
          link={reviewLink}
          open={!!reviewLink}
          onClose={() => setReviewLink(null)}
          onRetry={(id) => retryMutation.mutate(id)}
          onResolve={(id, updates) => handleUpdate(id, updates)}
          onDelete={(id) => deleteMutation.mutate(id)}
        />
      </>
    );
  }

  // Desktop: 3-panel layout
  return (
    <div className="flex min-h-screen bg-background">
      {/* Left sidebar */}
      <FilterSidebar
        contentType={contentType} setContentType={setContentType}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        sortBy={sortBy} setSortBy={setSortBy}
        showPinned={showPinned} setShowPinned={setShowPinned}
        linkCount={filteredLinks.length} pendingCount={pendingCount} readyCount={readyCount} failedCount={failedCount}
        duplicateCount={duplicateCount}
        deletedCount={deletedCount}
        userEmail={user?.email} onSignOut={signOut} onRefresh={handleRefresh}
        collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar}
        selectedCollectionId={selectedCollectionId} onSelectCollection={setSelectedCollectionId}
        onStatClick={handleStatClick}
        activeStatFilter={activeStatFilter}
      />

      {/* Center: links list */}
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="p-4 border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-10 space-y-3">
          <AddLinkInput onSuccess={handleRefresh} />
          <div className="flex items-center gap-2">
            <div className="relative flex-1 group/search">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground transition-colors group-focus-within/search:text-primary" />
              <Input
                ref={searchInputRef}
                placeholder="Search links... (press /)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 font-mono text-sm h-9 transition-all duration-200 focus:shadow-sm focus:shadow-primary/10"
              />
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant={readFilter === "unread" ? "default" : readFilter === "read" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setReadFilter((prev) => prev === "all" ? "unread" : prev === "unread" ? "read" : "all")}
                title={`Filter: ${readFilter}`}
              >
                {readFilter === "read" ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-all"
                onClick={toggleViewMode}
                title={viewMode === "list" ? "Switch to grid" : "Switch to list"}
              >
                {viewMode === "list" ? <LayoutGrid className="h-3.5 w-3.5" /> : <LayoutList className="h-3.5 w-3.5" />}
              </Button>
              {filteredLinks.length > 0 && !selectionMode && (
                <Button variant="outline" size="sm" className="h-8 text-xs font-mono gap-1.5 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all" onClick={() => setSelectionMode(true)}>
                  <CheckSquare className="h-3 w-3" /> Select
                </Button>
              )}
              <KeyboardShortcutsHelp />
              <SmartSearchDialog onSelectLink={(link) => setSelectedLink(link)} />
              <RouterLink to="/discover">
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-all" title="Discover AI & Tech Tools">
                  <Search className="h-3.5 w-3.5" />
                </Button>
              </RouterLink>
              <RouterLink to="/knowledge">
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-all" title="Knowledge Discovery">
                  <TrendingUp className="h-3.5 w-3.5" />
                </Button>
              </RouterLink>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-all" onClick={handleHealthCheck} disabled={healthChecking} title="Check link health">
                <HeartPulse className={`h-3.5 w-3.5 ${healthChecking ? "animate-pulse" : ""}`} />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-all" onClick={handleRefresh} disabled={isLoading}>
                <RefreshCw className={`h-3.5 w-3.5 transition-transform duration-500 ${isLoading ? "animate-spin" : "hover:rotate-180"}`} />
              </Button>
            </div>
          </div>
        </div>

        {/* Bulk Action Toolbar */}
        {selectionMode && (
          <BulkToolbar
            selectedIds={selectedIds} links={links} selectAll={selectAll} exitSelectionMode={exitSelectionMode}
            showTagInput={showTagInput} setShowTagInput={setShowTagInput}
            tagInput={tagInput} setTagInput={setTagInput}
            bulkTagMutation={bulkTagMutation} bulkDeleteMutation={bulkDeleteMutation}
            setShowDeleteConfirm={setShowDeleteConfirm}
          />
        )}

        {/* Links list */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeStatFilter === "deleted" ? (
            <RecycleBinView
              deletedLinks={deletedLinks}
              onRestore={(id) => restoreMutation.mutate(id)}
              onPermanentDelete={(id) => permanentDeleteMutation.mutate(id)}
              onEmptyTrash={() => emptyTrashMutation.mutate()}
            />
          ) : isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-lg border border-border/50 animate-shimmer"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          ) : filteredLinks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="relative mb-6">
                <img src={logo} alt="Xenonowledge" className="h-16 w-16 opacity-20 animate-float" />
                <div className="absolute inset-0 bg-primary/10 blur-xl rounded-full" />
              </div>
              <h2 className="font-mono text-sm text-muted-foreground mb-2 animate-fade-in">No links yet</h2>
              <p className="text-xs text-muted-foreground/70 max-w-sm animate-fade-in" style={{ animationDelay: "0.1s", animationFillMode: "backwards" }}>
                Add a link above or paste links in your Telegram channel and they'll appear here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {(() => {
                const readyLinks = filteredLinks.filter((l) => l.status === "ready");
                const pendingLinks = filteredLinks.filter((l) => l.status === "pending");
                const failedLinks = filteredLinks.filter((l) => l.status === "failed");
                const highlightedLinkId = highlightedIndex >= 0 && highlightedIndex < filteredLinks.length
                  ? filteredLinks[highlightedIndex].id : null;
                const cardProps = {
                  onPin: (id: string, pinned: boolean) => handleUpdate(id, { is_pinned: !pinned }),
                  onRetry: (id: string) => retryMutation.mutate(id),
                  onDelete: (id: string) => deleteMutation.mutate(id),
                  onClick: handleSelectLink,
                  onUpdate: handleUpdate,
                  onReview: (link: Link) => setReviewLink(link),
                  selectionMode,
                  selectedIds,
                  onToggleSelect: toggleSelect,
                  viewMode,
                  highlightedId: highlightedLinkId,
                };
                return (
                  <>
                    <LinkSection status="ready" links={readyLinks} {...cardProps} indexOffset={0} />
                    <LinkSection status="pending" links={pendingLinks} {...cardProps} indexOffset={readyLinks.length} />
                    <LinkSection status="failed" links={failedLinks} {...cardProps} indexOffset={readyLinks.length + pendingLinks.length} />
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </main>

      {/* Right panel: link detail */}
      {selectedLink && (
        <aside className="w-80 xl:w-96 shrink-0 border-l border-border/50 bg-card/30 backdrop-blur-sm h-screen sticky top-0 animate-slide-in-right">
          <LinkDetailPanel
            link={selectedLink}
            onClose={() => setSelectedLink(null)}
            onUpdate={handleUpdate}
            onRetry={(id) => retryMutation.mutate(id)}
            onDelete={(id) => deleteMutation.mutate(id)}
            onSelectLink={(link) => setSelectedLink(link)}
          />
        </aside>
      )}

      {/* Failed Link Review Dialog */}
      <FailedLinkReviewDialog
        link={reviewLink}
        open={!!reviewLink}
        onClose={() => setReviewLink(null)}
        onRetry={(id) => retryMutation.mutate(id)}
        onResolve={(id, updates) => handleUpdate(id, updates)}
        onDelete={(id) => deleteMutation.mutate(id)}
      />

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} links?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Bulk toolbar extracted
function BulkToolbar({ selectedIds, links, selectAll, exitSelectionMode, showTagInput, setShowTagInput, tagInput, setTagInput, bulkTagMutation, bulkDeleteMutation, setShowDeleteConfirm }: any) {
  return (
    <div className="flex items-center gap-2 p-3 bg-muted/50 border-b border-border animate-fade-in">
      <span className="text-xs font-mono text-muted-foreground">{selectedIds.size} selected</span>
      <Button variant="outline" size="sm" className="h-7 text-xs font-mono" onClick={selectAll}>
        All ({links.length})
      </Button>
      {showTagInput ? (
        <form className="flex items-center gap-1.5 ml-auto" onSubmit={(e) => { e.preventDefault(); const tag = tagInput.trim().toLowerCase(); if (!tag || tag.length > 50) return; bulkTagMutation.mutate({ ids: Array.from(selectedIds), tag }); }}>
          <Input placeholder="Tag name..." value={tagInput} onChange={(e: any) => setTagInput(e.target.value)} className="h-7 w-32 text-xs font-mono" maxLength={50} autoFocus />
          <Button type="submit" size="sm" className="h-7 text-xs" disabled={!tagInput.trim() || selectedIds.size === 0 || bulkTagMutation.isPending}>Apply</Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setShowTagInput(false); setTagInput(""); }}><X className="h-3 w-3" /></Button>
        </form>
      ) : (
        <div className="flex items-center gap-1.5 ml-auto">
          <Button variant="outline" size="sm" className="h-7 text-xs font-mono gap-1.5" disabled={selectedIds.size === 0} onClick={() => setShowTagInput(true)}><Tag className="h-3 w-3" />Tag</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs font-mono gap-1.5 text-destructive hover:text-destructive" disabled={selectedIds.size === 0} onClick={() => setShowDeleteConfirm(true)}><Trash2 className="h-3 w-3" />Delete</Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={exitSelectionMode}><X className="h-3.5 w-3.5" /></Button>
        </div>
      )}
    </div>
  );
}

// Mobile layout keeps the original design
function MobileLayout(props: any) {
  const {
    user, signOut, links, isLoading, search, setSearch,
    contentType, setContentType, statusFilter, setStatusFilter, sortBy, setSortBy, showPinned, setShowPinned,
    selectedLink, setSelectedLink,
    selectionMode, setSelectionMode, selectedIds, toggleSelect, selectAll, exitSelectionMode,
    showDeleteConfirm, setShowDeleteConfirm, showTagInput, setShowTagInput, tagInput, setTagInput,
    handleUpdate, retryMutation, deleteMutation, bulkDeleteMutation, bulkTagMutation,
    handleRefresh, pendingCount, readyCount, failedCount,
  } = props;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-10 bg-background/95 backdrop-blur">
        <div className="container flex items-center justify-between h-12 px-4">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Xenonowledge" className="h-5 w-5 animate-fade-in" />
            <h1 className="font-mono text-sm font-semibold animate-fade-in">Xenonowledge</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
              {user?.email}
            </span>
            <ImportDialog onSuccess={handleRefresh} />
            <RouterLink to="/discover">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Sparkles className="h-3.5 w-3.5" />
              </Button>
            </RouterLink>
            <ThemeToggle />
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

      <main className="container px-4 py-4 max-w-4xl animate-fade-in">
        {/* Add Link */}
        <div className="mb-4 animate-fade-in" style={{ animationDelay: "0.1s", animationFillMode: "backwards" }}>
          <AddLinkInput onSuccess={handleRefresh} />
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4 animate-fade-in" style={{ animationDelay: "0.15s", animationFillMode: "backwards" }}>
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
        <div className="flex items-center gap-4 mb-4 text-xs font-mono text-muted-foreground">
          <span>{links.length} links</span>
          {pendingCount > 0 && <span className="text-chart-3">{pendingCount} pending</span>}
          {readyCount > 0 && <span className="text-primary">{readyCount} ready</span>}
          {failedCount > 0 && <span className="text-destructive">{failedCount} failed</span>}
          <div className="ml-auto flex items-center gap-1">
            {links.length > 0 && !selectionMode && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs font-mono gap-1.5"
                onClick={() => setSelectionMode(true)}
              >
                <CheckSquare className="h-3 w-3" />
                Select
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Bulk Action Toolbar */}
        {selectionMode && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-muted/50 border border-border rounded-lg animate-fade-in">
            <span className="text-xs font-mono text-muted-foreground">
              {selectedIds.size} selected
            </span>
            <Button variant="outline" size="sm" className="h-7 text-xs font-mono" onClick={selectAll}>
              Select All ({links.length})
            </Button>

            {showTagInput ? (
              <form
                className="flex items-center gap-1.5 ml-auto"
                onSubmit={(e) => {
                  e.preventDefault();
                  const tag = tagInput.trim().toLowerCase();
                  if (!tag || tag.length > 50) return;
                  bulkTagMutation.mutate({ ids: Array.from(selectedIds), tag });
                }}
              >
                <Input
                  placeholder="Tag name..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="h-7 w-32 text-xs font-mono"
                  maxLength={50}
                  autoFocus
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={!tagInput.trim() || selectedIds.size === 0 || bulkTagMutation.isPending}
                >
                  Apply
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => { setShowTagInput(false); setTagInput(""); }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </form>
            ) : (
              <div className="flex items-center gap-1.5 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs font-mono gap-1.5"
                  disabled={selectedIds.size === 0}
                  onClick={() => setShowTagInput(true)}
                >
                  <Tag className="h-3 w-3" />
                  Add Tag
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs font-mono gap-1.5 text-destructive hover:text-destructive"
                  disabled={selectedIds.size === 0}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={exitSelectionMode}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Links Grid */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-card rounded-lg animate-pulse border border-border" />
            ))}
          </div>
        ) : links.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <img src={logo} alt="Xenonowledge" className="h-12 w-12 opacity-30 mb-4 animate-scale-in" />
            <h2 className="font-mono text-sm text-muted-foreground mb-1">No links yet</h2>
            <p className="text-xs text-muted-foreground/70 max-w-sm">
              Add a link above or paste links in your Telegram channel and they'll appear here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {(() => {
              const readyLinks = links.filter((l) => l.status === "ready");
              const pendingLinks = links.filter((l) => l.status === "pending");
              const failedLinks = links.filter((l) => l.status === "failed");
              const cardProps = {
                onPin: (id: string, pinned: boolean) => handleUpdate(id, { is_pinned: !pinned }),
                onRetry: (id: string) => retryMutation.mutate(id),
                onDelete: (id: string) => deleteMutation.mutate(id),
                onClick: setSelectedLink,
                onUpdate: handleUpdate,
                selectionMode,
                selectedIds,
                onToggleSelect: toggleSelect,
              };
              return (
                <>
                  <LinkSection status="ready" links={readyLinks} {...cardProps} indexOffset={0} />
                  <LinkSection status="pending" links={pendingLinks} {...cardProps} indexOffset={readyLinks.length} />
                  <LinkSection status="failed" links={failedLinks} {...cardProps} indexOffset={readyLinks.length + pendingLinks.length} />
                </>
              );
            })()}
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
        onSelectLink={(link) => setSelectedLink(link)}
      />

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} links?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All selected links and their data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default Index;
