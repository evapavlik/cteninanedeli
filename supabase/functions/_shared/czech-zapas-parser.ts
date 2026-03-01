/**
 * Deterministic parser for the "Nad písmem" section of Český zápas.
 * No AI required — operates on plain text extracted from PDF.
 *
 * Section structure (two common variants):
 *   Variant A — title and ref on same line:
 *     Nad Písmem
 *     [Sermon title] [Biblical reference, e.g. J 3,1–13]
 *     [Sermon body...]
 *     FirstName LastName
 *
 *   Variant B — ref on its own line (common in recent issues):
 *     Nad Písmem
 *     [Sermon title]
 *     [Biblical reference, e.g. J 3,1-17]
 *     [Sermon body...]
 *     FirstName LastName
 */

export interface ParsedArticle {
  title: string;
  author: string | null;
  biblical_refs_raw: string | null;
  biblical_references: string[];
  content_type: "kazani";
  liturgical_context: string | null;
  content: string;
}

/**
 * Regex for Czech-style biblical references.
 * Covers: J 3,1-17 · Mt 4,1-11 · Gn 12,1-4a · Ž 22,1 · Kor 1,18-31 etc.
 */
const BIBLICAL_REF_RE =
  /\b([JRŽA-Z][a-záčďéěíňóřšťúůýž]{0,4})\s+(\d+),(\d+(?:[-–]\d+)?[abc]?)\b/g;

/** Extracts all biblical references from a string. */
export function parseBiblicalRefs(text: string): string[] {
  const refs: string[] = [];
  const re = new RegExp(BIBLICAL_REF_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    refs.push(m[0]);
  }
  return refs;
}

/** Lines that signal the start of a new CZ section. */
const SECTION_BOUNDARY_RE =
  /^(Ze\s+sbor|Z\s+teologie|Bohoslužb|Oznámen|Přehled|Rozhovor|Zpráv|Inzerce|Vydavatel|Ročník\s+\d|Nad\s+p[ií]smem|EDITORIAL|OBSAH|Na\s+okraj|Dopis|Ohlédnut)/i;

/**
 * Parses the "Nad písmem" section from extracted PDF text.
 * Returns null if the section is not found.
 */
