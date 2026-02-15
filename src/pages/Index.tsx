import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";

import { fetchCyklus, getCachedCyklus } from "@/lib/api/firecrawl";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Moon, Sun } from "lucide-react";
import { LectorGuide } from "@/components/LectorGuide";
import { SectionProgress } from "@/components/SectionProgress";
import type { ReadingContextEntry } from "@/components/ReadingContext";
import { toast } from "sonner";
import ccshChalice from "@/assets/ccsh-chalice.svg";

const AmbonMode = lazy(() => import("@/components/AmbonMode").then(m => ({ default: m.AmbonMode })));

// Lazy-load heavy components (react-markdown, sheet, toolbar) to reduce initial JS
const AnnotatedText = lazy(() => import("@/components/AnnotatedText").then(m => ({ default: m.AnnotatedText })));
const ReadingToolbar = lazy(() => import("@/components/ReadingToolbar").then(m => ({ default: m.ReadingToolbar })));
const ReadingContext = lazy(() => import("@/components/ReadingContext").then(m => ({ default: m.ReadingContext })));

const CONTEXT_CACHE_VERSION = 2; // bump to invalidate old cache (v2: added citations)
const CONTEXT_CACHE_KEY = "ccsh-context-cache";
const ANNOTATE_CACHE_KEY = "ccsh-annotate-cache";

function saveContextToCache(sundayTitle: string, readings: ReadingContextEntry[]) {
  try {
    localStorage.setItem(CONTEXT_CACHE_KEY, JSON.stringify({ sundayTitle, readings, timestamp: Date.now(), version: CONTEXT_CACHE_VERSION }));
  } catch { /* ignore */ }
}

function loadContextFromCache(sundayTitle: string): ReadingContextEntry[] | null {
  try {
    const raw = localStorage.getItem(CONTEXT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.sundayTitle === sundayTitle && parsed.readings && parsed.version === CONTEXT_CACHE_VERSION) {
      return parsed.readings;
    }
    return null;
  } catch {
    return null;
  }
}

function saveAnnotateToCache(sundayTitle: string, annotated: string) {
  try {
    localStorage.setItem(ANNOTATE_CACHE_KEY, JSON.stringify({ sundayTitle, annotated, timestamp: Date.now() }));
  } catch { /* ignore */ }
}

function loadAnnotateFromCache(sundayTitle: string): string | null {
  try {
    const raw = localStorage.getItem(ANNOTATE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.sundayTitle === sundayTitle && parsed.annotated) {
      return parsed.annotated;
    }
    return null;
  } catch {
    return null;
  }
}

