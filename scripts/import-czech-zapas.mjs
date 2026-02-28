/**
 * import-czech-zapas.mjs
 * Importuje články z Českého zápasu do Supabase tabulky `czech_zapas_articles`.
 *
 * Použití:
 *   node scripts/import-czech-zapas.mjs <soubor.json>
 *   node scripts/import-czech-zapas.mjs <soubor.pdf> [--year YYYY] [--issue N]
 *   node scripts/import-czech-zapas.mjs <https://...soubor.pdf> [--year YYYY] [--issue N]
 *
 * Formát vstupního JSON souboru (pole článků):
 * [
 *   {
 *     "title": "Název článku",
 *     "author": "Jméno Autora",          // nebo null
 *     "year": 2024,
 *     "issue_number": 12,
 *     "content_type": "kazani",          // "kazani" | "clanek" | "komentar"
 *     "liturgical_context": "2. neděle postní",  // nebo null
 *     "biblical_refs_raw": "Mt 4,1-11",   // nebo null — AI doplní z textu
 *     "content": "Plný text článku..."
 *   }
 * ]
 *
 * Formát PDF: celé číslo Českého zápasu. AI automaticky rozloží na jednotlivé články.
 * Rok a číslo se detekují z názvu souboru/URL (např. cz2024-12.pdf) nebo je zadejte ručně.
 *
 * Vyžaduje proměnné prostředí:
 *   VITE_SUPABASE_URL  — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (pro zápis)
 *   GEMINI_API_KEY — pro extrakci biblických odkazů a segmentaci PDF (povinné pro PDF)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// Load environment from .env file if present
function loadEnv() {
  try {
    const envContent = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const line of envContent.split("\n")) {
      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").replace(/^["']|["']$/g, "").trim();
        if (!process.env[key.trim()]) process.env[key.trim()] = value;
      }
    }
  } catch {
    // .env not found — use existing environment variables
  }
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Chyba: VITE_SUPABASE_URL a SUPABASE_SERVICE_ROLE_KEY musí být nastaveny.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Extrahuje rok a číslo čísla z názvu souboru.
 * Podporuje vzory jako: cz2024-12.pdf, 2024-12.pdf, cz2024_12.pdf, ...
 */
function detectYearAndIssue(filename) {
  const base = filename.replace(/^.*[\\/]/, "").replace(/\.pdf$/i, "");
  const match = base.match(/(\d{4})[-_.]?(\d{1,2})/);
  if (match) {
    return { year: parseInt(match[1]), issue: parseInt(match[2]) };
  }
  return null;
}

/**
 * Extrahuje text z lokálního souboru PDF nebo URL pomocí pdf-parse.
 */
