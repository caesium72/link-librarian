import { useState } from "react";
import { Link } from "@/types/links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RefreshCw, Pencil, Trash2, ExternalLink, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FailedLinkReviewDialogProps {
  link: Link | null;
  open: boolean;
  onClose: () => void;
  onRetry: (id: string) => void;
  onResolve: (id: string, updates: Partial<Link>) => void;
  onDelete: (id: string) => void;
}

export function FailedLinkReviewDialog({
  link,
  open,
  onClose,
  onRetry,
  onResolve,
  onDelete,
}: FailedLinkReviewDialogProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"review" | "edit">("review");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const resetAndClose = () => {
    setMode("review");
    setTitle("");
    setSummary("");
    setTagsInput("");
    onClose();
  };

  const handleEdit = () => {
    setMode("edit");
    setTitle(link?.title || "");
    setSummary(link?.summary || "");
    setTagsInput(link?.tags?.join(", ") || "");
  };

  const handleResolve = () => {
    if (!link) return;
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    onResolve(link.id, {
      title: title || link.original_url,
      summary: summary || null,
      tags,
      status: "ready",
    } as Partial<Link>);
    toast({ title: "Resolved", description: "Link marked as ready." });
    resetAndClose();
  };

  const handleRetry = () => {
    if (!link) return;
    onRetry(link.id);
    toast({ title: "Retrying", description: "Analysis re-queued." });
    resetAndClose();
  };

  const handleDelete = () => {
    if (!link) return;
    onDelete(link.id);
    resetAndClose();
  };

  if (!link) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && resetAndClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Review Failed Link
          </DialogTitle>
          <DialogDescription>
            This link failed analysis. You can retry, manually resolve, or delete it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="bg-muted/50 rounded-md p-3 border border-border/50">
            <p className="text-xs text-muted-foreground font-mono mb-1">URL</p>
            <a
              href={link.original_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline break-all flex items-center gap-1"
            >
              {link.original_url}
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          </div>

          {link.domain && (
            <div className="flex items-center gap-2">
              <img
                src={`https://www.google.com/s2/favicons?domain=${link.domain}&sz=16`}
                alt=""
                className="h-4 w-4"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <span className="text-xs text-muted-foreground font-mono">{link.domain}</span>
              <Badge variant="destructive" className="text-[10px]">Failed</Badge>
            </div>
          )}

          {mode === "edit" ? (
            <div className="space-y-3 animate-fade-in">
              <div>
                <label className="text-xs font-mono text-muted-foreground mb-1 block">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter a title..."
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-mono text-muted-foreground mb-1 block">Summary</label>
                <Textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Enter a summary..."
                  rows={3}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-mono text-muted-foreground mb-1 block">Tags (comma-separated)</label>
                <Input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="tag1, tag2, tag3"
                  className="text-sm font-mono"
                />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {mode === "edit" ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setMode("review")}>
                Back
              </Button>
              <Button size="sm" onClick={handleResolve} className="gap-1.5">
                Mark as Ready
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleRetry}>
                <RefreshCw className="h-3.5 w-3.5" /> Retry Analysis
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleEdit}>
                <Pencil className="h-3.5 w-3.5" /> Edit & Resolve
              </Button>
              <Button variant="destructive" size="sm" className="gap-1.5" onClick={handleDelete}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
