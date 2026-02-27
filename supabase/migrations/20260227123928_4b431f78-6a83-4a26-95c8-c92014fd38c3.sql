
-- Add is_read column to links table for read/unread tracking
ALTER TABLE public.links ADD COLUMN is_read boolean NOT NULL DEFAULT false;

-- Add index for filtering
CREATE INDEX idx_links_is_read ON public.links (is_read);
