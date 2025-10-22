-- Create user_profiles table for superuser intelligence
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  
  -- Engagement Metrics
  total_feedback_count INTEGER DEFAULT 0,
  total_engagement NUMERIC DEFAULT 0,
  avg_engagement NUMERIC DEFAULT 0,
  follower_count INTEGER DEFAULT 0,
  
  -- Calculated Scores
  superuser_score NUMERIC DEFAULT 0,
  feedback_quality_score NUMERIC DEFAULT 0,
  feedback_frequency_score NUMERIC DEFAULT 0,
  
  -- Archetype Classification
  archetype TEXT,
  archetype_confidence NUMERIC DEFAULT 0,
  
  -- Metadata
  first_seen_at TIMESTAMP WITH TIME ZONE,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  profile_url TEXT,
  
  -- Engagement tracking
  linked_suggestions INTEGER DEFAULT 0,
  approved_suggestions INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_user_profiles_author ON public.user_profiles(author);
CREATE INDEX idx_user_profiles_superuser_score ON public.user_profiles(superuser_score DESC);
CREATE INDEX idx_user_profiles_archetype ON public.user_profiles(archetype);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone authenticated can view
CREATE POLICY "Users can view user profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Create outreach_log table
CREATE TABLE public.outreach_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  outreach_type TEXT NOT NULL,
  message_preview TEXT,
  status TEXT DEFAULT 'pending',
  sent_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.outreach_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and create outreach logs"
  ON public.outreach_log
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to auto-update user profiles from feedback
CREATE OR REPLACE FUNCTION public.update_user_profile_from_feedback()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_exists BOOLEAN;
  feedback_stats RECORD;
BEGIN
  SELECT EXISTS(SELECT 1 FROM user_profiles WHERE author = NEW.author) INTO profile_exists;
  
  SELECT 
    COUNT(*) as feedback_count,
    SUM(COALESCE(engagement, 0)) as total_eng,
    AVG(COALESCE(engagement, 0)) as avg_eng,
    MAX(COALESCE(followers, 0)) as max_followers,
    MIN(created_at) as first_seen,
    MAX(created_at) as last_seen
  INTO feedback_stats
  FROM feedback_sources
  WHERE author = NEW.author;
  
  IF profile_exists THEN
    UPDATE user_profiles SET
      total_feedback_count = feedback_stats.feedback_count,
      total_engagement = feedback_stats.total_eng,
      avg_engagement = feedback_stats.avg_eng,
      follower_count = feedback_stats.max_followers,
      last_seen_at = feedback_stats.last_seen,
      updated_at = NOW()
    WHERE author = NEW.author;
  ELSE
    INSERT INTO user_profiles (
      author, 
      source, 
      total_feedback_count, 
      total_engagement, 
      avg_engagement, 
      follower_count,
      first_seen_at,
      last_seen_at,
      profile_url
    ) VALUES (
      NEW.author,
      NEW.source,
      feedback_stats.feedback_count,
      feedback_stats.total_eng,
      feedback_stats.avg_eng,
      feedback_stats.max_followers,
      feedback_stats.first_seen,
      feedback_stats.last_seen,
      CASE 
        WHEN NEW.source = 'reddit' THEN 'https://reddit.com/u/' || NEW.author
        WHEN NEW.source = 'discord' THEN NULL
        ELSE NULL
      END
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger on feedback_sources
CREATE TRIGGER update_user_profile_on_feedback
  AFTER INSERT ON public.feedback_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profile_from_feedback();

-- Enable realtime for user_profiles
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;