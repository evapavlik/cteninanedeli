/**
 * localStorage keys for AI-generated data, shared between useAIData (reads,
 * writes) and useReadings (invalidation on content change).
 *
 * Every new key MUST be added to AI_CACHE_KEYS, otherwise useReadings won't
 * clear it when the Sunday content changes and users may see stale AI data.
 * The ai-cache-keys test enforces this.
 */
export const CONTEXT_CACHE_KEY = "ccsh-context-cache";
export const ANNOTATE_CACHE_KEY = "ccsh-annotate-cache";
export const POSTILY_CACHE_KEY = "ccsh-postily-cache";
export const CZ_CACHE_KEY = "ccsh-czech-zapas-cache";
export const CCSH_SERMONS_CACHE_KEY = "ccsh-sermons-cache";

export const AI_CACHE_KEYS = [
  CONTEXT_CACHE_KEY,
  ANNOTATE_CACHE_KEY,
  POSTILY_CACHE_KEY,
  CZ_CACHE_KEY,
  CCSH_SERMONS_CACHE_KEY,
];
