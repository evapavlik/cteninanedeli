import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";

import { fetchCyklus, getCachedCyklus } from "@/lib/api/firecrawl";
import { Loader2, Moon, Sun } from "lucide-react";
import type { ReadingContextEntry } from "@/components/ReadingContext";
import type { PreachingInspirationData } from "@/components/PreachingInspiration";
import ccshChalice from "@/assets/ccsh-chalice.svg";

const LectorGuide = lazy(() => import("@/components/LectorGuide").then(m => ({ default: m.LectorGuide })));
const SectionProgress = lazy(() => import("@/components/SectionProgress").then(m => ({ default: m.SectionProgress })));
const AnnotatedText = lazy(() => import("@/components/AnnotatedText").then(m => ({ default: m.AnnotatedText })));
const ReadingToolbar = lazy(() => import("@/components/ReadingToolbar").then(m => ({ default: m.ReadingToolbar })));
const ReadingContext = lazy(() => import("@/components/ReadingContext").then(m => ({ default: m.ReadingContext })));
const PreachingInspiration = lazy(() => import("@/components/PreachingInspiration").then(m => ({ default: m.PreachingInspiration })));

/* ---------- Generic localStorage cache ---------- */

const CACHE_VERSION = 3;

function saveCache<T>(key: string, sundayTitle: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify({ sundayTitle, data, ts: Date.now(), v: CACHE_VERSION }));
  } catch { /* full */ }
}

function loadCache<T>(key: string, sundayTitle: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p.sundayTitle === sundayTitle && p.data && p.v === CACHE_VERSION) return p.data as T;
    return null;
  } catch { return null; }
}

/* ---------- Component ---------- */

