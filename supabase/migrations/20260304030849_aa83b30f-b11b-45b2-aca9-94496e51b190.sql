-- Add source column to links to distinguish discovered tools from manual saves
ALTER TABLE public.links ADD COLUMN source text NOT NULL DEFAULT 'manual';

-- Index for efficient filtering
CREATE INDEX idx_links_source ON public.links(source);