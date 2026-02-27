import { Button } from "@/components/ui/button";
import { Trash2, RotateCcw, Trash } from "lucide-react";
import type { Link } from "@/types/links";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface RecycleBinViewProps {
  deletedLinks: Link[];
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onEmptyTrash: () => void;
}

export function RecycleBinView({ deletedLinks, onRestore, onPermanentDelete, onEmptyTrash }: RecycleBinViewProps) {
  if (deletedLinks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Trash2 className="h-12 w-12 text-muted-foreground/20 mb-4" />
        <h2 className="font-mono text-sm text-muted-foreground mb-2">Recycle bin is empty</h2>
        <p className="text-xs text-muted-foreground/70">Deleted links will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-sm font-semibold flex items-center gap-2">
          <Trash2 className="h-4 w-4" /> Recycle Bin ({deletedLinks.length})
        </h2>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="h-8 text-xs font-mono gap-1.5">
              <Trash className="h-3 w-3" /> Empty Trash
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Empty recycle bin?</AlertDialogTitle>
              <AlertDialogDescription>This will permanently delete all {deletedLinks.length} links. This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onEmptyTrash}>
                Delete All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <div className="space-y-2">
        {deletedLinks.map((link) => (
          <div
            key={link.id}
            className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50 hover:bg-card transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono truncate">{link.title || link.original_url}</p>
              <p className="text-[10px] text-muted-foreground truncate">{link.domain}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRestore(link.id)} title="Restore">
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Delete permanently">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
                    <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => onPermanentDelete(link.id)}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
