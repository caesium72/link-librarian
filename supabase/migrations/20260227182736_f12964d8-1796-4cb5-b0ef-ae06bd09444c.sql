-- Add soft delete column to links
ALTER TABLE public.links ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- Create index for faster queries on non-deleted links
CREATE INDEX idx_links_deleted_at ON public.links (deleted_at) WHERE deleted_at IS NULL;