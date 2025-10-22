-- Fix search_path security warnings for the cleanup functions

DROP FUNCTION IF EXISTS cleanup_ticket_suggestions_on_feedback_delete() CASCADE;
CREATE OR REPLACE FUNCTION cleanup_ticket_suggestions_on_feedback_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete ticket suggestions that reference the deleted feedback
  DELETE FROM ticket_suggestions
  WHERE source_refs @> jsonb_build_array(OLD.id::text);
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS cascade_delete_feedback_on_source_delete() CASCADE;
CREATE OR REPLACE FUNCTION cascade_delete_feedback_on_source_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete all feedback associated with this source
  DELETE FROM feedback_sources
  WHERE source_config_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate the triggers since we dropped the functions
DROP TRIGGER IF EXISTS cleanup_tickets_on_feedback_delete ON feedback_sources;
CREATE TRIGGER cleanup_tickets_on_feedback_delete
  BEFORE DELETE ON feedback_sources
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_ticket_suggestions_on_feedback_delete();

DROP TRIGGER IF EXISTS cascade_delete_feedback_trigger ON integration_configs;
CREATE TRIGGER cascade_delete_feedback_trigger
  BEFORE DELETE ON integration_configs
  FOR EACH ROW
  EXECUTE FUNCTION cascade_delete_feedback_on_source_delete();