import { supabase } from "@/integrations/supabase/client";

export async function checkLinksHealth(linkId?: string) {
  const { data, error } = await supabase.functions.invoke("check-link-health", {
    body: linkId ? { linkId } : {},
  });
  if (error) throw error;
  return data as { checked: number; healthy: number; broken: number; errors: number };
}
