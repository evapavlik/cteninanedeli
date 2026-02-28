/**
 * import-czech-zapas — Edge Function
 *
 * Přijme PDF čísla Českého zápasu (jako base64 nebo veřejnou URL),
 * deterministicky najde sekci "Nad písmem" a uloží kázání do tabulky
 * czech_zapas_articles. Nevyžaduje žádné AI / Gemini.
 *
 * POST /import-czech-zapas
 * {
 *   pdfBase64?: string,   // PDF soubor jako base64
 *   pdfUrl?:   string,   // veřejná URL PDF souboru
 *   year:      number,
 *   issueNumber: number,
 * }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseNadPismem } from "../_shared/czech-zapas-parser.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Extrahuje plain text z PDF (base64) pomocí pdfjs-dist */
async function extractPdfText(base64: string): Promise<string> {
  // Dekódujeme base64 → Uint8Array
  const binary = atob(base64);
  const data = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);

  // pdfjs-dist – legacy build funguje v Deno bez workerů
  // deno-lint-ignore no-explicit-any
  const pdfjsLib: any = await import("npm:pdfjs-dist/legacy/build/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "";

  const pdf = await pdfjsLib.getDocument({ data, disableFontFace: true }).promise;
  const pages: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // deno-lint-ignore no-explicit-any
    const pageText = content.items.map((item: any) => item.str).join(" ");
    pages.push(pageText);
  }

  return pages.join("\n");
}

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
    const { pdfBase64, pdfUrl, year, issueNumber } = body as {
      pdfBase64?: string;
      pdfUrl?: string;
      year: number;
      issueNumber: number;
    };

    if (!year || !issueNumber) {
      return new Response(JSON.stringify({ error: "year a issueNumber jsou povinné" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve PDF base64
    let b64 = pdfBase64;

    if (!b64 && pdfUrl) {
      const dlRes = await fetch(pdfUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          "Accept": "application/pdf,*/*",
        },
      });
      if (!dlRes.ok) {
        throw new Error(`Nepodařilo se stáhnout PDF: HTTP ${dlRes.status}`);
      }
      const arrayBuffer = await dlRes.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      b64 = btoa(binary);
    }

    if (!b64) {
      return new Response(JSON.stringify({ error: "Chybí pdfBase64 nebo pdfUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extrahujeme text z PDF
    const pdfText = await extractPdfText(b64);

    // Deterministicky parsujeme sekci "Nad písmem"
    const article = parseNadPismem(pdfText, year, issueNumber);

    if (!article) {
      return new Response(
        JSON.stringify({
          imported: 0,
          skipped: 0,
          articles: [],
          message: "Sekce „Nad písmem" nebyla v PDF nalezena.",
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
        articles: [{
          title: article.title,
          author: article.author,
          refs: article.biblical_references,
          ok: true,
        }],
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
