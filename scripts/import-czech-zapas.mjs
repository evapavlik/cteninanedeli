/**
 * import-czech-zapas.mjs
 * Importuje kázání z Českého zápasu do Supabase tabulky `czech_zapas_articles`.
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
 *     "biblical_refs_raw": "Mt 4,1-11",   // nebo null
 *     "content": "Plný text článku..."
 *   }
 * ]
 *
 * Formát PDF: celé číslo Českého zápasu. Skript deterministicky najde sekci
 * "Nad písmem" a importuje kázání — bez AI.
 * Rok a číslo se detekují z názvu souboru/URL (např. cz2024-12.pdf) nebo je zadejte ručně.
 *
 * Vyžaduje proměnné prostředí:
 *   VITE_SUPABASE_URL  — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (pro zápis)
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
 * Extrahuje biblické reference z textu pomocí regexu.
 * Vrátí pole odkazů, např. ["J 3,1-17", "Mt 4,1-11"]
 */
function parseBiblicalRefs(text) {
  const refs = [];
  const re = /\b([JRŽA-Z][a-záčďéěíňóřšťúůýž]{0,4})\s+(\d+),(\d+(?:[–-]\d+)?[abc]?)\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    refs.push(m[0]);
  }
  return refs;
}

/** Řádky signalizující novou sekci CZ (musí být na začátku řádku) */
const SECTION_BOUNDARY_RE =
  /^(Ze\s+sbor|Z\s+teologie|Z\s+ekumen|Bohoslužb|Oznámen|Přehled|Rozhovor|Zpráv|Inzerce|Vydavatel|Ročník\s+\d|Nad\s+p[ií]smem|EDITORIAL|OBSAH|Na\s+okraj|Dopis|Ohlédnut|Pro\s+d[eě]ti|Pozvánk)/i;

/** PDF artefakty signalizující, že jsme mimo kázání (záhlaví/zápatí stránky, ISSN atd.) */
const PAGE_BOUNDARY_RE =
  /ISSN\s+\d|MK\s+[ČC]\s*R\s+E\s+\d|[ČC]\s*eský\s+zápas\s+\d+\s*•|\d+\s*•\s*[ČC]\s*eský/i;

/**
 * Deterministicky parsuje sekci "Nad písmem" z extrahovaného textu PDF.
 * Nevyžaduje AI. Vrátí článek nebo null, pokud sekce není nalezena.
 */
