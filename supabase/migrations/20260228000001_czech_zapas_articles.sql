-- Moderní články z Českého zápasu (CČSH, se svolením redakce)
-- Druhý zdroj inspirace pro kazatele vedle Farského postil (1921–1924).
-- Stejná architektura jako tabulka `postily` — matching přes GIN index na biblical_references.

CREATE TABLE public.czech_zapas_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_number INTEGER NOT NULL UNIQUE,         -- pořadové číslo (vlastní, ne číslo v CZ)
  title TEXT NOT NULL,                            -- název článku
  author TEXT,                                    -- autor (moderní kazatel CČSH)
  biblical_references TEXT[] NOT NULL DEFAULT '{}', -- normalizované biblické ref, např. {"Mt 4,1-11"}
  biblical_refs_raw TEXT,                         -- původní zápis odkazu v textu
  liturgical_context TEXT,                        -- název neděle, např. "2. neděle postní"
  content_type TEXT NOT NULL DEFAULT 'kazani',    -- 'kazani' | 'clanek' | 'komentar'
  year INTEGER NOT NULL,                          -- rok vydání
  issue_number INTEGER NOT NULL,                  -- číslo Českého zápasu
  source_ref TEXT NOT NULL,                       -- citace, např. "Český zápas, ročník 2024, číslo 12"
  content TEXT NOT NULL,                          -- plný text článku
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- GIN index pro dotazy s překryvem polí biblických odkazů (stejný přístup jako u postily)
CREATE INDEX idx_czapas_biblical_refs
  ON public.czech_zapas_articles USING GIN (biblical_references);

CREATE INDEX idx_czapas_active
  ON public.czech_zapas_articles (is_active) WHERE is_active = true;

CREATE INDEX idx_czapas_liturgical
  ON public.czech_zapas_articles (liturgical_context) WHERE liturgical_context IS NOT NULL;

ALTER TABLE public.czech_zapas_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Czech zapas articles are publicly readable"
  ON public.czech_zapas_articles FOR SELECT
  USING (true);

-- Rozšíření constraint na ai_cache.mode o nový mode 'czech_zapas'
ALTER TABLE public.ai_cache DROP CONSTRAINT IF EXISTS ai_cache_mode_check;
ALTER TABLE public.ai_cache ADD CONSTRAINT ai_cache_mode_check
  CHECK (mode IN ('annotate', 'context', 'postily', 'czech_zapas'));
