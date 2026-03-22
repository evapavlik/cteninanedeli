-- Kázání z ccsh.cz/kazani.html (autor typicky Tomáš Butta)
-- Třetí zdroj inspirace pro kazatele vedle Farského postil a Českého zápasu.
-- Stejná architektura — matching přes GIN index na biblical_references.

CREATE TABLE IF NOT EXISTS public.ccsh_kazani (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sermon_number INTEGER NOT NULL UNIQUE,              -- pořadové číslo (auto-increment při importu)
  title TEXT NOT NULL,                                -- název kázání (obsahuje i biblický odkaz)
  author TEXT,                                        -- autor (typicky Tomáš Butta)
  biblical_references TEXT[] NOT NULL DEFAULT '{}',   -- normalizované ref, např. {"J 9,1-11"}
  biblical_refs_raw TEXT,                             -- původní zápis z titulku
  liturgical_context TEXT,                            -- název neděle, např. "4. postní neděle"
  year INTEGER NOT NULL,                              -- rok zveřejnění
  sermon_date DATE,                                   -- datum kázání
  source_url TEXT NOT NULL UNIQUE,                    -- URL na ccsh.cz (deduplikace)
  source_ref TEXT NOT NULL,                           -- citace pro zobrazení, např. "ccsh.cz, 18. březen 2026"
  content TEXT NOT NULL,                              -- plný text kázání
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- GIN index pro dotazy s překryvem polí biblických odkazů
CREATE INDEX IF NOT EXISTS idx_ccsh_kazani_biblical_refs
  ON public.ccsh_kazani USING GIN (biblical_references);

CREATE INDEX IF NOT EXISTS idx_ccsh_kazani_active
  ON public.ccsh_kazani (is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_ccsh_kazani_liturgical
  ON public.ccsh_kazani (liturgical_context) WHERE liturgical_context IS NOT NULL;

ALTER TABLE public.ccsh_kazani ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'ccsh_kazani'
      AND policyname = 'CCSH kazani are publicly readable'
  ) THEN
    CREATE POLICY "CCSH kazani are publicly readable"
      ON public.ccsh_kazani FOR SELECT
      USING (true);
  END IF;
END $$;

-- Rozšíření constraint na ai_cache.mode o nový mode 'ccsh_kazani'
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'ai_cache'
  ) THEN
    ALTER TABLE public.ai_cache DROP CONSTRAINT IF EXISTS ai_cache_mode_check;
    ALTER TABLE public.ai_cache ADD CONSTRAINT ai_cache_mode_check
      CHECK (mode IN ('annotate', 'context', 'postily', 'czech_zapas', 'ccsh_kazani'));
  END IF;
END $$;
