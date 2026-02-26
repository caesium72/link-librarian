import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchCollections, createCollection, deleteCollection, updateCollection } from "@/lib/api/collections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FolderPlus, Folder, Trash2, Pencil, Check, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Collection } from "@/types/collections";

interface CollectionManagerProps {
  selectedCollectionId: string | null;
  onSelectCollection: (id: string | null) => void;
  collapsed?: boolean;
}

export function CollectionManager({ selectedCollectionId, onSelectCollection, collapsed }: CollectionManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: collections = [] } = useQuery({
    queryKey: ["collections"],
    queryFn: fetchCollections,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createCollection(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      setNewName("");
      setShowCreate(false);
      toast({ title: "Collection created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCollection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      if (selectedCollectionId) onSelectCollection(null);
      toast({ title: "Collection deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateCollection(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      setEditingId(null);
      toast({ title: "Renamed" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (collapsed) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Collections</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {showCreate && (
        <div className="flex gap-1">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name..."
            className="h-7 text-xs font-mono"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) createMutation.mutate(newName.trim());
              if (e.key === "Escape") { setShowCreate(false); setNewName(""); }
            }}
            autoFocus
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => newName.trim() && createMutation.mutate(newName.trim())}
            disabled={!newName.trim()}
          >
            <Check className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* "All" option */}
      <Button
        variant={selectedCollectionId === null ? "secondary" : "ghost"}
        size="sm"
        className="w-full h-7 justify-start text-xs font-mono gap-1.5 px-2"
        onClick={() => onSelectCollection(null)}
      >
        <Folder className="h-3 w-3" />
        All Links
      </Button>

      {collections.map((col) => (
        <div key={col.id} className="group flex items-center gap-0.5">
          {editingId === col.id ? (
            <div className="flex gap-1 flex-1">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-7 text-xs font-mono"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && editName.trim()) renameMutation.mutate({ id: col.id, name: editName.trim() });
                  if (e.key === "Escape") setEditingId(null);
                }}
                autoFocus
              />
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => editName.trim() && renameMutation.mutate({ id: col.id, name: editName.trim() })}>
                <Check className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setEditingId(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <>
              <Button
                variant={selectedCollectionId === col.id ? "secondary" : "ghost"}
                size="sm"
                className="flex-1 h-7 justify-start text-xs font-mono gap-1.5 px-2 min-w-0"
                onClick={() => onSelectCollection(selectedCollectionId === col.id ? null : col.id)}
              >
                <Folder className="h-3 w-3 shrink-0" />
                <span className="truncate">{col.name}</span>
              </Button>
              <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingId(col.id); setEditName(col.name); }}>
                  <Pencil className="h-2.5 w-2.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(col.id)}>
                  <Trash2 className="h-2.5 w-2.5" />
                </Button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
