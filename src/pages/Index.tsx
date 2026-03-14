import { useState, useEffect, useRef, lazy, Suspense } from "react";

import { useReadings } from "@/hooks/useReadings";
import { useAIData } from "@/hooks/useAIData";
import { trackEvent } from "@/lib/analytics";
import { Loader2, Moon, Sun, Mail, Heart, Coffee } from "lucide-react";
import ccshChalice from "@/assets/ccsh-chalice.svg";
import { NotificationButton } from "@/components/NotificationButton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { AudioPlayback } from "@/components/AudioPlayback";

// Retry wrapper for lazy imports — retries once on chunk load failure
function lazyRetry<T extends { default: any }>(fn: () => Promise<T>): Promise<T> {
  return fn().catch(() => fn());
}

// Lazy-load all heavy components to reduce initial JS
const LectorGuide = lazy(() => lazyRetry(() => import("@/components/LectorGuide").then(m => ({ default: m.LectorGuide }))));
const SectionProgress = lazy(() => lazyRetry(() => import("@/components/SectionProgress").then(m => ({ default: m.SectionProgress }))));
const AnnotatedText = lazy(() => lazyRetry(() => import("@/components/AnnotatedText").then(m => ({ default: m.AnnotatedText }))));
const ReadingToolbar = lazy(() => lazyRetry(() => import("@/components/ReadingToolbar").then(m => ({ default: m.ReadingToolbar }))));
const ReadingContext = lazy(() => lazyRetry(() => import("@/components/ReadingContext").then(m => ({ default: m.ReadingContext }))));
const PreachingInspiration = lazy(() => lazyRetry(() => import("@/components/PreachingInspiration").then(m => ({ default: m.PreachingInspiration }))));

