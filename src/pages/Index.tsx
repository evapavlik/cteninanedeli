import { useState, useEffect, useRef, useCallback } from "react";

import { fetchCyklus } from "@/lib/api/firecrawl";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, BookOpen, Moon, Sun } from "lucide-react";
import { ReadingToolbar } from "@/components/ReadingToolbar";
import { AnnotatedText } from "@/components/AnnotatedText";
import { toast } from "sonner";

const Index = () => {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [annotatedMarkdown, setAnnotatedMarkdown] = useState<string | null>(null);
  const [sundayTitle, setSundayTitle] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark";
    }
    return false;
  });

  // Toolbar state
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [teleprompterActive, setTeleprompterActive] = useState(false);
  const [speed, setSpeed] = useState(1.5);
  const [fontSize, setFontSize] = useState(21);
  const [lineHeight, setLineHeight] = useState(1.9);

  const scrollRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>();

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

  // Teleprompter auto-scroll
  useEffect(() => {
    if (!teleprompterActive) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    let lastTime: number | null = null;

    const scroll = (timestamp: number) => {
      if (lastTime !== null) {
        const delta = timestamp - lastTime;
        window.scrollBy(0, (speed * delta) / 50);
      }
      lastTime = timestamp;
      animFrameRef.current = requestAnimationFrame(scroll);
    };

    animFrameRef.current = requestAnimationFrame(scroll);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [teleprompterActive, speed]);

  // Annotate via AI
  const handleAnnotate = useCallback(async () => {
    if (!markdown || isAnnotating) return;

    if (annotatedMarkdown) {
      // Toggle back to original
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

  const today = new Date();
  const formattedDate = today.toLocaleDateString("cs-CZ", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const displayMarkdown = annotatedMarkdown || markdown;

  return (
    <div className="min-h-screen bg-background" ref={scrollRef}>
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

        {displayMarkdown && (
          <>
            <ReadingToolbar
              onAnnotate={handleAnnotate}
              isAnnotating={isAnnotating}
              isAnnotated={!!annotatedMarkdown}
              teleprompterActive={teleprompterActive}
              onTeleprompterToggle={() => setTeleprompterActive(!teleprompterActive)}
              speed={speed}
              onSpeedChange={setSpeed}
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
          </>
        )}
      </div>
    </div>
  );
};

export default Index;
