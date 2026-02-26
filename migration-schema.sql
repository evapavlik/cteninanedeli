-- ============================================================
-- Čtení na neděli — schema migration (čistý stav)
-- Spustit v Supabase SQL Editor jako první krok.
-- Předtím zapnout extensions pg_cron a pg_net v dashboardu!
-- ============================================================

-- ============================================================
-- 1. Tabulka theological_profiles
-- ============================================================
CREATE TABLE public.theological_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.theological_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Theological profiles are publicly readable"
  ON public.theological_profiles FOR SELECT
  USING (true);

-- Trigger funkce pro updated_at (sdílená více tabulkami)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_theological_profiles_updated_at
  BEFORE UPDATE ON public.theological_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. Tabulka readings_cache (se sloupcem sunday_date)
-- ============================================================
CREATE TABLE public.readings_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sunday_title TEXT NOT NULL,
  url TEXT,
  markdown_content TEXT NOT NULL,
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sunday_date DATE,
  UNIQUE(sunday_title)
);

ALTER TABLE public.readings_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Readings cache is publicly readable"
  ON public.readings_cache FOR SELECT
  USING (true);

-- ============================================================
-- 3. Tabulka ai_cache (s módem 'postily')
-- ============================================================
CREATE TABLE public.ai_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text_hash TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('annotate', 'context', 'postily')),
  profile_slug TEXT NOT NULL REFERENCES public.theological_profiles(slug),
  result JSONB NOT NULL,
  model_used TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(text_hash, mode, profile_slug)
);

ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AI cache is publicly readable"
  ON public.ai_cache FOR SELECT
  USING (true);

-- ============================================================
-- 4. Tabulka corpus_documents
-- ============================================================
CREATE TABLE public.corpus_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_slug text NOT NULL REFERENCES public.theological_profiles(slug),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'věrouka' CHECK (category IN ('věrouka', 'liturgika', 'homiletika', 'pastorace', 'dějiny')),
  content text NOT NULL,
  summary text,
  sort_order integer NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.corpus_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Corpus documents are publicly readable"
  ON public.corpus_documents
  FOR SELECT
  USING (true);

CREATE INDEX idx_corpus_documents_profile_active
  ON public.corpus_documents(profile_slug, is_active, sort_order);

CREATE TRIGGER update_corpus_documents_updated_at
  BEFORE UPDATE ON public.corpus_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. Tabulka postily (finální verze s updated_at)
-- ============================================================
CREATE TABLE public.postily (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  postil_number integer NOT NULL,
  title text NOT NULL,
  biblical_references text[] NOT NULL DEFAULT '{}',
  biblical_refs_raw text,
  liturgical_context text,
  year integer NOT NULL,
  issue_number integer NOT NULL,
  source_ref text NOT NULL,
  biblical_text text,
  content text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_postily_biblical_refs ON public.postily USING GIN (biblical_references);
CREATE INDEX idx_postily_active ON public.postily (is_active);

ALTER TABLE public.postily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Postily are publicly readable"
  ON public.postily
  FOR SELECT
  USING (true);

CREATE TRIGGER update_postily_updated_at
  BEFORE UPDATE ON public.postily
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 6. Storage bucket seed-files
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('seed-files', 'seed-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Service role can read seed files"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'seed-files');

CREATE POLICY "Service role can insert seed files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'seed-files');

-- ============================================================
-- 7. Tabulka analytics_events
-- ============================================================
CREATE TABLE public.analytics_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  session_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Analytics events are publicly insertable"
  ON public.analytics_events
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Analytics events are publicly readable"
  ON public.analytics_events
  FOR SELECT
  USING (true);

CREATE INDEX idx_analytics_events_name ON public.analytics_events(event_name);
CREATE INDEX idx_analytics_events_created ON public.analytics_events(created_at DESC);

-- ============================================================
-- Hotovo! Pokračuj spuštěním migration-seed.sql
-- ============================================================
