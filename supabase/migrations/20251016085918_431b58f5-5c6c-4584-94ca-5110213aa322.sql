-- Create core tables if they don't exist

-- Clusters
CREATE TABLE IF NOT EXISTS public.clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme TEXT NOT NULL,
  area TEXT,
  sentiment NUMERIC,
  mentions_count INTEGER DEFAULT 0,
  delta_48h NUMERIC DEFAULT 0,
  status TEXT,
  impact_score NUMERIC DEFAULT 0,
  sources JSONB,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clusters ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clusters' AND policyname = 'Anyone can view clusters'
  ) THEN
    CREATE POLICY "Anyone can view clusters"
      ON public.clusters FOR SELECT
      USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clusters_impact_score ON public.clusters(impact_score DESC);
CREATE INDEX IF NOT EXISTS idx_clusters_created_at ON public.clusters(created_at DESC);

-- Tickets
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  cluster_id UUID REFERENCES public.clusters(id) ON DELETE SET NULL,
  state TEXT NOT NULL DEFAULT 'draft',
  priority TEXT NOT NULL DEFAULT 'medium',
  owner TEXT,
  created_by UUID,
  impact_score NUMERIC DEFAULT 0,
  export_status TEXT,
  export_provider TEXT,
  export_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tickets' AND policyname = 'Users can view tickets'
  ) THEN
    CREATE POLICY "Users can view tickets"
      ON public.tickets FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tickets' AND policyname = 'Users can create tickets'
  ) THEN
    CREATE POLICY "Users can create tickets"
      ON public.tickets FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tickets' AND policyname = 'Users can update tickets'
  ) THEN
    CREATE POLICY "Users can update tickets"
      ON public.tickets FOR UPDATE
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_state ON public.tickets(state);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON public.tickets(priority);

-- Events
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID,
  cluster_id UUID REFERENCES public.clusters(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'Users can view events'
  ) THEN
    CREATE POLICY "Users can view events"
      ON public.events FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'Users can create events'
  ) THEN
    CREATE POLICY "Users can create events"
      ON public.events FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON public.events("timestamp" DESC);

-- Feedback sources
CREATE TABLE IF NOT EXISTS public.feedback_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT CHECK (source IN ('discord','reddit','x','slack')),
  external_id TEXT,
  author TEXT,
  content TEXT,
  engagement NUMERIC,
  followers INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_sources ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'feedback_sources' AND policyname = 'Users can view feedback sources'
  ) THEN
    CREATE POLICY "Users can view feedback sources"
      ON public.feedback_sources FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'feedback_sources' AND policyname = 'Users can insert feedback sources'
  ) THEN
    CREATE POLICY "Users can insert feedback sources"
      ON public.feedback_sources FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_feedback_sources_created_at ON public.feedback_sources(created_at DESC);

-- Timestamp trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_clusters_updated_at'
  ) THEN
    CREATE TRIGGER trg_clusters_updated_at
    BEFORE UPDATE ON public.clusters
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tickets_updated_at'
  ) THEN
    CREATE TRIGGER trg_tickets_updated_at
    BEFORE UPDATE ON public.tickets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;