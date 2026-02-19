import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildTheologicalContext, buildContextPrompt, ANNOTATE_SYSTEM_PROMPT } from "../_shared/corpus.ts";
import { findMatchingPostily } from "../_shared/postily.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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

async function hashText(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 32);
}

const AI_MODEL = "google/gemini-3-flash-preview";
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callAI(apiKey: string, messages: { role: string; content: string }[], jsonMode = false) {
  const body: Record<string, unknown> = { model: AI_MODEL, messages };
  if (jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("AI gateway error:", res.status, t);
    return { ok: false as const, status: res.status };
  }
  const data = await res.json();
  return { ok: true as const, content: data.choices?.[0]?.message?.content || "" };
}

async function cacheResult(supabase: any, textHash: string, mode: string, slug: string, result: unknown) {
  await supabase.from("ai_cache").upsert(
    { text_hash: textHash, mode, profile_slug: slug, result, model_used: AI_MODEL },
    { onConflict: "text_hash,mode,profile_slug" }
  );
}

function buildPostilyFallback(matches: any[]) {
  return {
    postily: matches.map((m) => ({
      postil_number: m.postil_number, title: m.title, source_ref: m.source_ref,
      year: m.year, matched_ref: m.matched_ref, quotes: [],
      insight: "", relevance: "", preaching_angle: "", full_text: m.content,
    })),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp)) return json({ error: "Příliš mnoho požadavků, zkuste to později." }, 429);

  try {
    const { text, mode } = await req.json();

    if (!text || typeof text !== 'string') return json({ error: 'Text parameter is required and must be a string' }, 400);
    if (text.length > 50000) return json({ error: 'Text too long (max 50000 characters)' }, 400);
    if (mode && !['annotate', 'context', 'postily'].includes(mode)) return json({ error: 'Invalid mode parameter' }, 400);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const isContext = mode === "context";
    const isPostily = mode === "postily";
    const profileSlug = "ccsh";

    // 1. Check AI cache
    const textHash = await hashText(text);
    const cacheMode = isPostily ? "postily" : isContext ? "context" : "annotate";

    const { data: cached } = await supabase
      .from("ai_cache").select("result")
      .eq("text_hash", textHash).eq("mode", cacheMode).eq("profile_slug", profileSlug)
      .maybeSingle();

    if (cached) {
      console.log("Cache hit:", cacheMode);
      if (isContext) return json({ context: cached.result });
      if (isPostily) return json({ postily: cached.result });
      return json({ annotated: cached.result.annotated });
    }

    // 2. Handle postily mode
    if (isPostily) {
      const matches = await findMatchingPostily(supabase, text);
      if (matches.length === 0) return json({ postily: { matches: [], insights: null } });

      const topMatches = matches.slice(0, 2);
      const postilyContext = topMatches.map((m) =>
        `---\nPOSTILA č. ${m.postil_number}: „${m.title}"\n${m.source_ref}\nBiblický odkaz: ${m.matched_ref}\n${m.liturgical_context ? `Liturgický kontext: ${m.liturgical_context}\n` : ""}---\n${m.content}`
      ).join("\n\n");

      const postilyPrompt = `Jsi teolog Církve československé husitské. Níže je text nedělních čtení a k nim odpovídající postila (kázání) Karla Farského, zakladatele CČSH, z let 1921–1924.

Tvým úkolem je vytvořit inspiraci pro kázání. Vrať JSON objekt s těmito klíči:

- "postily": pole objektů (jeden pro každou matchovanou postilu), kde každý má:
  - "postil_number": číslo postily
  - "title": název postily
  - "source_ref": odkaz na Český zápas (ročník, číslo)
  - "year": rok vzniku
  - "matched_ref": biblický odkaz, na který postila reaguje
  - "quotes": pole 1-3 nejsilnějších doslovných citátů z Farského textu (každý max 2 věty)
  - "insight": 3-4 věty shrnující Farského pohled — co je jádro jeho výkladu, čím je originální
  - "relevance": 2-3 věty propojující Farského myšlenky s dneškem — proč je aktuální, jak může inspirovat dnešní kázání
  - "preaching_angle": 1 věta navrhující konkrétní úhel/háček pro kázání inspirovaný Farským
  - "full_text": celý text postily (zkopíruj doslova z kontextu níže)

Vrať POUZE validní JSON, žádný markdown ani komentáře.

POSTILY KARLA FARSKÉHO:
${postilyContext}`;

      const result = await callAI(LOVABLE_API_KEY, [
        { role: "system", content: postilyPrompt },
        { role: "user", content: text },
      ], true);

      if (!result.ok) return json({ postily: buildPostilyFallback(topMatches) });

      try {
        const parsed = JSON.parse(result.content);
        await cacheResult(supabase, textHash, cacheMode, profileSlug, parsed);
        return json({ postily: parsed });
      } catch {
        console.error("Failed to parse postily JSON:", result.content);
        return json({ postily: buildPostilyFallback(topMatches) });
      }
    }

    // 3. Handle context / annotate modes
    let systemPrompt: string;
    if (isContext) {
      const theologicalContext = await buildTheologicalContext(supabase, profileSlug);
      systemPrompt = buildContextPrompt(theologicalContext);
    } else {
      systemPrompt = ANNOTATE_SYSTEM_PROMPT;
    }

    const result = await callAI(LOVABLE_API_KEY, [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ], isContext);

    if (!result.ok) {
      if (result.status === 429) return json({ error: "Příliš mnoho požadavků, zkuste to později." }, 429);
      if (result.status === 402) return json({ error: "Nedostatek kreditů." }, 402);
      return json({ error: "Chyba AI služby" }, 500);
    }

    if (isContext) {
      try {
        const parsed = JSON.parse(result.content);
        await cacheResult(supabase, textHash, cacheMode, profileSlug, parsed);
        return json({ context: parsed });
      } catch {
        console.error("Failed to parse context JSON:", result.content);
        return json({ error: "Nepodařilo se zpracovat kontext" }, 500);
      }
    }

    await cacheResult(supabase, textHash, cacheMode, profileSlug, { annotated: result.content });
    return json({ annotated: result.content });
  } catch (e) {
    console.error("annotate error:", e);
    return json({ error: "Došlo k chybě při zpracování požadavku" }, 500);
  }
});
