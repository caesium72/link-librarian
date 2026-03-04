import { supabase } from "@/integrations/supabase/client";
import type { Link } from "@/types/links";

export async function fetchLinks({
  search,
  contentType,
  status,
  isPinned,
  sortBy = "date_desc",
}: {
  search?: string;
  contentType?: string;
  status?: string;
  isPinned?: boolean;
  sortBy?: string;
} = {}): Promise<Link[]> {
  const sortMap: Record<string, { column: string; ascending: boolean }> = {
    date_desc: { column: "created_at", ascending: false },
    date_asc: { column: "created_at", ascending: true },
    title_asc: { column: "title", ascending: true },
    title_desc: { column: "title", ascending: false },
    domain_asc: { column: "domain", ascending: true },
  };
  const sort = sortMap[sortBy] || sortMap.date_desc;

  let query = supabase
    .from("links")
    .select("*")
    .is("deleted_at", null)
    .eq("source", "manual")
    .order(sort.column, { ascending: sort.ascending });

  if (search && search.trim()) {
    // Use full-text search
    const tsQuery = search.trim().split(/\s+/).join(" & ");
    query = query.textSearch("fts", tsQuery);
  }

  if (contentType && contentType !== "all") {
    query = query.eq("content_type", contentType);
  }

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (isPinned !== undefined) {
    query = query.eq("is_pinned", isPinned);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function updateLink(id: string, updates: Partial<Link>) {
  const { data, error } = await supabase
    .from("links")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteLink(id: string) {
  // Soft delete
  const { error } = await supabase
    .from("links")
    .update({ deleted_at: new Date().toISOString() } as any)
    .eq("id", id);
  if (error) throw error;
}

export async function permanentDeleteLink(id: string) {
  const { error } = await supabase.from("links").delete().eq("id", id);
  if (error) throw error;
}

export async function restoreLink(id: string) {
  const { error } = await supabase
    .from("links")
    .update({ deleted_at: null } as any)
    .eq("id", id);
  if (error) throw error;
}

export async function fetchDeletedLinks(): Promise<Link[]> {
  const { data, error } = await supabase
    .from("links")
    .select("*")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function emptyTrash() {
  const { error } = await supabase
    .from("links")
    .delete()
    .not("deleted_at", "is", null);
  if (error) throw error;
}

export async function bulkDeleteLinks(ids: string[]) {
  // Soft delete
  const { error } = await supabase
    .from("links")
    .update({ deleted_at: new Date().toISOString() } as any)
    .in("id", ids);
  if (error) throw error;
}

export async function bulkAddTag(ids: string[], tag: string) {
  // Fetch current tags for all links, then append the new tag
  const { data, error: fetchError } = await supabase
    .from("links")
    .select("id, tags")
    .in("id", ids);
  if (fetchError) throw fetchError;

  const updates = (data || []).map((link) => {
    const existing = link.tags || [];
    const newTags = existing.includes(tag) ? existing : [...existing, tag];
    return supabase.from("links").update({ tags: newTags }).eq("id", link.id);
  });

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

export async function bulkRemoveTag(ids: string[], tag: string) {
  const { data, error: fetchError } = await supabase
    .from("links")
    .select("id, tags")
    .in("id", ids);
  if (fetchError) throw fetchError;

  const updates = (data || []).map((link) => {
    const newTags = (link.tags || []).filter((t: string) => t !== tag);
    return supabase.from("links").update({ tags: newTags }).eq("id", link.id);
  });

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

export async function checkDuplicate(url: string): Promise<Link | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("links")
    .select("*")
    .eq("original_url", url)
    .eq("user_id", user.id)
    .maybeSingle();
  return data || null;
}

export async function addLink(url: string, source: string = "manual"): Promise<Link> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Check for duplicate
  const existing = await checkDuplicate(url);
  if (existing) {
    // Increment duplicate_count
    await supabase
      .from("links")
      .update({ duplicate_count: ((existing as any).duplicate_count || 0) + 1 } as any)
      .eq("id", existing.id);
    throw new Error("DUPLICATE");
  }

  // Extract domain
  let domain = "";
  try { domain = new URL(url).hostname; } catch {}

  // Insert link
  const { data, error } = await supabase
    .from("links")
    .insert({ original_url: url, domain, user_id: user.id, status: "pending", source } as any)
    .select()
    .single();
  if (error) throw error;

  // Trigger analysis (fire and forget)
  supabase.functions.invoke("analyze-link", { body: { linkId: data.id } }).catch(console.error);

  return data;
}

export async function retryAnalysis(linkId: string) {
  const { data, error } = await supabase.functions.invoke("analyze-link", {
    body: { linkId },
  });
  if (error) throw error;
  return data;
}
