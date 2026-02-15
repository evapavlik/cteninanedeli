import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory rate limiter (per isolate)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

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

// Simple hash function for cache key
async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 32);
}

/**
 * Build theological context from corpus_documents table.
 * Documents are loaded by profile_slug, filtered by is_active, and sorted by sort_order.
 * Each document is prefixed with its category and title for AI clarity.
 */
async function buildTheologicalContext(
  supabase: ReturnType<typeof createClient>,
  profileSlug: string
): Promise<string> {
  const { data: docs, error } = await supabase
    .from("corpus_documents")
    .select("title, category, content, summary")
    .eq("profile_slug", profileSlug)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error loading corpus documents:", error.message);
    throw new Error("Failed to load theological corpus");
  }

  if (!docs || docs.length === 0) {
    throw new Error(`No active corpus documents found for profile "${profileSlug}"`);
  }

  console.log(`Loaded ${docs.length} corpus document(s) for profile "${profileSlug}"`);

  const sections = docs.map((doc: { title: string; category: string; content: string; summary: string | null }) => {
    const header = `[${doc.category.toUpperCase()}] ${doc.title}`;
    const separator = "=".repeat(header.length);
    const summaryLine = doc.summary ? `\nSouhrn: ${doc.summary}\n` : "";
    return `${separator}\n${header}\n${separator}${summaryLine}\n${doc.content}`;
  });

  return sections.join("\n\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting
  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp)) {
    return new Response(
      JSON.stringify({ error: "Příliš mnoho požadavků, zkuste to později." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { text, mode } = await req.json();

    // Validate text parameter
    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Text parameter is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const MAX_TEXT_LENGTH = 50000;
    if (text.length > MAX_TEXT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Text too long (max ${MAX_TEXT_LENGTH} characters)` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate mode parameter
    if (mode && !['annotate', 'context'].includes(mode)) {
      return new Response(
        JSON.stringify({ error: 'Invalid mode parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const isContext = mode === "context";
    const profileSlug = "ccsh";

    // 1. Load theological corpus from structured documents
    const theologicalProfile = await buildTheologicalContext(supabase, profileSlug);

    // 2. Check AI cache
    const textHash = await hashText(text);
    const cacheMode = isContext ? "context" : "annotate";

    const { data: cached } = await supabase
      .from("ai_cache")
      .select("result")
      .eq("text_hash", textHash)
      .eq("mode", cacheMode)
      .eq("profile_slug", profileSlug)
      .maybeSingle();

    if (cached) {
      console.log("Returning cached AI result for mode:", cacheMode);
      if (isContext) {
        return new Response(JSON.stringify({ context: cached.result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ annotated: cached.result.annotated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Generate via AI
    const systemPrompt = isContext
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

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ];

    const body: Record<string, unknown> = {
      model: "google/gemini-3-flash-preview",
      messages,
    };

    if (isContext) {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Příliš mnoho požadavků, zkuste to později." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Nedostatek kreditů." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Chyba AI služby" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    if (isContext) {
      try {
        const parsed = JSON.parse(content);

        // Save to AI cache
        await supabase.from("ai_cache").upsert(
          { text_hash: textHash, mode: cacheMode, profile_slug: profileSlug, result: parsed, model_used: "google/gemini-3-flash-preview" },
          { onConflict: "text_hash,mode,profile_slug" }
        );
        console.log("Cached context result");

        return new Response(JSON.stringify({ context: parsed }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        console.error("Failed to parse context JSON:", content);
        return new Response(
          JSON.stringify({ error: "Nepodařilo se zpracovat kontext" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Save annotate result to AI cache
    await supabase.from("ai_cache").upsert(
      { text_hash: textHash, mode: cacheMode, profile_slug: profileSlug, result: { annotated: content }, model_used: "google/gemini-3-flash-preview" },
      { onConflict: "text_hash,mode,profile_slug" }
    );
    console.log("Cached annotate result");

    return new Response(JSON.stringify({ annotated: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("annotate error:", e);
    return new Response(
      JSON.stringify({ error: "Došlo k chybě při zpracování požadavku" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
