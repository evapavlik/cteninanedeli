/**
 * Deterministic parser for the "Nad písmem" section of Český zápas.
 * No AI required — operates on plain text extracted from PDF.
 *
 * Section structure (three common variants):
 *   Variant A — title and ref on same line (forward):
 *     Nad Písmem
 *     [Sermon title] [Biblical reference, e.g. J 3,1–13]
 *     [Sermon body...]
 *     FirstName LastName
 *
 *   Variant B — ref on its own line (forward, common in recent issues):
 *     Nad Písmem
 *     [Sermon title]
 *     [Biblical reference, e.g. J 3,1-17]
 *     [Sermon body...]
 *     FirstName LastName
 *
 *   Variant C — reversed layout (heading after body, e.g. ČZ 11/2023):
 *     [Sermon body...]
 *     FirstName LastName
 *     [Sermon title] [Biblical reference]
 *     Nad Písmem
 *     [Liturgical context, e.g. 3. neděle postní]
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

/** Lines that signal the start of a new CZ section (must be at start of line). */
const SECTION_BOUNDARY_RE =
  /^(Ze\s+sbor|Z\s+teologie|Z\s+ekumen|Bohoslužb|Oznámen|Přehled|Rozhovor|Zpráv|Inzerce|Vydavatel|Ročník\s+\d|Nad\s+p[ií]smem|EDITORIAL|OBSAH|Na\s+okraj|Dopis|Ohlédnut|Pro\s+d[eě]ti|Pozvánk)/i;

/**
 * PDF extraction artifacts that signal we've left the sermon.
 * Matches magazine page headers/footers, ISSN lines, etc.
 * These can appear anywhere in a line (columns often merge in PDF extraction).
 */
const PAGE_BOUNDARY_RE =
  /ISSN\s+\d|MK\s+[ČC]\s*R\s+E\s+\d|[ČC]\s*eský\s+zápas\s+\d+\s*•|\d+\s*•\s*[ČC]\s*eský/i;

/**
 * Parses the reversed "Nad písmem" layout where the heading appears AFTER the sermon.
 * Layout: [body] → [author] → [title + ref] → [heading] → [liturgical context]
 * Found in PDFs where column layout causes the heading to render below the sermon.
 */
