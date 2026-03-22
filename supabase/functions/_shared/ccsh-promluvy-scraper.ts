/**
 * Scraper for promluvy (sermons from Český zápas) from ccsh.cz/aktualne/81-promluvy.html.
 * These are web-published versions of "Nad písmem" articles from the ČZ magazine.
 */

import { fetchHtmlDirect, stripHtmlTags } from "./html-parser.ts";
import { normalizeBiblicalRef } from "./biblical-refs.ts";

const BASE_URL = "https://www.ccsh.cz";
const LISTING_PATH = "/aktualne/81-promluvy.html";
const ITEMS_PER_PAGE = 6;

export interface PromluvaListItem {
  title: string;
  url: string;       // relative path, e.g. "/aktualne/81-promluvy/2806-..."
  author: string | null;
  dateISO: string | null;
  dateStr: string;
}

export interface PromluvaPageData {
  title: string;
  author: string | null;
  dateISO: string | null;
  dateStr: string;
  liturgicalContext: string | null;
  biblicalRefsRaw: string | null;
  biblicalReferences: string[];
  czIssueNumber: number | null;
  czYear: number | null;
  content: string;
  sourceUrl: string;
}

/**
 * Extract biblical references from parenthesized format at end of title.
 * "Já jsem vzkříšení i život (J 11,1-45)" → ["J 11,1-45"]
 * "Osoby a obsazení (J 9,1-41)" → ["J 9,1-41"]
 * "Pokušení na poušti - záznamy z neděle 22.2." → []
 */
export function extractBiblicalRefsFromPromluvaTitle(title: string): {
  refs: string[];
  raw: string | null;
} {
  const clean = title.replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

  // Match parenthesized ref at end: (J 11,1-45) or (L 18,1–8)
  const m = clean.match(/\(([^)]+)\)\s*$/);
  if (!m) return { refs: [], raw: null };

  const inside = m[1].trim();

  // Verify it looks like a biblical reference (starts with a book abbreviation + numbers)
  if (!/^(?:\d\s*)?[A-ZŽŘa-zžř]+\s+\d/.test(inside)) {
    return { refs: [], raw: null };
  }

  // Could have multiple refs separated by semicolon: (J 21,18-19; 2 Tm 4,6)
  const parts = inside.split(/;\s*/);
  const refs: string[] = [];
  const rawParts: string[] = [];

  for (const part of parts) {
    const normalized = normalizeBiblicalRef(part.trim());
    if (normalized && /\d/.test(normalized)) {
      refs.push(normalized);
      rawParts.push(part.trim());
    }
  }

  return {
    refs,
    raw: rawParts.length > 0 ? rawParts.join("; ") : null,
  };
}

/**
 * Extract ČZ issue number and year from content.
 * Patterns:
 * - "(ČZ 12/2026)" in first paragraph
 * - "Český zápas č. 12/2026 z 22. 3. 2026" at end
 */
export function extractCzIssue(content: string): { issueNumber: number | null; year: number | null } {
  // Try "(ČZ N/YYYY)"
  const m1 = content.match(/\(ČZ\s+(\d+)\/(\d{4})\)/);
  if (m1) {
    return { issueNumber: parseInt(m1[1], 10), year: parseInt(m1[2], 10) };
  }

  // Try "Český zápas č. N/YYYY"
  const m2 = content.match(/Český\s+zápas\s+č\.\s*(\d+)\/(\d{4})/);
  if (m2) {
    return { issueNumber: parseInt(m2[1], 10), year: parseInt(m2[2], 10) };
  }

  return { issueNumber: null, year: null };
}

/**
 * Scrape the promluvy listing page at a given offset.
 * Returns metadata for each article (6 per page).
 */
