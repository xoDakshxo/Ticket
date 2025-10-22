-- Add source_config_id to feedback_sources to link to integration_configs
ALTER TABLE feedback_sources 
ADD COLUMN source_config_id uuid REFERENCES integration_configs(id) ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX idx_feedback_sources_config_id ON feedback_sources(source_config_id);

-- Update existing reddit feedback to link to integration configs where possible
-- Note: This only works if the content or other fields can help identify the source
-- For new syncs, the source_config_id will be set automatically