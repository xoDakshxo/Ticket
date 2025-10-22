-- Add channel field to integration_configs to specify what product/topic the source is about
ALTER TABLE integration_configs 
ADD COLUMN channel TEXT;

-- Add channel to feedback_sources for easier querying
ALTER TABLE feedback_sources 
ADD COLUMN channel TEXT;

-- Add index for filtering by channel
CREATE INDEX idx_feedback_sources_channel ON feedback_sources(channel);

-- Add index for integration configs by channel
CREATE INDEX idx_integration_configs_channel ON integration_configs(channel);