import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildTheologicalContext, buildContextPrompt, ANNOTATE_SYSTEM_PROMPT } from "../_shared/corpus.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * warm-cache: Scrapes cyklus.ccsh.cz index to find the next Sunday's readings,
 * fetches the full reading page, and pre-generates both AI outputs (context + annotate).
 * Designed to be called via pg_cron daily at 4:00 UTC.
 */

const INDEX_URL = "https://cyklus.ccsh.cz/index.php?option=com_content&view=article&id=275&bck=1";

/**
 * Parse the index page to find the next upcoming Sunday reading URL.
 * Lines look like: Ne 22.02.2026 [08](A.23): [1. neděle postní (Invocavit)](https://cyklus.ccsh.cz/...)
 */
function findNextSundayUrl(markdown: string): { url: string; title: string; date: string } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Match lines like: Ne DD.MM.YYYY \[WW\](A.NN): [Title](URL)
  // Note: brackets may be escaped as \[ \] in markdown
  const lineRegex = /Ne\s+(\d{2})\.(\d{2})\.(\d{4})\s+\\?\[[\d]*\\?\]\([^)]*\):\s*\[([^\]]+)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  let closest: { url: string; title: string; date: Date } | null = null;

  while ((match = lineRegex.exec(markdown)) !== null) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const title = match[4];
    const url = match[5];
    const date = new Date(year, month, day);

    // Find the first Sunday that is today or in the future
    if (date >= today) {
      if (!closest || date < closest.date) {
        closest = { url, title, date };
      }
    }
  }

  if (!closest) return null;
  const d = closest.date;
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { url: closest.url, title: closest.title, date: dateStr };
}

/**
 * Extract readings from a cyklus.ccsh.cz reading page.
 * Format: #### První čtení z Písma: Reference \n text
 */
