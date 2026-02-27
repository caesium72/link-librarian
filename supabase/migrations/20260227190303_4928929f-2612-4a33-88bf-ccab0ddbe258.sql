
-- Create user_sessions table to track individual login sessions
CREATE TABLE public.user_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_token TEXT NOT NULL,
  browser TEXT,
  os TEXT,
  device_type TEXT DEFAULT 'desktop',
  ip_address TEXT,
  last_active_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_current BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sessions
CREATE POLICY "Users can view their own sessions"
ON public.user_sessions FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own sessions
CREATE POLICY "Users can insert their own sessions"
ON public.user_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY "Users can update their own sessions"
ON public.user_sessions FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own sessions (for sign-out)
CREATE POLICY "Users can delete their own sessions"
ON public.user_sessions FOR DELETE
USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions (user_id);
CREATE UNIQUE INDEX idx_user_sessions_token ON public.user_sessions (session_token);
