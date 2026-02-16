import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
function findNextSundayUrl(markdown: string): { url: string; title: string } | null {
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

  return closest ? { url: closest.url, title: closest.title } : null;
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
      readingsMarkdown = extracted.readings || rawMarkdown;
      sundayTitle = extracted.sundayTitle;

      // Save to readings_cache
      await supabase.from("readings_cache").upsert(
        {
          sunday_title: sundayTitle,
          url: nextSunday.url,
          markdown_content: readingsMarkdown,
          scraped_at: new Date().toISOString(),
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

    // Load theological corpus
    const { data: docs } = await supabase
      .from("corpus_documents")
      .select("title, category, content, summary")
      .eq("profile_slug", profileSlug)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (!docs || docs.length === 0) {
      addLog("No corpus documents found, skipping AI");
      return new Response(JSON.stringify({ success: true, sundayTitle, log }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const theologicalProfile = docs.map((doc) => {
      const header = `[${doc.category.toUpperCase()}] ${doc.title}`;
      const separator = "=".repeat(header.length);
      const summaryLine = doc.summary ? `\nSouhrn: ${doc.summary}\n` : "";
      return `${separator}\n${header}\n${separator}${summaryLine}\n${doc.content}`;
    }).join("\n\n");

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

      const systemPrompt = mode === "context"
        ? `${theologicalProfile}

Tvým úkolem je pro zadaný biblický text (jedno nebo více čtení) vytvořit stručný kontextový průvodce v duchu teologie CČSH.

Vrať JSON objekt s polem "readings", kde každý prvek odpovídá jednomu čtení a má tyto klíče:
- "title": název čtení (např. "První čtení – Iz 58,7-10")
- "intro": 1-2 věty, které může lektor říct shromáždění PŘED čtením, aby zasadil text do kontextu. Formuluj v duchu husitské teologie – zdůrazni Kristův odkaz, reformační tradici, obecenství a aktuálnost poselství pro dnešek.
- "characters": pole klíčových postav [{name, description}] – kdo je kdo v textu (max 4)
- "historical_context": 2-3 věty o historickém pozadí – kdy, kde, proč text vznikl, komu byl určen
- "main_message": 1 věta shrnující jádro/poselství textu z perspektivy CČSH – zdůrazni Ducha Kristova, obecenství, zpřítomnění Božího slova a praktický dopad do života věřícího
- "tone": jaký emocionální charakter má mít přednes (např. "slavnostní a povzbudivý", "naléhavý a varovný")
- "citations": pole 0–2 relevantních citací ze Základů víry CČSH [{question_number, text, relevance}]. question_number je číslo otázky (např. 105), text je krátká citace z odpovědi (max 2 věty), relevance je 1 věta vysvětlující spojitost s čtením. Pokud žádná otázka přímo nesouvisí, vrať prázdné pole []. NEVYMÝŠLEJ citace — používej POUZE skutečné otázky a odpovědi z dokumentu Základy víry CČSH uvedeného výše.

Vrať POUZE validní JSON, žádný markdown ani komentáře.`
        : `${theologicalProfile}

Jsi expert na liturgické předčítání (lektorování) v Církvi československé husitské.
Tvým úkolem je anotovat biblický text značkami pro přednes:

Pravidla:
- **tučně** označ slova, která mají být zdůrazněna (klíčová slova, jména, důležité pojmy)
- Vlož značku [pauza] tam, kde má být krátká pauza (cca 1 sekunda) — typicky před důležitou myšlenkou nebo po čárce
- Vlož značku [dlouhá pauza] tam, kde má být delší pauza (2-3 sekundy) — typicky mezi odstavci, před závěrečným veršem
- Vlož značku [pomalu] před pasáže, které mají být čteny pomaleji (slavnostní momenty, klíčové výroky)
- Vlož značku [normálně] pro návrat k normálnímu tempu
- Zachovej celý původní text — nic neodstraňuj, nic nepřidávej kromě značek
- Neměň formátování nadpisů (## zůstane ##)
- Nevkládej žádné komentáře ani vysvětlení — vrať POUZE anotovaný text

Příklad:
Vstup: "Hospodin řekl Mojžíšovi: Jdi k faraónovi a řekni mu: Propusť můj lid."
Výstup: "**Hospodin** řekl **Mojžíšovi**: [pauza] Jdi k **faraónovi** a řekni mu: [pauza] [pomalu] **Propusť můj lid.** [normálně]"`;

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
