-- Create ticket_suggestions table for persistent AI suggestions
CREATE TABLE public.ticket_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  impact_score NUMERIC NOT NULL DEFAULT 0,
  theme TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  source_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ticket_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own suggestions"
  ON public.ticket_suggestions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create suggestions"
  ON public.ticket_suggestions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own suggestions"
  ON public.ticket_suggestions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own suggestions"
  ON public.ticket_suggestions FOR DELETE
  USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_ticket_suggestions_user_status 
  ON public.ticket_suggestions(user_id, status);

-- Add trigger for updated_at
CREATE TRIGGER update_ticket_suggestions_updated_at
  BEFORE UPDATE ON public.ticket_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create loop_messages table if it doesn't exist (for storing Loop's messages)
CREATE TABLE IF NOT EXISTS public.loop_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  context_type TEXT NOT NULL,
  related_id UUID,
  tone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.loop_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view loop messages"
  ON public.loop_messages FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert loop messages"
  ON public.loop_messages FOR INSERT
  WITH CHECK (true);