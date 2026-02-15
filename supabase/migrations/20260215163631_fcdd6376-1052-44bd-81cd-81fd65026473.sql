
-- Create corpus_documents table
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

-- Enable RLS
ALTER TABLE public.corpus_documents ENABLE ROW LEVEL SECURITY;

-- Public read policy
CREATE POLICY "Corpus documents are publicly readable"
ON public.corpus_documents
FOR SELECT
USING (true);

-- Index for filtering
CREATE INDEX idx_corpus_documents_profile_active ON public.corpus_documents(profile_slug, is_active, sort_order);

-- Updated_at trigger
CREATE TRIGGER update_corpus_documents_updated_at
BEFORE UPDATE ON public.corpus_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing data
INSERT INTO public.corpus_documents (profile_slug, title, category, content, sort_order)
SELECT slug, name, 'věrouka', content, 1
FROM public.theological_profiles;
