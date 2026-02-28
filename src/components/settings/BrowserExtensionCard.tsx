import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Bookmark, Copy, CheckCircle2, Download, Chrome, Puzzle, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import JSZip from "jszip";

interface BrowserExtensionCardProps {
  supabaseUrl: string;
  accessToken: string;
}

export function BrowserExtensionCard({ supabaseUrl, accessToken }: BrowserExtensionCardProps) {
  const { toast } = useToast();
  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const handleDownloadZip = async () => {
    setDownloadingZip(true);
    try {
      const zip = new JSZip();
      const files = [
        { name: "manifest.json", path: "/extension/manifest.json" },
        { name: "popup.html", path: "/extension/popup.html" },
        { name: "popup.js", path: "/extension/popup.js" },
        { name: "icon16.png", path: "/extension/icon16.png" },
        { name: "icon48.png", path: "/extension/icon48.png" },
        { name: "icon128.png", path: "/extension/icon128.png" },
      ];
      await Promise.all(
        files.map(async (file) => {
          const response = await fetch(file.path);
          const blob = await response.blob();
          zip.file(file.name, blob);
        })
      );
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "link-librarian-extension.zip";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Downloaded!", description: "Unzip the file into a folder to install." });
    } catch (e) {
      toast({ title: "Download failed", variant: "destructive" });
    } finally {
      setDownloadingZip(false);
    }
  };

  const bookmarkletCode = `javascript:void(function(){var x=new XMLHttpRequest();x.open('POST','${supabaseUrl}/functions/v1/save-link');x.setRequestHeader('Content-Type','application/json');x.setRequestHeader('Authorization','Bearer ${accessToken}');x.onload=function(){var r=JSON.parse(x.responseText);if(r.duplicate){alert('Link Librarian: Already saved!')}else if(r.success){alert('Link Librarian: Saved!')}else{alert('Link Librarian: Error - '+r.error)}};x.onerror=function(){alert('Link Librarian: Network error')};x.send(JSON.stringify({url:location.href,title:document.title}))})()`;

  const copyToClipboard = (text: string, setter: (v: boolean) => void, label: string) => {
    navigator.clipboard.writeText(text);
    setter(true);
    toast({ title: `${label} copied!` });
    setTimeout(() => setter(false), 2000);
  };

  if (!accessToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-mono text-base">
            <Puzzle className="h-4 w-4" />
            Browser Extension
          </CardTitle>
          <CardDescription className="text-sm">Sign in to set up browser integration.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-mono text-base">
          <Puzzle className="h-4 w-4" />
          Browser Extension
        </CardTitle>
        <CardDescription className="text-sm">
          Save any page to Link Librarian with one click.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="extension" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="extension" className="flex-1 font-mono text-xs gap-1.5">
              <Chrome className="h-3.5 w-3.5" />
              Extension
            </TabsTrigger>
            <TabsTrigger value="bookmarklet" className="flex-1 font-mono text-xs gap-1.5">
              <Bookmark className="h-3.5 w-3.5" />
              Bookmarklet
            </TabsTrigger>
          </TabsList>

          <TabsContent value="extension" className="space-y-4 mt-4">
            {/* Step 1: Download */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                <Label className="font-mono text-sm">Download the extension</Label>
              </div>
              <div className="ml-8 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Download the extension as a ZIP file, then unzip it into a folder.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="font-mono gap-2"
                  onClick={handleDownloadZip}
                  disabled={downloadingZip}
                >
                  {downloadingZip ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  {downloadingZip ? "Bundling..." : "Download Extension (.zip)"}
                </Button>
              </div>
            </div>

            {/* Step 2: Install */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                <Label className="font-mono text-sm">Install in Chrome</Label>
              </div>
              <div className="ml-8 text-xs text-muted-foreground space-y-1">
                <p>1. Open <code>chrome://extensions</code> in your browser</p>
                <p>2. Enable <strong>Developer mode</strong> (top right toggle)</p>
                <p>3. Click <strong>Load unpacked</strong></p>
                <p>4. Select the folder with the extension files</p>
              </div>
            </div>

            {/* Step 3: Configure */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                <Label className="font-mono text-sm">Configure the extension</Label>
              </div>
              <div className="ml-8 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Click the extension icon and paste these values:
                </p>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Project URL</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={supabaseUrl} className="font-mono text-xs" onClick={(e) => (e.target as HTMLInputElement).select()} />
                    <Button variant="outline" size="icon" className="shrink-0" onClick={() => copyToClipboard(supabaseUrl, setCopiedUrl, "URL")}>
                      {copiedUrl ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Access Token</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={accessToken} type="password" className="font-mono text-xs" onClick={(e) => { (e.target as HTMLInputElement).type = "text"; (e.target as HTMLInputElement).select(); }} />
                    <Button variant="outline" size="icon" className="shrink-0" onClick={() => copyToClipboard(accessToken, setCopiedToken, "Token")}>
                      {copiedToken ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border bg-muted/50 text-xs text-muted-foreground">
              <strong>Note:</strong> The access token expires when you sign out. Re-visit this page to get a fresh token after signing back in.
            </div>
          </TabsContent>

          <TabsContent value="bookmarklet" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                <Label className="font-mono text-sm">Show bookmarks bar</Label>
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
                <a
                  href={bookmarkletCode}
                  onClick={(e) => e.preventDefault()}
                  draggable
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-mono cursor-grab active:cursor-grabbing hover:bg-primary/90 transition-colors"
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  Save to Link Librarian
                </a>
                <p className="text-xs text-muted-foreground mt-1">Or copy the code manually:</p>
                <div className="flex gap-2">
                  <Input readOnly value={bookmarkletCode} className="font-mono text-xs" onClick={(e) => (e.target as HTMLInputElement).select()} />
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(bookmarkletCode, setCopiedBookmarklet, "Bookmarklet")} className="shrink-0">
                    {copiedBookmarklet ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                <Label className="font-mono text-sm">Click it on any page!</Label>
              </div>
              <p className="text-xs text-muted-foreground ml-8">
                The current page URL and title will be saved and analyzed automatically.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-muted/50 text-xs text-muted-foreground">
              <strong>Note:</strong> The bookmarklet uses your current session token. Re-generate after signing out and back in.
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
