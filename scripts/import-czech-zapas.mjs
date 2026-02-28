/**
 * import-czech-zapas.mjs
 * Importuje články z Českého zápasu do Supabase tabulky `czech_zapas_articles`.
 *
 * Použití:
 *   node scripts/import-czech-zapas.mjs <soubor.json>
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
 * Vyžaduje proměnné prostředí:
 *   VITE_SUPABASE_URL  — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (pro zápis)
 *   GEMINI_API_KEY — pro extrakci biblických odkazů pomocí AI (volitelné)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

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
 * Extrahuje biblické reference z textu pomocí Gemini AI.
 * Vrátí pole normalizovaných odkazů, např. ["Mt 4,1-11", "Lk 9,28-36"]
 */
async function extractBiblicalRefs(text, rawRef) {
  // If raw ref is explicitly provided and non-empty, try to parse it first
  if (rawRef && rawRef.trim()) {
    // Return as single-element array — the DB will handle it
    // (For proper normalization, this would call biblical-refs normalization logic)
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

async function main() {
  const inputFile = process.argv[2];
  if (!inputFile) {
    console.error("Použití: node scripts/import-czech-zapas.mjs <soubor.json>");
    process.exit(1);
  }

  let articles;
  try {
    articles = JSON.parse(readFileSync(resolve(process.cwd(), inputFile), "utf8"));
  } catch (e) {
    console.error(`Chyba při čtení souboru: ${e.message}`);
    process.exit(1);
  }

  if (!Array.isArray(articles)) {
    console.error("Vstupní soubor musí obsahovat JSON pole článků.");
    process.exit(1);
  }

  console.log(`\nImportuji ${articles.length} článků z ${inputFile}...\n`);

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
