import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ExternalLink, Folder, Loader2 } from "lucide-react";
import type { Collection } from "@/types/collections";
import type { Link as LinkType } from "@/types/links";

const SharedCollection = () => {
  const { slug } = useParams<{ slug: string }>();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [links, setLinks] = useState<LinkType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    loadSharedCollection();
  }, [slug]);

  const loadSharedCollection = async () => {
    setLoading(true);
    setError(null);

    // Fetch collection by slug
    const { data: col, error: colError } = await supabase
      .from("collections")
      .select("*")
      .eq("public_slug", slug)
      .eq("is_public", true)
      .maybeSingle();

    if (colError || !col) {
      setError("Collection not found or is no longer public.");
      setLoading(false);
      return;
    }
    setCollection(col as Collection);

    // Fetch link IDs in collection
    const { data: clData } = await supabase
      .from("collection_links")
      .select("link_id")
      .eq("collection_id", col.id);

    if (!clData || clData.length === 0) {
      setLinks([]);
      setLoading(false);
      return;
    }

    const linkIds = clData.map((r: any) => r.link_id);
    const { data: linksData } = await supabase
      .from("links")
      .select("*")
      .in("id", linkIds)
      .is("deleted_at", null)
      .eq("status", "ready")
      .order("created_at", { ascending: false });

    setLinks((linksData || []) as LinkType[]);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground font-mono text-sm">{error || "Not found"}</p>
          <Link to="/">
            <Button variant="outline" size="sm" className="font-mono gap-2">
              <ArrowLeft className="h-3.5 w-3.5" />
              Go home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 z-10 bg-background/95 backdrop-blur">
        <div className="container flex items-center h-12 px-4 gap-3">
          <Folder className="h-4 w-4 text-primary" />
          <h1 className="font-mono text-sm font-semibold truncate">{collection.name}</h1>
          {collection.description && (
            <span className="text-xs text-muted-foreground truncate hidden sm:inline">
              — {collection.description}
            </span>
          )}
          <Badge variant="secondary" className="ml-auto font-mono text-xs shrink-0">
            {links.length} link{links.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </header>

      <main className="container px-4 py-6 max-w-2xl">
        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground font-mono text-center py-8">
            This collection is empty.
          </p>
        ) : (
          <div className="space-y-3">
            {links.map((link) => (
              <Card key={link.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <a
                        href={link.original_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-mono font-medium hover:underline flex items-center gap-1.5"
                      >
                        <span className="truncate">{link.title || link.original_url}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                      </a>
                      {link.domain && (
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{link.domain}</p>
                      )}
                    </div>
                  </div>
                  {link.summary && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{link.summary}</p>
                  )}
                  {link.tags && link.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {link.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px] font-mono">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="text-center mt-8">
          <p className="text-xs text-muted-foreground font-mono">
            Shared via Link Librarian
          </p>
        </div>
      </main>
    </div>
  );
};

export default SharedCollection;
