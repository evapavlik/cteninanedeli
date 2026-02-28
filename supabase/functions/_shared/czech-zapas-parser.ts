/**
 * Deterministický parser sekce "Nad písmem" z Českého zápasu.
 * Nevyžaduje žádné AI — pracuje na extrahovaném textu z PDF.
 *
 * Struktura sekce:
 *   Nad Písmem
 *   [Název kázání] [Biblická reference, např. J 3,1-17]
 *   [Text kázání...]
 *   Jméno Příjmení
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
 * Regex pro biblické reference v češtině.
 * Pokrývá: J 3,1-17 · Mt 4,1-11 · Gn 12,1-4a · Ž 22,1 · Kor 1,18-31 atd.
 */
const BIBLICAL_REF_RE =
  /\b([JRŽA-Z][a-záčďéěíňóřšťúůýž]{0,4})\s+(\d+),(\d+(?:[–-]\d+)?[abc]?)\b/g;

/** Extrahuje všechny biblické reference z textu */
export function parseBiblicalRefs(text: string): string[] {
  const refs: string[] = [];
  const re = new RegExp(BIBLICAL_REF_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    refs.push(m[0]);
  }
  return refs;
}

/** Řádky, které signalizují začátek nové sekce CZ */
const SECTION_BOUNDARY_RE =
  /^(Ze\s+sbor|Z\s+teologie|Bohoslužb|Oznámen|Přehled|Rozhovor|Zpráv|Inzerce|Vydavatel|Ročník\s+\d|Nad\s+p[ií]smem|EDITORIAL|OBSAH|Na\s+okraj|Dopis|Ohlédnut)/i;

/**
 * Parsuje sekci "Nad písmem" z extrahovaného textu PDF.
 * Vrátí null, pokud sekce není nalezena.
 */
export function parseNadPismem(
  rawText: string,
  year: number,
  issueNumber: number,
): ParsedArticle | null {
  // Normalizace: spojení dělení slov pomlčkou (časté při extrakci z PDF)
  // Např. "při-\nchází" → "přichází"
  const text = rawText
    .replace(/([a-záčďéěíňóřšťúůýž])-\n([a-záčďéěíňóřšťúůýž])/g, "$1$2")
    .replace(/\r\n/g, "\n");

  const lines = text.split("\n");

  // Najdeme řádek "Nad Písmem" / "Nad písmem"
  const headerIdx = lines.findIndex((l) =>
    /^nad\s+p[ií]smem\s*$/i.test(l.trim())
  );
  if (headerIdx === -1) return null;

  // První neprázdný řádek po záhlaví = řádek s názvem a biblickou referencí
  let titleIdx = headerIdx + 1;
  while (titleIdx < lines.length && lines[titleIdx].trim() === "") titleIdx++;
  if (titleIdx >= lines.length) return null;

  const titleLine = lines[titleIdx].trim();

  // Extrahujeme biblické reference z řádku názvu
  const refsInTitle = parseBiblicalRefs(titleLine);
  let title = titleLine;
  let biblical_refs_raw: string | null = null;

  if (refsInTitle.length > 0) {
    // Název = vše před první referencí
    const firstRefPos = titleLine.indexOf(refsInTitle[0]);
    title = titleLine.substring(0, firstRefPos).trim();
    biblical_refs_raw = refsInTitle.join("; ");
  }

  // Sbíráme řádky těla — dokud nenarazíme na novou sekci nebo limit
  const bodyLines: string[] = [];
  for (let i = titleIdx + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.length > 0 && SECTION_BOUNDARY_RE.test(trimmed)) break;
    bodyLines.push(lines[i]);
    if (bodyLines.length >= 400) break; // bezpečnostní limit
  }

  // Ořezání prázdných řádků na konci
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === "") {
    bodyLines.pop();
  }

  if (bodyLines.length === 0) return null;

  // Poslední neprázdný řádek = podpis autora
  const author = bodyLines[bodyLines.length - 1].trim() || null;
  const content = bodyLines.slice(0, bodyLines.length - 1).join("\n").trim();

  // Pokus o extrakci liturgického kontextu (např. "2. neděle postní")
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
