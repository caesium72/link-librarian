import { supabase } from "@/integrations/supabase/client";
import type { Collection } from "@/types/collections";

export async function fetchCollections(): Promise<Collection[]> {
  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .order("position", { ascending: true });
  if (error) throw error;
  return (data || []) as Collection[];
}

export async function createCollection(name: string): Promise<Collection> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("collections")
    .insert({ name, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data as Collection;
}

export async function updateCollection(id: string, updates: Partial<Pick<Collection, "name" | "description" | "color" | "icon" | "position">>) {
  const { data, error } = await supabase
    .from("collections")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Collection;
}

export async function deleteCollection(id: string) {
  const { error } = await supabase.from("collections").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchCollectionLinkIds(collectionId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("collection_links")
    .select("link_id")
    .eq("collection_id", collectionId);
  if (error) throw error;
  return (data || []).map((r: any) => r.link_id);
}

export async function fetchLinkCollectionIds(linkId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("collection_links")
    .select("collection_id")
    .eq("link_id", linkId);
  if (error) throw error;
  return (data || []).map((r: any) => r.collection_id);
}

export async function addLinkToCollection(collectionId: string, linkId: string) {
  const { error } = await supabase
    .from("collection_links")
    .insert({ collection_id: collectionId, link_id: linkId });
  if (error) throw error;
}

export async function removeLinkFromCollection(collectionId: string, linkId: string) {
  const { error } = await supabase
    .from("collection_links")
    .delete()
    .eq("collection_id", collectionId)
    .eq("link_id", linkId);
  if (error) throw error;
}

export async function addLinksToCollection(collectionId: string, linkIds: string[]) {
  const rows = linkIds.map((link_id) => ({ collection_id: collectionId, link_id }));
  const { error } = await supabase.from("collection_links").upsert(rows, { onConflict: "collection_id,link_id" });
  if (error) throw error;
}
