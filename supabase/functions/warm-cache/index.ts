import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * warm-cache: Pre-fetches readings from ccsh.cz and pre-generates
 * both AI outputs (context + annotate) so users get instant results.
 * Designed to be called via pg_cron daily.
 */

function extractReadings(markdown: string): { sundayTitle: string; readings: string } {
  const sundayMatch = markdown.match(/neděle\s+\d+\.\s*\w+/i) || markdown.match(/neděle[^\n]*/i);
  const sundayDate = sundayMatch ? sundayMatch[0].trim() : "";

  const sections: string[] = [];

  function extractSection(keyword: string): string | null {
    const regex = new RegExp(`####\\s*([^\\n]*${keyword}[^\\n]*)\\n+([\\s\\S]*?)(?=\\n####|\\n##\\s|$)`, "i");
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

  return {
    sundayTitle: sundayDate,
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
    // --- Step 1: Scrape readings ---
    const url = "https://www.ccsh.cz/cyklus.html";

    if (!FIRECRAWL_API_KEY) {
      addLog("FIRECRAWL_API_KEY not set, checking existing cache only");
    }

    let rawMarkdown: string | null = null;
    let sundayTitle = "";

    // Check if we have a fresh cache (< 6 hours)
    const { data: cached } = await supabase
      .from("readings_cache")
      .select("markdown_content, sunday_title, scraped_at")
      .eq("url", url)
      .order("scraped_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const SIX_HOURS = 6 * 60 * 60 * 1000;
    const isFresh = cached && (Date.now() - new Date(cached.scraped_at).getTime()) < SIX_HOURS;

    if (isFresh) {
      addLog("Readings cache is fresh, reusing");
      rawMarkdown = cached.markdown_content;
      sundayTitle = cached.sunday_title;
    } else if (FIRECRAWL_API_KEY) {
      addLog("Scraping fresh readings from ccsh.cz");
      const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      });

      if (!scrapeRes.ok) {
        addLog(`Firecrawl error: ${scrapeRes.status}`);
        // Fall back to stale cache
        if (cached) {
          rawMarkdown = cached.markdown_content;
          sundayTitle = cached.sunday_title;
          addLog("Using stale cache as fallback");
        }
      } else {
        const scrapeData = await scrapeRes.json();
        rawMarkdown = scrapeData?.data?.markdown || scrapeData?.markdown || null;
      }
    } else if (cached) {
      rawMarkdown = cached.markdown_content;
      sundayTitle = cached.sunday_title;
      addLog("Using stale cache (no Firecrawl key)");
    }

    if (!rawMarkdown) {
      addLog("No readings available — aborting");
      return new Response(JSON.stringify({ success: false, log }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract and clean readings
    const extracted = extractReadings(rawMarkdown);
    const readingsMarkdown = extracted.readings || rawMarkdown;
    if (!sundayTitle) sundayTitle = extracted.sundayTitle;

    // Save to readings_cache if we scraped fresh
    if (!isFresh && FIRECRAWL_API_KEY) {
      await supabase.from("readings_cache").upsert(
        { sunday_title: sundayTitle, url, markdown_content: rawMarkdown, scraped_at: new Date().toISOString() },
        { onConflict: "sunday_title" }
      );
      addLog(`Saved readings to cache: "${sundayTitle}"`);
    }

    // --- Step 2: Pre-generate AI outputs ---
    if (!LOVABLE_API_KEY) {
      addLog("LOVABLE_API_KEY not set, skipping AI pre-generation");
      return new Response(JSON.stringify({ success: true, log }), {
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
      return new Response(JSON.stringify({ success: true, log }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const theologicalProfile = docs.map((doc) => {
      const header = `[${doc.category.toUpperCase()}] ${doc.title}`;
      const separator = "=".repeat(header.length);
      const summaryLine = doc.summary ? `\nSouhrn: ${doc.summary}\n` : "";
      return `${separator}\n${header}\n${separator}${summaryLine}\n${doc.content}`;
    }).join("\n\n");

    // Helper to call AI and cache result
    async function generateAndCache(mode: "context" | "annotate") {
      // Check if already cached
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
          addLog(`Cached AI context (${Object.keys(parsed).length} keys)`);
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

    // Generate both in parallel
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
