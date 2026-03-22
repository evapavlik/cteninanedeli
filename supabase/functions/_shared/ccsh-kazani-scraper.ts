/**
 * Scraper for sermons from ccsh.cz/kazani.html.
 * Extracts sermon metadata and content from the Joomla-based listing and detail pages.
 */

import { fetchHtmlDirect, stripHtmlTags } from "./html-parser.ts";
import { normalizeBiblicalRef } from "./biblical-refs.ts";

const BASE_URL = "https://www.ccsh.cz";

export interface SermonListItem {
  title: string;
  url: string;      // relative path, e.g. "/kazani/2802-j-9-..."
  author: string | null;
  dateStr: string;   // e.g. "18. březen 2026"
  dateISO: string | null; // e.g. "2026-03-18"
}

export interface SermonPageData {
  title: string;
  author: string | null;
  dateISO: string | null;
  dateStr: string;
  liturgicalContext: string | null;
  biblicalRefsRaw: string | null;
  biblicalReferences: string[];
  content: string;
  sourceUrl: string;  // full URL
}

/** Czech month names in nominative case (as used on ccsh.cz listing: "březen") */
const CZECH_MONTHS_NOM: Record<string, number> = {
  leden: 1, únor: 2, březen: 3, duben: 4, květen: 5, červen: 6,
  červenec: 7, srpen: 8, září: 9, říjen: 10, listopad: 11, prosinec: 12,
};

/** Czech month names in genitive case (as used in dates: "března") */
const CZECH_MONTHS_GEN: Record<string, number> = {
  ledna: 1, února: 2, března: 3, dubna: 4, května: 5, června: 6,
  července: 7, srpna: 8, září: 9, října: 10, listopadu: 11, prosince: 12,
};

/**
 * Parse a Czech date string like "18. březen 2026" or "18. března 2026" to ISO date.
 */
export function parseCzechDate(dateStr: string): string | null {
  // Normalize whitespace and non-breaking spaces
  const clean = dateStr.replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  const m = clean.match(/(\d{1,2})\.\s*(\S+)\s+(\d{4})/);
  if (!m) return null;

  const day = parseInt(m[1], 10);
  const monthName = m[2].toLowerCase();
  const year = parseInt(m[3], 10);

  const month = CZECH_MONTHS_NOM[monthName] || CZECH_MONTHS_GEN[monthName];
  if (!month) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Regex pattern matching common Czech biblical reference formats in sermon titles.
 * Matches patterns like: "J 9, 1-11", "Mt 2,13-23", "Ř 5,19", "Ga 5,22-23.25",
 * "1Kor 12,1-11", "Ž 94,16-21.15"
 *
 * The title format is typically: "[BiblicalRef] [Description]"
 * e.g. "J 9, 1-11 Ježíš činí skutky Otce..."
 */
const BIBLICAL_REF_PATTERN = /^((?:\d\s*)?[A-ZŽŘa-zžř]+)\s+(\d[\d,.:;\-–— ]*\d[a-z]?)/i;

/**
 * Extract biblical references from a sermon title.
 * Title format examples:
 * - "J 9, 1-11 Ježíš činí skutky Otce a otevírá zrak slepým"
 * - "Mt 2,13-23 Rodina v ohrožení a pod Boží ochranou"
 * - "Ř 5,19 Neposlušnost Adama a poslušnost Krista"
 * - "Ga 5,22-23.25; J 15,1-3.8 Ovoce Ducha z Ježíše..."
 * - "Promluva na popeleční středu" (no biblical ref)
 */
export function extractBiblicalRefsFromTitle(title: string): {
  refs: string[];
  raw: string | null;
} {
  const clean = title
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Try to match one or more biblical refs at the start of the title
  // They can be separated by semicolons: "Ga 5,22-23.25; J 15,1-3.8"
  const refs: string[] = [];
  const rawParts: string[] = [];

  // Split potential multiple refs by semicolon
  // But first, find where the "description" part starts
  // Strategy: try to match ref patterns from the start, greedily consuming
  // ref;ref patterns before the descriptive text begins

  // First, check if title starts with a biblical book pattern
  if (!BIBLICAL_REF_PATTERN.test(clean)) {
    return { refs: [], raw: null };
  }

  // Split by semicolons and try each part
  const parts = clean.split(/;\s*/);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    const m = part.match(BIBLICAL_REF_PATTERN);
    if (m) {
      const rawRef = `${m[1]} ${m[2].trim()}`;
      rawParts.push(rawRef);
      refs.push(normalizeBiblicalRef(rawRef));
    } else if (i > 0) {
      // Subsequent parts after semicolon that don't match = description text, stop
      break;
    }
  }

  return {
    refs,
    raw: rawParts.length > 0 ? rawParts.join("; ") : null,
  };
}

/**
 * Scrape the sermon listing page at a given offset.
 * Returns metadata for each sermon on the page (typically 8 per page).
 */