function parseReversedNadPismem(
  lines: string[],
  headerIdx: number,
  titleLineIdx: number,
  titleLine: string,
  titleRefs: string[],
): ParsedArticle | null {
  // Extract title (part before first biblical reference)
  const firstRefPos = titleLine.indexOf(titleRefs[0]);
  const title = titleLine.substring(0, firstRefPos).trim().replace(/\s*[([\s]+$/, "");
  const biblical_refs_raw = titleRefs.join("; ");

  // Author: look at the non-empty line before the title
  let authorCandidateIdx = titleLineIdx - 1;
  while (authorCandidateIdx >= 0 && lines[authorCandidateIdx].trim() === "")
    authorCandidateIdx--;

  const STANDALONE_NAME_RE =
    /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+(?:\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+){1,3}$/;
  const NAME_SUFFIX_RE =
    /^(.+[.!?…])\s+([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+(?:\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+){1,3})\s*$/;

  let author: string | null = null;
  let bodyEndIdx: number;

  if (authorCandidateIdx >= 0) {
    const candidateLine = lines[authorCandidateIdx].trim();
    if (
      STANDALONE_NAME_RE.test(candidateLine) &&
      !/[.!?,;:0-9]/.test(candidateLine)
    ) {
      // Standalone author name on its own line
      author = candidateLine;
      bodyEndIdx = authorCandidateIdx - 1;
    } else {
      const nameSuffix = NAME_SUFFIX_RE.exec(candidateLine);
      if (nameSuffix) {
        // Author embedded after sentence ending: "...uvěřili. Lucie Haltofová"
        author = nameSuffix[2];
        bodyEndIdx = authorCandidateIdx; // include line in body, strip name later
      } else {
        // No recognizable author before title
        author = null;
        bodyEndIdx = titleLineIdx - 1;
      }
    }
  } else {
    bodyEndIdx = -1;
  }

  // Collect body lines backward until we hit a section/page boundary or TOC line
  const bodyLines: string[] = [];
  for (let i = bodyEndIdx; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed.length > 0) {
      const looksLikeSectionHeader =
        SECTION_BOUNDARY_RE.test(trimmed) && !/\.\s/.test(trimmed);
      const looksLikePageBoundary = PAGE_BOUNDARY_RE.test(trimmed);
      const looksLikeTocLine = trimmed.includes("•");
      if (looksLikeSectionHeader || looksLikePageBoundary || looksLikeTocLine)
        break;
    }
    bodyLines.unshift(lines[i]);
    if (bodyLines.length >= 120) break;
  }

  // Trim leading/trailing empty lines
  while (bodyLines.length > 0 && bodyLines[0].trim() === "") bodyLines.shift();
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === "")
    bodyLines.pop();

  if (bodyLines.length === 0) return null;

  // If author was embedded in last body line, strip the name
  if (author && bodyEndIdx === authorCandidateIdx) {
    const lastLine = bodyLines[bodyLines.length - 1].trim();
    const nameSuffix = NAME_SUFFIX_RE.exec(lastLine);
    if (nameSuffix) {
      bodyLines[bodyLines.length - 1] = nameSuffix[1];
    }
  }
  const content = bodyLines.join("\n").trim();

  // Extract liturgical context from lines after heading
  let liturgical_context: string | null = null;
  for (
    let i = headerIdx + 1;
    i < Math.min(lines.length, headerIdx + 5);
    i++
  ) {
    const trimmed = lines[i].trim();
    if (trimmed === "") continue;
    const liturgicalMatch = trimmed.match(
      /\b(\d+\.\s+ned[eě]l[ei]\s+\S+|Hod\s+Bo[žz][íi]\s+\S+|[Vv]elikonoční\s+ned[eě]l[ai]|[Kk]květnou\s+ned[eě]l[ei]|[Ss]lavnost\s+\S+|[Pp]ůst[ní]*\s+ned[eě]l[ei])/,
    );
    if (liturgicalMatch) {
      liturgical_context = liturgicalMatch[0].trim();
      break;
    }
  }

  return {
    title,
    author,
    biblical_refs_raw,
    biblical_references: titleRefs,
    content_type: "kazani",
    liturgical_context,
    content,
  };
}

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
  // Ultra-flexible: allow spaces within both "nad" and "písmem" (pdfjs artifact).
  // Handles: "Nad P í smem", "NAD PÍSM EM", "N AD   P ÍSMEM" etc.
  const NAD_PISMEM_SPLIT_RE = /n\s*a\s*d\s+p\s*[ií]\s*s\s*m\s*e\s*m/i;
  // Skip table-of-contents / navigation header lines that list section names
  // separated by bullets, e.g. "EDITORIAL • ZE ŽIVOTA CÍRKVE • NAD PÍSMEM • TÉMA…"
  const isTocLine = (line: string) => line.includes("•");

  // Prefer a line where the heading starts at the beginning.
  // Use the split-tolerant regex so "NAD PÍSM EM" and "N AD P ÍSMEM" also match.
  let headerIdx = lines.findIndex(
    (l) => /^n\s*a\s*d\s+p\s*[ií]\s*s\s*m\s*e\s*m/i.test(l.trim()) && !isTocLine(l),
  );
  // Fallback: heading embedded anywhere in a line (but not in TOC lines)
  if (headerIdx === -1) {
    headerIdx = lines.findIndex((l) => NAD_PISMEM_RE.test(l) && !isTocLine(l));
  }
  // Fallback: diacritic-split form ("Nad P í smem") — pdfjs artifact (but not in TOC lines)
  if (headerIdx === -1) {
    headerIdx = lines.findIndex((l) => NAD_PISMEM_SPLIT_RE.test(l) && !isTocLine(l));
  }
  if (headerIdx === -1) return null;

  const headerLine = lines[headerIdx].trim();
  // Try standard regex first, then split-tolerant form
  const headingMatch = NAD_PISMEM_RE.exec(headerLine) ?? NAD_PISMEM_SPLIT_RE.exec(headerLine);
  const restAfterHeader = headingMatch
    ? headerLine.slice(headingMatch.index + headingMatch[0].length).trim()
    : "";

  // --- Detect reversed layout (Variant C) ---
  // In some PDFs (e.g. ČZ 11/2023), the heading appears AFTER the sermon:
  //   body → author → title+ref → "Nad písmem" → liturgical context
  // Detect by checking if the non-empty line BEFORE the heading has biblical refs.
  if (restAfterHeader.length === 0) {
    let prevIdx = headerIdx - 1;
    while (prevIdx >= 0 && lines[prevIdx].trim() === "") prevIdx--;
    if (prevIdx >= 0) {
      const prevLine = lines[prevIdx].trim();
      if (prevLine.length > 0 && prevLine.length < 100) {
        const prevRefs = parseBiblicalRefs(prevLine);
        if (prevRefs.length > 0) {
          return parseReversedNadPismem(lines, headerIdx, prevIdx, prevLine, prevRefs);
        }
      }
    }
  }

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

  // Collect body lines until we hit a new section header, page boundary,
  // standalone author name, or safety limit.
  // Typical "Nad písmem" sermons are 40–70 lines of body text, plus ~20 lines
  // of liturgical preamble (readings, prayers, hymns) = 60–90 lines total.
  const STANDALONE_NAME_RE =
    /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+(?:\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+){1,3}$/;
  const bodyLines: string[] = [];
  for (let i = titleIdx + 1 + extraLinesConsumed; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // A real section header never contains a mid-sentence period
    // ("rozhovor. Hned…" is body text, not the "Rozhovor" section header)
    const looksLikeSectionHeader =
      trimmed.length > 0 &&
      SECTION_BOUNDARY_RE.test(trimmed) &&
      !/\.\s/.test(trimmed);
    // PDF page headers/footers (ISSN, magazine name+number) can appear anywhere in a line
    const looksLikePageBoundary = PAGE_BOUNDARY_RE.test(trimmed);
    if (looksLikeSectionHeader || looksLikePageBoundary) break;

    // Detect standalone author name: 2–4 capitalized words, no punctuation,
    // appearing after substantial body content (>= 20 lines).
    // This catches the author line that marks the end of the sermon,
    // even when no section boundary follows immediately.
    if (
      bodyLines.length >= 20 &&
      trimmed.length > 3 &&
      trimmed.length < 50 &&
      STANDALONE_NAME_RE.test(trimmed) &&
      !/[.!?,;:0-9]/.test(trimmed)
    ) {
      bodyLines.push(lines[i]); // include the name as the last body line
      break;
    }

    bodyLines.push(lines[i]);
    if (bodyLines.length >= 120) break; // safety limit
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
  // Use \S+ instead of \w+ because \w doesn't match Czech diacritics (á, í, etc.)
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
