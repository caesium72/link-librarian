import { useParams, Link } from "react-router-dom";
import { usePublicProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Folder, ExternalLink, Link2, BookOpen, Globe } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface PublicCollectionLink {
  id: string;
  title: string | null;
  original_url: string;
  domain: string | null;
  summary: string | null;
  tags: string[] | null;
  content_type: string | null;
}

interface PublicCollection {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  public_slug: string | null;
  links: PublicCollectionLink[];
  linkCount: number;
}

const PublicProfile = () => {
  const { username } = useParams<{ username: string }>();
  const { profile, loading } = usePublicProfile(username);
  const [collections, setCollections] = useState<PublicCollection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [expandedCollection, setExpandedCollection] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    const fetchCollections = async () => {
      const { data: cols } = await supabase
        .from("collections")
        .select("id, name, description, icon, public_slug")
        .eq("user_id", profile.user_id)
        .eq("is_public", true);

      if (!cols || cols.length === 0) {
        setCollections([]);
        setLoadingCollections(false);
        return;
      }

      // Fetch links for each collection
      const colIds = cols.map((c) => c.id);
      const { data: colLinks } = await supabase
        .from("collection_links")
        .select("collection_id, link_id")
        .in("collection_id", colIds);

      const linkIds = [...new Set((colLinks || []).map((cl) => cl.link_id))];

      let linksMap = new Map<string, PublicCollectionLink>();
      if (linkIds.length > 0) {
        const { data: links } = await supabase
          .from("links")
          .select("id, title, original_url, domain, summary, tags, content_type")
          .in("id", linkIds)
          .is("deleted_at", null);
        (links || []).forEach((l) => linksMap.set(l.id, l as PublicCollectionLink));
      }

      const enrichedCollections: PublicCollection[] = cols.map((col) => {
        const colLinkIds = (colLinks || []).filter((cl) => cl.collection_id === col.id).map((cl) => cl.link_id);
        const colLinksData = colLinkIds.map((id) => linksMap.get(id)).filter(Boolean) as PublicCollectionLink[];
        return { ...col, links: colLinksData.slice(0, 20), linkCount: colLinksData.length };
      });

      setCollections(enrichedCollections);
      setLoadingCollections(false);
    };

    fetchCollections();
  }, [profile?.user_id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="font-mono text-muted-foreground animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
        <p className="font-mono text-muted-foreground">User not found</p>
        <Link to="/">
          <Button variant="outline" size="sm" className="font-mono">
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Go home
          </Button>
        </Link>
      </div>
    );
  }

  const displayName = profile.display_name || profile.username || "User";
  const initials = displayName.slice(0, 2).toUpperCase();
  const totalLinks = collections.reduce((sum, c) => sum + c.linkCount, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 z-10 bg-background/95 backdrop-blur">
        <div className="container flex items-center h-12 px-4 gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="font-mono text-sm font-semibold">@{profile.username}</h1>
        </div>
      </header>

      <main className="container px-4 py-8 max-w-2xl">
        {/* Profile Hero */}
        <div className="flex items-start gap-5 mb-8">
          <Avatar className="h-20 w-20 border-2 border-border">
            <AvatarFallback className="text-xl font-mono bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="font-mono text-xl font-semibold truncate">{displayName}</h2>
            <p className="text-sm text-muted-foreground font-mono">@{profile.username}</p>
            {profile.bio && <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{profile.bio}</p>}
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                <Folder className="h-3.5 w-3.5" />
                <span>{collections.length} collections</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                <Link2 className="h-3.5 w-3.5" />
                <span>{totalLinks} curated links</span>
              </div>
            </div>
          </div>
        </div>

        {/* Collections */}
        <h3 className="font-mono text-sm font-semibold mb-4 flex items-center gap-2">
          <BookOpen className="h-4 w-4" /> Public Collections
        </h3>

        {loadingCollections ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-lg bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : collections.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground font-mono">No public collections yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {collections.map((col) => {
              const isExpanded = expandedCollection === col.id;
              return (
                <Card key={col.id} className="overflow-hidden transition-all">
                  <CardHeader
                    className="py-3 px-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedCollection(isExpanded ? null : col.id)}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 font-mono text-sm">
                        <Folder className="h-4 w-4 text-primary" />
                        {col.name}
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          {col.linkCount} links
                        </Badge>
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {col.public_slug && (
                          <Link
                            to={`/shared/${col.public_slug}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                    {col.description && (
                      <p className="text-xs text-muted-foreground mt-1">{col.description}</p>
                    )}
                  </CardHeader>

                  {isExpanded && col.links.length > 0 && (
                    <CardContent className="px-4 pb-3 pt-0">
                      <div className="border-t border-border pt-3 space-y-2">
                        {col.links.map((link) => (
                          <a
                            key={link.id}
                            href={link.original_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-3 p-2.5 rounded-md hover:bg-muted/50 transition-colors group"
                          >
                            <Globe className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                {link.title || link.original_url}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {link.domain && (
                                  <span className="text-xs text-muted-foreground font-mono">{link.domain}</span>
                                )}
                                {link.content_type && link.content_type !== "other" && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                    {link.content_type}
                                  </Badge>
                                )}
                              </div>
                              {link.summary && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{link.summary}</p>
                              )}
                              {link.tags && link.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {link.tags.slice(0, 5).map((tag) => (
                                    <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </a>
                        ))}
                        {col.linkCount > 20 && (
                          <p className="text-xs text-muted-foreground text-center pt-1 font-mono">
                            +{col.linkCount - 20} more links
                          </p>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default PublicProfile;