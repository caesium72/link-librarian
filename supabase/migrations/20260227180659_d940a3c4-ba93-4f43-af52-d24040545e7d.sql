
-- Add duplicate_count column to links table
ALTER TABLE public.links ADD COLUMN duplicate_count integer NOT NULL DEFAULT 0;

-- Backfill: set duplicate_count = save_count - 1 for links with save_count > 1
UPDATE public.links SET duplicate_count = save_count - 1 WHERE save_count > 1;
