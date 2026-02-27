import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Search, ExternalLink, Pin, BookOpen } from "lucide-react";
import type { Link } from "@/types/links";

interface SmartSearchDialogProps {
  onSelectLink?: (link: Link) => void;
  children?: React.ReactNode;
}

export function SmartSearchDialog({ onSelectLink, children }: SmartSearchDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Link[]>([]);
  const [reason, setReason] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isSearching) return;

    setIsSearching(true);
    setHasSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-search", {
        body: { query: query.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResults(data?.results || []);
      setReason(data?.reason || "");
    } catch (e: any) {
      toast({ title: "Search failed", description: e.message, variant: "destructive" });
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setQuery("");
      setResults([]);
      setReason("");
      setHasSearched(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-all" title="AI Smart Search">
            <Sparkles className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Smart Search
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. 'React testing article from last week'"
              className="pl-9 font-mono text-sm"
              autoFocus
            />
          </div>
          <Button type="submit" size="sm" disabled={isSearching || !query.trim()} className="gap-1.5 font-mono text-xs">
            <Sparkles className="h-3 w-3" />
            {isSearching ? "Thinking..." : "Search"}
          </Button>
        </form>

        {/* AI reason */}
        {reason && !isSearching && (
          <p className="text-xs text-muted-foreground font-mono px-1">{reason}</p>
        )}

        <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
          {/* Loading */}
          {isSearching && (
            <div className="space-y-3 py-2">
              <p className="text-xs text-muted-foreground font-mono text-center animate-pulse">
                🔍 Searching your library with AI...
              </p>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border/50">
                  <Skeleton className="h-4 w-4 rounded shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <div className="flex gap-1">
                      <Skeleton className="h-4 w-12 rounded-full" />
                      <Skeleton className="h-4 w-16 rounded-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isSearching && !hasSearched && (
            <div className="py-8 text-center">
              <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-1">Ask anything about your saved links</p>
              <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                {["React articles from this week", "unread AI tools", "Python tutorials I saved", "articles about databases"].map((suggestion) => (
                  <button
                    key={suggestion}
                    className="text-[10px] font-mono px-2 py-1 rounded-full border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                    onClick={() => {
                      setQuery(suggestion);
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No results */}
          {!isSearching && hasSearched && results.length === 0 && (
            <div className="py-8 text-center">
              <Search className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No matching links found</p>
            </div>
          )}

          {/* Results */}
          {!isSearching && results.length > 0 && (
            <div className="space-y-2 py-2">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                {results.length} result{results.length !== 1 ? "s" : ""}
              </span>
              {results.map((link) => (
                <button
                  key={link.id}
                  className="w-full text-left p-3 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-accent/50 transition-colors group"
                  onClick={() => {
                    onSelectLink?.(link);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-start gap-2">
                    <BookOpen className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-medium truncate">{link.title || "Untitled"}</h4>
                        {link.is_pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] font-mono text-muted-foreground truncate">
                          {link.domain || link.original_url?.replace(/^https?:\/\//, "").slice(0, 40)}
                        </span>
                        <ExternalLink className="h-2.5 w-2.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      {link.summary && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{link.summary}</p>
                      )}
                      {link.tags && link.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {link.tags.slice(0, 4).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[10px] font-mono h-4">
                              {tag}
                            </Badge>
                          ))}
                          {link.tags.length > 4 && (
                            <span className="text-[10px] text-muted-foreground">+{link.tags.length - 4}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
