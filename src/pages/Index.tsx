import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { fetchCyklus } from "@/lib/api/firecrawl";
import { Loader2, BookOpen, Moon, Sun } from "lucide-react";

const Index = () => {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [sundayTitle, setSundayTitle] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark";
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  // Auto-fetch on mount
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const result = await fetchCyklus();
      if (result.success && result.markdown) {
        setMarkdown(result.markdown);
        setSundayTitle(result.sundayTitle || "");
      } else {
        setError(result.error || "Nepodařilo se načíst čtení.");
      }
      setLoading(false);
    };
    load();
  }, []);

  const today = new Date();
  const formattedDate = today.toLocaleDateString("cs-CZ", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-5 py-10 md:px-6 md:py-20">
        {/* Dark mode toggle */}
        <div className="flex justify-end mb-6">
          <button
            onClick={() => setDark(!dark)}
            className="p-2 rounded-full text-foreground/60 hover:text-foreground transition-colors"
            aria-label={dark ? "Přepnout na světlý režim" : "Přepnout na tmavý režim"}
          >
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>

        {/* Header */}
        <header className="mb-14 text-center md:mb-20">
          <BookOpen className="mx-auto mb-5 h-8 w-8 text-muted-foreground md:h-9 md:w-9" strokeWidth={1} />
          <h1 className="mb-2 font-serif text-3xl font-semibold tracking-wide text-foreground md:text-4xl" style={{ fontVariant: 'small-caps' }}>
            Nedělní čtení
          </h1>
          <p className="font-serif text-lg text-muted-foreground md:text-xl">
            Kazatelský cyklus CČSH
          </p>
          {sundayTitle && (
            <p className="mt-5 font-serif text-xl font-medium text-foreground md:text-2xl">
              {sundayTitle}
            </p>
          )}
          <p className="mt-2 text-base text-muted-foreground capitalize md:text-lg">
            {formattedDate}
          </p>
        </header>

        {/* Error */}
        {error && !loading && (
          <div className="text-center">
            <p className="font-serif text-base text-destructive">{error}</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-4 py-16">
            <Loader2 className="h-7 w-7 animate-spin text-foreground/40" />
            <p className="font-serif text-base text-muted-foreground md:text-lg">
              Stahuji aktuální čtení…
            </p>
          </div>
        )}

        {markdown && (
          <article className="prose-reading">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {markdown}
            </ReactMarkdown>
          </article>
        )}
      </div>
    </div>
  );
};

export default Index;
