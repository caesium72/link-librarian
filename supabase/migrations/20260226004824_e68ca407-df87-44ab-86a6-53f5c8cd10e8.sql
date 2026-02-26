
-- Collections table
CREATE TABLE public.collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT 'default',
  icon TEXT DEFAULT 'folder',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Junction table for many-to-many
CREATE TABLE public.collection_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  link_id UUID NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(collection_id, link_id)
);

-- Enable RLS
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_links ENABLE ROW LEVEL SECURITY;

-- Collections RLS
CREATE POLICY "Users can view their own collections"
  ON public.collections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own collections"
  ON public.collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own collections"
  ON public.collections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own collections"
  ON public.collections FOR DELETE
  USING (auth.uid() = user_id);

-- Collection links RLS (join through collections to verify ownership)
CREATE POLICY "Users can view their own collection links"
  ON public.collection_links FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.collections WHERE id = collection_id AND user_id = auth.uid()));

CREATE POLICY "Users can add to their own collections"
  ON public.collection_links FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.collections WHERE id = collection_id AND user_id = auth.uid()));

CREATE POLICY "Users can remove from their own collections"
  ON public.collection_links FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.collections WHERE id = collection_id AND user_id = auth.uid()));

-- Indexes
CREATE INDEX idx_collection_links_collection ON public.collection_links(collection_id);
CREATE INDEX idx_collection_links_link ON public.collection_links(link_id);
CREATE INDEX idx_collections_user ON public.collections(user_id);

-- Updated_at trigger for collections
CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
