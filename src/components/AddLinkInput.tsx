import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, List, X } from "lucide-react";
import { addLink } from "@/lib/api/links";
import { useToast } from "@/hooks/use-toast";

interface AddLinkInputProps {
  onSuccess: () => void;
}

function parseUrl(raw: string): string | null {
  let trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed) && /^[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}/.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return trimmed;
  } catch {
    return null;
  }
}

export function AddLinkInput({ onSuccess }: AddLinkInputProps) {
  const [url, setUrl] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const { toast } = useToast();

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseUrl(url);
    if (!parsed) {
      toast({ title: "Invalid URL", description: "Please enter a valid URL (e.g. example.com).", variant: "destructive" });
      return;
    }

    setIsAdding(true);
    try {
      await addLink(parsed);
      setUrl("");
      toast({ title: "Link added", description: "Analysis will start shortly." });
      onSuccess();
    } catch (e: any) {
      if (e.message === "DUPLICATE") {
        toast({ title: "Duplicate link", description: "This link already exists in your library.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: e.message, variant: "destructive" });
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleBulkSubmit = async () => {
    const lines = bulkText.split(/\n/).map(l => l.trim()).filter(Boolean);
    const urls: string[] = [];
    const invalid: string[] = [];

    for (const line of lines) {
      const parsed = parseUrl(line);
      if (parsed) {
        urls.push(parsed);
      } else {
        invalid.push(line);
      }
    }

    if (urls.length === 0) {
      toast({ title: "No valid URLs", description: "Enter one URL per line.", variant: "destructive" });
      return;
    }

    setIsAdding(true);
    setProgress({ done: 0, total: urls.length });
    let added = 0;
    let duplicates = 0;
    let errors = 0;

    for (const u of urls) {
      try {
        await addLink(u);
        added++;
      } catch (e: any) {
        if (e.message === "DUPLICATE") duplicates++;
        else errors++;
      }
      setProgress(p => ({ ...p, done: p.done + 1 }));
    }

    setIsAdding(false);
    setProgress({ done: 0, total: 0 });

    const parts: string[] = [];
    if (added > 0) parts.push(`${added} added`);
    if (duplicates > 0) parts.push(`${duplicates} duplicates`);
    if (errors > 0) parts.push(`${errors} failed`);
    if (invalid.length > 0) parts.push(`${invalid.length} invalid`);

    toast({
      title: `Bulk import complete`,
      description: parts.join(", "),
      variant: errors > 0 || invalid.length > 0 ? "destructive" : "default",
    });

    if (added > 0) {
      setBulkText("");
      setBulkMode(false);
      onSuccess();
    }
  };

  if (bulkMode) {
    return (
      <div className="space-y-2 animate-fade-in">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">Paste one URL per line</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setBulkMode(false); setBulkText(""); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Textarea
          placeholder={"https://example.com\nhttps://another-site.org\nexample.dev/article"}
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          className="font-mono text-sm min-h-[100px] resize-y"
          disabled={isAdding}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-mono">
            {bulkText.split(/\n/).filter(l => l.trim()).length} lines
            {progress.total > 0 && ` · ${progress.done}/${progress.total} processed`}
          </span>
          <Button
            size="sm"
            className="h-8"
            onClick={handleBulkSubmit}
            disabled={isAdding || !bulkText.trim()}
          >
            {isAdding ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Adding...</>
            ) : (
              <><Plus className="h-3.5 w-3.5 mr-1.5" /> Add All</>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSingleSubmit} className="flex gap-2">
      <Input
        placeholder="Paste a URL..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="font-mono text-sm h-9"
        disabled={isAdding}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 shrink-0"
        onClick={() => setBulkMode(true)}
        title="Bulk add"
      >
        <List className="h-3.5 w-3.5" />
      </Button>
      <Button type="submit" size="sm" className="h-9 shrink-0" disabled={isAdding || !url.trim()}>
        {isAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
      </Button>
    </form>
  );
}