export function parseNadPismem(
  rawText: string,
  year: number,
  issueNumber: number,
): ParsedArticle | null {
  // Normalize: rejoin words hyphenated across line breaks (common in PDF extraction)
  // e.g. "při-\nchází" → "přichází"
  const text = rawText
    .replace(/([a-záčďéěíňóřšťúůýž])-\n([a-záčďéěíňóřšťúůýž])/g, "$1$2")
    .replace(/\r\n/g, "\n");

  const lines = text.split("\n");

  // Find the line containing "Nad Písmem" / "Nad písmem".
  // Handles:
  //   - header on its own line: "Nad Písmem"
  //   - header + title on same line: "Nad Písmem Dokážeme říct Ne? (L 4,1–13)"
  //   - header embedded mid-line: "...předchozí text Nad Písmem" (PDF sometimes
  //     omits newlines before section headings due to hasEOL not being set)
  //   - header with trailing colon: "Nad písmem:"
  //   - diacritic-split artifact: "Nad P í smem" (pdfjs + special Czech font)
  const NAD_PISMEM_RE = /nad\s+p[ií]smem[:\s]*/i;
  // Ultra-flexible: allow spaces within "písmem" (pdfjs diacritic-split artifact)
  const NAD_PISMEM_SPLIT_RE = /nad\s+p\s*[ií]\s*s\s*m\s*e\s*m/i;
  // Prefer a line where the heading starts at the beginning
  let headerIdx = lines.findIndex((l) => /^nad\s+p[ií]smem/i.test(l.trim()));
  // Fallback: heading embedded anywhere in a line
  if (headerIdx === -1) {
    headerIdx = lines.findIndex((l) => NAD_PISMEM_RE.test(l));
  }
  // Fallback: diacritic-split form ("Nad P í smem") — pdfjs artifact
  if (headerIdx === -1) {
    headerIdx = lines.findIndex((l) => NAD_PISMEM_SPLIT_RE.test(l));
  }
  if (headerIdx === -1) return null;

  const headerLine = lines[headerIdx].trim();
  const headingMatch = NAD_PISMEM_RE.exec(headerLine);
  const restAfterHeader = headingMatch
    ? headerLine.slice(headingMatch.index + headingMatch[0].length).trim()
    : "";

  let titleIdx: number;
  let titleLine: string;
  if (restAfterHeader.length > 0) {
    // Header and title are on the same line
    titleIdx = headerIdx;
    titleLine = restAfterHeader;
  } else {
    // Header is alone; first non-empty line after it is the title
    titleIdx = headerIdx + 1;
    while (titleIdx < lines.length && lines[titleIdx].trim() === "") titleIdx++;
    if (titleIdx >= lines.length) return null;
    titleLine = lines[titleIdx].trim();
  }

  // Extract biblical references from the title line
  let refsInTitle = parseBiblicalRefs(titleLine);
  let title = titleLine;
  let biblical_refs_raw: string | null = null;
  // How many extra lines after the title were consumed for the biblical ref
  let extraLinesConsumed = 0;

  if (refsInTitle.length > 0) {
    // Refs are on the same line as the title
    // e.g. "Dokážeme říct Ne? (L 4,1–13)" → title + ref on same line
    const firstRefPos = titleLine.indexOf(refsInTitle[0]);
    title = titleLine.substring(0, firstRefPos).trim().replace(/\s*[([\s]+$/, "");
    biblical_refs_raw = refsInTitle.join("; ");
  } else {
    // Refs may be on the next non-empty line (common in Český zápas layout):
    //   Název textu       ← titleLine
    //   J 3,1-17          ← refs on their own line
    //   Milé sestry...    ← body
    let refLineIdx = titleIdx + 1;
    while (refLineIdx < lines.length && lines[refLineIdx].trim() === "") refLineIdx++;
    if (refLineIdx < lines.length) {
      const candidate = lines[refLineIdx].trim();
      const refsOnNextLine = parseBiblicalRefs(candidate);
      // Accept the line as a ref-only line if it consists entirely of refs
      // (i.e. removing all refs leaves nothing meaningful behind)
      if (refsOnNextLine.length > 0) {
        const stripped = candidate.replace(new RegExp(BIBLICAL_REF_RE.source, "g"), "").replace(/[;,\s()[\]]+/g, "").trim();
        if (stripped.length === 0) {
          refsInTitle = refsOnNextLine;
          biblical_refs_raw = refsOnNextLine.join("; ");
          extraLinesConsumed = refLineIdx - titleIdx; // skip this line when collecting body
        }
      }
    }
  }

  // Collect body lines until we hit a new section header or the safety limit
  const bodyLines: string[] = [];
  for (let i = titleIdx + 1 + extraLinesConsumed; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // A real section header never contains a mid-sentence period
    // ("rozhovor. Hned…" is body text, not the "Rozhovor" section header)
    const looksLikeSectionHeader =
      trimmed.length > 0 &&
      SECTION_BOUNDARY_RE.test(trimmed) &&
      !/\.\s/.test(trimmed);
    if (looksLikeSectionHeader) break;
    bodyLines.push(lines[i]);
    if (bodyLines.length >= 400) break; // safety limit
  }

  // Trim trailing empty lines
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === "") {
    bodyLines.pop();
  }

  if (bodyLines.length === 0) return null;

  // Last non-empty line is the author's name.
  // Sometimes the author appears on the same line as the closing sentence:
  // "také uvěřili. Lucie Haltofová" — detect and split.
  const lastBodyLine = bodyLines[bodyLines.length - 1].trim();
  const NAME_SUFFIX_RE =
    /^(.+[.!?…])\s+([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+(?:\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+){1,3})\s*$/;
  const nameSuffixMatch = NAME_SUFFIX_RE.exec(lastBodyLine);

  let author: string | null;
  let content: string;
  if (nameSuffixMatch) {
    author = nameSuffixMatch[2];
    content = [...bodyLines.slice(0, -1), nameSuffixMatch[1]].join("\n").trim();
  } else {
    author = lastBodyLine || null;
    content = bodyLines.slice(0, -1).join("\n").trim();
  }

  // Attempt to extract liturgical context (e.g. "2. neděle postní")
  const liturgicalMatch = content.match(
    /\b(\d+\.\s+ned[eě]l[ei]\s+\w+|Hod\s+Bo[žz][íi]\s+\w+|[Vv]elikonoční\s+ned[eě]l[ai]|[Kk]větnou\s+ned[eě]l[ei]|[Ss]lavnost\s+\w+|[Pp]ůst[ní]*\s+ned[eě]l[ei])/,
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
  };
}
