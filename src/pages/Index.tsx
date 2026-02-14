import { useState, useEffect, useRef, useCallback } from "react";

import { fetchCyklus, getCachedCyklus } from "@/lib/api/firecrawl";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Moon, Sun } from "lucide-react";
import { ReadingToolbar } from "@/components/ReadingToolbar";
import { AnnotatedText } from "@/components/AnnotatedText";
import { LectorGuide } from "@/components/LectorGuide";
import { toast } from "sonner";
import ccshChalice from "@/assets/ccsh-chalice.svg";

const Index = () => {
  const cached = getCachedCyklus();
  const [markdown, setMarkdown] = useState<string | null>(cached?.markdown || null);
  const [annotatedMarkdown, setAnnotatedMarkdown] = useState<string | null>(null);
  const [sundayTitle, setSundayTitle] = useState<string>(cached?.sundayTitle || "");
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as "light" | "dark") || "light";
    }
    return "light";
  });

  // Toolbar state
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [fontSize, setFontSize] = useState(21);
  const [lineHeight, setLineHeight] = useState(1.9);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    if (theme === "dark") document.documentElement.classList.add("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  };

  const themeIcon = theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />;
  const themeLabel = theme === "light" ? "Noční režim" : "Denní režim";

  // Auto-fetch on mount (background refresh if cached)
  useEffect(() => {
    const load = async () => {
      if (!markdown) setLoading(true);
      setError(null);
      const result = await fetchCyklus();
      if (result.success && result.markdown) {
        setMarkdown(result.markdown);
        setSundayTitle(result.sundayTitle || "");
      } else if (!markdown) {
        // Only show error if we have no cached data
        setError(result.error || "Nepodařilo se načíst čtení.");
      }
      setLoading(false);
    };
    load();
  }, []);

  // Annotate via AI
  const handleAnnotate = useCallback(async () => {
    if (!markdown || isAnnotating) return;

    if (annotatedMarkdown) {
      setAnnotatedMarkdown(null);
      return;
    }

    setIsAnnotating(true);
    try {
      const { data, error } = await supabase.functions.invoke("annotate-reading", {
        body: { text: markdown },
      });

      if (error) throw error;
      if (data?.annotated) {
        setAnnotatedMarkdown(data.annotated);
        toast.success("Značky pro přednes přidány");
      } else {
        throw new Error("Prázdná odpověď");
      }
    } catch (e) {
      console.error("Annotation error:", e);
      toast.error("Nepodařilo se anotovat text");
    } finally {
      setIsAnnotating(false);
    }
  }, [markdown, isAnnotating, annotatedMarkdown]);

  const displayMarkdown = annotatedMarkdown || markdown;

  return (
    <div className="min-h-screen bg-background" ref={scrollRef}>
      <div className="mx-auto max-w-2xl px-5 py-10 md:px-6 md:py-20">
        {/* Dark mode toggle */}
        <div className="flex justify-end mb-6">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-foreground/60 hover:text-foreground transition-colors"
            aria-label={themeLabel}
            title={themeLabel}
          >
            {themeIcon}
          </button>
        </div>

        {/* Header */}
        <header className="mb-14 text-center md:mb-20">
          <img src={ccshChalice} alt="Kalich CČSH" className="mx-auto mb-6 h-14 w-auto md:h-16" style={{ filter: 'var(--chalice-filter, none)' }} />
          <h1 className="mb-3 text-2xl font-normal tracking-wider text-foreground/80 md:text-3xl" style={{ fontFamily: "'Playfair Display SC', Georgia, serif", letterSpacing: '0.15em' }}>
            Čtení textů na neděli
          </h1>
          <div className="mx-auto mt-2 mb-1 flex items-center justify-center gap-3 text-muted-foreground/35">
            <span className="block h-px w-12 bg-current" />
            <span className="text-[0.55rem]">✦</span>
            <span className="block h-px w-12 bg-current" />
          </div>
          {sundayTitle && (
            <p className="mt-5 font-serif text-lg font-medium text-foreground md:text-xl">
              {sundayTitle}
            </p>
          )}
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

        {/* Lector guide */}
        <LectorGuide />

        {displayMarkdown && (
          <>
            <ReadingToolbar
              onAnnotate={handleAnnotate}
              isAnnotating={isAnnotating}
              isAnnotated={!!annotatedMarkdown}
              fontSize={fontSize}
              onFontSizeChange={setFontSize}
              lineHeight={lineHeight}
              onLineHeightChange={setLineHeight}
            />

            {/* Legend for annotations */}
            {annotatedMarkdown && (
              <div className="mb-8 flex flex-wrap justify-center gap-4 font-sans text-xs text-muted-foreground">
                <span><span className="text-amber-600 dark:text-amber-400 font-medium">‖</span> pauza</span>
                <span><span className="text-red-600 dark:text-red-400 font-medium">‖‖</span> dlouhá pauza</span>
                <span><span className="text-blue-600 dark:text-blue-400 font-medium">▼</span> pomalu</span>
                <span><span className="text-green-600 dark:text-green-400 font-medium">▲</span> normálně</span>
                <span><strong>tučně</strong> = důraz</span>
              </div>
            )}

            <AnnotatedText
              markdown={displayMarkdown}
              fontSize={fontSize}
              lineHeight={lineHeight}
            />

            {/* Ending ornament */}
            <div className="mt-16 mb-8 flex items-center justify-center gap-3 text-muted-foreground/30">
              <span className="block h-px w-12 bg-current" />
              <span className="text-[0.55rem]">✦</span>
              <span className="block h-px w-12 bg-current" />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Index;
