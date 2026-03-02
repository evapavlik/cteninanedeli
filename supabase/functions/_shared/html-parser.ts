/**
 * Fallback HTML fetching and parsing for when Firecrawl is unavailable.
 * Used by warm-cache to scrape readings from ccsh.cz/cyklus.html as an
 * alternative to the Firecrawl-based scraping of cyklus.ccsh.cz.
 */

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
 * Parse the ccsh.cz/cyklus.html index page to find the next upcoming Sunday.
 * Looks for links or text containing dates in DD.MM.YYYY format along with
 * Sunday names and reading page URLs.
 *
 * Returns the same shape as the existing findNextSundayUrl() in warm-cache.
 */
export function parseIndexFromHtml(html: string): { url: string; title: string; date: string } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let closest: { url: string; title: string; date: Date } | null = null;

  // Strategy 1: Find <a> tags containing dates (DD.MM.YYYY) — typical index page pattern
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
      // Extract Sunday name: text after the date, or the full link text
      const afterDate = linkContent.replace(/.*\d{4}\s*/, "").trim();
      const title = afterDate || linkContent;
      const resolvedUrl = href.startsWith("http") ? href : new URL(href, "https://www.ccsh.cz/").toString();
      closest = { url: resolvedUrl, title, date };
    }
  }

  // Strategy 2: If no links with dates found, look for date patterns in plain text
  // near headings or bold text that might indicate Sunday entries
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
    // Match heading tags (h2-h4) or bold/strong containing the keyword, followed by content
    const headingRegex = new RegExp(
      `<(?:h[2-4]|b|strong)[^>]*>\\s*([^<]*${keyword}[^<]*)\\s*</(?:h[2-4]|b|strong)>([\\s\\S]*?)(?=<(?:h[2-4]|b|strong)[^>]*>\\s*[^<]*(?:čtení|Evangelium|Žalm)|$)`,
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
