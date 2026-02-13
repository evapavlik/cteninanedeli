import { supabase } from '@/integrations/supabase/client';

export async function fetchCyklus(): Promise<{ success: boolean; markdown?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
    body: { url: 'https://www.ccsh.cz/cyklus.html' },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const markdown = data?.data?.markdown || data?.markdown;
  if (!markdown) {
    return { success: false, error: 'No content received' };
  }

  return { success: true, markdown };
}
