import { Link } from "@/types/links";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SimilarLinks } from "@/components/SimilarLinks";
import {
  ExternalLink, Copy, Pin, PinOff, RefreshCw, Trash2, X, BookOpen, CheckCircle2, Clock,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { markAsReading, markAsRead } from "@/lib/api/reading";

interface LinkDetailPanelProps {
  link: Link | null;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Link>) => void;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
  onSelectLink?: (link: Link) => void;
}

export function LinkDetailPanel({ link, onClose, onUpdate, onRetry, onDelete, onSelectLink }: LinkDetailPanelProps) {
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

  if (!link) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-xs font-mono">Select a link to view details</p>
      </div>
    );
  }

  const copyUrl = () => {
    navigator.clipboard.writeText(link.original_url);
    toast({ title: "Copied!", description: "URL copied to clipboard" });
  };

  const saveNotes = () => {
    onUpdate(link.id, { notes });
  };

  const saveTags = () => {
    const newTags = tagsInput.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    onUpdate(link.id, { tags: newTags });
    setEditingTags(false);
  };

  const statusColors: Record<string, string> = {
    pending: "text-muted-foreground",
    ready: "text-primary",
    failed: "text-destructive",
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-mono font-semibold leading-tight">
            {link.title || "Untitled Link"}
          </h2>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

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
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => window.open(link.original_url, "_blank")}>
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
          {link.domain && (
            <span className="text-xs text-muted-foreground font-mono mt-1 block">{link.domain}</span>
          )}
        </div>

        {/* Tags */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-xs font-mono text-muted-foreground">Tags</h4>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => (editingTags ? saveTags() : setEditingTags(true))}>
              {editingTags ? "Save" : "Edit"}
            </Button>
          </div>
          {editingTags ? (
            <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="tag1, tag2, tag3" className="font-mono text-xs" onKeyDown={(e) => e.key === "Enter" && saveTags()} />
          ) : (
            <div className="flex flex-wrap gap-1">
              {link.tags?.map((tag) => (
                <Badge key={tag} variant="secondary" className="font-mono text-xs">{tag}</Badge>
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
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add your notes..." className="font-mono text-xs min-h-[80px]" onBlur={saveNotes} />
        </div>

        {/* Reading Progress */}
        {(link as any).reading_time_estimate && (
          <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {(link as any).reading_time_estimate} min read
              </span>
              {link.is_read ? (
                <Badge variant="secondary" className="text-[10px] font-mono gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Read
                </Badge>
              ) : (link as any).reading_started_at ? (
                <Badge variant="outline" className="text-[10px] font-mono gap-1 text-chart-3">
                  <BookOpen className="h-3 w-3" /> In Progress
                </Badge>
              ) : null}
            </div>
            <div className="flex gap-2 mt-2">
              {!link.is_read && !(link as any).reading_started_at && (
                <Button variant="outline" size="sm" className="h-7 text-xs font-mono gap-1" onClick={async () => {
                  await markAsReading(link.id);
                  onUpdate(link.id, { is_read: false } as any);
                  toast({ title: "Started reading" });
                }}>
                  <BookOpen className="h-3 w-3" /> Start Reading
                </Button>
              )}
              {!link.is_read && (
                <Button variant="outline" size="sm" className="h-7 text-xs font-mono gap-1" onClick={async () => {
                  await markAsRead(link.id);
                  onUpdate(link.id, { is_read: true });
                  toast({ title: "Marked as read! 🎉" });
                }}>
                  <CheckCircle2 className="h-3 w-3" /> Mark as Read
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="space-y-1 text-xs text-muted-foreground font-mono">
          <div>Saved {link.save_count}× · Created {new Date(link.created_at).toLocaleString()}</div>
          <div>Updated {new Date(link.updated_at).toLocaleString()}</div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="font-mono text-xs" onClick={() => onUpdate(link.id, { is_pinned: !link.is_pinned })}>
            {link.is_pinned ? <PinOff className="h-3 w-3 mr-1" /> : <Pin className="h-3 w-3 mr-1" />}
            {link.is_pinned ? "Unpin" : "Pin"}
          </Button>
          {link.status === "failed" && (
            <Button variant="outline" size="sm" className="font-mono text-xs" onClick={() => onRetry(link.id)}>
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          )}
          <Button
            variant="outline" size="sm"
            className="font-mono text-xs text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => { onDelete(link.id); onClose(); }}
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
    </ScrollArea>
  );
}
