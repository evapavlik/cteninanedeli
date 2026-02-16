import { supabase } from '@/integrations/supabase/client';

const CACHE_KEY = 'ccsh-cyklus-cache';

interface CacheEntry {
  markdown: string;
  sundayTitle: string;
  sundayDate: string | null;
  timestamp: number;
}

function saveToCache(markdown: string, sundayTitle: string, sundayDate: string | null) {
  try {
    const entry: CacheEntry = { markdown, sundayTitle, sundayDate, timestamp: Date.now() };
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

export function getCachedCyklus(): { markdown: string; sundayTitle: string; sundayDate: string | null } | null {
  const cached = loadFromCache();
  if (!cached) return null;
  return { markdown: cached.markdown, sundayTitle: cached.sundayTitle, sundayDate: cached.sundayDate };
}

/**
 * Fetch the latest readings.
 * Primary path: read from the server-side readings_cache (populated by warm-cache cron).
 * The most recent entry is always the correct next Sunday.
 */
export async function fetchCyklus(): Promise<{ success: boolean; markdown?: string; sundayTitle?: string; sundayDate?: string | null; error?: string }> {
  const { data, error } = await supabase
    .from('readings_cache')
    .select('markdown_content, sunday_title, sunday_date')
    .order('scraped_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { success: false, error: error.message };
  }

  if (!data) {
    return { success: false, error: 'Žádná čtení nejsou k dispozici' };
  }

  const sundayDate = (data as any).sunday_date as string | null;
  saveToCache(data.markdown_content, data.sunday_title, sundayDate);

  return {
    success: true,
    markdown: data.markdown_content,
    sundayTitle: data.sunday_title,
    sundayDate,
  };
}
