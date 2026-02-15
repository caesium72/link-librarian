import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, FileJson, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const CHUNK_SIZE = 200;

export const ImportDialog = ({ onSuccess }: { onSuccess: () => void }) => {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [result, setResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);
    setProgress(0);
    setProgressLabel("Parsing file...");

    try {
      const text = await file.text();
      let parsed: unknown;

      try {
        parsed = JSON.parse(text);
      } catch {
        const lines = text.split("\n").filter((l) => l.trim());
        parsed = { messages: lines.map((l) => JSON.parse(l)) };
      }

      let messages: unknown[];
      if (Array.isArray(parsed)) {
        messages = parsed;
      } else if (parsed && typeof parsed === "object" && "messages" in (parsed as Record<string, unknown>)) {
        messages = (parsed as Record<string, unknown[]>).messages;
      } else {
        throw new Error("Unrecognized format. Expected Telegram Desktop JSON export.");
      }

      const totalChunks = Math.ceil(messages.length / CHUNK_SIZE);
      let totalImported = 0;
      let totalSkipped = 0;
      let totalUrls = 0;

      for (let i = 0; i < totalChunks; i++) {
        const chunk = messages.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const pct = Math.round(((i + 1) / totalChunks) * 100);
        setProgress(pct);
        setProgressLabel(`Processing ${i * CHUNK_SIZE + 1}–${Math.min((i + 1) * CHUNK_SIZE, messages.length)} of ${messages.length} messages...`);

        const { data, error } = await supabase.functions.invoke("import-telegram", {
          body: { messages: chunk },
        });

        if (error) throw error;
        totalImported += data.imported;
        totalSkipped += data.skipped;
        totalUrls += data.total;
      }

      setProgress(100);
      setProgressLabel("Done!");
      setResult({ imported: totalImported, skipped: totalSkipped, total: totalUrls });
      toast({
        title: "Import complete",
        description: `${totalImported} new links imported, ${totalSkipped} duplicates skipped.`,
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs font-mono gap-1.5">
          <Upload className="h-3.5 w-3.5" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">Import Telegram History</DialogTitle>
          <DialogDescription className="text-xs">
            Export your channel history from Telegram Desktop as JSON, then upload it here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
                  Click to upload <code>result.json</code>
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.jsonl"
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
              <p className="text-muted-foreground">{result.total} URLs found total</p>
            </div>
          )}

          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-semibold">How to export:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Open Telegram Desktop</li>
              <li>Right-click your channel → Export chat history</li>
              <li>Select JSON format, uncheck media</li>
              <li>Upload the <code>result.json</code> file here</li>
            </ol>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
