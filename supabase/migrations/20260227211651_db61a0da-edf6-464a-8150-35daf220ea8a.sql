
-- Add digest preferences to user_settings
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS digest_frequency text DEFAULT 'weekly',
ADD COLUMN IF NOT EXISTS digest_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_digest_sent_at timestamp with time zone DEFAULT NULL;