function extractReadings(markdown: string, pageTitle: string): { sundayTitle: string; readings: string } {
  const sections: string[] = [];

  function extractSection(keyword: string): string | null {
    const regex = new RegExp(
      `####\\s*([^\\n]*${keyword}[^\\n]*)\\n+([\\s\\S]*?)(?=\\n####|$)`,
      "i"
    );
    const match = markdown.match(regex);
    if (match) {
      return `## ${match[1].trim()}\n\n${match[2].trim()}`;
    }
    return null;
  }

  const first = extractSection("První čtení");
  if (first) sections.push(first);
  const second = extractSection("Druhé čtení");
  if (second) sections.push(second);
  const gospel = extractSection("Evangelium");
  if (gospel) sections.push(gospel);

  // Clean the page title: remove markdown escapes like \.
  const cleanTitle = pageTitle.replace(/\\([.#*_~`])/g, "$1").trim();

  return {
    sundayTitle: cleanTitle,
    readings: sections.join("\n\n---\n\n"),
  };
}

async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").substring(0, 32);
}

async function scrapeUrl(url: string, apiKey: string): Promise<string | null> {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data?.data?.markdown || data?.markdown || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

  const log: string[] = [];
  const addLog = (msg: string) => { console.log(msg); log.push(msg); };

  try {
    if (!FIRECRAWL_API_KEY) {
      addLog("FIRECRAWL_API_KEY not set — aborting");
      return new Response(JSON.stringify({ success: false, log }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Step 1: Scrape index page to find next Sunday ---
    addLog("Scraping cyklus.ccsh.cz index…");
    const indexMarkdown = await scrapeUrl(INDEX_URL, FIRECRAWL_API_KEY);
    if (!indexMarkdown) {
      addLog("Failed to scrape index page");
      return new Response(JSON.stringify({ success: false, log }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nextSunday = findNextSundayUrl(indexMarkdown);
    if (!nextSunday) {
      addLog("No upcoming Sunday found in index");
      return new Response(JSON.stringify({ success: false, log }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    addLog(`Next Sunday: "${nextSunday.title}" → ${nextSunday.url}`);

    // --- Step 2: Check if we already have this Sunday cached ---
    const { data: cached } = await supabase
      .from("readings_cache")
      .select("id, sunday_title, scraped_at")
      .eq("sunday_title", nextSunday.title)
      .maybeSingle();

    let readingsMarkdown: string;
    let sundayTitle: string;

    const SIX_HOURS = 6 * 60 * 60 * 1000;
    const isFresh = cached && (Date.now() - new Date(cached.scraped_at).getTime()) < SIX_HOURS;

    if (isFresh) {
      addLog("Readings cache is fresh, reusing");
      const { data: fullCached } = await supabase
        .from("readings_cache")
        .select("markdown_content, sunday_title")
        .eq("id", cached.id)
        .single();
      readingsMarkdown = fullCached!.markdown_content;
      sundayTitle = fullCached!.sunday_title;
    } else {
      // Scrape the reading page
      addLog(`Scraping reading page: ${nextSunday.url}`);
      const rawMarkdown = await scrapeUrl(nextSunday.url, FIRECRAWL_API_KEY);
      if (!rawMarkdown) {
        addLog("Failed to scrape reading page");
        return new Response(JSON.stringify({ success: false, log }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const extracted = extractReadings(rawMarkdown, nextSunday.title);

      // Validate: extracted readings must contain actual biblical text, not site navigation
      if (!extracted.readings || extracted.readings.length < 100) {
        addLog(`Extraction failed — readings too short (${extracted.readings?.length || 0} chars). Raw markdown starts with: ${rawMarkdown.substring(0, 100)}`);
        return new Response(JSON.stringify({ success: false, log, error: "Extraction produced no valid readings" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      readingsMarkdown = extracted.readings;
      sundayTitle = extracted.sundayTitle;

      // Save to readings_cache — delete old entries first, then insert
      await supabase.from("readings_cache").delete().neq("sunday_title", sundayTitle);
      await supabase.from("readings_cache").upsert(
        {
          sunday_title: sundayTitle,
          url: nextSunday.url,
          markdown_content: readingsMarkdown,
          scraped_at: new Date().toISOString(),
          sunday_date: nextSunday.date,
        },
        { onConflict: "sunday_title" }
      );
      addLog(`Saved readings to cache: "${sundayTitle}"`);
    }

    // --- Step 3: Pre-generate AI outputs ---
    if (!LOVABLE_API_KEY) {
      addLog("LOVABLE_API_KEY not set, skipping AI pre-generation");
      return new Response(JSON.stringify({ success: true, sundayTitle, log }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profileSlug = "ccsh";
    const textHash = await hashText(readingsMarkdown);

    // Load theological corpus once — only needed for context mode
    let theologicalContext: string | null = null;
    try {
      theologicalContext = await buildTheologicalContext(supabase, profileSlug);
    } catch (e) {
      addLog(`Warning: could not load corpus — ${e.message}`);
    }

    async function generateAndCache(mode: "context" | "annotate") {
      const { data: existing } = await supabase
        .from("ai_cache")
        .select("id")
        .eq("text_hash", textHash)
        .eq("mode", mode)
        .eq("profile_slug", profileSlug)
        .maybeSingle();

      if (existing) {
        addLog(`AI cache hit for "${mode}" — skipping`);
        return;
      }

      // Build system prompt: context mode needs corpus, annotate mode does not
      let systemPrompt: string;
      if (mode === "context") {
        if (!theologicalContext) {
          addLog(`Skipping "${mode}" — no corpus available`);
          return;
        }
        systemPrompt = buildContextPrompt(theologicalContext);
      } else {
        systemPrompt = ANNOTATE_SYSTEM_PROMPT;
      }

      const body: Record<string, unknown> = {
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: readingsMarkdown },
        ],
      };
      if (mode === "context") {
        body.response_format = { type: "json_object" };
      }

      addLog(`Generating AI "${mode}"…`);
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        addLog(`AI error for "${mode}": ${res.status}`);
        return;
      }

      const aiData = await res.json();
      const content = aiData.choices?.[0]?.message?.content || "";

      if (mode === "context") {
        try {
          const parsed = JSON.parse(content);
          await supabase.from("ai_cache").upsert(
            { text_hash: textHash, mode, profile_slug: profileSlug, result: parsed, model_used: "google/gemini-3-flash-preview" },
            { onConflict: "text_hash,mode,profile_slug" }
          );
          addLog(`Cached AI context`);
        } catch {
          addLog("Failed to parse context JSON");
        }
      } else {
        await supabase.from("ai_cache").upsert(
          { text_hash: textHash, mode, profile_slug: profileSlug, result: { annotated: content }, model_used: "google/gemini-3-flash-preview" },
          { onConflict: "text_hash,mode,profile_slug" }
        );
        addLog(`Cached AI annotate (${content.length} chars)`);
      }
    }

    await Promise.all([
      generateAndCache("context"),
      generateAndCache("annotate"),
    ]);

    addLog("Warm-cache complete ✓");
    return new Response(JSON.stringify({ success: true, sundayTitle, log }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    addLog(`Fatal error: ${e.message}`);
    return new Response(JSON.stringify({ success: false, error: e.message, log }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