function parseNadPismem(rawText, year, issueNumber) {
  // Spojení dělení slov pomlčkou (časté při extrakci z PDF)
  const text = rawText
    .replace(/([a-záčďéěíňóřšťúůýž])-\n([a-záčďéěíňóřšťúůýž])/g, "$1$2")
    .replace(/\r\n/g, "\n");

  const lines = text.split("\n");

  // Najít záhlaví sekce — flexibilní detekce
  const NAD_PISMEM_RE = /nad\s+p[ií]smem[:\s]*/i;
  const NAD_PISMEM_SPLIT_RE = /nad\s+p\s*[ií]\s*s\s*m\s*e\s*m/i;
  // Prefer heading at start of line
  let headerIdx = lines.findIndex((l) => /^nad\s+p[ií]smem/i.test(l.trim()));
  // Fallback: heading embedded anywhere in a line
  if (headerIdx === -1) {
    headerIdx = lines.findIndex((l) => NAD_PISMEM_RE.test(l));
  }
  // Fallback: diacritic-split form ("Nad P í smem")
  if (headerIdx === -1) {
    headerIdx = lines.findIndex((l) => NAD_PISMEM_SPLIT_RE.test(l));
  }
  if (headerIdx === -1) return null;

  const headerLine = lines[headerIdx].trim();
  const headingMatch = NAD_PISMEM_RE.exec(headerLine);
  const restAfterHeader = headingMatch
    ? headerLine.slice(headingMatch.index + headingMatch[0].length).trim()
    : "";

  let titleIdx;
  let titleLine;
  if (restAfterHeader.length > 0) {
    titleIdx = headerIdx;
    titleLine = restAfterHeader;
  } else {
    titleIdx = headerIdx + 1;
    while (titleIdx < lines.length && lines[titleIdx].trim() === "") titleIdx++;
    if (titleIdx >= lines.length) return null;
    titleLine = lines[titleIdx].trim();
  }

  let refsInTitle = parseBiblicalRefs(titleLine);
  let title = titleLine;
  let biblical_refs_raw = null;

  if (refsInTitle.length > 0) {
    const firstRefPos = titleLine.indexOf(refsInTitle[0]);
    title = titleLine.substring(0, firstRefPos).trim().replace(/\s*[([\s]+$/, "");
    biblical_refs_raw = refsInTitle.join("; ");
  }

  // Refs may be on the next non-empty line
  let extraLinesConsumed = 0;
  if (refsInTitle.length === 0) {
    let refLineIdx = titleIdx + 1;
    while (refLineIdx < lines.length && lines[refLineIdx].trim() === "") refLineIdx++;
    if (refLineIdx < lines.length) {
      const candidate = lines[refLineIdx].trim();
      const refsOnNextLine = parseBiblicalRefs(candidate);
      if (refsOnNextLine.length > 0) {
        const stripped = candidate.replace(/\b([JRŽA-Z][a-záčďéěíňóřšťúůýž]{0,4})\s+(\d+),(\d+(?:[–-]\d+)?[abc]?)\b/g, "").replace(/[;,\s()[\]]+/g, "").trim();
        if (stripped.length === 0) {
          refsInTitle = refsOnNextLine;
          biblical_refs_raw = refsOnNextLine.join("; ");
          extraLinesConsumed = refLineIdx - titleIdx;
        }
      }
    }
  }

  // Sbíráme tělo článku (typické kázání = 40–70 řádků + ~20 řádků liturgického úvodu)
  const STANDALONE_NAME_RE =
    /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+(?:\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+){1,3}$/;
  const bodyLines = [];
  for (let i = titleIdx + 1 + extraLinesConsumed; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const looksLikeSectionHeader =
      trimmed.length > 0 &&
      SECTION_BOUNDARY_RE.test(trimmed) &&
      !/\.\s/.test(trimmed);
    const looksLikePageBoundary = PAGE_BOUNDARY_RE.test(trimmed);
    if (looksLikeSectionHeader || looksLikePageBoundary) break;

    // Detect standalone author name after substantial body content
    if (
      bodyLines.length >= 20 &&
      trimmed.length > 3 &&
      trimmed.length < 50 &&
      STANDALONE_NAME_RE.test(trimmed) &&
      !/[.!?,;:0-9]/.test(trimmed)
    ) {
      bodyLines.push(lines[i]);
      break;
    }

    bodyLines.push(lines[i]);
    if (bodyLines.length >= 120) break;
  }

  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === "") {
    bodyLines.pop();
  }

  if (bodyLines.length === 0) return null;

  // Last non-empty line is the author's name.
  // Sometimes author appears on same line as closing sentence:
  // "také uvěřili. Lucie Haltofová" — detect and split.
  const lastBodyLine = bodyLines[bodyLines.length - 1].trim();
  const NAME_SUFFIX_RE =
    /^(.+[.!?…])\s+([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+(?:\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+){1,3})\s*$/;
  const nameSuffixMatch = NAME_SUFFIX_RE.exec(lastBodyLine);

  let author;
  let content;
  if (nameSuffixMatch) {
    author = nameSuffixMatch[2];
    content = [...bodyLines.slice(0, -1), nameSuffixMatch[1]].join("\n").trim();
  } else {
    author = lastBodyLine || null;
    content = bodyLines.slice(0, -1).join("\n").trim();
  }

  const liturgicalMatch = content.match(
    /\b(\d+\.\s+ned[eě]l[ei]\s+\w+|Hod\s+Bo[žz][íi]\s+\w+|[Vv]elikonoční\s+ned[eě]l[ai]|[Pp]ůst[ní]*\s+ned[eě]l[ei])/,
  );
  const liturgical_context = liturgicalMatch ? liturgicalMatch[0].trim() : null;

  return {
    title,
    author,
    biblical_refs_raw,
    biblical_references: refsInTitle,
    content_type: "kazani",
    liturgical_context,
    content,
    year,
    issue_number: issueNumber,
  };
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

    // Deterministicky parsujeme sekci "Nad písmem"
    const parsed = parseNadPismem(pdfText, year, issueNumber);

    if (!parsed) {
      console.log("  ⚠ Sekce „Nad písmem" nebyla v PDF nalezena.");
      process.exit(0);
    }

    articles = [parsed];
    console.log(`  → Nalezena sekce „Nad písmem": „${parsed.title}"\n`);

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

    // Biblical references — z názvu nebo z textu (regex)
    const refs = article.biblical_references?.length
      ? article.biblical_references
      : parseBiblicalRefs(article.biblical_refs_raw || article.content?.substring(0, 500) || "");
    console.log(`    → Biblické reference: ${refs.length > 0 ? refs.join(", ") : "(žádné nalezeny)"}`);

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
