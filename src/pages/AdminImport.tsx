import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle, XCircle, Loader2, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { extractPdfText, detectYearAndIssue } from "@/lib/pdf-extract";

interface ImportedArticle {
  title: string;
  author: string | null;
  refs: string[];
  ok: boolean;
}

interface ImportResult {
  imported: number;
  skipped: number;
  articles: ImportedArticle[];
  message?: string;
}

export default function AdminImport() {
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState("");
  const [issue, setIssue] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
    setError(null);
    if (f) {
      const detected = detectYearAndIssue(f.name);
      if (detected) {
        if (!year) setYear(detected.year);
        if (!issue) setIssue(detected.issue);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    const yearNum = parseInt(year);
    const issueNum = parseInt(issue);

    if (!yearNum || !issueNum) {
      setError("Zadejte prosím ročník a číslo.");
      return;
    }
    if (!file) {
      setError("Vyberte prosím PDF soubor.");
      return;
    }

    setLoading(true);
    try {
      const pdfText = await extractPdfText(file);

      // DEBUG — remove after diagnosis
      const nadIdx = pdfText.toLowerCase().indexOf("nad");
      console.log("[import] total chars:", pdfText.length);
      console.log("[import] text around 'nad' (±200 chars):\n",
        nadIdx >= 0 ? pdfText.slice(Math.max(0, nadIdx - 50), nadIdx + 200) : "(not found)");
      console.log("[import] first 500 chars:\n", pdfText.slice(0, 500));

      const { data, error: fnError } = await supabase.functions.invoke("import-czech-zapas", {
        body: { pdfText, year: yearNum, issueNumber: issueNum },
      });

      if (fnError) {
        let msg = fnError.message;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const body = await (fnError as any).context?.json?.();
          if (body?.error) msg = body.error;
        } catch { /* ignore parse errors */ }
        throw new Error(msg);
      }
      setResult(data as ImportResult);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <BookOpen className="h-7 w-7 text-foreground/70" />
          <div>
            <h1 className="text-xl font-semibold">Import z Českého zápasu</h1>
            <p className="text-sm text-foreground/50">Nahraj číslo CZ — automaticky najde sekci „Nad písmem" a uloží kázání</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* PDF file upload */}
          <div>
            <label className="block text-sm font-medium mb-2">PDF soubor</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-foreground/40 transition-colors"
            >
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <FileText className="h-5 w-5 text-foreground/60" />
                  <span className="font-medium">{file.name}</span>
                  <span className="text-foreground/40">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                </div>
              ) : (
                <div className="text-foreground/50 text-sm">
                  <Upload className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Klikni nebo přetáhni PDF soubor
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Year + Issue */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Ročník (rok)</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2024"
                min="1900"
                max="2100"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Číslo</label>
              <input
                type="number"
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                placeholder="12"
                min="1"
                max="52"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 rounded-lg px-3 py-2">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-foreground text-background text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Zpracovávám PDF...
              </>
            ) : (
              "Importovat"
            )}
          </button>
        </form>

        {/* Results */}
        {result && (
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span>
                <strong>{result.imported}</strong> článků importováno
                {result.skipped > 0 && (
                  <span className="text-foreground/50">, {result.skipped} přeskočeno</span>
                )}
              </span>
            </div>

            {result.message && (
              <p className="text-sm text-foreground/60">{result.message}</p>
            )}

            {result.articles.length > 0 && (
              <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden text-sm">
                {result.articles.map((a, i) => (
                  <li key={i} className="flex items-start gap-3 px-4 py-3">
                    {a.ok
                      ? <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      : <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    }
                    <div className="min-w-0">
                      <div className="font-medium truncate">{a.title}</div>
                      {a.author && <div className="text-foreground/50">{a.author}</div>}
                      {a.refs.length > 0 && (
                        <div className="text-foreground/40 text-xs mt-0.5">{a.refs.join(", ")}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {result.imported > 0 && (
              <p className="text-xs text-foreground/40">
                Tip: Spusť warm-cache pro předgenerování AI výstupů pro příští neděli.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