export async function scrapeSermonListing(startOffset: number = 0): Promise<SermonListItem[]> {
  const url = startOffset === 0
    ? `${BASE_URL}/kazani.html`
    : `${BASE_URL}/kazani.html?start=${startOffset}`;

  const html = await fetchHtmlDirect(url);
  if (!html) return [];

  const items: SermonListItem[] = [];

  // Each sermon is inside <article class="default">
  // Extract: title from <h3 class="article-title"><a href="..." title="...">
  //          author from <dd class="createdby"><span>...</span>
  //          date from <time datetime="...">
  const articleRegex = /<article\s+class="default">([\s\S]*?)<\/article>/gi;
  let articleMatch;

  while ((articleMatch = articleRegex.exec(html)) !== null) {
    const block = articleMatch[1];

    // Extract URL and title from <h3 class="article-title">
    const titleMatch = block.match(
      /<h3\s+class="article-title"[^>]*>\s*<a\s+href="([^"]+)"[^>]*title="([^"]*)"[^>]*>/i
    );
    if (!titleMatch) continue;

    const relativeUrl = titleMatch[1];
    // Skip print-layout URLs
    if (relativeUrl.includes("tmpl=component")) continue;
    // Only include /kazani/ URLs
    if (!relativeUrl.startsWith("/kazani/")) continue;

    const titleHtml = titleMatch[2];
    const title = stripHtmlTags(titleHtml).replace(/\s+/g, " ").trim();

    // Extract author from <dd class="createdby"><span>...</span>
    const authorMatch = block.match(
      /<dd\s+class="createdby[^"]*"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/i
    );
    const author = authorMatch ? authorMatch[1].trim() : null;

    // Extract date from <time datetime="...">
    const timeMatch = block.match(/<time\s+datetime="([^"]+)"/i);
    const dateISO = timeMatch ? timeMatch[1].substring(0, 10) : null;

    // Extract human-readable date
    const dateTextMatch = block.match(/<time[^>]*>([\s\S]*?)<\/time>/i);
    const dateStr = dateTextMatch
      ? stripHtmlTags(dateTextMatch[1]).replace(/\s+/g, " ").trim()
      : "";

    items.push({
      title,
      url: relativeUrl,
      author,
      dateStr,
      dateISO,
    });
  }

  return items;
}

/**
 * Scrape an individual sermon page and extract full content + metadata.
 */
export async function scrapeSermonPage(relativeUrl: string): Promise<SermonPageData | null> {
  const fullUrl = `${BASE_URL}${relativeUrl}`;
  const html = await fetchHtmlDirect(fullUrl);
  if (!html) return null;

  // Extract title from <h1 class="article-title">
  const h1Match = html.match(
    /<h1\s+class="article-title"[^>]*>\s*(?:<a[^>]*>)?\s*([\s\S]*?)(?:<\/a>\s*)?<\/h1>/i
  );
  const title = h1Match
    ? stripHtmlTags(h1Match[1]).replace(/\s+/g, " ").trim()
    : "";

  // Extract author from <dd class="createdby">
  const authorMatch = html.match(
    /<dd\s+class="createdby[^"]*"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/i
  );
  const author = authorMatch ? authorMatch[1].trim() : null;

  // Extract date from <time datetime="...">
  const timeMatch = html.match(/<time\s+datetime="([^"]+)"/i);
  const dateISO = timeMatch ? timeMatch[1].substring(0, 10) : null;

  const dateTextMatch = html.match(/<time[^>]*>([\s\S]*?)<\/time>/i);
  const dateStr = dateTextMatch
    ? stripHtmlTags(dateTextMatch[1]).replace(/\s+/g, " ").trim()
    : "";

  // Extract content from <section class="article-content">
  const contentMatch = html.match(
    /<section\s+class="article-content[^"]*"[^>]*>([\s\S]*?)<\/section>/i
  );
  let content = "";
  if (contentMatch) {
    // Remove social sharing scripts/divs
    let rawContent = contentMatch[1]
      .replace(/<div\s+class="fastsocialshare[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "");
    content = stripHtmlTags(rawContent).replace(/\n{3,}/g, "\n\n").trim();
  }

  if (!title || !content) return null;

  // Extract biblical references from title
  const { refs, raw } = extractBiblicalRefsFromTitle(title);

  // Extract liturgical context from the first paragraph of content
  // Pattern: "Kázání na 4. postní neděli..." or "Kázání na neděli Zmrtvýchvstání..."
  const liturgicalContext = extractLiturgicalContext(content);

  return {
    title,
    author,
    dateISO,
    dateStr,
    liturgicalContext,
    biblicalRefsRaw: raw,
    biblicalReferences: refs,
    content,
    sourceUrl: fullUrl,
  };
}

/**
 * Extract liturgical context (Sunday name) from the first paragraph of sermon content.
 * Common patterns:
 * - "Kázání na 4. postní neděli v kostele..."
 * - "Kázání na neděli Zmrtvýchvstání Páně..."
 * - "Kázání na 1. neděli po Zjevení Páně..."
 * - "Promluva na popeleční středu..."
 */
export function extractLiturgicalContext(content: string): string | null {
  // Look at the first few lines
  const firstLines = content.substring(0, 500);

  // Try to match "Kázání na [liturgical context] v/ve/při/..."
  const m = firstLines.match(
    /[Kk]ázání\s+na\s+([\dA-Za-záčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ.,\s]+?)(?:\s+v\s|\s+ve\s|\s+při\s|\s+v\xa0|\s+dne\s)/i
  );
  if (m) {
    return m[1].replace(/\s+/g, " ").trim();
  }

  // Also try "Promluva na [...]"
  const m2 = firstLines.match(
    /[Pp]romluva\s+na\s+([\dA-Za-záčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ.,\s]+?)(?:\s+v\s|\s+ve\s|\s+při\s|\s+v\xa0|\s+dne\s)/i
  );
  if (m2) {
    return m2[1].replace(/\s+/g, " ").trim();
  }

  return null;
}

/**
 * Get total number of pages from the listing page.
 * Looks for "Strana X z Y" in pagination.
 */
export async function getTotalPages(): Promise<number> {
  const html = await fetchHtmlDirect(`${BASE_URL}/kazani.html`);
  if (!html) return 1;

  const m = html.match(/Strana\s+\d+\s+z\s+(\d+)/i);
  return m ? parseInt(m[1], 10) : 1;
}
