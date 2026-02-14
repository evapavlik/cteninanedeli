
-- 1. Theological profiles table
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

-- 2. Readings cache table
CREATE TABLE public.readings_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sunday_title TEXT NOT NULL,
  url TEXT,
  markdown_content TEXT NOT NULL,
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sunday_title)
);

ALTER TABLE public.readings_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Readings cache is publicly readable"
  ON public.readings_cache FOR SELECT
  USING (true);

-- 3. AI cache table
CREATE TABLE public.ai_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text_hash TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('annotate', 'context')),
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

-- Timestamp trigger for theological_profiles
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
