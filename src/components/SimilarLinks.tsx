import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, ExternalLink, BookOpen } from "lucide-react";
import type { Link } from "@/types/links";

interface SimilarLink extends Link {
  reason?: string;
}

interface SimilarLinksProps {
  linkId: string;
  onSelectLink?: (link: Link) => void;
}

export function SimilarLinks({ linkId, onSelectLink }: SimilarLinksProps) {
  const [results, setResults] = useState<SimilarLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setResults([]);
    setHasLoaded(false);
    setError(null);
  }, [linkId]);

  const findSimilar = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("similar-links", {
        body: { linkId },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setResults(data?.results || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  };

  if (!hasLoaded && !isLoading) {
    return (
      <div>
        <h4 className="text-xs font-mono text-muted-foreground mb-2">Similar Links</h4>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 font-mono text-xs"
          onClick={findSimilar}
        >
          <Sparkles className="h-3 w-3" />
          Find Similar Links
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <h4 className="text-xs font-mono text-muted-foreground mb-2">Similar Links</h4>
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground font-mono text-center animate-pulse">
            Finding related links...
          </p>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded-md border border-border/50">
              <Skeleton className="h-3.5 w-3.5 rounded shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h4 className="text-xs font-mono text-muted-foreground mb-2">Similar Links</h4>
        <p className="text-xs text-destructive font-mono">{error}</p>
        <Button variant="ghost" size="sm" className="mt-1 text-xs font-mono" onClick={findSimilar}>
          Retry
        </Button>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div>
        <h4 className="text-xs font-mono text-muted-foreground mb-2">Similar Links</h4>
        <p className="text-xs text-muted-foreground">No similar links found in your library.</p>
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-xs font-mono text-muted-foreground mb-2">
        Similar Links · {results.length}
      </h4>
      <div className="space-y-1.5">
        {results.map((link) => (
          <button
            key={link.id}
            className="w-full text-left p-2 rounded-md border border-border/50 hover:border-primary/30 hover:bg-accent/50 transition-colors group"
            onClick={() => onSelectLink?.(link)}
          >
            <div className="flex items-start gap-2">
              <BookOpen className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <h5 className="text-xs font-medium truncate">{link.title || "Untitled"}</h5>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[10px] font-mono text-muted-foreground truncate">
                    {link.domain || "unknown"}
                  </span>
                  <ExternalLink className="h-2 w-2 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                </div>
                {link.reason && (
                  <Badge variant="outline" className="text-[9px] font-mono mt-1 h-4">
                    {link.reason}
                  </Badge>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
