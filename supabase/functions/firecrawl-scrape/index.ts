import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Simple in-memory rate limiter (per isolate)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10; // max requests per window
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting
  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp)) {
    return new Response(
      JSON.stringify({ success: false, error: 'Příliš mnoho požadavků, zkuste to později.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and restrict to allowed domains only
    let formattedUrl = url.trim();
    if (formattedUrl.length > 500) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL too long' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const ALLOWED_DOMAINS = ['ccsh.cz', 'www.ccsh.cz'];
    try {
      const urlObj = new URL(formattedUrl);
      if (!ALLOWED_DOMAINS.includes(urlObj.hostname)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Domain not allowed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client for cache operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check readings_cache first (by URL)
    const { data: cached } = await supabase
      .from("readings_cache")
      .select("markdown_content, sunday_title, scraped_at")
      .eq("url", formattedUrl)
      .order("scraped_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      // Return cached version if less than 6 hours old
      const age = Date.now() - new Date(cached.scraped_at).getTime();
      const SIX_HOURS = 6 * 60 * 60 * 1000;
      if (age < SIX_HOURS) {
        console.log("Returning cached reading (age:", Math.round(age / 60000), "min)");
        return new Response(
          JSON.stringify({ success: true, data: { markdown: cached.markdown_content }, fromCache: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Not cached or stale — fetch from Firecrawl
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      // If we have stale cache, return it rather than failing
      if (cached) {
        console.log("Firecrawl key missing, returning stale cache");
        return new Response(
          JSON.stringify({ success: true, data: { markdown: cached.markdown_content }, fromCache: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scraping URL:', formattedUrl);

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      // Return stale cache if available
      if (cached) {
        console.log("Firecrawl failed, returning stale cache");
        return new Response(
          JSON.stringify({ success: true, data: { markdown: cached.markdown_content }, fromCache: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: 'Nepodařilo se načíst data' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const markdown = data?.data?.markdown || data?.markdown;

    // Save to readings_cache
    if (markdown) {
      // Extract sunday title from markdown
      const sundayMatch = markdown.match(/neděle\s+\d+\.\s*\w+/i) || markdown.match(/neděle[^\n]*/i);
      const sundayTitle = sundayMatch ? sundayMatch[0].trim() : formattedUrl;

      await supabase
        .from("readings_cache")
        .upsert(
          { sunday_title: sundayTitle, url: formattedUrl, markdown_content: markdown, scraped_at: new Date().toISOString() },
          { onConflict: "sunday_title" }
        );
      console.log("Saved to readings_cache:", sundayTitle);
    }

    console.log('Scrape successful');
    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Došlo k chybě při zpracování požadavku' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
