import { useState, useEffect, useRef, useCallback } from "react";
import { fetchCyklus, getCachedCyklus } from "@/lib/api/firecrawl";
import { clearCaches } from "@/lib/cache";

const ANNOTATE_CACHE_KEY = "ccsh-annotate-cache";
const CONTEXT_CACHE_KEY = "ccsh-context-cache";
const POSTILY_CACHE_KEY = "ccsh-postily-cache";

const AI_CACHE_KEYS = [ANNOTATE_CACHE_KEY, CONTEXT_CACHE_KEY, POSTILY_CACHE_KEY];

/**
 * Hook that manages fetching Sunday readings and detecting content changes.
 * Handles mount fetch, PWA visibility refetch, and cache invalidation.
 */
export function useReadings() {
  const cached = getCachedCyklus();
  const [markdown, setMarkdown] = useState<string | null>(cached?.markdown || null);
  const [sundayTitle, setSundayTitle] = useState(cached?.sundayTitle || "");
  const [sundayDate, setSundayDate] = useState<string | null>(cached?.sundayDate || null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  // Track previous values to detect changes
  const lastTitleRef = useRef(cached?.sundayTitle || "");
  const lastContentRef = useRef(cached?.markdown || "");

  // Increments whenever AI caches are invalidated — downstream hooks re-run
  const [invalidationEpoch, setInvalidationEpoch] = useState(0);

  const refreshData = useCallback(async () => {
    if (!markdown) setLoading(true);
    setError(null);
    const result = await fetchCyklus();
    if (result.success && result.markdown) {
      const newTitle = result.sundayTitle || "";
      const titleChanged = newTitle !== lastTitleRef.current;
      const contentChanged = result.markdown !== lastContentRef.current;

      setMarkdown(result.markdown);
      setSundayTitle(newTitle);
      setSundayDate(result.sundayDate || null);

      if (titleChanged || contentChanged) {
        clearCaches(AI_CACHE_KEYS);
        lastTitleRef.current = newTitle;
        lastContentRef.current = result.markdown;
        setInvalidationEpoch((e) => e + 1);
      }
    } else if (!markdown) {
      setError(result.error || "Nepodařilo se načíst čtení.");
    }
    setLoading(false);
  }, [markdown]);

  // Auto-fetch on mount
  useEffect(() => {
    refreshData();
  }, []);

  // Re-fetch when PWA resumes from background
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshData();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshData]);

  return { markdown, sundayTitle, sundayDate, loading, error, invalidationEpoch };
}
