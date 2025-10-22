-- Ensure upserts on feedback_sources work by providing a conflict target
CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_sources_external_id_unique
ON public.feedback_sources (external_id);
