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
import { Badge } from "@/components/ui/badge";
import { Upload, FileJson, Loader2, Globe, BookOpen, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const CHUNK_SIZE = 200;

type ImportSource = "telegram" | "pocket" | "instapaper" | "bookmarks" | "raindrop";

interface ParsedLink {
  url: string;
  title?: string;
  tags?: string[];
  created_at?: string;
}

function parsePocketHTML(html: string): ParsedLink[] {
  const links: ParsedLink[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const anchors = doc.querySelectorAll("a");
  anchors.forEach((a) => {
    const url = a.getAttribute("href");
    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) return;
    const title = a.textContent?.trim() || undefined;
    const tags = a.getAttribute("tags")?.split(",").map((t) => t.trim()).filter(Boolean) || [];
    const timeAdded = a.getAttribute("time_added");
    links.push({
      url,
      title,
      tags: tags.length > 0 ? tags : undefined,
      created_at: timeAdded ? new Date(parseInt(timeAdded) * 1000).toISOString() : undefined,
    });
  });
  return links;
}

function parseInstapaperCSV(text: string): ParsedLink[] {
  const links: ParsedLink[] = [];
  const lines = text.split("\n");
  // Instapaper CSV: URL,Title,Selection,Folder,Timestamp
  const startIdx = lines[0]?.toLowerCase().includes("url") ? 1 : 0;
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    // Simple CSV parse handling quoted fields
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === "," && !inQuotes) { fields.push(current.trim()); current = ""; continue; }
      current += char;
    }
    fields.push(current.trim());
    const [url, title, , folder, timestamp] = fields;
    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) continue;
    const tags = folder && folder !== "Unread" && folder !== "Archive" ? [folder] : undefined;
    links.push({
      url,
      title: title || undefined,
      tags,
      created_at: timestamp ? new Date(parseInt(timestamp) * 1000).toISOString() : undefined,
    });
  }
  return links;
}

function parseBookmarksHTML(html: string): ParsedLink[] {
  const links: ParsedLink[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const anchors = doc.querySelectorAll("a");
  anchors.forEach((a) => {
    const url = a.getAttribute("href");
    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) return;
    const title = a.textContent?.trim() || undefined;
    const addDate = a.getAttribute("add_date");
    links.push({
      url,
      title,
      created_at: addDate ? new Date(parseInt(addDate) * 1000).toISOString() : undefined,
    });
  });
  return links;
}

function parseRaindropCSV(text: string): ParsedLink[] {
  const links: ParsedLink[] = [];
  const lines = text.split("\n");
  const headerLine = lines[0]?.toLowerCase() || "";
  const headers = headerLine.split(",").map((h) => h.trim().replace(/"/g, ""));
  const urlIdx = headers.findIndex((h) => h === "url" || h === "link");
  const titleIdx = headers.findIndex((h) => h === "title");
  const tagsIdx = headers.findIndex((h) => h === "tags");
  const dateIdx = headers.findIndex((h) => h.includes("created") || h.includes("date"));
  if (urlIdx === -1) return links;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === "," && !inQuotes) { fields.push(current.trim()); current = ""; continue; }
      current += char;
    }
    fields.push(current.trim());
    const url = fields[urlIdx];
    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) continue;
    const title = titleIdx >= 0 ? fields[titleIdx] : undefined;
    const tags = tagsIdx >= 0 && fields[tagsIdx] ? fields[tagsIdx].split(",").map((t) => t.trim()).filter(Boolean) : undefined;
    const created = dateIdx >= 0 && fields[dateIdx] ? new Date(fields[dateIdx]).toISOString() : undefined;
    links.push({ url, title: title || undefined, tags, created_at: created });
  }
  return links;
}

