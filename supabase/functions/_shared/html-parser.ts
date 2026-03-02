/**
 * Fallback HTML fetching and parsing for when Firecrawl is unavailable.
 * Used by warm-cache to scrape readings from ccsh.cz/cyklus.html as an
 * alternative to the Firecrawl-based scraping of cyklus.ccsh.cz.
 */

/** Czech month names (genitive case as used in dates) → month number (1-12) */
const CZECH_MONTHS: Record<string, number> = {
  ledna: 1, února: 2, března: 3, dubna: 4, května: 5, června: 6,
  července: 7, srpna: 8, září: 9, října: 10, listopadu: 11, prosince: 12,
};

/**
 * Fetch a URL via plain HTTP GET and return the HTML body.
 * Handles charset detection (UTF-8 vs windows-1250).
 */
export async function fetchHtmlDirect(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "CCSH-Cyklus-Bot/1.0 (cteninanedeli.vercel.app)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) {
      console.error(`Direct fetch error ${res.status} for ${url}`);
      return null;
    }
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("windows-1250") || contentType.includes("iso-8859-2")) {
      const buffer = await res.arrayBuffer();
      return new TextDecoder("windows-1250").decode(buffer);
    }
    return await res.text();
  } catch (e) {
    console.error(`Direct fetch exception for ${url}: ${(e as Error).message}`);
    return null;
  }
}

/**
 * Strip HTML tags, decode common entities, and preserve basic structure.
 */
export function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&#\d+;/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Parse ccsh.cz/cyklus.html to find the current Sunday's title and date.
 * The page is a single page with all data: title in <h1>, date as
 * "neděle DD. měsíce", and readings in <h2>/<h3>/<strong> sections.
 * Returns url: "" to signal that readings are already on this page.
 *
 * Also supports index-style pages with <a> tags containing DD.MM.YYYY dates
 * as a fallback strategy.
 */
export function parseIndexFromHtml(html: string): { url: string; title: string; date: string } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();

  // Strategy 1: Single-page format (ccsh.cz/cyklus.html)
  // Title in <h1>, date as "neděle DD. měsíce" in page body
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const title = stripHtmlTags(h1Match[1]).trim();
    const textContent = stripHtmlTags(html);
    // Match "neděle DD. měsíce" — Czech month names in genitive (března, dubna…)
    const dateMatch = textContent.match(/ned[eě]le\s+(\d{1,2})\.\s*(\S+)/i);
    if (dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const monthName = dateMatch[2].toLowerCase();
      const month = CZECH_MONTHS[monthName];
      if (month) {
        // No year on page — try current year first
        const currentYearDate = new Date(currentYear, month - 1, day);
        let date: Date | null = null;
        if (currentYearDate >= today) {
          date = currentYearDate;
        } else {
          // Try next year only for Dec→Jan boundary (date must be within ~14 days)
          const nextYearDate = new Date(currentYear + 1, month - 1, day);
          const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;
          if (nextYearDate >= today && (nextYearDate.getTime() - today.getTime()) < FOURTEEN_DAYS) {
            date = nextYearDate;
          }
        }
        if (date) {
          const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          return { url: "", title, date: dateStr };
        }
      }
    }
  }

  // Strategy 2: Index page with <a> tags containing dates (DD.MM.YYYY)
  let closest: { url: string; title: string; date: Date } | null = null;

  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const linkContent = stripHtmlTags(match[2]).trim();

    const dateMatch = linkContent.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (!dateMatch) continue;

    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10) - 1;
    const year = parseInt(dateMatch[3], 10);
    const date = new Date(year, month, day);

    if (date >= today && (!closest || date < closest.date)) {
      const afterDate = linkContent.replace(/.*\d{4}\s*/, "").trim();
      const title = afterDate || linkContent;
      const resolvedUrl = href.startsWith("http") ? href : new URL(href, "https://www.ccsh.cz/").toString();
      closest = { url: resolvedUrl, title, date };
    }
  }

  // Strategy 3: Plain text with "Ne DD.MM.YYYY" patterns
  if (!closest) {
    const textContent = stripHtmlTags(html);
    const lineRegex = /Ne\s+(\d{1,2})\.(\d{1,2})\.(\d{4})\s*[^:\n]*:\s*(.+)/g;
    let textMatch: RegExpExecArray | null;

    while ((textMatch = lineRegex.exec(textContent)) !== null) {
      const day = parseInt(textMatch[1], 10);
      const month = parseInt(textMatch[2], 10) - 1;
      const year = parseInt(textMatch[3], 10);
      const title = textMatch[4].trim();
      const date = new Date(year, month, day);

      if (date >= today && (!closest || date < closest.date)) {
        closest = { url: "", title, date };
      }
    }
  }

  if (!closest) return null;

  const d = closest.date;
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { url: closest.url, title: closest.title, date: dateStr };
}

/**
 * Extract readings (První čtení, Druhé čtení, Evangelium) from a reading page HTML.
 * Output matches the format produced by the Firecrawl-based extractReadings():
 *   "## Heading\n\ntext\n\n---\n\n## Heading\n\ntext..."
 */
export function extractReadingsFromHtml(html: string, pageTitle: string): { sundayTitle: string; readings: string } {
  const sections: string[] = [];

  function extractSection(keyword: string): string | null {
    // Match heading tags (h2-h4) or bold/strong containing the keyword, followed by content.
    // Content terminates at: any <h1>-<h4> heading, or <b>/<strong> with known section keywords.
    const headingRegex = new RegExp(
      `<(?:h[2-4]|b|strong)[^>]*>\\s*([^<]*${keyword}[^<]*)\\s*</(?:h[2-4]|b|strong)>([\\s\\S]*?)(?=<h[1-4][^>]*>|<(?:b|strong)[^>]*>\\s*[^<]*(?:čtení|Evangelium|Žalm|Tužby|Modlitba|Přímluv)|$)`,
      "i"
    );
    const match = html.match(headingRegex);
    if (match) {
      const heading = stripHtmlTags(match[1]).trim();
      const body = stripHtmlTags(match[2]).trim();
      if (body.length > 50) {
        return `## ${heading}\n\n${body}`;
      }
    }

    // Fallback: look for the keyword in #### markdown-like format (if the HTML contains markdown)
    const mdRegex = new RegExp(
      `####\\s*([^\\n]*${keyword}[^\\n]*)\\n+([\\s\\S]*?)(?=\\n####|$)`,
      "i"
    );
    const mdMatch = html.match(mdRegex);
    if (mdMatch) {
      return `## ${mdMatch[1].trim()}\n\n${mdMatch[2].trim()}`;
    }

    return null;
  }

  const first = extractSection("První čtení");
  if (first) sections.push(first);
  const second = extractSection("Druhé čtení");
  if (second) sections.push(second);
  const gospel = extractSection("Evangelium");
  if (gospel) sections.push(gospel);

  const cleanTitle = pageTitle
    .replace(/\\([.#*_~`])/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();

  return {
    sundayTitle: cleanTitle,
    readings: sections.join("\n\n---\n\n"),
  };
}
