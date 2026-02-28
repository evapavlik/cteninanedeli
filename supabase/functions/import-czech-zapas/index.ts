/**
 * import-czech-zapas — Edge Function
 *
 * Přijme PDF čísla Českého zápasu (jako base64 nebo veřejnou URL),
 * nechá Gemini AI rozložit ho na jednotlivé články a uloží je do tabulky
 * czech_zapas_articles.
 *
 * POST /import-czech-zapas
 * {
 *   pdfBase64?: string,   // PDF soubor jako base64
 *   pdfUrl?:   string,   // veřejná URL PDF souboru
 *   year:      number,
 *   issueNumber: number,
 *   hint?:     string    // pokyn pro AI: kde v čísle hledat (str., téma, autor...)
 * }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Article {
  title: string;
  author: string | null;
  content_type: "kazani" | "clanek" | "komentar";
  liturgical_context: string | null;
  biblical_refs_raw: string | null;
  content: string;
}

/** Gemini multimodal call — přečte PDF a vrátí pole článků */
async function segmentPdf(
  pdfBase64: string,
  year: number,
  issueNumber: number,
  hint: string | undefined,
  geminiKey: string,
): Promise<Article[]> {
  const hintSection = hint
    ? `\nPOKYN (zaměř se zejména na toto): ${hint}\n`
    : "";

  const prompt =
    `Jsi asistent pro zpracování textů z týdeníku Český zápas (CČSH - Církev československá husitská).
Toto je číslo ${issueNumber}/${year}.
${hintSection}
Identifikuj jednotlivé OBSAHOVÉ články a vrať je jako JSON pole.
Zahrň pouze:
- kázání / promluvy / homilie  → content_type: "kazani"
- teologické a duchovní články → content_type: "clanek"
- komentáře k čtením / zamyšlení → content_type: "komentar"

VYNECH: redakční oznámení, inzeráty, zprávy ze sborů, personální oznámení, záhlaví stránek, obsah čísla.

Pro každý článek vrať JSON objekt:
{
  "title": "Přesný název článku",
  "author": "Jméno autora nebo null",
  "content_type": "kazani" nebo "clanek" nebo "komentar",
  "liturgical_context": "Název neděle nebo svátku (např. '2. neděle postní') nebo null",
  "biblical_refs_raw": "Biblický odkaz z záhlaví článku nebo null (např. 'Mt 4,1-11')",
  "content": "Celý text článku doslova, bez záhlaví a zápatí stránek"
}

Vrať POUZE JSON pole. Pokud nenajdeš žádný vhodný článek, vrať [].`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inline_data: { mime_type: "application/pdf", data: pdfBase64 } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: { response_mime_type: "application/json" },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini PDF API error ${res.status}: ${body.substring(0, 200)}`);
  }

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (parsed.articles ?? parsed.clanky ?? []);
  } catch {
    throw new Error(`Gemini vrátil nevalidní JSON: ${raw.substring(0, 300)}`);
  }
}

/** Extrahuje biblické reference z textu pomocí Gemini */
async function extractBiblicalRefs(
  content: string,
  rawRef: string | null | undefined,
  geminiKey: string,
): Promise<string[]> {
  if (rawRef?.trim()) return [rawRef.trim()];

  const prompt =
    `Z následujícího textu extrahuj všechny explicitní biblické reference. Vrať JSON pole řetězců ve formátu "Zkratka kap,verš" (např. "Mt 4,1-11", "Gn 12,1-4a"). Pokud nejsou žádné, vrať []. Vrať POUZE JSON pole.\n\nTEXT:\n${content.substring(0, 3000)}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json" },
      }),
    },
  );

  if (!res.ok) return [];
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (parsed.refs ?? parsed.references ?? []);
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_KEY) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY není nastaveno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const { pdfBase64, pdfUrl, year, issueNumber, hint } = body as {
      pdfBase64?: string;
      pdfUrl?: string;
      year: number;
      issueNumber: number;
      hint?: string;
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
      // Download PDF from URL
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
      b64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    }

    if (!b64) {
      return new Response(JSON.stringify({ error: "Chybí pdfBase64 nebo pdfUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Segment PDF into articles
    const rawArticles = await segmentPdf(b64, year, issueNumber, hint, GEMINI_KEY);

    if (rawArticles.length === 0) {
      return new Response(
        JSON.stringify({ imported: 0, skipped: 0, articles: [], message: "Gemini nenašel žádné vhodné články." }),
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
    let nextNum = (lastRow?.article_number ?? 0) + 1;

    const sourceRef = `Český zápas, ročník ${year}, číslo ${issueNumber}`;
    const results: Array<{ title: string; author: string | null; refs: string[]; ok: boolean }> = [];
    let imported = 0;
    let skipped = 0;

    for (const article of rawArticles) {
      if (!article.title || !article.content) {
        skipped++;
        results.push({ title: article.title ?? "(bez názvu)", author: null, refs: [], ok: false });
        continue;
      }

      // Extract biblical references
      const refs = await extractBiblicalRefs(article.content, article.biblical_refs_raw, GEMINI_KEY);

      const row = {
        article_number: nextNum,
        title: article.title,
        author: article.author ?? null,
        biblical_references: refs,
        biblical_refs_raw: article.biblical_refs_raw ?? null,
        liturgical_context: article.liturgical_context ?? null,
        content_type: article.content_type ?? "kazani",
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
        skipped++;
        results.push({ title: article.title, author: article.author ?? null, refs, ok: false });
      } else {
        imported++;
        nextNum++;
        results.push({ title: article.title, author: article.author ?? null, refs, ok: true });
      }
    }

    return new Response(
      JSON.stringify({ imported, skipped, articles: results }),
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
