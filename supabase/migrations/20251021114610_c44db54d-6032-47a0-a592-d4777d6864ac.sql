-- Phase 2: Add velocity tracking and declined reasons

-- Add new fields to ticket_suggestions table
ALTER TABLE ticket_suggestions 
ADD COLUMN declined_reason TEXT,
ADD COLUMN velocity_score NUMERIC DEFAULT 0,
ADD COLUMN is_trending BOOLEAN DEFAULT false;

-- Create table to track engagement over time for velocity calculation
CREATE TABLE IF NOT EXISTS feedback_engagement_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID REFERENCES feedback_sources(id) ON DELETE CASCADE,
  engagement NUMERIC NOT NULL,
  followers INTEGER NOT NULL,
  snapshot_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient velocity queries
CREATE INDEX idx_feedback_engagement_snapshots_feedback_id 
ON feedback_engagement_snapshots(feedback_id);

CREATE INDEX idx_feedback_engagement_snapshots_snapshot_at 
ON feedback_engagement_snapshots(snapshot_at DESC);

-- Enable RLS
ALTER TABLE feedback_engagement_snapshots ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view engagement snapshots
CREATE POLICY "Users can view engagement snapshots"
ON feedback_engagement_snapshots FOR SELECT
TO authenticated
USING (true);

-- Policy: Service role can insert snapshots
CREATE POLICY "Service role can insert snapshots"
ON feedback_engagement_snapshots FOR INSERT
TO service_role
WITH CHECK (true);