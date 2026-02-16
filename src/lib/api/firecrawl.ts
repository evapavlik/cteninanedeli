import { supabase } from '@/integrations/supabase/client';

const CACHE_KEY = 'ccsh-cyklus-cache';

interface CacheEntry {
  markdown: string;
  sundayTitle: string;
  timestamp: number;
}

function saveToCache(markdown: string, sundayTitle: string) {
  try {
    const entry: CacheEntry = { markdown, sundayTitle, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch { /* localStorage full or unavailable */ }
}

function loadFromCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

export function getCachedCyklus(): { markdown: string; sundayTitle: string } | null {
  const cached = loadFromCache();
  if (!cached) return null;
  return { markdown: cached.markdown, sundayTitle: cached.sundayTitle };
}

/**
 * Fetch the latest readings.
 * Primary path: read from the server-side readings_cache (populated by warm-cache cron).
 * The most recent entry is always the correct next Sunday.
 */
export async function fetchCyklus(): Promise<{ success: boolean; markdown?: string; sundayTitle?: string; error?: string }> {
  // Read the latest cached reading from the database (populated by warm-cache cron)
  const { data, error } = await supabase
    .from('readings_cache')
    .select('markdown_content, sunday_title')
    .order('scraped_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { success: false, error: error.message };
  }

  if (!data) {
    return { success: false, error: 'Žádná čtení nejsou k dispozici' };
  }

  saveToCache(data.markdown_content, data.sunday_title);

  return {
    success: true,
    markdown: data.markdown_content,
    sundayTitle: data.sunday_title,
  };
}
