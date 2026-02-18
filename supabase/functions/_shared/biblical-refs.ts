/**
 * Normalize biblical references for matching between cyklus.ccsh.cz
 * readings and Farský's Postily.
 *
 * cyklus format:  "## Evangelium – Mt 4,1-11"
 * Farský format:  "(Ned. I. postní: Mat. 4, 1—11.)"
 * canonical:      "Mt 4,1-11"
 */

const BOOK_ALIASES: Record<string, string> = {
  // Starý zákon
  "gn": "Gn", "gen": "Gn",
  "ex": "Ex",
  "lv": "Lv", "lev": "Lv",
  "nm": "Nm", "num": "Nm",
  "dt": "Dt", "deut": "Dt",
  "joz": "Joz",
  "sd": "Sd",
  "rt": "Rt", "rút": "Rt",
  "sam": "Sam",
  "král": "Král", "kr": "Král",
  "pa": "Pa", "par": "Pa",
  "ezd": "Ezd",
  "neh": "Neh",
  "tob": "Tob",
  "jdt": "Jdt",
  "est": "Est",
  "job": "Job", "jób": "Job",
  "ž": "Ž", "žalm": "Ž", "žal": "Ž",
  "př": "Př", "přísl": "Př",
  "kaz": "Kaz",
  "pís": "Pís",
  "mdr": "Mdr", "mudr": "Mdr",
  "sír": "Sír", "sir": "Sír",
  "iz": "Iz",
  "jr": "Jr", "jer": "Jr",
  "pláč": "Pláč",
  "bar": "Bar",
  "ez": "Ez",
  "dan": "Dan",
  "oz": "Oz",
  "jl": "Jl", "joel": "Jl",
  "am": "Am",
  "abd": "Abd",
  "jon": "Jon",
  "mi": "Mi", "mich": "Mi",
  "na": "Na", "nah": "Na",
  "hab": "Hab",
  "sof": "Sof",
  "ag": "Ag",
  "za": "Za", "zach": "Za",
  "mal": "Mal",
  "mak": "Mak",

  // Nový zákon
  "mt": "Mt", "mat": "Mt",
  "mk": "Mk", "mar": "Mk",
  "lk": "Lk", "l": "Lk", "luk": "Lk",
  "j": "J", "jan": "J",
  "sk": "Sk",
  "ř": "Ř", "řím": "Ř",
  "kor": "Kor",
  "gal": "Gal",
  "ef": "Ef",
  "fp": "Fp", "fil": "Fp", "filip": "Fp",
  "kol": "Kol",
  "sol": "Sol", "tes": "Sol",
  "tim": "Tim",
  "tt": "Tt", "tit": "Tt",
  "fm": "Fm", "filem": "Fm",
  "žd": "Žd", "žid": "Žd",
  "jk": "Jk", "jak": "Jk",
  "pt": "Pt", "petr": "Pt",
  "jud": "Jud",
  "zj": "Zj", "zjev": "Zj",
};

/**
 * Normalize a single biblical reference to canonical form.
 * "Mat. 22, 37—46" → "Mt 22,37-46"
 * "1 Kor 12,1-11" → "1Kor 12,1-11"
 */
export function normalizeBiblicalRef(raw: string): string {
  let ref = raw.trim().replace(/\.$/, "");

  // Fix common OCR errors
  ref = ref.replace(/^1z\b/i, "Iz");

  // Handle numbered books: "I. Kor." "II. Sol." "1 Kor"
  const numberedMatch = ref.match(/^([IVX]+\.?|[12345])\s+(.+)$/i);
  let prefix = "";
  let rest = ref;
  if (numberedMatch) {
    const num = numberedMatch[1].replace(".", "");
    if (num === "I" || num === "1") prefix = "1";
    else if (num === "II" || num === "2") prefix = "2";
    else if (num === "III" || num === "3") prefix = "3";
    else if (num === "IV" || num === "4") prefix = "4";
    else if (num === "V" || num === "5") prefix = "5";
    rest = numberedMatch[2];
  }

  // Extract book name and chapter:verse
  const bookMatch = rest.match(/^([A-ZŽŘČŠa-zžřčšůúýáéíóďťňě]+\.?)\s*(.*)$/i);
  if (!bookMatch) return raw.trim();

  const bookRaw = bookMatch[1].toLowerCase().replace(/\.$/, "");
  const chapterVerse = bookMatch[2];

  const book = BOOK_ALIASES[bookRaw] || bookMatch[1].replace(/\.$/, "");

  // Normalize chapter:verse — "22, 37—46" → "22,37-46"
  const cv = chapterVerse
    .replace(/\s+/g, "")
    .replace(/[—–]+/g, "-")
    .replace(/\.$/g, "");

  const canonical = prefix ? `${prefix}${book}` : book;
  return cv ? `${canonical} ${cv}` : canonical;
}

/**
 * Extract biblical references from a markdown reading heading.
 * "## Evangelium – Mt 4,1-11" → ["Mt 4,1-11"]
 * "## První čtení z Písma: Gn 2,7-9; 3,1-7" → ["Gn 2,7-9", "Gn 3,1-7"]
 */
export function extractRefsFromHeading(heading: string): string[] {
  // Remove heading markup and label
  let text = heading
    .replace(/^#{1,4}\s*/, "")
    .replace(/^(První|Druhé|Třetí)\s+čtení[^:–—-]*[:\s–—-]+/i, "")
    .replace(/^Evangelium[^:–—-]*[:\s–—-]+/i, "")
    .trim();

  if (!text) return [];

  // Split on ";" for multiple refs
  const parts = text.split(/;\s*/);
  const refs: string[] = [];
  for (const part of parts) {
    const normalized = normalizeBiblicalRef(part.trim());
    if (normalized && /\d/.test(normalized)) {
      refs.push(normalized);
    }
  }
  return refs;
}

/**
 * Extract all biblical references from the full markdown of Sunday readings.
 * Returns normalized refs keyed by reading type.
 */
export function extractAllRefsFromMarkdown(markdown: string): {
  readings: { type: string; refs: string[] }[];
  allRefs: string[];
} {
  const headingRegex = /^##\s+(.+)$/gm;
  const readings: { type: string; refs: string[] }[] = [];
  const allRefs: string[] = [];

  let match;
  while ((match = headingRegex.exec(markdown)) !== null) {
    const heading = match[1];
    let type = "unknown";
    if (/první/i.test(heading)) type = "first";
    else if (/druhé/i.test(heading)) type = "second";
    else if (/evangelium/i.test(heading)) type = "gospel";

    const refs = extractRefsFromHeading("## " + heading);
    readings.push({ type, refs });
    allRefs.push(...refs);
  }

  return { readings, allRefs };
}
