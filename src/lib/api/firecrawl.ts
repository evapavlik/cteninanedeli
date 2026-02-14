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

  // Only first and second reading - NO evangelium
  const first = extractSection('První čtení');
  if (first) sections.push(first);

  const second = extractSection('Druhé čtení');
  if (second) sections.push(second);

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

  console.log('Raw markdown preview:', rawMarkdown.substring(0, 500));

  const { sundayTitle, readings } = extractReadings(rawMarkdown);

  if (!readings) {
    // Return full markdown as fallback
    return { success: true, markdown: rawMarkdown, sundayTitle };
  }

  return { 
    success: true, 
    markdown: readings,
    sundayTitle,
  };
}
