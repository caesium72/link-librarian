
-- Add public sharing columns to collections
ALTER TABLE public.collections
  ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN public_slug TEXT UNIQUE;

-- Create index for slug lookups
CREATE UNIQUE INDEX idx_collections_public_slug ON public.collections (public_slug) WHERE public_slug IS NOT NULL;

-- Allow anyone to view public collections (read-only)
CREATE POLICY "Anyone can view public collections"
ON public.collections FOR SELECT
USING (is_public = true);

-- Allow anyone to view links in public collections via collection_links
CREATE POLICY "Anyone can view public collection links"
ON public.collection_links FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM collections
    WHERE collections.id = collection_links.collection_id
    AND collections.is_public = true
  )
);

-- Allow anyone to view links that belong to public collections
CREATE POLICY "Anyone can view links in public collections"
ON public.links FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM collection_links
    JOIN collections ON collections.id = collection_links.collection_id
    WHERE collection_links.link_id = links.id
    AND collections.is_public = true
  )
);
