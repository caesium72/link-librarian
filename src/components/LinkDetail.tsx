import { Link } from "@/types/links";
import { Badge } from "@/components/ui/badge";
import { SimilarLinks } from "@/components/SimilarLinks";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ExternalLink,
  Copy,
  Pin,
  PinOff,
  RefreshCw,
  Trash2,
  BookOpen,
  BookCheck,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface LinkDetailProps {
  link: Link | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Link>) => void;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
  onSelectLink?: (link: Link) => void;
}

export function LinkDetail({ link, open, onClose, onUpdate, onRetry, onDelete, onSelectLink }: LinkDetailProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [editingTags, setEditingTags] = useState(false);

  useEffect(() => {
    if (link) {
      setNotes(link.notes || "");
      setTagsInput(link.tags?.join(", ") || "");
      setEditingTags(false);
    }
  }, [link]);

  if (!link) return null;

  const copyUrl = () => {
    navigator.clipboard.writeText(link.original_url);
    toast({ title: "Copied!", description: "URL copied to clipboard" });
  };

  const saveNotes = () => {
    onUpdate(link.id, { notes });
  };

  const saveTags = () => {
    const newTags = tagsInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    onUpdate(link.id, { tags: newTags });
    setEditingTags(false);
  };

  const statusColors: Record<string, string> = {
    pending: "text-muted-foreground",
    ready: "text-primary",
    failed: "text-destructive",
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="text-sm font-mono pr-8">
              {link.title || "Untitled Link"}
            </SheetTitle>
          </div>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          {/* Status & Type */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`font-mono text-xs ${statusColors[link.status]}`}>
              {link.status}
            </Badge>
            {link.content_type && (
              <Badge variant="secondary" className="font-mono text-xs">
                {link.content_type}
              </Badge>
            )}
            {link.confidence_score !== null && (
              <span className="text-xs text-muted-foreground font-mono">
                confidence: {link.confidence_score}
              </span>
            )}
          </div>

          {/* Summary */}
          {link.summary && (
            <div>
              <h4 className="text-xs font-mono text-muted-foreground mb-1">Summary</h4>
              <p className="text-sm">{link.summary}</p>
            </div>
          )}

          {/* Key Points */}
          {link.key_points && link.key_points.length > 0 && (
            <div>
              <h4 className="text-xs font-mono text-muted-foreground mb-1">Key Points</h4>
              <ul className="space-y-1">
                {link.key_points.map((point, i) => (
                  <li key={i} className="text-sm flex gap-2">
                    <span className="text-primary font-mono shrink-0">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* URL */}
          <div>
            <h4 className="text-xs font-mono text-muted-foreground mb-1">URL</h4>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate font-mono">
                {link.original_url}
              </code>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copyUrl}>
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => window.open(link.original_url, "_blank")}
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
            {link.domain && (
              <span className="text-xs text-muted-foreground font-mono mt-1 block">
                {link.domain}
              </span>
            )}
          </div>

          {/* Tags */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-xs font-mono text-muted-foreground">Tags</h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => (editingTags ? saveTags() : setEditingTags(true))}
              >
                {editingTags ? "Save" : "Edit"}
              </Button>
            </div>
            {editingTags ? (
              <Input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="tag1, tag2, tag3"
                className="font-mono text-xs"
                onKeyDown={(e) => e.key === "Enter" && saveTags()}
              />
            ) : (
              <div className="flex flex-wrap gap-1">
                {link.tags?.map((tag) => (
                  <Badge key={tag} variant="secondary" className="font-mono text-xs">
                    {tag}
                  </Badge>
                ))}
                {(!link.tags || link.tags.length === 0) && (
                  <span className="text-xs text-muted-foreground">No tags</span>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <h4 className="text-xs font-mono text-muted-foreground mb-1">Notes</h4>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add your notes..."
              className="font-mono text-xs min-h-[80px]"
              onBlur={saveNotes}
            />
          </div>

          {/* Metadata */}
          <div className="space-y-1 text-xs text-muted-foreground font-mono">
            <div>Saved {link.save_count}× · Created {new Date(link.created_at).toLocaleString()}</div>
            <div>Updated {new Date(link.updated_at).toLocaleString()}</div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="font-mono text-xs"
              onClick={() => onUpdate(link.id, { is_pinned: !link.is_pinned })}
            >
              {link.is_pinned ? <PinOff className="h-3 w-3 mr-1" /> : <Pin className="h-3 w-3 mr-1" />}
              {link.is_pinned ? "Unpin" : "Pin"}
            </Button>
            <Button
              variant={link.is_read ? "default" : "outline"}
              size="sm"
              className="font-mono text-xs"
              onClick={() => onUpdate(link.id, { is_read: !link.is_read })}
            >
              {link.is_read ? <BookCheck className="h-3 w-3 mr-1" /> : <BookOpen className="h-3 w-3 mr-1" />}
              {link.is_read ? "Visited" : "Mark Visited"}
            </Button>
            {link.status === "failed" && (
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-xs"
                onClick={() => onRetry(link.id)}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry Analysis
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="font-mono text-xs text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => {
                onDelete(link.id);
                onClose();
              }}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </Button>
          </div>

          {/* Similar Links */}
          {link.status === "ready" && (
            <SimilarLinks linkId={link.id} onSelectLink={onSelectLink} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
