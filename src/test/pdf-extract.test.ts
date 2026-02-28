import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectYearAndIssue, extractPdfText } from "@/lib/pdf-extract";

// Mock the pdfjs-dist worker URL (Vite ?url import)
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "mocked-worker.mjs" }));

// Mock pdfjs-dist itself
vi.mock("pdfjs-dist", () => {
  const GlobalWorkerOptions = { workerSrc: "" };
  const getDocument = vi.fn();
  return { GlobalWorkerOptions, getDocument };
});

// jsdom doesn't implement File.arrayBuffer — provide a minimal mock
function makeFile(): File {
  return { arrayBuffer: async () => new ArrayBuffer(0) } as unknown as File;
}

// ─── detectYearAndIssue ────────────────────────────────────────────────────

describe("detectYearAndIssue", () => {
  it("parses year_issue with underscore", () => {
    expect(detectYearAndIssue("cz_2024_12.pdf")).toEqual({ year: "2024", issue: "12" });
  });

  it("parses year-issue with dash", () => {
    expect(detectYearAndIssue("2025-3.pdf")).toEqual({ year: "2025", issue: "3" });
  });

  it("parses compact year+issue without separator (preserves leading zero)", () => {
    // regex captures raw digits; parseInt in AdminImport strips leading zero
    expect(detectYearAndIssue("cz202501.pdf")).toEqual({ year: "2025", issue: "01" });
  });

  it("strips directory path before matching", () => {
    expect(detectYearAndIssue("/home/eva/downloads/cz_2024_12.pdf")).toEqual({ year: "2024", issue: "12" });
  });

  it("handles .PDF uppercase extension", () => {
    expect(detectYearAndIssue("CZ_2025_04.PDF")).toEqual({ year: "2025", issue: "04" });
  });

  it("returns null when no year+issue found", () => {
    expect(detectYearAndIssue("cesky-zapas.pdf")).toBeNull();
  });

  it("returns null for empty filename", () => {
    expect(detectYearAndIssue("")).toBeNull();
  });
});

// ─── extractPdfText ────────────────────────────────────────────────────────

describe("extractPdfText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeMockPdf(pages: Array<Array<{ str: string }>>) {
    return {
      numPages: pages.length,
      getPage: vi.fn().mockImplementation(async (n: number) => ({
        getTextContent: async () => ({ items: pages[n - 1] }),
      })),
    };
  }

  async function callExtract(pdfMock: ReturnType<typeof makeMockPdf>) {
    const { getDocument } = await import("pdfjs-dist");
    (getDocument as ReturnType<typeof vi.fn>).mockReturnValue({ promise: Promise.resolve(pdfMock) });
    return extractPdfText(makeFile());
  }

  it("joins items on the same line with spaces", async () => {
    const text = await callExtract(makeMockPdf([[
      { str: "Nad", hasEOL: false },
      { str: "písmem", hasEOL: true },
    ]]));
    expect(text).toBe("Nad písmem");
  });

  it("inserts newline when hasEOL is true", async () => {
    const text = await callExtract(makeMockPdf([[
      { str: "Nad písmem", hasEOL: true },
      { str: "Titulek kázání", hasEOL: true },
    ]]));
    expect(text).toBe("Nad písmem\nTitulek kázání");
  });

  it("joins multiple pages with newlines", async () => {
    const text = await callExtract(makeMockPdf([
      [{ str: "Strana jedna", hasEOL: false }],
      [{ str: "Strana dva", hasEOL: false }],
    ]));
    expect(text).toBe("Strana jedna\nStrana dva");
  });

  it("handles empty pages without crashing", async () => {
    const text = await callExtract(makeMockPdf([[], [{ str: "Obsah", hasEOL: false }]]));
    expect(text).toBe("\nObsah");
  });

  it("skips items without str", async () => {
    const text = await callExtract(makeMockPdf([[
      { str: "OK", hasEOL: false },
      {} as { str: string; hasEOL: boolean },
    ]]));
    expect(text).toBe("OK");
  });

  it("sets GlobalWorkerOptions.workerSrc to the mocked worker URL", async () => {
    await callExtract(makeMockPdf([[{ str: "x" }]]));
    const pdfjsLib = await import("pdfjs-dist");
    expect(pdfjsLib.GlobalWorkerOptions.workerSrc).toBe("mocked-worker.mjs");
  });
});
