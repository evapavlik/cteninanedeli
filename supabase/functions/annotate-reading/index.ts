import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildTheologicalContext, buildContextPrompt, ANNOTATE_SYSTEM_PROMPT } from "../_shared/corpus.ts";
import { findMatchingPostily, findMatchingCzechZapas } from "../_shared/postily.ts";
import { buildPostilyPrompt, formatPostilyContext, buildCzechZapasPrompt, formatCzechZapasContext } from "../_shared/prompts.ts";

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
    const { text, mode, liturgicalContext } = await req.json();

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
    if (mode && !['annotate', 'context', 'postily', 'czech_zapas'].includes(mode)) {
      return new Response(
        JSON.stringify({ error: 'Invalid mode parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    /** Fetch from Gemini with retry on 429 (exponential backoff). */
    async function geminiRequest(body: Record<string, unknown>): Promise<Response> {
      const MAX_RETRIES = 3;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const res = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${GEMINI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          },
        );

        if (res.ok || res.status !== 429 || attempt === MAX_RETRIES) {
          if (!res.ok) {
            const errBody = await res.text().catch(() => "(no body)");
            console.log(`Gemini error ${res.status} (attempt ${attempt}/${MAX_RETRIES}): ${errBody.slice(0, 300)}`);
            return new Response(errBody, { status: res.status, headers: res.headers });
          }
          return res;
        }

        const delay = 5000 * Math.pow(2, attempt - 1);
        console.log(`Gemini 429, retry ${attempt}/${MAX_RETRIES} in ${delay}ms…`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      throw new Error("geminiRequest: unexpected fall-through");
    }

    const isContext = mode === "context";
    const isPostily = mode === "postily";
    const isCzechZapas = mode === "czech_zapas";
    const profileSlug = "ccsh";

    // 1. Check AI cache first (before loading corpus — saves a DB call on cache hit)
    const textHash = await hashText(text);
    const cacheMode = isPostily ? "postily" : isCzechZapas ? "czech_zapas" : isContext ? "context" : "annotate";

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
      if (isCzechZapas) {
        return new Response(JSON.stringify({ czech_zapas: cached.result }), {
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
      const postilyContext = formatPostilyContext(topMatches);

      const postilyMessages = [
        { role: "system", content: buildPostilyPrompt(postilyContext) },
        { role: "user", content: text },
      ];

      const postilyBody = {
        model: "gemini-2.5-flash",
        messages: postilyMessages,
        response_format: { type: "json_object" },
      };

      const postilyResponse = await geminiRequest(postilyBody);

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
          { text_hash: textHash, mode: cacheMode, profile_slug: profileSlug, result: parsed, model_used: "gemini-2.5-flash" },
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

    // Mode "czech_zapas": find matching modern articles and generate AI insights (with optional Farský tension)
    if (isCzechZapas) {
      const czMatches = await findMatchingCzechZapas(supabase, text, liturgicalContext);

      if (czMatches.length === 0) {
        return new Response(JSON.stringify({ czech_zapas: { czech_zapas: [] } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const topCzMatches = czMatches.slice(0, 2);
      const czContext = formatCzechZapasContext(topCzMatches);

      // Optionally include a Farský postila for the same reading (for tension/continuity)
      let farskySnippet: string | undefined;
      try {
        const postilyMatches = await findMatchingPostily(supabase, text);
        if (postilyMatches.length > 0) {
          const m = postilyMatches[0];
          const excerpt = m.content.length > 800 ? m.content.substring(0, 800) + "…" : m.content;
          farskySnippet = `Postila č. ${m.postil_number}: „${m.title}"\n${m.source_ref}\n---\n${excerpt}`;
        }
      } catch (e) {
        console.error("Failed to load postily for czech_zapas tension:", e);
      }

      const czMessages = [
        { role: "system", content: buildCzechZapasPrompt(czContext, farskySnippet) },
        { role: "user", content: text },
      ];

      const czResponse = await geminiRequest({
        model: "gemini-2.5-flash",
        messages: czMessages,
        response_format: { type: "json_object" },
      });

      if (!czResponse.ok) {
        const t = await czResponse.text();
        console.error("AI error for czech_zapas:", czResponse.status, t);
        // Fallback: return raw matches without AI insights
        const fallback = {
          czech_zapas: topCzMatches.map((m) => ({
            article_number: m.article_number,
            title: m.title,
            author: m.author,
            source_ref: m.source_ref,
            year: m.year,
            matched_ref: m.matched_ref,
            quotes: [],
            insight: "",
            relevance: "",
            preaching_angle: "",
            full_text: m.content,
          })),
          cross_era_tension: null,
        };
        return new Response(JSON.stringify({ czech_zapas: fallback }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const czData = await czResponse.json();
      const czContent = czData.choices?.[0]?.message?.content || "";

      try {
        const parsed = JSON.parse(czContent);
        await supabase.from("ai_cache").upsert(
          { text_hash: textHash, mode: cacheMode, profile_slug: profileSlug, result: parsed, model_used: "gemini-2.5-flash" },
          { onConflict: "text_hash,mode,profile_slug" }
        );
        console.log("Cached czech_zapas result");
        return new Response(JSON.stringify({ czech_zapas: parsed }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        console.error("Failed to parse czech_zapas JSON:", czContent);
        // Fallback with raw data instead of 500
        const fallback = {
          czech_zapas: topCzMatches.map((m) => ({
            article_number: m.article_number,
            title: m.title,
            author: m.author,
            source_ref: m.source_ref,
            year: m.year,
            matched_ref: m.matched_ref,
            quotes: [],
            insight: "",
            relevance: "",
            preaching_angle: "",
            full_text: m.content,
          })),
          cross_era_tension: null,
        };
        return new Response(JSON.stringify({ czech_zapas: fallback }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 2. Build system prompt — only load corpus for context mode
    let systemPrompt: string;
    if (isContext) {
      const theologicalContext = await buildTheologicalContext(supabase, profileSlug);

      // Try to find a matching Farský postila for a teaser quote
      let farskySnippet: string | undefined;
      try {
        const matches = await findMatchingPostily(supabase, text);
        if (matches.length > 0) {
          const m = matches[0];
          // Provide first ~800 chars so AI can pick the best sentence
          const excerpt = m.content.length > 800 ? m.content.substring(0, 800) + "…" : m.content;
          farskySnippet = `Postila č. ${m.postil_number}: „${m.title}"\n${m.source_ref}\n---\n${excerpt}`;
        }
      } catch (e) {
        console.error("Failed to load postily for context teaser:", e);
      }

      systemPrompt = buildContextPrompt(theologicalContext, farskySnippet);
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
      model: "gemini-2.5-flash",
      messages,
    };

    if (isContext) {
      body.response_format = { type: "json_object" };
    }

    const response = await geminiRequest(body);

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
          { text_hash: textHash, mode: cacheMode, profile_slug: profileSlug, result: parsed, model_used: "gemini-2.5-flash" },
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
      { text_hash: textHash, mode: cacheMode, profile_slug: profileSlug, result: { annotated: content }, model_used: "gemini-2.5-flash" },
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
