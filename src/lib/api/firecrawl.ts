import { supabase } from '@/integrations/supabase/client';

function extractReadings(markdown: string): { sundayTitle: string; readings: string } {
  // Extract sunday name/date
  const sundayMatch = markdown.match(/neděle \d+\.\s*\w+/i);
  const sundayDate = sundayMatch ? sundayMatch[0] : '';

  // Split by h4 headers (#### )
  const sections: string[] = [];

  // First reading - capture header with reference + following paragraph(s) until next ####
  const firstMatch = markdown.match(/####\s*(První čtení z Písma[^\n]*)\n\n([\s\S]*?)(?=\n####)/);
  if (firstMatch) {
    sections.push(`## ${firstMatch[1]}\n\n${firstMatch[2].trim()}`);
  }

  // Second reading (epištola)
  const secondMatch = markdown.match(/####\s*(Druhé čtení z Písma[^\n]*)\n\n([\s\S]*?)(?=\n####)/);
  if (secondMatch) {
    sections.push(`## ${secondMatch[1]}\n\n${secondMatch[2].trim()}`);
  }

  // Evangelium
  const evangeliumMatch = markdown.match(/####\s*(Evangelium[^\n]*)\n\n([\s\S]*?)(?=\n####)/);
  if (evangeliumMatch) {
    sections.push(`## ${evangeliumMatch[1]}\n\n${evangeliumMatch[2].trim()}`);
  }

  // Fallback: if no sections matched, try a looser approach
  if (sections.length === 0) {
    // Try matching any #### header containing these keywords
    const patterns = [
      { label: 'První čtení', regex: /####[^\n]*(První čtení[^\n]*)\n+([\s\S]*?)(?=####|$)/i },
      { label: 'Druhé čtení', regex: /####[^\n]*(Druhé čtení[^\n]*)\n+([\s\S]*?)(?=####|$)/i },
      { label: 'Evangelium', regex: /####[^\n]*(Evangelium[^\n]*)\n+([\s\S]*?)(?=####|$)/i },
    ];
    for (const p of patterns) {
      const m = markdown.match(p.regex);
      if (m) {
        sections.push(`## ${m[1].trim()}\n\n${m[2].trim()}`);
      }
    }
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
