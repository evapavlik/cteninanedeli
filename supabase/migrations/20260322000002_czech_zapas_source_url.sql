-- Add source_url column to czech_zapas_articles for web scraping deduplication.
-- Existing rows (imported from PDF) will have NULL source_url.

ALTER TABLE public.czech_zapas_articles
  ADD COLUMN IF NOT EXISTS source_url TEXT UNIQUE;
