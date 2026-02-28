/**
 * import-czech-zapas — Edge Function
 *
 * Accepts plain text of a Český zápas issue (extracted client-side),
 * deterministically finds the "Nad písmem" section and saves the sermon
 * to the czech_zapas_articles table. No AI / Gemini / large dependencies.
 *
 * POST /import-czech-zapas
 * {
 *   pdfText:     string,  // plain text extracted from PDF (client-side via pdfjs-dist)
 *   year:        number,
 *   issueNumber: number,
 * }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseNadPismem } from "../_shared/czech-zapas-parser.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const { pdfText, year, issueNumber } = body as {
      pdfText: string;
      year: number;
      issueNumber: number;
    };

    if (!year || !issueNumber) {
      return new Response(JSON.stringify({ error: "year a issueNumber jsou povinné" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pdfText?.trim()) {
      return new Response(JSON.stringify({ error: "Chybí pdfText" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deterministically parse the "Nad písmem" section
    const article = parseNadPismem(pdfText, year, issueNumber);

    if (!article) {
      return new Response(
        JSON.stringify({
          imported: 0,
          skipped: 0,
          articles: [],
          message: `Sekce „Nad písmem" nebyla v PDF nalezena.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get next article_number
    const { data: lastRow } = await supabase
      .from("czech_zapas_articles")
      .select("article_number")
      .order("article_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextNum = (lastRow?.article_number ?? 0) + 1;

    const sourceRef = `Český zápas, ročník ${year}, číslo ${issueNumber}`;

    const row = {
      article_number: nextNum,
      title: article.title,
      author: article.author ?? null,
      biblical_references: article.biblical_references,
      biblical_refs_raw: article.biblical_refs_raw ?? null,
      liturgical_context: article.liturgical_context ?? null,
      content_type: article.content_type,
      year,
      issue_number: issueNumber,
      source_ref: sourceRef,
      content: article.content,
      is_active: true,
    };

    const { error } = await supabase
      .from("czech_zapas_articles")
      .upsert(row, { onConflict: "article_number" });

    if (error) {
      return new Response(
        JSON.stringify({
          imported: 0,
          skipped: 1,
          articles: [{ title: article.title, author: article.author, refs: article.biblical_references, ok: false }],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        imported: 1,
        skipped: 0,
        articles: [{ title: article.title, author: article.author, refs: article.biblical_references, ok: true }],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("import-czech-zapas error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
