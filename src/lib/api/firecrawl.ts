import { supabase } from '@/integrations/supabase/client';

function extractReadings(markdown: string): { sundayTitle: string; readings: string } {
  // Extract sunday name/date - try multiple patterns
  const sundayMatch = markdown.match(/neděle\s+\d+\.\s*\w+/i) || markdown.match(/neděle[^\n]*/i);
  const sundayDate = sundayMatch ? sundayMatch[0].trim() : '';

  const sections: string[] = [];

  // Generic function to extract a section by keyword
  function extractSection(keyword: string): string | null {
    // Match #### header containing the keyword, then capture everything until next #### or end
    const regex = new RegExp(`####\\s*([^\\n]*${keyword}[^\\n]*)\\n+([\\s\\S]*?)(?=\\n####|\\n##\\s|$)`, 'i');
    const match = markdown.match(regex);
    if (match) {
      return `## ${match[1].trim()}\n\n${match[2].trim()}`;
    }
    return null;
  }

  const first = extractSection('První čtení');
  if (first) sections.push(first);

  const second = extractSection('Druhé čtení');
  if (second) sections.push(second);

  const gospel = extractSection('Evangelium');
  if (gospel) sections.push(gospel);

  return {
    sundayTitle: sundayDate,
    readings: sections.join('\n\n---\n\n'),
  };
}

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

export async function fetchCyklus(): Promise<{ success: boolean; markdown?: string; sundayTitle?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
    body: { url: 'https://www.ccsh.cz/cyklus.html' },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const rawMarkdown = data?.data?.markdown || data?.markdown;
  if (!rawMarkdown) {
    return { success: false, error: 'No content received' };
  }

  console.log('Raw markdown preview:', rawMarkdown.substring(0, 500));

  const { sundayTitle, readings } = extractReadings(rawMarkdown);

  const md = readings || rawMarkdown;
  saveToCache(md, sundayTitle);

  return { 
    success: true, 
    markdown: md,
    sundayTitle,
  };
}
