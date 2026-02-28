/**
 * PDF text extraction utilities (client-side, browser only).
 *
 * Uses pdfjs-dist loaded lazily so it doesn't affect the main bundle.
 * The worker URL is resolved by Vite at build time via the ?url import.
 */

// Vite resolves this at build time → copies worker to dist/assets and returns the URL.
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

/** Extracts plain text from a PDF File. Runs in the browser (not edge function). */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Reconstruct line breaks using hasEOL — each TextItem knows whether
    // the PDF renderer placed a line break after it. Without this, all text
    // on a page merges into one long string and the parser can't find headings.
    let pageText = "";
    for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
      if (!item.str) continue;
      pageText += item.str;
      pageText += item.hasEOL ? "\n" : " ";
    }
    pages.push(pageText.trimEnd());
  }
  return pages.join("\n");
}

/** Detects year and issue number from a PDF filename (e.g. "cz_2024_12.pdf"). */
export function detectYearAndIssue(filename: string): { year: string; issue: string } | null {
  const base = filename.replace(/\.pdf$/i, "").replace(/^.*[\\/]/, "");
  const m = base.match(/(\d{4})[-_.]?(\d{1,2})/);
  if (m) return { year: m[1], issue: m[2] };
  return null;
}
