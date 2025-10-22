-- Create aggregation function for faster user profile backfill
CREATE OR REPLACE FUNCTION public.aggregate_user_profiles()
RETURNS TABLE (
  author TEXT,
  source TEXT,
  feedback_count BIGINT,
  total_engagement NUMERIC,
  avg_engagement NUMERIC,
  max_followers INTEGER,
  first_seen TIMESTAMP WITH TIME ZONE,
  last_seen TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    author,
    source,
    COUNT(*) as feedback_count,
    SUM(COALESCE(engagement, 0)) as total_engagement,
    AVG(COALESCE(engagement, 0)) as avg_engagement,
    MAX(COALESCE(followers, 0)) as max_followers,
    MIN(created_at) as first_seen,
    MAX(created_at) as last_seen
  FROM feedback_sources
  GROUP BY author, source
  ORDER BY author;
$$;