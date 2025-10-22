-- Update aggregate_user_profiles function to filter out low-value users
CREATE OR REPLACE FUNCTION public.aggregate_user_profiles()
RETURNS TABLE(
  author text,
  source text,
  feedback_count bigint,
  total_engagement numeric,
  avg_engagement numeric,
  max_followers integer,
  first_seen timestamp with time zone,
  last_seen timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
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
  HAVING 
    COUNT(*) >= 2 
    OR SUM(COALESCE(engagement, 0)) >= 10 
    OR MAX(COALESCE(followers, 0)) >= 50
  ORDER BY author;
$$;