import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchCollections, fetchLinkCollectionIds, addLinkToCollection, removeLinkFromCollection } from "@/lib/api/collections";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FolderPlus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AddToCollectionMenuProps {
  linkId: string;
}

export function AddToCollectionMenu({ linkId }: AddToCollectionMenuProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: collections = [] } = useQuery({
    queryKey: ["collections"],
    queryFn: fetchCollections,
  });

  const { data: memberOf = [], isLoading } = useQuery({
    queryKey: ["link-collections", linkId],
    queryFn: () => fetchLinkCollectionIds(linkId),
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: (collectionId: string) => addLinkToCollection(collectionId, linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["link-collections", linkId] });
      queryClient.invalidateQueries({ queryKey: ["collection-links"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (collectionId: string) => removeLinkFromCollection(collectionId, linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["link-collections", linkId] });
      queryClient.invalidateQueries({ queryKey: ["collection-links"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggle = (collectionId: string, isMember: boolean) => {
    if (isMember) removeMutation.mutate(collectionId);
    else addMutation.mutate(collectionId);
  };

  if (collections.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
          <FolderPlus className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="end" onClick={(e) => e.stopPropagation()}>
        <p className="text-[10px] font-mono text-muted-foreground uppercase mb-2">Add to collection</p>
        {isLoading ? (
          <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : (
          <div className="space-y-1">
            {collections.map((col) => {
              const isMember = memberOf.includes(col.id);
              return (
                <label key={col.id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-xs font-mono">
                  <Checkbox checked={isMember} onCheckedChange={() => toggle(col.id, isMember)} />
                  <span className="truncate">{col.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
