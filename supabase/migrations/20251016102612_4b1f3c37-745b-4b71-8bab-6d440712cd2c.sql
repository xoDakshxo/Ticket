-- Create ticket_feedback_links junction table
CREATE TABLE public.ticket_feedback_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  feedback_id uuid NOT NULL REFERENCES public.feedback_sources(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(ticket_id, feedback_id)
);

-- Enable RLS
ALTER TABLE public.ticket_feedback_links ENABLE ROW LEVEL SECURITY;

-- Users can view feedback links
CREATE POLICY "Users can view ticket feedback links"
ON public.ticket_feedback_links
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Users can create feedback links
CREATE POLICY "Users can create ticket feedback links"
ON public.ticket_feedback_links
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Users can delete feedback links
CREATE POLICY "Users can delete ticket feedback links"
ON public.ticket_feedback_links
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Create index for faster lookups
CREATE INDEX idx_ticket_feedback_links_ticket_id ON public.ticket_feedback_links(ticket_id);
CREATE INDEX idx_ticket_feedback_links_feedback_id ON public.ticket_feedback_links(feedback_id);