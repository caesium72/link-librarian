import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Bookmark, Copy, CheckCircle2, ExternalLink } from "lucide-react";

interface BrowserExtensionCardProps {
  supabaseUrl: string;
  accessToken: string;
}

export function BrowserExtensionCard({ supabaseUrl, accessToken }: BrowserExtensionCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const bookmarkletCode = `javascript:void(function(){var x=new XMLHttpRequest();x.open('POST','${supabaseUrl}/functions/v1/save-link');x.setRequestHeader('Content-Type','application/json');x.setRequestHeader('Authorization','Bearer ${accessToken}');x.onload=function(){var r=JSON.parse(x.responseText);if(r.duplicate){alert('Link Librarian: Already saved!')}else if(r.success){alert('Link Librarian: Saved!')}else{alert('Link Librarian: Error - '+r.error)}};x.onerror=function(){alert('Link Librarian: Network error')};x.send(JSON.stringify({url:location.href,title:document.title}))})()`;

  const handleCopy = () => {
    navigator.clipboard.writeText(bookmarkletCode);
    setCopied(true);
    toast({ title: "Bookmarklet code copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-mono text-base">
          <Bookmark className="h-4 w-4" />
          Browser Bookmarklet
        </CardTitle>
        <CardDescription className="text-sm">
          Save any page to Link Librarian with one click from your browser's bookmarks bar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!accessToken ? (
          <p className="text-sm text-muted-foreground">
            Sign in to generate your bookmarklet.
          </p>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                <Label className="font-mono text-sm">Show your bookmarks bar</Label>
              </div>
              <p className="text-xs text-muted-foreground ml-8">
                Press <kbd className="px-1.5 py-0.5 text-xs rounded border bg-muted">Ctrl+Shift+B</kbd> (or <kbd className="px-1.5 py-0.5 text-xs rounded border bg-muted">⌘+Shift+B</kbd> on Mac).
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                <Label className="font-mono text-sm">Drag to bookmarks bar</Label>
              </div>
              <div className="ml-8 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Drag this button to your bookmarks bar:
                </p>
                <a
                  href={bookmarkletCode}
                  onClick={(e) => e.preventDefault()}
                  draggable
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-mono cursor-grab active:cursor-grabbing hover:bg-primary/90 transition-colors"
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  Save to Link Librarian
                </a>
                <p className="text-xs text-muted-foreground mt-1">
                  Or copy the code below and create a bookmark manually with it as the URL:
                </p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={bookmarkletCode}
                    className="font-mono text-xs"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
                    {copied ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                <Label className="font-mono text-sm">Save links!</Label>
              </div>
              <p className="text-xs text-muted-foreground ml-8">
                Visit any page and click the bookmarklet in your bookmarks bar. The page URL and title will be saved and analyzed automatically.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-muted/50 text-xs text-muted-foreground">
              <strong>Note:</strong> The bookmarklet uses your current session token. If you sign out and back in, you'll need to re-generate it from this page.
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
