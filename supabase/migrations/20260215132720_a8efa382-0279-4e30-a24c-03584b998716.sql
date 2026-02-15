
-- Create links table
CREATE TABLE public.links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  canonical_url TEXT,
  domain TEXT,
  title TEXT,
  summary TEXT,
  tags TEXT[] DEFAULT '{}',
  content_type TEXT DEFAULT 'other' CHECK (content_type IN ('article', 'video', 'repo', 'docs', 'tool', 'thread', 'other')),
  key_points TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  save_count INTEGER NOT NULL DEFAULT 1,
  confidence_score NUMERIC(3,2),
  fts tsvector,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create saves table
CREATE TABLE public.saves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  link_id UUID NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_message_id BIGINT,
  telegram_chat_id BIGINT,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_message_text TEXT,
  user_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX idx_links_user_url ON public.links(user_id, original_url);
CREATE INDEX idx_links_fts ON public.links USING GIN(fts);
CREATE INDEX idx_links_status ON public.links(status);
CREATE INDEX idx_links_user_id ON public.links(user_id);
CREATE INDEX idx_links_created_at ON public.links(created_at DESC);
CREATE INDEX idx_saves_link_id ON public.saves(link_id);

-- FTS trigger
CREATE OR REPLACE FUNCTION public.update_links_fts()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fts :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_links_fts_trigger
  BEFORE INSERT OR UPDATE ON public.links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_links_fts();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_links_updated_at
  BEFORE UPDATE ON public.links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saves ENABLE ROW LEVEL SECURITY;

-- RLS policies for links
CREATE POLICY "Users can view their own links" ON public.links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own links" ON public.links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own links" ON public.links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own links" ON public.links FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for saves
CREATE POLICY "Users can view their own saves" ON public.saves FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own saves" ON public.saves FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own saves" ON public.saves FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own saves" ON public.saves FOR DELETE USING (auth.uid() = user_id);
