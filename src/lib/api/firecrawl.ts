import { supabase } from '@/integrations/supabase/client';

export interface LiturgicalExtras {
  tuzby: string | null;
  modlitbaPredCtenim: string | null;
  versKObetovani: string | null;
  versKPozehnani: string | null;
  modlitbaKPozehnani: string | null;
  vhodnePisne: string | null;
}

function extractReadings(markdown: string): { sundayTitle: string; readings: string; liturgicalExtras: LiturgicalExtras } {
  const sundayMatch = markdown.match(/neděle\s+\d+\.\s*\w+/i) || markdown.match(/neděle[^\n]*/i);
  const sundayDate = sundayMatch ? sundayMatch[0].trim() : '';

  const sections: string[] = [];

  function extractSection(keyword: string): string | null {
    const regex = new RegExp(`####\\s*([^\\n]*${keyword}[^\\n]*)\\n+([\\s\\S]*?)(?=\\n####|\\n##\\s|$)`, 'i');
    const match = markdown.match(regex);
    if (match) {
      return `## ${match[1].trim()}\n\n${match[2].trim()}`;
    }
    return null;
  }

  function extractSectionBody(keyword: string): string | null {
    const regex = new RegExp(`####\\s*[^\\n]*${keyword}[^\\n]*\\n+([\\s\\S]*?)(?=\\n####|\\n##\\s|$)`, 'i');
    const match = markdown.match(regex);
    return match ? match[1].trim() : null;
  }

  const first = extractSection('První čtení');
  if (first) sections.push(first);

  const second = extractSection('Druhé čtení');
  if (second) sections.push(second);

  const gospel = extractSection('Evangelium');
  if (gospel) sections.push(gospel);

  const liturgicalExtras: LiturgicalExtras = {
    tuzby: extractSectionBody('Tužby'),
    modlitbaPredCtenim: extractSectionBody('Modlitba před čtením'),
    versKObetovani: extractSectionBody('Verše k obětování|Verš k obětování'),
    versKPozehnani: extractSectionBody('Verš k požehnání|Verše k požehnání'),
    modlitbaKPozehnani: extractSectionBody('Modlitba k požehnání'),
    vhodnePisne: extractSectionBody('Vhodné písně'),
  };

  return {
    sundayTitle: sundayDate,
    readings: sections.join('\n\n---\n\n'),
    liturgicalExtras,
  };
}

const CACHE_KEY = 'ccsh-cyklus-cache';

interface CacheEntry {
  markdown: string;
  sundayTitle: string;
  liturgicalExtras?: LiturgicalExtras;
  timestamp: number;
}

function saveToCache(markdown: string, sundayTitle: string, liturgicalExtras: LiturgicalExtras) {
  try {
    const entry: CacheEntry = { markdown, sundayTitle, liturgicalExtras, timestamp: Date.now() };
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

export function getCachedCyklus(): { markdown: string; sundayTitle: string; liturgicalExtras?: LiturgicalExtras } | null {
  const cached = loadFromCache();
  if (!cached) return null;
  return { markdown: cached.markdown, sundayTitle: cached.sundayTitle, liturgicalExtras: cached.liturgicalExtras };
}

export async function fetchCyklus(): Promise<{ success: boolean; markdown?: string; sundayTitle?: string; liturgicalExtras?: LiturgicalExtras; error?: string }> {
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

  const { sundayTitle, readings, liturgicalExtras } = extractReadings(rawMarkdown);

  const md = readings || rawMarkdown;
  saveToCache(md, sundayTitle, liturgicalExtras);

  return { 
    success: true, 
    markdown: md,
    sundayTitle,
    liturgicalExtras,
  };
}