const Index = () => {
  const { markdown, sundayTitle, sundayDate, loading, error, invalidationEpoch } = useReadings();
  const {
    contextData, isLoadingContext,
    postilyData, isLoadingPostily,
    czData, isLoadingCz,
    annotatedMarkdown, isAnnotating, handleAnnotate,
  } = useAIData(markdown, sundayTitle, invalidationEpoch);
  const {
    isRecording, audioUrl, duration, error: recorderError,
    startRecording, stopRecording, clearRecording,
  } = useVoiceRecorder();

  // Theme
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as "light" | "dark") || "light";
    }
    return "light";
  });

  // UI panels
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isInspirationOpen, setIsInspirationOpen] = useState(false);
  const [activeReadingIndex, setActiveReadingIndex] = useState(0);

  // Typography
  const [fontSize, setFontSize] = useState(24);
  const [lineHeight, setLineHeight] = useState(2.0);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { trackEvent("page_view"); }, []);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    if (theme === "dark") document.documentElement.classList.add("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => {
      const next = t === "light" ? "dark" : "light";
      trackEvent("theme_toggle", { to: next });
      return next;
    });
  };

  const themeIcon = theme === "light" ? <Moon className="h-6 w-6" /> : <Sun className="h-6 w-6" />;
  const themeLabel = theme === "light" ? "Noční režim" : "Denní režim";

  // Track which reading heading is currently in view via IntersectionObserver
  const displayMarkdown = annotatedMarkdown || markdown;

  useEffect(() => {
    if (!displayMarkdown) return;

    const observeHeadings = () => {
      const article = document.querySelector(".prose-reading");
      if (!article) return undefined;

      const headings = article.querySelectorAll("h2");
      if (headings.length === 0) return undefined;

      // Measure sticky header so the observer triggers at the right scroll position
      const stickyEl = document.querySelector('.sticky.top-0');
      const topInset = stickyEl?.getBoundingClientRect().height ?? 120;

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const idx = Array.from(headings).indexOf(entry.target as HTMLHeadingElement);
              if (idx >= 0) setActiveReadingIndex(idx);
            }
          }
        },
        { rootMargin: `-${topInset}px 0px -60% 0px`, threshold: 0 },
      );

      headings.forEach((h) => observer.observe(h));
      return () => observer.disconnect();
    };

    let cleanup: (() => void) | undefined;
    const timer = setTimeout(() => {
      cleanup = observeHeadings();
    }, 300);
    return () => {
      clearTimeout(timer);
      cleanup?.();
    };
  }, [displayMarkdown]);

  return (
    <main className="min-h-screen bg-background flex flex-col pt-safe" ref={scrollRef}>
      <div className="mx-auto max-w-2xl px-5 py-10 md:px-6 md:py-20 flex-1" style={{ minHeight: 'calc(100vh - 140px)' }}>
        {/* Top controls: dark mode toggle + notification bell */}
        <div className="flex justify-end items-center gap-2 mb-6">
          <NotificationButton />
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-full text-foreground/60 hover:text-foreground transition-colors"
            aria-label={themeLabel}
            title={themeLabel}
          >
            {themeIcon}
          </button>
        </div>

        {/* Header */}
        <header className="mb-14 text-center md:mb-20">
          <img src={ccshChalice} alt="Kalich CČSH" width="20" height="56" className="mx-auto mb-6 h-14 w-auto md:h-16" style={{ filter: 'var(--chalice-filter, none)' }} loading="eager" decoding="sync" />
          <h1 className="mb-3 text-2xl font-normal tracking-wider text-foreground/80 md:text-3xl" style={{ fontFamily: "'Literata', Georgia, serif", letterSpacing: '0.12em', textTransform: 'uppercase' }}>
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
        <ErrorBoundary inline>
          <Suspense fallback={null}>
            <LectorGuide />
          </Suspense>
        </ErrorBoundary>

        {displayMarkdown && (
          <>
            <ErrorBoundary inline>
            <Suspense fallback={null}>
              {contextData && (
                <ReadingContext
                  readings={contextData}
                  open={isGuideOpen}
                  onOpenChange={setIsGuideOpen}
                  initialIndex={activeReadingIndex}
                  onOpenInspiration={() => setIsInspirationOpen(true)}
                  hasInspiration={!!postilyData || !!czData}
                />
              )}

              {(postilyData || czData) && (
                <PreachingInspiration
                  data={postilyData}
                  czData={czData}
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
                  onOpenGuide={() => { trackEvent("open_guide"); setIsGuideOpen(true); }}
                  hasGuide={!!contextData}
                  isLoadingGuide={isLoadingContext}
                  onOpenInspiration={() => { trackEvent("open_inspiration"); setIsInspirationOpen(true); }}
                  hasInspiration={!!postilyData || !!czData}
                  isLoadingInspiration={isLoadingPostily || isLoadingCz}
                  onToggleRecording={isRecording ? stopRecording : startRecording}
                  isRecording={isRecording}
                  recordingDuration={duration}
                />

                {/* Audio playback */}
                {audioUrl && !isRecording && (
                  <AudioPlayback
                    audioUrl={audioUrl}
                    duration={duration}
                    onRecordAgain={startRecording}
                    onDelete={clearRecording}
                  />
                )}

                {/* Recording error */}
                {recorderError && (
                  <p className="mt-2 text-center font-serif text-sm text-destructive">{recorderError}</p>
                )}

                {/* Section progress indicator */}
                <SectionProgress activeIndex={activeReadingIndex} total={3} onSelect={setActiveReadingIndex} />
              </div>

              {/* Legend for annotations */}
              {annotatedMarkdown && (
                <div className="mb-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-sans text-[0.7rem] text-muted-foreground">
                  <span><span className="text-amber-600 dark:text-amber-400 font-medium">‖</span> pauza</span>
                  <span><span className="text-red-600 dark:text-red-400 font-medium">‖‖</span> dlouhá pauza</span>
                  <span><span className="text-blue-600 dark:text-blue-400 font-medium">▼</span> pomalu</span>
                  <span><span className="text-green-600 dark:text-green-400 font-medium">▲</span> normálně</span>
                  <span><strong>tučně</strong> = důraz</span>
                  <span className="basis-full text-center text-[0.6rem] text-muted-foreground/50 italic">AI vodítko, ne závazný předpis</span>
                </div>
              )}

              <AnnotatedText
                markdown={displayMarkdown}
                fontSize={fontSize}
                lineHeight={lineHeight}
              />

            </Suspense>
            </ErrorBoundary>

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
      <footer className="border-t border-border mt-12 px-5 pt-8 pb-safe text-center font-serif text-xs text-muted-foreground/70 space-y-1.5">
        {sundayTitle && (
          <p className="mb-3 tracking-widest uppercase text-muted-foreground/50">{sundayTitle}</p>
        )}
        <p>
          Texty čtení z{" "}
          <a href="https://cyklus.ccsh.cz" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors">cyklus.ccsh.cz</a>
          {" · "}postily Karla Farského z{" "}
          <a href="https://www.ccsh.cz" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors">Českého zápasu</a>
          {" "}(1921–1924)
        </p>
        <p className="inline-flex items-center justify-center gap-1.5 flex-wrap">
          <Heart className="h-3 w-3" /> Eva Pavlíková
          <span className="text-muted-foreground/30">·</span>
          <a
            href="mailto:eva.pavlik@gmail.com?subject=%C4%8Cten%C3%AD%20na%20ned%C4%9Bli"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Mail className="h-3 w-3" />
            Napište mi
          </a>
          <span className="text-muted-foreground/30">·</span>
          <a
            href="https://buymeacoffee.com/evapavlikova"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Coffee className="h-3 w-3" />
            Podpořte projekt
          </a>
        </p>
      </footer>
    </main>
  );
};

export default Index;
