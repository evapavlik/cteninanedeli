import { useState, useEffect, useCallback } from "react";
import { saveCache, loadCache } from "@/lib/cache";
import type { ReadingContextEntry } from "@/components/ReadingContext";
import type { PreachingInspirationData, CzechZapasInsight } from "@/components/PreachingInspiration";

const CONTEXT_CACHE_KEY = "ccsh-context-cache";
const ANNOTATE_CACHE_KEY = "ccsh-annotate-cache";
const POSTILY_CACHE_KEY = "ccsh-postily-cache";
const CZ_CACHE_KEY = "ccsh-czech-zapas-cache";

/**
 * Hook that manages AI-generated data (context, postily, annotations).
 * Automatically fetches context and postily when markdown is available.
 * Provides handleAnnotate for on-demand annotation toggling.
 *
 * @param invalidationEpoch - bumped by useReadings when content changes,
 *   forcing AI data to re-fetch even for the same sundayTitle.
 */
export function useAIData(
  markdown: string | null,
  sundayTitle: string,
  invalidationEpoch: number,
) {
  // --- Context ---
  const [contextData, setContextData] = useState<ReadingContextEntry[] | null>(() => {
    if (sundayTitle) return loadCache<ReadingContextEntry[]>(CONTEXT_CACHE_KEY, sundayTitle);
    return null;
  });
  const [isLoadingContext, setIsLoadingContext] = useState(false);

  // --- Postily ---
  const [postilyData, setPostilyData] = useState<PreachingInspirationData | null>(() => {
    if (sundayTitle) return loadCache<PreachingInspirationData>(POSTILY_CACHE_KEY, sundayTitle);
    return null;
  });
  const [isLoadingPostily, setIsLoadingPostily] = useState(false);

  // --- Czech Zápas ---
  const [czData, setCzData] = useState<{ czech_zapas: CzechZapasInsight[]; cross_era_tension?: string | null } | null>(() => {
    if (sundayTitle) return loadCache<{ czech_zapas: CzechZapasInsight[]; cross_era_tension?: string | null }>(CZ_CACHE_KEY, sundayTitle);
    return null;
  });
  const [isLoadingCz, setIsLoadingCz] = useState(false);

  // --- Annotate ---
  const [annotatedMarkdown, setAnnotatedMarkdown] = useState<string | null>(() => {
    if (sundayTitle) return loadCache<string>(ANNOTATE_CACHE_KEY, sundayTitle);
    return null;
  });
  const [isAnnotating, setIsAnnotating] = useState(false);

  // Reset AI state when epoch changes (content was invalidated by useReadings)
  useEffect(() => {
    if (invalidationEpoch === 0) return; // skip initial render
    setContextData(null);
    setPostilyData(null);
    setCzData(null);
    setAnnotatedMarkdown(null);
  }, [invalidationEpoch]);

  // Fetch context automatically
  useEffect(() => {
    if (!markdown || contextData) return;

    if (sundayTitle) {
      const cached = loadCache<ReadingContextEntry[]>(CONTEXT_CACHE_KEY, sundayTitle);
      if (cached) {
        setContextData(cached);
        return;
      }
    }

    const fetchContext = async () => {
      setIsLoadingContext(true);
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await supabase.functions.invoke("annotate-reading", {
          body: { text: markdown, mode: "context" },
        });
        if (error) throw error;
        if (data?.context?.readings) {
          setContextData(data.context.readings);
          if (sundayTitle) saveCache(CONTEXT_CACHE_KEY, sundayTitle, data.context.readings);
        }
      } catch (e) {
        console.error("Context fetch error:", e);
      } finally {
        setIsLoadingContext(false);
      }
    };
    fetchContext();
  }, [markdown, sundayTitle, invalidationEpoch]);

  // Fetch postily automatically
  useEffect(() => {
    if (!markdown || postilyData) return;

    if (sundayTitle) {
      const cached = loadCache<PreachingInspirationData>(POSTILY_CACHE_KEY, sundayTitle);
      if (cached) {
        setPostilyData(cached);
        return;
      }
    }

    const fetchPostily = async () => {
      setIsLoadingPostily(true);
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await supabase.functions.invoke("annotate-reading", {
          body: { text: markdown, mode: "postily" },
        });
        if (error) throw error;
        const postilyResult = data?.postily;
        const postilyArray = Array.isArray(postilyResult) ? postilyResult : postilyResult?.postily;
        if (postilyArray && postilyArray.length > 0) {
          // Filter out entries without AI content (e.g. 429 fallback with empty fields)
          const withInsights = postilyArray.filter(
            (p: any) => p.insight || (p.quotes && p.quotes.length > 0),
          );
          if (withInsights.length > 0) {
            const normalized: PreachingInspirationData = { postily: withInsights };
            setPostilyData(normalized);
            if (sundayTitle) saveCache(POSTILY_CACHE_KEY, sundayTitle, normalized);
          }
        }
      } catch (e) {
        console.error("Postily fetch error:", e);
      } finally {
        setIsLoadingPostily(false);
      }
    };
    fetchPostily();
  }, [markdown, sundayTitle, invalidationEpoch]);

  // Fetch czech_zapas automatically
  useEffect(() => {
    if (!markdown || czData) return;

    if (sundayTitle) {
      const cached = loadCache<{ czech_zapas: CzechZapasInsight[] }>(CZ_CACHE_KEY, sundayTitle);
      if (cached) {
        setCzData(cached);
        return;
      }
    }

    const fetchCzechZapas = async () => {
      setIsLoadingCz(true);
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await supabase.functions.invoke("annotate-reading", {
          body: { text: markdown, mode: "czech_zapas", liturgicalContext: sundayTitle },
        });
        if (error) throw error;
        const czResult = data?.czech_zapas;
        const czArray = Array.isArray(czResult) ? czResult : czResult?.czech_zapas;
        const crossEraTension = Array.isArray(czResult) ? null : (czResult?.cross_era_tension ?? null);
        if (czArray && czArray.length > 0) {
          // Filter out entries without AI content (e.g. 429 fallback with empty fields)
          const withInsights = czArray.filter(
            (a: any) => a.insight || (a.quotes && a.quotes.length > 0),
          );
          if (withInsights.length > 0) {
            const normalized = { czech_zapas: withInsights, cross_era_tension: crossEraTension };
            setCzData(normalized);
            if (sundayTitle) saveCache(CZ_CACHE_KEY, sundayTitle, normalized);
          }
        }
      } catch (e) {
        console.error("Czech zapas fetch error:", e);
      } finally {
        setIsLoadingCz(false);
      }
    };
    fetchCzechZapas();
  }, [markdown, sundayTitle, invalidationEpoch]);

  // Toggle annotations on demand
  const handleAnnotate = useCallback(async () => {
    if (!markdown || isAnnotating) return;

    if (annotatedMarkdown) {
      setAnnotatedMarkdown(null);
      return;
    }

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
        if (sundayTitle) saveCache(ANNOTATE_CACHE_KEY, sundayTitle, data.annotated);
        toast.success("Značky pro přednes přidány");
      } else {
        throw new Error("Prázdná odpověď");
      }
    } catch (e) {
      console.error("Annotation error:", e);
      const { toast } = await import("sonner");
      toast.error("Nepodařilo se anotovat text");
    } finally {
      setIsAnnotating(false);
    }
  }, [markdown, isAnnotating, annotatedMarkdown, sundayTitle]);

  return {
    contextData,
    isLoadingContext,
    postilyData,
    isLoadingPostily,
    czData,
    isLoadingCz,
    annotatedMarkdown,
    isAnnotating,
    handleAnnotate,
  };
}
