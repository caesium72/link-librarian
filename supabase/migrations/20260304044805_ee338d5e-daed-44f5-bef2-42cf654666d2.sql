
-- Add reading progress columns to links
ALTER TABLE public.links 
  ADD COLUMN IF NOT EXISTS reading_time_estimate integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reading_started_at timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reading_completed_at timestamp with time zone DEFAULT NULL;

-- Create reading_streaks table for tracking daily reading activity
CREATE TABLE public.reading_streaks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  date date NOT NULL,
  links_read integer NOT NULL DEFAULT 0,
  reading_minutes integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.reading_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own streaks" ON public.reading_streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own streaks" ON public.reading_streaks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own streaks" ON public.reading_streaks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own streaks" ON public.reading_streaks FOR DELETE USING (auth.uid() = user_id);
