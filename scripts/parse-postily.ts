/**
 * Parser for Karel Farský's Postily (1921–1924).
 * Reads the OCR-extracted text and splits it into individual postils
 * with structured metadata.
 *
 * Usage: npx tsx scripts/parse-postily.ts /tmp/postily.txt > scripts/postily.json
 */

import { readFileSync } from "fs";
import { normalizeBiblicalRef } from "../supabase/functions/_shared/biblical-refs.ts";

interface Postila {
  postil_number: number;
  title: string;
  biblical_references: string[];
  biblical_refs_raw: string;
  liturgical_context: string;
  year: number;
  issue_number: number;
  source_ref: string;
  biblical_text: string;
  content: string;
}

// normalizeBiblicalRef is imported from the shared module above

/**
 * Extract biblical references from the raw parenthetical text.
 * Handles patterns like:
 * - "(Mat. 22, 37—46.)"
 * - "(Ned. I. postní: Mat. 4, 1—11.)"
 * - "(Epištola k Řím. 8, 12—17.)"
 * - "(Ned. 2. adventní: Mat. 11, 2—10.)"
 */
function extractBiblicalRefs(raw: string): { refs: string[]; liturgical: string } {
  let liturgical = "";
  let refText = raw.replace(/^\(/, "").replace(/\)\s*$/, "").trim();

  // Extract liturgical context: "Ned. I. postní:" or "Ned. 25. po sv. D."
  const litMatch = refText.match(/^((?:Ned|Neděle|Sv[áa]tek|Nanebevstoup|Letnice|Velikonoce|Advent|Vánoce|Půst)[^:)]*?):\s*/i);
  if (litMatch) {
    liturgical = litMatch[1].trim();
    refText = refText.substring(litMatch[0].length);
  } else {
    // Try matching "Ned. 25. po sv. D. — ..." or "Ned. 25. po sv. D., ..." pattern
    const litMatch2 = refText.match(/^(Ned\.?\s*\d+\.?\s*(?:po\s+)?(?:sv\.\s*D\.?|po\s+Třech\s+králích|adventní|postní|velikon|po\s+Zjev)[^,—–-]*?)\s*[,—–-]\s*/i);
    if (litMatch2) {
      liturgical = litMatch2[1].trim();
      refText = refText.substring(litMatch2[0].length);
    }
  }

  // Split multiple refs: "Mat. 4, 1—11.) (Epištola I. Sol. 4, 1—7.)"
  // or "Epištola k Řím. 8, 12—17" after the liturgical part
  const refs: string[] = [];

  // Remove common prefixes from references
  refText = refText.replace(/Epištola\s*(?:k\s*)?/gi, "").trim();
  refText = refText.replace(/Evangelium\s*/gi, "").trim();

  // Split on ") (" or ";" or " — " between references
  const parts = refText.split(/\)\s*\(?|;\s*/);

  for (const part of parts) {
    const cleaned = part.replace(/[()]/g, "").trim();
    if (!cleaned) continue;

    // Must contain at least one digit to be a biblical reference
    if (/\d/.test(cleaned)) {
      const normalized = normalizeBiblicalRef(cleaned);
      if (normalized) refs.push(normalized);
    }
  }

  return { refs, liturgical };
}

// ---------- Main parser ----------

