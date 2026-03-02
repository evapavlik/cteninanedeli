import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildTheologicalContext, buildContextPrompt, ANNOTATE_SYSTEM_PROMPT } from "../_shared/corpus.ts";
import { findMatchingPostily, findMatchingCzechZapas } from "../_shared/postily.ts";
import { buildPostilyPrompt, formatPostilyContext, buildCzechZapasPrompt, formatCzechZapasContext } from "../_shared/prompts.ts";
import { fetchHtmlDirect, parseIndexFromHtml, extractReadingsFromHtml } from "../_shared/html-parser.ts";

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
const FALLBACK_INDEX_URL = "https://www.ccsh.cz/cyklus.html";

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

/**
 * Generate a two-sentence notification text via Gemini.
 * Sentence 1: short inspirational hook about the reading content.
 * Sentence 2: fixed invitation with correctly declined Sunday name.
 */
async function generateNotificationSentence(
  readings: string,
  sundayTitle: string,
  geminiKey: string,
): Promise<string | null> {
  const systemPrompt =
    `Jsi asistent pro Církev československou husitskou. Napiš přesně dvě věty pro push notifikaci mobilní aplikace pro lektory a kazatele.

1. věta: Krátká, inspirativní, vystihuje duchovní jádro nedělního čtení. Konkrétní, nosná, max. 100 znaků.
2. věta: Přesně tato struktura: "Nechte se pozvat k čtení na tuto neděli, která je [název neděle v 7. pádu]."

Název neděle (v 1. pádu): "${sundayTitle}"
Správně skloň název do 7. pádu. Příklady: "1. neděle postní" → "1. nedělí postní", "Květná neděle" → "Květnou nedělí", "Boží hod vánoční" → "Božím hodem vánočním".

Výstup: pouze obě věty oddělené mezerou, bez uvozovek, bez číslování.`;

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${geminiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.0-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: readings },
        ],
      }),
    },
  );

  if (!res.ok) return null;
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim() || null;
  return text;
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

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "(no body)");
    console.error(`Firecrawl error ${res.status}: ${errorBody}`);
    return null;
  }
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
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

  const log: string[] = [];
  const addLog = (msg: string) => { console.log(msg); log.push(msg); };

  try {
    // --- Step 1: Find next Sunday from index page ---
    // Try Firecrawl first, then direct HTML fetch as fallback
    let nextSunday: { url: string; title: string; date: string } | null = null;

    if (FIRECRAWL_API_KEY) {
      addLog("Scraping cyklus.ccsh.cz index via Firecrawl…");
      const indexMarkdown = await scrapeUrl(INDEX_URL, FIRECRAWL_API_KEY);
      if (indexMarkdown) {
        nextSunday = findNextSundayUrl(indexMarkdown);
        if (nextSunday) addLog(`Firecrawl index: found "${nextSunday.title}"`);
        else addLog("Firecrawl index: scraped OK but no upcoming Sunday matched");
      } else {
        addLog("Firecrawl index: scrape failed");
      }
    } else {
      addLog("FIRECRAWL_API_KEY not set — skipping Firecrawl");
    }

    // Fallback: direct fetch from ccsh.cz/cyklus.html
    if (!nextSunday) {
      addLog(`Trying fallback: direct fetch from ${FALLBACK_INDEX_URL}…`);
      const indexHtml = await fetchHtmlDirect(FALLBACK_INDEX_URL);
      if (indexHtml) {
        nextSunday = parseIndexFromHtml(indexHtml);
        if (nextSunday) {
          addLog(`Fallback index: found "${nextSunday.title}" → ${nextSunday.url}`);
        } else {
          addLog(`Fallback index: could not parse HTML (${indexHtml.length} chars). First 300: ${indexHtml.substring(0, 300)}`);
        }
      } else {
        addLog("Fallback index: fetch failed");
      }
    }

    // Both sources failed — fall back to most recent cached reading
    if (!nextSunday) {
      addLog("All index sources failed — falling back to most recent cache");
      const { data: mostRecent } = await supabase
        .from("readings_cache")
        .select("markdown_content, sunday_title, notification_sentence")
        .order("sunday_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!mostRecent) {
        addLog("No cached reading available — aborting");
        return new Response(JSON.stringify({ success: false, log }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (mostRecent.notification_sentence) {
        addLog(`Notification sentence already exists for "${mostRecent.sunday_title}" — nothing to do`);
        return new Response(JSON.stringify({ success: true, sundayTitle: mostRecent.sunday_title, log }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!GEMINI_API_KEY) {
        addLog("GEMINI_API_KEY not set — cannot generate notification sentence");
        return new Response(JSON.stringify({ success: false, log }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      addLog(`Generating notification sentence for cached "${mostRecent.sunday_title}"…`);
      const notifSentence = await generateNotificationSentence(mostRecent.markdown_content, mostRecent.sunday_title, GEMINI_API_KEY);
      if (notifSentence) {
        await supabase
          .from("readings_cache")
          .update({ notification_sentence: notifSentence })
          .eq("sunday_title", mostRecent.sunday_title);
        addLog(`Notification sentence saved: "${notifSentence.substring(0, 60)}…"`);
      }

      return new Response(JSON.stringify({ success: true, sundayTitle: mostRecent.sunday_title, log }), {
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
      // Scrape the reading page — try Firecrawl, then direct fetch
      let rawMarkdown: string | null = null;
      let scrapeSource = "firecrawl";

      if (FIRECRAWL_API_KEY && nextSunday.url) {
        addLog(`Scraping reading page via Firecrawl: ${nextSunday.url}`);
        rawMarkdown = await scrapeUrl(nextSunday.url, FIRECRAWL_API_KEY);
        if (rawMarkdown) {
          addLog(`Firecrawl reading page: ${rawMarkdown.length} chars`);
        } else {
          addLog("Firecrawl reading page: scrape failed");
        }
      }

      // Fallback: direct fetch of reading page HTML
      if (!rawMarkdown && nextSunday.url) {
        addLog(`Trying fallback: direct fetch of reading page ${nextSunday.url}…`);
        const readingHtml = await fetchHtmlDirect(nextSunday.url);
        if (readingHtml) {
          const htmlExtracted = extractReadingsFromHtml(readingHtml, nextSunday.title);
          if (htmlExtracted.readings && htmlExtracted.readings.length >= 100) {
            rawMarkdown = htmlExtracted.readings;
            scrapeSource = "direct-fetch";
            addLog(`Fallback reading page: extracted ${rawMarkdown.length} chars`);
            // For direct-fetch, rawMarkdown is already in ## format — skip extractReadings below
          } else {
            addLog(`Fallback reading page: extraction too short (${htmlExtracted.readings?.length || 0} chars). HTML ${readingHtml.length} chars, first 300: ${readingHtml.substring(0, 300)}`);
          }
        } else {
          addLog("Fallback reading page: fetch failed");
        }
      }

      if (!rawMarkdown) {
        // All scraping failed — fall back to stale cache if available
        if (cached) {
          addLog("All scraping failed — falling back to stale cache");
          const { data: fullCached } = await supabase
            .from("readings_cache")
            .select("markdown_content, sunday_title, notification_sentence")
            .eq("id", cached.id)
            .single();
          if (fullCached?.notification_sentence) {
            addLog("Notification sentence already exists in stale cache — nothing to do");
            return new Response(JSON.stringify({ success: true, sundayTitle: fullCached.sunday_title, log }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          readingsMarkdown = fullCached!.markdown_content;
          sundayTitle = fullCached!.sunday_title;
        } else {
          addLog("All scraping failed — no cache available");
          return new Response(JSON.stringify({ success: false, log }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else if (scrapeSource === "direct-fetch") {
        // Direct-fetch already produced ## formatted readings
        readingsMarkdown = rawMarkdown;
        sundayTitle = nextSunday.title.replace(/\\([.#*_~`])/g, "$1").trim();

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
        addLog(`Saved readings to cache (via ${scrapeSource}): "${sundayTitle}"`);
      } else {
        // Firecrawl succeeded — use existing extractReadings for markdown
        const extracted = extractReadings(rawMarkdown, nextSunday.title);

        if (!extracted.readings || extracted.readings.length < 100) {
          addLog(`Extraction failed — readings too short (${extracted.readings?.length || 0} chars). Raw markdown starts with: ${rawMarkdown.substring(0, 100)}`);
          return new Response(JSON.stringify({ success: false, log, error: "Extraction produced no valid readings" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        readingsMarkdown = extracted.readings;
        sundayTitle = extracted.sundayTitle;

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
        addLog(`Saved readings to cache (via ${scrapeSource}): "${sundayTitle}"`);
      }
    }

    // --- Step 3: Pre-generate AI outputs ---
    if (!GEMINI_API_KEY) {
      addLog("GEMINI_API_KEY not set, skipping AI pre-generation");
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
      addLog(`Warning: could not load corpus — ${(e as Error).message}`);
    }

    // Try to find matching Farský postily for context teaser + postily pre-generation
    let farskySnippet: string | undefined;
    let postilyMatches: Awaited<ReturnType<typeof findMatchingPostily>> = [];
    try {
      postilyMatches = await findMatchingPostily(supabase, readingsMarkdown);
      if (postilyMatches.length > 0) {
        const m = postilyMatches[0];
        const excerpt = m.content.length > 800 ? m.content.substring(0, 800) + "…" : m.content;
        farskySnippet = `Postila č. ${m.postil_number}: „${m.title}"\n${m.source_ref}\n---\n${excerpt}`;
        addLog(`Found ${postilyMatches.length} matching postil(s) for Farský teaser`);
      }
    } catch (e) {
      addLog(`Warning: could not load postily — ${(e as Error).message}`);
    }

    // Try to find matching modern Český zápas articles
    let czMatches: Awaited<ReturnType<typeof findMatchingCzechZapas>> = [];
    try {
      czMatches = await findMatchingCzechZapas(supabase, readingsMarkdown, sundayTitle);
      addLog(`Found ${czMatches.length} Czech zápas article(s)`);
    } catch (e) {
      addLog(`Warning: could not load czech_zapas — ${(e as Error).message}`);
    }

    async function generateAndCache(mode: "context" | "annotate" | "postily" | "czech_zapas") {
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

      // Build system prompt based on mode
      let systemPrompt: string;
      let userContent = readingsMarkdown;
      let isJson = false;

      if (mode === "context") {
        if (!theologicalContext) {
          addLog(`Skipping "${mode}" — no corpus available`);
          return;
        }
        systemPrompt = buildContextPrompt(theologicalContext, farskySnippet);
        isJson = true;
      } else if (mode === "postily") {
        if (postilyMatches.length === 0) {
          addLog(`Skipping "${mode}" — no matching postily`);
          return;
        }
        const topMatches = postilyMatches.slice(0, 2);
        const postilyContext = formatPostilyContext(topMatches);
        systemPrompt = buildPostilyPrompt(postilyContext);
        isJson = true;
      } else if (mode === "czech_zapas") {
        if (czMatches.length === 0) {
          addLog(`Skipping "${mode}" — no matching Czech zápas articles`);
          return;
        }
        const topCzMatches = czMatches.slice(0, 2);
        const czContext = formatCzechZapasContext(topCzMatches);
        systemPrompt = buildCzechZapasPrompt(czContext, farskySnippet);
        isJson = true;
      } else {
        systemPrompt = ANNOTATE_SYSTEM_PROMPT;
      }

      const body: Record<string, unknown> = {
        model: "gemini-2.0-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      };
      if (isJson) {
        body.response_format = { type: "json_object" };
      }

      addLog(`Generating AI "${mode}"…`);
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GEMINI_API_KEY}`,
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

      if (isJson) {
        try {
          const parsed = JSON.parse(content);
          await supabase.from("ai_cache").upsert(
            { text_hash: textHash, mode, profile_slug: profileSlug, result: parsed, model_used: "gemini-2.0-flash" },
            { onConflict: "text_hash,mode,profile_slug" }
          );
          addLog(`Cached AI ${mode}`);
        } catch {
          addLog(`Failed to parse ${mode} JSON`);
        }
      } else {
        await supabase.from("ai_cache").upsert(
          { text_hash: textHash, mode, profile_slug: profileSlug, result: { annotated: content }, model_used: "gemini-2.0-flash" },
          { onConflict: "text_hash,mode,profile_slug" }
        );
        addLog(`Cached AI annotate (${content.length} chars)`);
      }
    }

    await Promise.all([
      generateAndCache("context"),
      generateAndCache("annotate"),
      generateAndCache("postily"),
      generateAndCache("czech_zapas"),
    ]);

    // --- Step 4: Generate notification sentence (if not already set for this Sunday) ---
    const { data: cachedRow } = await supabase
      .from("readings_cache")
      .select("notification_sentence")
      .eq("sunday_title", sundayTitle)
      .maybeSingle();

    if (!cachedRow?.notification_sentence) {
      addLog("Generating notification sentence…");
      const notifSentence = await generateNotificationSentence(readingsMarkdown, sundayTitle, GEMINI_API_KEY);
      if (notifSentence) {
        await supabase
          .from("readings_cache")
          .update({ notification_sentence: notifSentence })
          .eq("sunday_title", sundayTitle);
        addLog(`Notification sentence saved: "${notifSentence.substring(0, 60)}…"`);
      } else {
        addLog("Warning: could not generate notification sentence");
      }
    } else {
      addLog("Notification sentence already exists — skipping");
    }

    addLog("Warm-cache complete ✓");
    return new Response(JSON.stringify({ success: true, sundayTitle, log }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    addLog(`Fatal error: ${(e as Error).message}`);
    return new Response(JSON.stringify({ success: false, error: (e as Error).message, log }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
