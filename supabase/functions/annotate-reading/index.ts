import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildTheologicalContext, buildContextPrompt, ANNOTATE_SYSTEM_PROMPT } from "../_shared/corpus.ts";
import { findMatchingPostily } from "../_shared/postily.ts";

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
    if (mode && !['annotate', 'context', 'postily'].includes(mode)) {
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
    const isPostily = mode === "postily";
    const profileSlug = "ccsh";

    // 1. Check AI cache first (before loading corpus — saves a DB call on cache hit)
    const textHash = await hashText(text);
    const cacheMode = isPostily ? "postily" : isContext ? "context" : "annotate";

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
      if (isPostily) {
        return new Response(JSON.stringify({ postily: cached.result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ annotated: cached.result.annotated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode "postily": find matching postily and generate AI insights for preaching
    if (isPostily) {
      const matches = await findMatchingPostily(supabase, text);

      if (matches.length === 0) {
        return new Response(JSON.stringify({ postily: { matches: [], insights: null } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Use at most 2 matching postily (to keep prompt size reasonable)
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

      const postilyMessages = [
        { role: "system", content: postilyPrompt },
        { role: "user", content: text },
      ];

      const postilyBody = {
        model: "google/gemini-3-flash-preview",
        messages: postilyMessages,
        response_format: { type: "json_object" },
      };

      const postilyResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(postilyBody),
        }
      );

      if (!postilyResponse.ok) {
        const t = await postilyResponse.text();
        console.error("AI gateway error for postily:", postilyResponse.status, t);
        // Fallback: return raw matches without AI insights
        const fallback = {
          postily: topMatches.map((m) => ({
            postil_number: m.postil_number,
            title: m.title,
            source_ref: m.source_ref,
            year: m.year,
            matched_ref: m.matched_ref,
            quotes: [],
            insight: "",
            relevance: "",
            preaching_angle: "",
            full_text: m.content,
          })),
        };
        return new Response(JSON.stringify({ postily: fallback }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const postilyData = await postilyResponse.json();
      const postilyContent = postilyData.choices?.[0]?.message?.content || "";

      try {
        const parsed = JSON.parse(postilyContent);

        // Cache the result
        await supabase.from("ai_cache").upsert(
          { text_hash: textHash, mode: cacheMode, profile_slug: profileSlug, result: parsed, model_used: "google/gemini-3-flash-preview" },
          { onConflict: "text_hash,mode,profile_slug" }
        );
        console.log("Cached postily result");

        return new Response(JSON.stringify({ postily: parsed }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        console.error("Failed to parse postily JSON:", postilyContent);
        // Fallback with raw data
        const fallback = {
          postily: topMatches.map((m) => ({
            postil_number: m.postil_number,
            title: m.title,
            source_ref: m.source_ref,
            year: m.year,
            matched_ref: m.matched_ref,
            quotes: [],
            insight: "",
            relevance: "",
            preaching_angle: "",
            full_text: m.content,
          })),
        };
        return new Response(JSON.stringify({ postily: fallback }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 2. Build system prompt — only load corpus for context mode
    let systemPrompt: string;
    if (isContext) {
      const theologicalContext = await buildTheologicalContext(supabase, profileSlug);
      systemPrompt = buildContextPrompt(theologicalContext);
    } else {
      // Annotate mode: no corpus needed — purely about reading technique
      systemPrompt = ANNOTATE_SYSTEM_PROMPT;
    }

    // 3. Generate via AI
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
