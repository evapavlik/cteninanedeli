-- Postily Karla Farského (1921–1924)
-- Jednotlivá kázání parsovaná z knihy Postily, slouží jako inspirace pro kazatele.

CREATE TABLE public.postily (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  postil_number INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  biblical_references TEXT[] NOT NULL DEFAULT '{}',
  biblical_refs_raw TEXT,
  liturgical_context TEXT,
  year INTEGER NOT NULL,
  issue_number INTEGER NOT NULL,
  source_ref TEXT NOT NULL,
  biblical_text TEXT,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.postily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Postily are publicly readable"
  ON public.postily FOR SELECT
  USING (true);

-- GIN index for array containment queries (biblical_references && ARRAY[...])
CREATE INDEX idx_postily_biblical_refs ON public.postily USING GIN (biblical_references);
CREATE INDEX idx_postily_active ON public.postily (is_active) WHERE is_active = true;

-- Extend ai_cache mode CHECK to allow 'postily' mode
ALTER TABLE public.ai_cache DROP CONSTRAINT IF EXISTS ai_cache_mode_check;
ALTER TABLE public.ai_cache ADD CONSTRAINT ai_cache_mode_check CHECK (mode IN ('annotate', 'context', 'postily'));