export async function scrapePromluvaListing(startOffset: number = 0): Promise<PromluvaListItem[]> {
  const url = startOffset === 0
    ? `${BASE_URL}${LISTING_PATH}`
    : `${BASE_URL}${LISTING_PATH}?start=${startOffset}`;

  const html = await fetchHtmlDirect(url);
  if (!html) return [];

  const items: PromluvaListItem[] = [];

  const articleRegex = /<article\s+class="[^"]*">([\s\S]*?)<\/article>/gi;
  let articleMatch;

  while ((articleMatch = articleRegex.exec(html)) !== null) {
    const block = articleMatch[1];

    // Extract URL and title from <h3 class="article-title">
    const titleMatch = block.match(
      /<h3\s+class="article-title"[^>]*>\s*<a\s+href="([^"]+)"[^>]*title="([^"]*)"[^>]*>/i
    );
    if (!titleMatch) continue;

    const relativeUrl = titleMatch[1];
    if (relativeUrl.includes("tmpl=component")) continue;
    if (!relativeUrl.startsWith("/aktualne/81-promluvy/")) continue;

    const titleHtml = titleMatch[2];
    const title = stripHtmlTags(titleHtml).replace(/\s+/g, " ").trim();

    // Extract author
    const authorMatch = block.match(
      /<dd\s+class="createdby[^"]*"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/i
    );
    const author = authorMatch ? authorMatch[1].trim() : null;

    // Extract date
    const timeMatch = block.match(/<time\s+datetime="([^"]+)"/i);
    const dateISO = timeMatch ? timeMatch[1].substring(0, 10) : null;

    const dateTextMatch = block.match(/<time[^>]*>([\s\S]*?)<\/time>/i);
    const dateStr = dateTextMatch
      ? stripHtmlTags(dateTextMatch[1]).replace(/\s+/g, " ").trim()
      : "";

    items.push({ title, url: relativeUrl, author, dateISO, dateStr });
  }

  return items;
}

/**
 * Scrape an individual promluva page.
 */
export async function scrapePromluvaPage(relativeUrl: string): Promise<PromluvaPageData | null> {
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

  // Extract date
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
    let rawContent = contentMatch[1]
      .replace(/<div\s+class="fastsocialshare[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "");
    content = stripHtmlTags(rawContent).replace(/\n{3,}/g, "\n\n").trim();
  }

  if (!title || !content) return null;

  // Extract biblical references from title (parenthesized format)
  const { refs, raw } = extractBiblicalRefsFromPromluvaTitle(title);

  // Extract ČZ issue info from content
  const { issueNumber, year: czYear } = extractCzIssue(content);

  // Extract liturgical context from content
  const liturgicalContext = extractPromluvaLiturgicalContext(content);

  return {
    title,
    author,
    dateISO,
    dateStr,
    liturgicalContext,
    biblicalRefsRaw: raw,
    biblicalReferences: refs,
    czIssueNumber: issueNumber,
    czYear: czYear,
    content,
    sourceUrl: fullUrl,
  };
}

/**
 * Extract liturgical context from promluva content.
 * Also handles: "5. neděle postní" standalone or in opening paragraph.
 */
function extractPromluvaLiturgicalContext(content: string): string | null {
  const firstLines = content.substring(0, 500);

  // "Kázání na 4. postní neděli v..."
  const m1 = firstLines.match(
    /[Kk]ázání\s+na\s+([\dA-Za-záčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ.,\s]+?)(?:\s+v\s|\s+ve\s|\s+při\s|\s+v\xa0|\s+dne\s)/i
  );
  if (m1) return m1[1].replace(/\s+/g, " ").trim();

  // "Promluva na popeleční středu..."
  const m2 = firstLines.match(
    /[Pp]romluva\s+na\s+([\dA-Za-záčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ.,\s]+?)(?:\s+v\s|\s+ve\s|\s+při\s|\s+v\xa0|\s+dne\s)/i
  );
  if (m2) return m2[1].replace(/\s+/g, " ").trim();

  // "5. neděle postní" or "Květná neděle" as standalone pattern
  const m3 = firstLines.match(
    /(\d+\.\s+(?:neděle|postní neděle|neděle postní|neděle po)[^\n.]*)/i
  );
  if (m3) return m3[1].replace(/\s+/g, " ").trim();

  return null;
}

/**
 * Get total number of pages from the promluvy listing.
 */
export async function getPromluvaPageCount(): Promise<number> {
  const html = await fetchHtmlDirect(`${BASE_URL}${LISTING_PATH}`);
  if (!html) return 1;

  const m = html.match(/Strana\s+\d+\s+z\s+(\d+)/i);
  return m ? parseInt(m[1], 10) : 1;
}
