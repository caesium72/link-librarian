import { useParams, Link } from "react-router-dom";
import { usePublicProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Folder, ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface PublicCollection {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  public_slug: string | null;
}

const PublicProfile = () => {
  const { username } = useParams<{ username: string }>();
  const { profile, loading } = usePublicProfile(username);
  const [collections, setCollections] = useState<PublicCollection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(true);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("collections")
      .select("id, name, description, icon, public_slug")
      .eq("user_id", profile.user_id)
      .eq("is_public", true)
      .then(({ data }) => {
        setCollections((data as PublicCollection[]) ?? []);
        setLoadingCollections(false);
      });
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

      <main className="container px-4 py-8 max-w-xl">
        <div className="flex items-center gap-4 mb-6">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg font-mono">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-mono text-lg font-semibold">{displayName}</h2>
            <p className="text-sm text-muted-foreground font-mono">@{profile.username}</p>
            {profile.bio && <p className="text-sm text-muted-foreground mt-1">{profile.bio}</p>}
          </div>
        </div>

        <h3 className="font-mono text-sm font-semibold mb-3">Public Collections</h3>
        {loadingCollections ? (
          <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
        ) : collections.length === 0 ? (
          <p className="text-sm text-muted-foreground">No public collections yet.</p>
        ) : (
          <div className="space-y-2">
            {collections.map((c) => (
              <Link key={c.id} to={c.public_slug ? `/shared/${c.public_slug}` : "#"}>
                <Card className="hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="flex items-center gap-2 font-mono text-sm">
                      <Folder className="h-4 w-4" />
                      {c.name}
                      <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                    </CardTitle>
                  </CardHeader>
                  {c.description && (
                    <CardContent className="py-0 px-4 pb-3">
                      <p className="text-xs text-muted-foreground">{c.description}</p>
                    </CardContent>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default PublicProfile;
