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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pages.push(content.items.map((item: any) => item.str ?? "").join(" "));
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
