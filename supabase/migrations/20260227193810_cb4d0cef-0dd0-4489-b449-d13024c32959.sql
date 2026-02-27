
-- Create rss_feeds table for feed subscriptions
CREATE TABLE public.rss_feeds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  feed_url TEXT NOT NULL,
  title TEXT,
  last_fetched_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, feed_url)
);

ALTER TABLE public.rss_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own feeds" ON public.rss_feeds FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own feeds" ON public.rss_feeds FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own feeds" ON public.rss_feeds FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own feeds" ON public.rss_feeds FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_rss_feeds_user_id ON public.rss_feeds (user_id);

CREATE TRIGGER update_rss_feeds_updated_at
BEFORE UPDATE ON public.rss_feeds
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
