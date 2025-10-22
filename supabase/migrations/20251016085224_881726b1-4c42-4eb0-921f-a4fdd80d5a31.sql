-- Create table for Loop's AI-generated messages
CREATE TABLE public.loop_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message TEXT NOT NULL,
  context_type TEXT NOT NULL CHECK (context_type IN ('page', 'ticket', 'cluster', 'digest', 'tip')),
  related_id UUID,
  tone TEXT CHECK (tone IN ('neutral', 'friendly', 'celebratory')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.loop_messages ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read Loop messages
CREATE POLICY "Users can view Loop messages"
ON public.loop_messages
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow service role to insert Loop messages (for edge function)
CREATE POLICY "Service role can insert Loop messages"
ON public.loop_messages
FOR INSERT
WITH CHECK (true);

-- Create index for faster lookups by context
CREATE INDEX idx_loop_messages_context ON public.loop_messages(context_type, related_id);
CREATE INDEX idx_loop_messages_created ON public.loop_messages(created_at DESC);