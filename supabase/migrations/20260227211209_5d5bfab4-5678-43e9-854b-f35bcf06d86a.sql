
-- Add health monitoring columns to links table
ALTER TABLE public.links 
ADD COLUMN IF NOT EXISTS health_status text DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS last_health_check timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS health_status_code integer DEFAULT NULL;
