import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/hooks/useProfile";
import { User, Loader2, ExternalLink } from "lucide-react";

export function ProfileCard() {
  const { profile, loading, updateProfile } = useProfile();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username ?? "");
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        username: username.trim() || null,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
      });
      toast({ title: "Profile updated!" });
    } catch (e: any) {
      const msg = e.message?.includes("profiles_username_key")
        ? "Username is already taken"
        : e.message;
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-mono text-base">
          <User className="h-4 w-4" />
          Profile
        </CardTitle>
        <CardDescription className="text-sm">
          Set your username and display name. Your public profile will be at{" "}
          {username ? (
            <a href={`/u/${username}`} className="text-primary hover:underline">
              /u/{username} <ExternalLink className="inline h-3 w-3" />
            </a>
          ) : (
            <span className="text-muted-foreground">/u/your-username</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="font-mono text-sm">Username</Label>
          <Input
            placeholder="your-username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
            className="font-mono text-sm"
            maxLength={30}
          />
          <p className="text-[10px] text-muted-foreground">Lowercase letters, numbers, hyphens, underscores only.</p>
        </div>
        <div className="space-y-2">
          <Label className="font-mono text-sm">Display Name</Label>
          <Input
            placeholder="Your Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="font-mono text-sm"
            maxLength={50}
          />
        </div>
        <div className="space-y-2">
          <Label className="font-mono text-sm">Bio</Label>
          <Textarea
            placeholder="A short bio..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="font-mono text-sm resize-none"
            rows={3}
            maxLength={200}
          />
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          size="sm"
          className="font-mono"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
          Save Profile
        </Button>
      </CardContent>
    </Card>
  );
}
