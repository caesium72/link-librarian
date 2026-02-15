import { useState, useCallback, useEffect } from "react";
import { useRequireAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchLinks, updateLink, retryAnalysis } from "@/lib/api/links";
import { LinkCard } from "@/components/LinkCard";
import { LinkDetail } from "@/components/LinkDetail";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, LogOut, Inbox, Pin } from "lucide-react";
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

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["links", debouncedSearch, contentType, statusFilter, showPinned],
    queryFn: () =>
      fetchLinks({
        search: debouncedSearch || undefined,
        contentType: contentType !== "all" ? contentType : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        isPinned: showPinned ? true : undefined,
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
            <span className="font-mono text-primary text-sm">{">"}</span>
            <h1 className="font-mono text-sm font-semibold">Link Librarian</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
              {user?.email}
            </span>
            <ImportDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: ["links"] })} />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={signOut}>
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container px-4 py-4 max-w-4xl">
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
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="article">Article</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="repo">Repo</SelectItem>
                <SelectItem value="docs">Docs</SelectItem>
                <SelectItem value="tool">Tool</SelectItem>
                <SelectItem value="thread">Thread</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-28 h-9 text-xs font-mono">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
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
            <Inbox className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h2 className="font-mono text-sm text-muted-foreground mb-1">No links yet</h2>
            <p className="text-xs text-muted-foreground/70 max-w-sm">
              Paste links in your Telegram channel and they'll appear here automatically.
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
      />
    </div>
  );
};

export default Index;
