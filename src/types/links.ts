import { Tables } from "@/integrations/supabase/types";

export type Link = Tables<"links">;
export type Save = Tables<"saves">;

export type ContentType = "article" | "video" | "repo" | "docs" | "tool" | "thread" | "other";
export type LinkStatus = "pending" | "ready" | "failed";