function parsePostily(filePath: string): Postila[] {
  const text = readFileSync(filePath, "utf-8");
  const lines = text.split("\n");

  // Find all "Český zápas" lines — these mark the start of each postil
  const czLines: { lineIdx: number; year: number; issue: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/Český\s*zápas\s*,?\s*ročník\s*(\d{4})\s*,?\s*číslo\s*(\d{1,2})/i);
    if (match) {
      czLines.push({ lineIdx: i, year: parseInt(match[1]), issue: parseInt(match[2]) });
    }
  }

  const postily: Postila[] = [];

  for (let czIdx = 0; czIdx < czLines.length; czIdx++) {
    const cz = czLines[czIdx];
    const nextCzLine = czIdx + 1 < czLines.length ? czLines[czIdx + 1].lineIdx : lines.length;

    // Look backward for postil number (within 10 lines before CZ line)
    // OCR sometimes omits the dot after the number, so we match with or without it.
    // We also skip obvious page numbers (3-digit numbers > 170 which is max postil count).
    let postilNumber = 0;
    const expectedNumber = postily.length + 1; // sequential expectation
    for (let back = cz.lineIdx - 1; back >= Math.max(0, cz.lineIdx - 10); back--) {
      const numMatch = lines[back].match(/^(\d{1,3})\.?\s*$/);
      if (numMatch) {
        const candidate = parseInt(numMatch[1]);
        // Accept if it's close to expected sequence (within ±5) or if it has a dot
        const hasDot = lines[back].includes(".");
        if (hasDot || (candidate >= expectedNumber - 5 && candidate <= expectedNumber + 5)) {
          postilNumber = candidate;
          break;
        }
      }
    }

    // Skip optional "(Upraveno v Naší postyle,...)" line — OCR may produce variants like "(Opravenov Našípostyle,...)"
    let cursor = cz.lineIdx + 1;
    while (cursor < nextCzLine && lines[cursor].trim() === "") cursor++;
    if (cursor < nextCzLine && /^\((?:Upraven|Opraven).*postyl/i.test(lines[cursor].trim())) {
      cursor++;
      while (cursor < nextCzLine && lines[cursor].trim() === "") cursor++;
    }

    // Collect TITLE lines (uppercase or mixed, until we hit a line starting with "(")
    const titleLines: string[] = [];
    while (cursor < nextCzLine) {
      const line = lines[cursor].trim();
      if (line === "") {
        cursor++;
        continue;
      }
      // Biblical reference line starts with "("
      if (line.startsWith("(")) break;
      // Quoted biblical text starts with ",," or "„" or "«"
      if (/^[,,„«]/.test(line) && titleLines.length > 0) break;
      titleLines.push(line);
      cursor++;
    }

    const title = titleLines
      .join(" ")
      .replace(/\s+/g, " ")
      .replace(/[„"",,]/g, '"')
      .trim();

    if (!title) {
      console.error(`Warning: empty title for postil near line ${cz.lineIdx}, source: Český zápas, ročník ${cz.year}, číslo ${cz.issue}`);
    }

    // Extract biblical reference(s)
    let biblicalRefsRaw = "";
    let liturgicalContext = "";
    let biblicalRefs: string[] = [];

    if (cursor < nextCzLine && lines[cursor].trim().startsWith("(")) {
      // Collect full reference (may span multiple lines)
      let refText = "";
      while (cursor < nextCzLine) {
        refText += " " + lines[cursor].trim();
        cursor++;
        if (refText.includes(")")) break;
      }
      biblicalRefsRaw = refText.trim();

      // There might be a second reference in parentheses on the next line
      while (cursor < nextCzLine && lines[cursor].trim() === "") cursor++;
      if (cursor < nextCzLine && lines[cursor].trim().startsWith("(Epištola") ||
          (cursor < nextCzLine && lines[cursor].trim().startsWith("(") && /\d/.test(lines[cursor].trim()))) {
        let refText2 = "";
        while (cursor < nextCzLine) {
          refText2 += " " + lines[cursor].trim();
          cursor++;
          if (refText2.includes(")")) break;
        }
        biblicalRefsRaw += " " + refText2.trim();
      }

      const extracted = extractBiblicalRefs(biblicalRefsRaw);
      biblicalRefs = extracted.refs;
      liturgicalContext = extracted.liturgical;
    }

    // Skip blank lines
    while (cursor < nextCzLine && lines[cursor].trim() === "") cursor++;

    // Collect the rest as content
    const contentLines: string[] = [];
    for (let i = cursor; i < nextCzLine; i++) {
      const line = lines[i].trim();
      // Stop at standalone page numbers
      if (/^\d{1,3}$/.test(line) && i > cursor + 5) continue;
      contentLines.push(lines[i]);
    }

    let fullContent = contentLines.join("\n").trim();

    // Try to split biblical_text (quoted text) from commentary
    let biblicalText = "";
    let commentary = fullContent;

    // Biblical text typically starts with „ or ,, and is the first paragraph
    const quoteMatch = fullContent.match(/^([,,„«"].+?)(?:\n\n|\n(?=[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]))/s);
    if (quoteMatch) {
      biblicalText = quoteMatch[1].trim();
      commentary = fullContent.substring(quoteMatch[0].length).trim();
    }

    const sourceRef = `Český zápas, ročník ${cz.year}, číslo ${cz.issue}`;

    postily.push({
      postil_number: postilNumber,
      title,
      biblical_references: biblicalRefs,
      biblical_refs_raw: biblicalRefsRaw,
      liturgical_context: liturgicalContext,
      year: cz.year,
      issue_number: cz.issue,
      source_ref: sourceRef,
      biblical_text: biblicalText,
      content: commentary || fullContent,
    });
  }

  // Second pass: fill in missing postil numbers by interpolation
  for (let i = 0; i < postily.length; i++) {
    if (postily[i].postil_number !== 0) continue;

    // Find nearest known numbers before and after
    let prevNum = 0;
    for (let j = i - 1; j >= 0; j--) {
      if (postily[j].postil_number > 0) { prevNum = postily[j].postil_number; break; }
    }
    let nextNum = 0;
    let nextIdx = 0;
    for (let j = i + 1; j < postily.length; j++) {
      if (postily[j].postil_number > 0) { nextNum = postily[j].postil_number; nextIdx = j; break; }
    }

    // Interpolate: assign prevNum + offset
    if (prevNum > 0) {
      // Count how many unknowns are between prev known and this
      let gap = 0;
      for (let j = i; j >= 0; j--) {
        if (postily[j].postil_number > 0) break;
        gap++;
      }
      postily[i].postil_number = prevNum + gap;
    } else if (nextNum > 0) {
      // Count backwards from next known
      let gap = 0;
      for (let j = i; j < postily.length; j++) {
        if (postily[j].postil_number > 0) break;
        gap++;
      }
      postily[i].postil_number = nextNum - gap;
    }
  }

  return postily;
}

// ---------- Run ----------

const inputPath = process.argv[2] || "/tmp/postily.txt";
const postily = parsePostily(inputPath);

// Output stats to stderr
console.error(`Parsed ${postily.length} postils`);
console.error(`Years: ${[...new Set(postily.map(p => p.year))].sort().join(", ")}`);
console.error(`With biblical refs: ${postily.filter(p => p.biblical_references.length > 0).length}`);
console.error(`Without number: ${postily.filter(p => p.postil_number === 0).length}`);

// Output JSON to stdout
console.log(JSON.stringify(postily, null, 2));
