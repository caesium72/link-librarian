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
import { Upload, FileJson, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const ImportDialog = ({ onSuccess }: { onSuccess: () => void }) => {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const text = await file.text();
      let parsed: unknown;

      // Try parsing as JSON
      try {
        parsed = JSON.parse(text);
      } catch {
        // Try JSONL (one object per line)
        const lines = text.split("\n").filter((l) => l.trim());
        parsed = { messages: lines.map((l) => JSON.parse(l)) };
      }

      // Extract messages array from Telegram export format
      let messages: unknown[];
      if (Array.isArray(parsed)) {
        messages = parsed;
      } else if (parsed && typeof parsed === "object" && "messages" in (parsed as Record<string, unknown>)) {
        messages = (parsed as Record<string, unknown[]>).messages;
      } else {
        throw new Error("Unrecognized format. Expected Telegram Desktop JSON export.");
      }

      // Send to edge function
      const { data, error } = await supabase.functions.invoke("import-telegram", {
        body: { messages },
      });

      if (error) throw error;

      setResult(data);
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
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground font-mono">Processing messages...</p>
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
