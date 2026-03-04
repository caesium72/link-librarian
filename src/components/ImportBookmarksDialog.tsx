import { useState, useRef } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileJson, Loader2, BookOpen, Cloud, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type ImportFormat = "pocket" | "raindrop" | "browser";

export const ImportBookmarksDialog = ({ onSuccess }: { onSuccess: () => void }) => {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [result, setResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<ImportFormat>("pocket");
  const { toast } = useToast();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);
    setProgress(0);
    setProgressLabel("Reading file...");

    try {
      const text = await file.text();
      setProgress(20);
      setProgressLabel("Uploading to server...");

      const { data, error } = await supabase.functions.invoke("import-bookmarks", {
        body: { format: activeTab, bookmarks: text },
      });

      if (error) throw error;

      setProgress(100);
      setProgressLabel("Done!");
      setResult({ imported: data.imported, skipped: data.skipped, total: data.total });
      toast({
        title: "Import complete",
        description: `${data.imported} new links imported, ${data.skipped} duplicates skipped.`,
      });
      onSuccess();
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const acceptMap: Record<ImportFormat, string> = {
    pocket: ".html,.htm",
    raindrop: ".csv",
    browser: ".html,.htm",
  };

  const instructions: Record<ImportFormat, { steps: string[]; icon: React.ReactNode }> = {
    pocket: {
      icon: <BookOpen className="h-4 w-4" />,
      steps: [
        "Go to getpocket.com/export",
        "Click 'Export HTML file'",
        "Upload the downloaded file here",
      ],
    },
    raindrop: {
      icon: <Cloud className="h-4 w-4" />,
      steps: [
        "Go to app.raindrop.io/settings/export",
        "Click 'Export .CSV'",
        "Upload the downloaded CSV here",
      ],
    },
    browser: {
      icon: <Globe className="h-4 w-4" />,
      steps: [
        "Open your browser's bookmark manager",
        "Click 'Export bookmarks' (HTML format)",
        "Upload the exported file here",
      ],
    },
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs font-mono gap-1.5">
          <Upload className="h-3.5 w-3.5" />
          Import Bookmarks
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">Import Bookmarks</DialogTitle>
          <DialogDescription className="text-xs">
            Import your bookmarks from Pocket, Raindrop.io, or your browser.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ImportFormat)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pocket" className="text-xs font-mono">Pocket</TabsTrigger>
            <TabsTrigger value="raindrop" className="text-xs font-mono">Raindrop</TabsTrigger>
            <TabsTrigger value="browser" className="text-xs font-mono">Browser</TabsTrigger>
          </TabsList>

          {(["pocket", "raindrop", "browser"] as ImportFormat[]).map((fmt) => (
            <TabsContent key={fmt} value={fmt} className="space-y-4">
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                {importing ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground font-mono">{progressLabel}</p>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center gap-2">
                    <FileJson className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground font-mono">
                      Click to upload your {fmt === "raindrop" ? "CSV" : "HTML"} export
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={acceptMap[fmt]}
                      className="hidden"
                      onChange={handleFile}
                    />
                  </label>
                )}
              </div>

              {result && (
                <div className="rounded-lg bg-card border border-border p-3 font-mono text-xs space-y-1">
                  <p className="text-primary">{result.imported} new links imported</p>
                  <p className="text-muted-foreground">{result.skipped} duplicates skipped</p>
                  <p className="text-muted-foreground">{result.total} bookmarks found total</p>
                </div>
              )}

              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  {instructions[fmt].icon} How to export from {fmt === "browser" ? "your browser" : fmt.charAt(0).toUpperCase() + fmt.slice(1)}:
                </p>
                <ol className="list-decimal list-inside space-y-0.5">
                  {instructions[fmt].steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
