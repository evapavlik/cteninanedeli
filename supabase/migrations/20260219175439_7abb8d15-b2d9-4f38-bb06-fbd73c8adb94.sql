
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

-- GIN index for array overlap queries
CREATE INDEX idx_postily_biblical_refs ON public.postily USING GIN (biblical_references);

-- Index for active filtering
CREATE INDEX idx_postily_active ON public.postily (is_active);

-- Enable RLS
ALTER TABLE public.postily ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Postily are publicly readable"
  ON public.postily
  FOR SELECT
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_postily_updated_at
  BEFORE UPDATE ON public.postily
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
