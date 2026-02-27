
-- Create tagging_rules table
CREATE TABLE public.tagging_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  condition_type TEXT NOT NULL DEFAULT 'domain_contains',
  condition_value TEXT NOT NULL,
  tag TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tagging_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rules"
ON public.tagging_rules FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own rules"
ON public.tagging_rules FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rules"
ON public.tagging_rules FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rules"
ON public.tagging_rules FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_tagging_rules_user_id ON public.tagging_rules (user_id);

-- Trigger for updated_at
CREATE TRIGGER update_tagging_rules_updated_at
BEFORE UPDATE ON public.tagging_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
