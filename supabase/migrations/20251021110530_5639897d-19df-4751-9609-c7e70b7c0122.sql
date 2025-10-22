-- Allow authenticated users to delete tickets so UI deletions persist
CREATE POLICY "Users can delete tickets"
ON public.tickets
FOR DELETE
USING (auth.uid() IS NOT NULL);