async function extractTextFromPdf(filePathOrUrl) {
  const pdfParse = require("pdf-parse");
  let buffer;

  if (filePathOrUrl.startsWith("http://") || filePathOrUrl.startsWith("https://")) {
    // Download PDF from URL
    process.stdout.write("  → Stahuji PDF z URL... ");
    const url = new URL(filePathOrUrl);
    const res = await fetch(filePathOrUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Referer": `${url.origin}/`,
        "Accept": "application/pdf,*/*",
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} při stahování PDF`);
    }
    const arrayBuffer = await res.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
    console.log(`${(buffer.length / 1024).toFixed(0)} KB`);
  } else {
    buffer = readFileSync(filePathOrUrl);
  }

  const data = await pdfParse(buffer);
  return data.text;
}

/**
 * Segmentuje text PDF čísla na jednotlivé články pomocí Gemini AI.
 * Vrátí pole článků připravených pro import.
 */
async function segmentPdfToArticles(text, year, issueNumber) {
  if (!GEMINI_API_KEY) {
    console.error("Chyba: GEMINI_API_KEY musí být nastaveno pro zpracování PDF.");
    process.exit(1);
  }

  // Gemini má limit ~1M tokenů; PDF Českého zápasu (~20 stran) by mělo vejít celé.
  // Bezpečně ořežeme na 80 000 znaků.
  const textChunk = text.length > 80000 ? text.substring(0, 80000) + "\n\n[TEXT ZKRÁCEN]" : text;

  const prompt = `Jsi asistent pro zpracování textů z týdeníku Český zápas (CČSH - Církev československá husitská).
Níže je text extrahovaný z PDF čísla ${issueNumber}/${year}.

Identifikuj jednotlivé OBSAHOVÉ články a vrať je jako JSON pole. Zahrň pouze:
- kázání / promluvy / homilie (content_type: "kazani")
- teologické a duchovní články (content_type: "clanek")
- komentáře k čtením / zamyšlení (content_type: "komentar")

VYNECH: redakční oznámení, inzeráty, zprávy ze sborů, tabulky příspěvků, obsah čísla, záhlaví a zápatí stránek, personální oznámení, nekrology kratší než 200 slov.

Pro každý článek vrať JSON objekt:
{
  "title": "Přesný název článku",
  "author": "Jméno autora nebo null (pokud není uveden)",
  "content_type": "kazani" nebo "clanek" nebo "komentar",
  "liturgical_context": "Název neděle nebo svátku (např. '2. neděle postní', 'Hod Boží vánoční') nebo null",
  "biblical_refs_raw": "Biblický odkaz citovaný v záhlaví/nadpisu článku nebo null",
  "content": "Celý text článku doslova"
}

Vrať POUZE JSON pole (bez markdown backticks, bez vysvětlení). Pokud nenajdeš žádný vhodný článek, vrať [].

TEXT Z PDF:
${textChunk}`;

  console.log("  → Odesílám text Gemini AI k segmentaci na články...");

  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GEMINI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gemini-2.0-flash",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`  ✗ Gemini API error ${res.status}: ${errText.substring(0, 200)}`);
    process.exit(1);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "[]";

  try {
    const parsed = JSON.parse(content);
    // Gemini may return { articles: [...] } or just [...]
    const articles = Array.isArray(parsed)
      ? parsed
      : (parsed.articles || parsed.items || parsed.clanek || parsed.clanky || []);

    // Inject year and issue_number into every article
    return articles.map((a) => ({
      ...a,
      year,
      issue_number: issueNumber,
    }));
  } catch (e) {
    console.error("  ✗ Nepodařilo se zparsovat odpověď Gemini:", content.substring(0, 300));
    process.exit(1);
  }
}

/**
 * Extrahuje biblické reference z textu pomocí Gemini AI.
 * Vrátí pole normalizovaných odkazů, např. ["Mt 4,1-11", "Lk 9,28-36"]
 */
async function extractBiblicalRefs(text, rawRef) {
  // If raw ref is explicitly provided and non-empty, try to parse it first
  if (rawRef && rawRef.trim()) {
    return [rawRef.trim()];
  }

  if (!GEMINI_API_KEY) {
    console.warn("  ⚠ GEMINI_API_KEY není nastaveno — biblical_refs zůstanou prázdné.");
    return [];
  }

  const prompt = `Z následujícího textu kázání/článku extrahuj všechny explicitní biblické reference (citáty nebo přímé odkazy na konkrétní verše). Vrať JSON pole řetězců ve formátu "Zkratka kap,verš" (např. "Mt 4,1-11", "Gn 12,1-4a", "Ř 8,28"). Pokud nejsou žádné explicitní reference, vrať prázdné pole []. Vrať POUZE JSON pole, žádný další text.\n\nTEXT:\n${text.substring(0, 3000)}`;

  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GEMINI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gemini-2.0-flash",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    console.warn(`  ⚠ Gemini error ${res.status} — biblical_refs zůstanou prázdné.`);
    return [];
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "[]";
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : (parsed.refs || parsed.references || []);
  } catch {
    return [];
  }
}

/**
 * Získá nejvyšší article_number z DB pro auto-increment.
 */
async function getNextArticleNumber() {
  const { data } = await supabase
    .from("czech_zapas_articles")
    .select("article_number")
    .order("article_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.article_number || 0) + 1;
}

/**
 * Zparsuje command-line argumenty.
 * Vrátí { inputFile, year, issue }.
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let inputFile = null;
  let year = null;
  let issue = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--year" && args[i + 1]) {
      year = parseInt(args[++i]);
    } else if (args[i] === "--issue" && args[i + 1]) {
      issue = parseInt(args[++i]);
    } else if (!inputFile && !args[i].startsWith("--")) {
      inputFile = args[i];
    }
  }

  return { inputFile, year, issue };
}

async function main() {
  const { inputFile, year: yearArg, issue: issueArg } = parseArgs();

  if (!inputFile) {
    console.error("Použití:");
    console.error("  node scripts/import-czech-zapas.mjs <soubor.json>");
    console.error("  node scripts/import-czech-zapas.mjs <soubor.pdf> [--year YYYY] [--issue N]");
    process.exit(1);
  }

  const isUrl = inputFile.startsWith("http://") || inputFile.startsWith("https://");
  const filePath = isUrl ? inputFile : resolve(process.cwd(), inputFile);
  const isPdf = inputFile.toLowerCase().endsWith(".pdf");

  let articles;

  if (isPdf) {
    // ── PDF mode ──────────────────────────────────────────────────────────
    let year = yearArg;
    let issueNumber = issueArg;

    // Try to detect from filename if not provided
    if (!year || !issueNumber) {
      const detected = detectYearAndIssue(inputFile);
      if (detected) {
        year = year || detected.year;
        issueNumber = issueNumber || detected.issue;
        console.log(`  → Rozpoznáno z názvu souboru: ročník ${year}, číslo ${issueNumber}`);
      }
    }

    if (!year || !issueNumber) {
      console.error("Chyba: Pro PDF musí být zadán rok a číslo (--year YYYY --issue N).");
      console.error("Nebo pojmenuj soubor ve formátu cz2024-12.pdf pro automatickou detekci.");
      process.exit(1);
    }

    const source = isUrl ? inputFile : inputFile;
    console.log(`\nZpracovávám PDF: ${source} (ročník ${year}, číslo ${issueNumber})\n`);

    // Extract text from PDF (local file or URL)
    if (!isUrl) process.stdout.write("  → Extrahuji text z PDF... ");
    let pdfText;
    try {
      pdfText = await extractTextFromPdf(filePath);
      if (!isUrl) console.log(`${pdfText.length.toLocaleString("cs")} znaků`);
      else console.log(`  → Extrahováno ${pdfText.length.toLocaleString("cs")} znaků`);
    } catch (e) {
      console.error(`\n  ✗ Chyba při čtení PDF: ${e.message}`);
      process.exit(1);
    }

    // Segment into articles using Gemini
    articles = await segmentPdfToArticles(pdfText, year, issueNumber);

    if (!articles || articles.length === 0) {
      console.log("  ⚠ Gemini nenašel žádné vhodné články v tomto PDF.");
      process.exit(0);
    }

    console.log(`  → Gemini identifikoval ${articles.length} článků\n`);

  } else {
    // ── JSON mode ─────────────────────────────────────────────────────────
    try {
      articles = JSON.parse(readFileSync(filePath, "utf8"));
    } catch (e) {
      console.error(`Chyba při čtení souboru: ${e.message}`);
      process.exit(1);
    }

    if (!Array.isArray(articles)) {
      console.error("Vstupní JSON soubor musí obsahovat pole článků.");
      process.exit(1);
    }

    console.log(`\nImportuji ${articles.length} článků z ${inputFile}...\n`);
  }

  let nextNum = await getNextArticleNumber();
  let imported = 0;
  let skipped = 0;

  for (const article of articles) {
    if (!article.title || !article.content || !article.year || !article.issue_number) {
      console.warn(`  ⚠ Přeskakuji článek bez povinných polí: ${JSON.stringify(article).substring(0, 80)}`);
      skipped++;
      continue;
    }

    const sourceRef = `Český zápas, ročník ${article.year}, číslo ${article.issue_number}`;
    console.log(`  [${nextNum}] ${article.title} (${sourceRef})`);
    if (article.author) console.log(`         Autor: ${article.author}`);

    // Extract biblical references
    process.stdout.write("    → Extrahuji biblické reference... ");
    const refs = await extractBiblicalRefs(article.content, article.biblical_refs_raw);
    console.log(refs.length > 0 ? refs.join(", ") : "(žádné nalezeny)");

    const row = {
      article_number: nextNum,
      title: article.title,
      author: article.author || null,
      biblical_references: refs,
      biblical_refs_raw: article.biblical_refs_raw || null,
      liturgical_context: article.liturgical_context || null,
      content_type: article.content_type || "kazani",
      year: article.year,
      issue_number: article.issue_number,
      source_ref: sourceRef,
      content: article.content,
      is_active: true,
    };

    const { error } = await supabase
      .from("czech_zapas_articles")
      .upsert(row, { onConflict: "article_number" });

    if (error) {
      console.error(`    ✗ Chyba při ukládání: ${error.message}`);
      skipped++;
    } else {
      console.log("    ✓ Uloženo");
      imported++;
      nextNum++;
    }
  }

  console.log(`\nHotovo: ${imported} importováno, ${skipped} přeskočeno.`);
  if (imported > 0) {
    console.log("\nTip: Po importu spusť warm-cache pro pre-generaci AI výstupů:");
    console.log("  supabase functions invoke warm-cache --no-verify-jwt");
  }
}

main().catch((e) => {
  console.error("Fatální chyba:", e.message);
  process.exit(1);
});
