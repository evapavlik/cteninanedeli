import { supabase } from '@/integrations/supabase/client';

function extractReadings(markdown: string): { sundayTitle: string; readings: string } {
  // Extract sunday name from metadata or content
  const sundayMatch = markdown.match(/neděle \d+\. \w+/i);
  const sundayDate = sundayMatch ? sundayMatch[0] : '';

  // Extract sections between markers
  const sections: string[] = [];
  
  // First reading
  const firstReadingMatch = markdown.match(/####\s*První čtení z Písma[^\n]*\n\n([\s\S]*?)(?=\n####)/);
  if (firstReadingMatch) {
    sections.push(`## První čtení z Písma\n\n${firstReadingMatch[1].trim()}`);
  }

  // Second reading (epistle)
  const secondReadingMatch = markdown.match(/####\s*Druhé čtení z Písma[^\n]*\n\n([\s\S]*?)(?=\n####)/);
  if (secondReadingMatch) {
    sections.push(`## Druhé čtení (epištola)\n\n${secondReadingMatch[1].trim()}`);
  }

  // Evangelium
  const evangeliumMatch = markdown.match(/####\s*Evangelium[^\n]*\n\n([\s\S]*?)(?=\n####)/);
  if (evangeliumMatch) {
    sections.push(`## Evangelium\n\n${evangeliumMatch[1].trim()}`);
  }

  return {
    sundayTitle: sundayDate,
    readings: sections.join('\n\n---\n\n'),
  };
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

  const { sundayTitle, readings } = extractReadings(rawMarkdown);
  
  // Also try to get the liturgical name from metadata
  const metadataName = data?.data?.metadata?.name || data?.metadata?.name || '';

  return { 
    success: true, 
    markdown: readings,
    sundayTitle: metadataName || sundayTitle,
  };
}