const Index = () => {
  const cached = getCachedCyklus();
  const [markdown, setMarkdown] = useState<string | null>(cached?.markdown || null);
  const [annotatedMarkdown, setAnnotatedMarkdown] = useState<string | null>(() => {
    if (cached?.sundayTitle) return loadAnnotateFromCache(cached.sundayTitle);
    return null;
  });
  const [sundayTitle, setSundayTitle] = useState<string>(cached?.sundayTitle || "");
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as "light" | "dark") || "light";
    }
    return "light";
  });

  // Context panel state
  const [contextData, setContextData] = useState<ReadingContextEntry[] | null>(() => {
    if (cached?.sundayTitle) return loadContextFromCache(cached.sundayTitle);
    return null;
  });
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [activeReadingIndex, setActiveReadingIndex] = useState(0);

  // Toolbar state
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [fontSize, setFontSize] = useState(21);
  const [lineHeight, setLineHeight] = useState(1.9);

  const [isAmbonMode, setIsAmbonMode] = useState(false);

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
        setError(result.error || "Nepodařilo se načíst čtení.");
      }
      setLoading(false);
    };
    load();
  }, []);

  // Fetch context when markdown is available (use cache first)
  useEffect(() => {
    if (!markdown || contextData) return;

    if (sundayTitle) {
      const cachedContext = loadContextFromCache(sundayTitle);
      if (cachedContext) {
        setContextData(cachedContext);
        return;
      }
    }

    const fetchContext = async () => {
      setIsLoadingContext(true);
      try {
        const { data, error } = await supabase.functions.invoke("annotate-reading", {
          body: { text: markdown, mode: "context" },
        });
        if (error) throw error;
        if (data?.context?.readings) {
          setContextData(data.context.readings);
          if (sundayTitle) {
            saveContextToCache(sundayTitle, data.context.readings);
          }
        }
      } catch (e) {
        console.error("Context fetch error:", e);
      } finally {
        setIsLoadingContext(false);
      }
    };
    fetchContext();
  }, [markdown, sundayTitle]);

  // Track which reading heading is currently in view via IntersectionObserver
  useEffect(() => {
    const displayMd = annotatedMarkdown || markdown;
    if (!displayMd) return;

    const observeHeadings = () => {
      const article = document.querySelector(".prose-reading");
      if (!article) return undefined;

      const headings = article.querySelectorAll("h2");
      if (headings.length === 0) return undefined;

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const idx = Array.from(headings).indexOf(entry.target as HTMLHeadingElement);
              if (idx >= 0) setActiveReadingIndex(idx);
            }
          }
        },
        { rootMargin: "-120px 0px -60% 0px", threshold: 0 }
      );

      headings.forEach((h) => observer.observe(h));
      return () => observer.disconnect();
    };

    // Small delay to let markdown render
    let cleanup: (() => void) | undefined;
    const timer = setTimeout(() => {
      cleanup = observeHeadings();
    }, 300);
    return () => {
      clearTimeout(timer);
      cleanup?.();
    };
  }, [markdown, annotatedMarkdown]);

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
        if (sundayTitle) saveAnnotateToCache(sundayTitle, data.annotated);
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
    <main className="min-h-screen bg-background" ref={scrollRef}>
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
          <h1 className="mb-3 text-2xl font-normal tracking-wider text-foreground/80 md:text-3xl" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", letterSpacing: '0.12em', textTransform: 'uppercase' }}>
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
            <Suspense fallback={null}>
              {contextData && (
                <ReadingContext
                  readings={contextData}
                  open={isGuideOpen}
                  onOpenChange={setIsGuideOpen}
                  initialIndex={activeReadingIndex}
                />
              )}

              <div className="sticky top-0 z-10 bg-background pb-3">
                <ReadingToolbar
                  onAnnotate={handleAnnotate}
                  isAnnotating={isAnnotating}
                  isAnnotated={!!annotatedMarkdown}
                  fontSize={fontSize}
                  onFontSizeChange={setFontSize}
                  lineHeight={lineHeight}
                  onLineHeightChange={setLineHeight}
                  onOpenGuide={() => setIsGuideOpen(true)}
                  hasGuide={!!contextData}
                  isLoadingGuide={isLoadingContext}
                />

                {/* Section progress indicator */}
                <SectionProgress activeIndex={activeReadingIndex} total={3} onSelect={setActiveReadingIndex} />
              </div>

              {/* Legend for annotations */}
              {annotatedMarkdown && (
                <div className="mb-8 space-y-2">
                  <div className="flex flex-wrap justify-center gap-4 font-sans text-xs text-muted-foreground">
                    <span><span className="text-amber-600 dark:text-amber-400 font-medium">‖</span> pauza</span>
                    <span><span className="text-red-600 dark:text-red-400 font-medium">‖‖</span> dlouhá pauza</span>
                    <span><span className="text-blue-600 dark:text-blue-400 font-medium">▼</span> pomalu</span>
                    <span><span className="text-green-600 dark:text-green-400 font-medium">▲</span> normálně</span>
                    <span><strong>tučně</strong> = důraz</span>
                  </div>
                  <p className="text-center font-sans text-[0.65rem] text-muted-foreground/60 italic">
                    ✦ Značky byly vygenerovány pomocí AI – slouží jako vodítko, ne jako závazný předpis
                  </p>
                </div>
              )}

              <AnnotatedText
                markdown={displayMarkdown}
                fontSize={fontSize}
                lineHeight={lineHeight}
              />

            </Suspense>

            {/* Ending ornament */}
            <div className="mt-16 mb-8 flex items-center justify-center gap-3 text-muted-foreground/30">
              <span className="block h-px w-12 bg-current" />
              <span className="text-[0.55rem]">✦</span>
              <span className="block h-px w-12 bg-current" />
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-8 text-center font-serif text-sm text-muted-foreground">
        <p>Vytvořeno s láskou k poznání.</p>
        <p className="mt-1">
          Našli jste chybu? Napište na{" "}
          <a
            href="mailto:eva.pavlik@gmail.com?subject=%C4%8Cten%C3%AD%20na%20ned%C4%9Bli"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            eva.pavlik@gmail.com
          </a>{" "}
          s předmětem <span className="italic">Čtení na neděli</span>.
        </p>
      </footer>
    </main>
  );
};

export default Index;