const Index = () => {
  const cached = getCachedCyklus();
  const [markdown, setMarkdown] = useState<string | null>(cached?.markdown || null);
  const [annotatedMarkdown, setAnnotatedMarkdown] = useState<string | null>(() =>
    cached?.sundayTitle ? loadCache<string>("ccsh-annotate", cached.sundayTitle) : null
  );
  const [sundayTitle, setSundayTitle] = useState(cached?.sundayTitle || "");
  const [sundayDate, setSundayDate] = useState<string | null>(cached?.sundayDate || null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof window !== "undefined" ? (localStorage.getItem("theme") as "light" | "dark") || "light" : "light"
  );

  const [contextData, setContextData] = useState<ReadingContextEntry[] | null>(() =>
    cached?.sundayTitle ? loadCache("ccsh-context", cached.sundayTitle) : null
  );
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [activeReadingIndex, setActiveReadingIndex] = useState(0);

  const [postilyData, setPostilyData] = useState<PreachingInspirationData | null>(() =>
    cached?.sundayTitle ? loadCache("ccsh-postily", cached.sundayTitle) : null
  );
  const [isLoadingPostily, setIsLoadingPostily] = useState(false);
  const [isInspirationOpen, setIsInspirationOpen] = useState(false);

  const [isAnnotating, setIsAnnotating] = useState(false);
  const [fontSize, setFontSize] = useState(21);
  const [lineHeight, setLineHeight] = useState(1.9);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Theme
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Auto-fetch readings on mount
  useEffect(() => {
    (async () => {
      if (!markdown) setLoading(true);
      setError(null);
      const result = await fetchCyklus();
      if (result.success && result.markdown) {
        setMarkdown(result.markdown);
        setSundayTitle(result.sundayTitle || "");
        setSundayDate(result.sundayDate || null);
      } else if (!markdown) {
        setError(result.error || "Nepodařilo se načíst čtení.");
      }
      setLoading(false);
    })();
  }, []);

  // Fetch AI data (context + postily) once markdown is available
  useEffect(() => {
    if (!markdown) return;
    const fetchAi = async (mode: string, cacheKey: string, setter: (d: any) => void, current: unknown) => {
      if (current) return;
      if (sundayTitle) {
        const c = loadCache(cacheKey, sundayTitle);
        if (c) { setter(c); return; }
      }
      const setLoading = mode === "context" ? setIsLoadingContext : setIsLoadingPostily;
      setLoading(true);
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await supabase.functions.invoke("annotate-reading", {
          body: { text: markdown, mode },
        });
        if (error) throw error;
        const result = mode === "context" ? data?.context?.readings : data?.postily;
        if (result && (mode !== "postily" || result.postily?.length > 0)) {
          setter(result);
          if (sundayTitle) saveCache(cacheKey, sundayTitle, result);
        }
      } catch (e) { console.error(`${mode} fetch error:`, e); }
      finally { setLoading(false); }
    };
    fetchAi("context", "ccsh-context", setContextData, contextData);
    fetchAi("postily", "ccsh-postily", setPostilyData, postilyData);
  }, [markdown, sundayTitle]);

  // Track active reading via IntersectionObserver
  useEffect(() => {
    if (!annotatedMarkdown && !markdown) return;
    let cleanup: (() => void) | undefined;
    const timer = setTimeout(() => {
      const headings = document.querySelector(".prose-reading")?.querySelectorAll("h2");
      if (!headings?.length) return;
      const observer = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              const idx = Array.from(headings).indexOf(e.target as HTMLHeadingElement);
              if (idx >= 0) setActiveReadingIndex(idx);
            }
          }
        },
        { rootMargin: "-120px 0px -60% 0px", threshold: 0 }
      );
      headings.forEach((h) => observer.observe(h));
      cleanup = () => observer.disconnect();
    }, 300);
    return () => { clearTimeout(timer); cleanup?.(); };
  }, [markdown, annotatedMarkdown]);

  // Annotate via AI
  const handleAnnotate = useCallback(async () => {
    if (!markdown || isAnnotating) return;
    if (annotatedMarkdown) { setAnnotatedMarkdown(null); return; }
    setIsAnnotating(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { toast } = await import("sonner");
      const { data, error } = await supabase.functions.invoke("annotate-reading", {
        body: { text: markdown },
      });
      if (error) throw error;
      if (data?.annotated) {
        setAnnotatedMarkdown(data.annotated);
        if (sundayTitle) saveCache("ccsh-annotate", sundayTitle, data.annotated);
        toast.success("Značky pro přednes přidány");
      } else { throw new Error("Prázdná odpověď"); }
    } catch (e) {
      console.error("Annotation error:", e);
      const { toast } = await import("sonner");
      toast.error("Nepodařilo se anotovat text");
    } finally { setIsAnnotating(false); }
  }, [markdown, isAnnotating, annotatedMarkdown]);

  const displayMarkdown = annotatedMarkdown || markdown;

  return (
    <main className="min-h-screen bg-background" ref={scrollRef}>
      <div className="mx-auto max-w-2xl px-5 py-10 md:px-6 md:py-20" style={{ minHeight: 'calc(100vh - 140px)' }}>
        {/* Dark mode toggle */}
        <div className="flex justify-end mb-6">
          <button
            onClick={() => setTheme(t => t === "light" ? "dark" : "light")}
            className="p-2 rounded-full text-foreground/60 hover:text-foreground transition-colors"
            aria-label={theme === "light" ? "Noční režim" : "Denní režim"}
            title={theme === "light" ? "Noční režim" : "Denní režim"}
          >
            {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>
        </div>

        {/* Header */}
        <header className="mb-14 text-center md:mb-20">
          <img src={ccshChalice} alt="Kalich CČSH" width="20" height="56" className="mx-auto mb-6 h-14 w-auto md:h-16" style={{ filter: 'var(--chalice-filter, none)' }} loading="eager" decoding="sync" />
          <h1 className="mb-3 text-2xl font-normal tracking-wider text-foreground/80 md:text-3xl" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Čtení textů na neděli
          </h1>
          <div className="mx-auto mt-2 mb-1 flex items-center justify-center gap-3 text-muted-foreground/35">
            <span className="block h-px w-12 bg-current" />
            <span className="text-[0.55rem]">✦</span>
            <span className="block h-px w-12 bg-current" />
          </div>
          {sundayDate && (
            <p className="mt-5 font-serif text-lg font-medium text-foreground md:text-xl">
              {new Date(sundayDate + 'T00:00:00').toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
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
          <div className="flex flex-col items-center gap-4 py-16" style={{ minHeight: '50vh' }}>
            <Loader2 className="h-7 w-7 animate-spin text-foreground/40" />
            <p className="font-serif text-base text-muted-foreground md:text-lg">
              Stahuji aktuální čtení…
            </p>
          </div>
        )}

        {/* Lector guide */}
        <Suspense fallback={null}>
          <LectorGuide />
        </Suspense>

        {displayMarkdown && (
          <>
            <Suspense fallback={null}>
              {contextData && (
                <ReadingContext
                  readings={contextData}
                  open={isGuideOpen}
                  onOpenChange={setIsGuideOpen}
                  initialIndex={activeReadingIndex}
                  onOpenInspiration={() => setIsInspirationOpen(true)}
                  hasInspiration={!!postilyData}
                />
              )}

              {postilyData && (
                <PreachingInspiration
                  data={postilyData}
                  open={isInspirationOpen}
                  onOpenChange={setIsInspirationOpen}
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
                  onOpenInspiration={() => setIsInspirationOpen(true)}
                  hasInspiration={!!postilyData}
                  isLoadingInspiration={isLoadingPostily}
                />

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
        <p>S láskou k poznání vytvořila Eva Pavlíková.</p>
        <p className="mt-1">
          Našli jste chybu? Napište mi na{" "}
          <a
            href="mailto:eva.pavlik@gmail.com?subject=%C4%8Cten%C3%AD%20na%20ned%C4%9Bli"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            email
          </a>.
        </p>
      </footer>
    </main>
  );
};

export default Index;