export const ImportDialog = ({ onSuccess }: { onSuccess: () => void }) => {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [result, setResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);
  const [source, setSource] = useState<ImportSource>("telegram");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const importGenericLinks = async (links: ParsedLink[]) => {
    if (links.length === 0) {
      toast({ title: "No links found", description: "The file didn't contain any recognizable URLs.", variant: "destructive" });
      setImporting(false);
      return;
    }

    const totalChunks = Math.ceil(links.length / CHUNK_SIZE);
    let totalImported = 0;
    let totalSkipped = 0;

    for (let i = 0; i < totalChunks; i++) {
      const chunk = links.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const pct = Math.round(((i + 1) / totalChunks) * 100);
      setProgress(pct);
      setProgressLabel(`Saving ${i * CHUNK_SIZE + 1}–${Math.min((i + 1) * CHUNK_SIZE, links.length)} of ${links.length} links...`);

      const { data, error } = await supabase.functions.invoke("save-link", {
        body: { links: chunk.map((l) => ({ url: l.url, title: l.title, tags: l.tags, source: source })) },
      });

      if (error) throw error;
      totalImported += data?.imported ?? chunk.length;
      totalSkipped += data?.skipped ?? 0;
    }

    setProgress(100);
    setProgressLabel("Done!");
    setResult({ imported: totalImported, skipped: totalSkipped, total: links.length });
    toast({
      title: "Import complete",
      description: `${totalImported} new links imported, ${totalSkipped} duplicates skipped.`,
    });
    onSuccess();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);
    setProgress(0);
    setProgressLabel("Parsing file...");

    try {
      const text = await file.text();

      if (source === "telegram") {
        // Existing Telegram logic
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
      } else if (source === "pocket") {
        const links = parsePocketHTML(text);
        await importGenericLinks(links);
      } else if (source === "instapaper") {
        const links = parseInstapaperCSV(text);
        await importGenericLinks(links);
      } else if (source === "bookmarks") {
        const links = parseBookmarksHTML(text);
        await importGenericLinks(links);
      } else if (source === "raindrop") {
        const links = parseRaindropCSV(text);
        await importGenericLinks(links);
      }
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

  const sources: { key: ImportSource; label: string; icon: React.ReactNode; accept: string; desc: string }[] = [
    { key: "telegram", label: "Telegram", icon: <FileJson className="h-3.5 w-3.5" />, accept: ".json,.jsonl", desc: "Telegram Desktop JSON export" },
    { key: "pocket", label: "Pocket", icon: <BookOpen className="h-3.5 w-3.5" />, accept: ".html,.htm", desc: "Pocket HTML export file" },
    { key: "instapaper", label: "Instapaper", icon: <FileText className="h-3.5 w-3.5" />, accept: ".csv", desc: "Instapaper CSV export" },
    { key: "bookmarks", label: "Bookmarks", icon: <Globe className="h-3.5 w-3.5" />, accept: ".html,.htm", desc: "Browser bookmarks HTML export" },
    { key: "raindrop", label: "Raindrop", icon: <FileText className="h-3.5 w-3.5" />, accept: ".csv", desc: "Raindrop.io CSV export" },
  ];

  const activeSource = sources.find((s) => s.key === source)!;

  const instructions: Record<ImportSource, { steps: string[] }> = {
    telegram: {
      steps: [
        "Open Telegram Desktop",
        "Right-click your channel → Export chat history",
        "Select JSON format, uncheck media",
        "Upload the result.json file here",
      ],
    },
    pocket: {
      steps: [
        "Go to getpocket.com/export",
        "Click Export to get your ril_export.html file",
        "Upload the HTML file here",
      ],
    },
    instapaper: {
      steps: [
        "Go to instapaper.com/export",
        "Click Download .CSV file",
        "Upload the CSV file here",
      ],
    },
    bookmarks: {
      steps: [
        "Open your browser's bookmark manager",
        "Export bookmarks as HTML",
        "Upload the HTML file here",
      ],
    },
    raindrop: {
      steps: [
        "Go to app.raindrop.io → Settings → Export",
        "Download as CSV",
        "Upload the CSV file here",
      ],
    },
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
          <DialogTitle className="font-mono">Import Links</DialogTitle>
          <DialogDescription className="text-xs">
            Import your reading list from various services.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source selector */}
          <div className="flex flex-wrap gap-1.5">
            {sources.map((s) => (
              <button
                key={s.key}
                onClick={() => { setSource(s.key); setResult(null); }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono border transition-all",
                  source === s.key
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/20"
                )}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>

          {/* Upload area */}
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            {importing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground font-mono">{progressLabel}</p>
              </div>
            ) : (
              <label className="cursor-pointer flex flex-col items-center gap-2">
                {activeSource.icon}
                <p className="text-sm text-muted-foreground font-mono">
                  Click to upload {activeSource.desc}
                </p>
                <Badge variant="secondary" className="text-[10px]">{activeSource.accept}</Badge>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={activeSource.accept}
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
            <p className="font-semibold">How to export from {activeSource.label}:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              {instructions[source].steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
