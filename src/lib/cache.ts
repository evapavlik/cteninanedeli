const CACHE_VERSION = 5;

interface CacheEntry<T> {
  sundayTitle: string;
  data: T;
  timestamp: number;
  version: number;
}

export function saveCache<T>(key: string, sundayTitle: string, data: T): void {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ sundayTitle, data, timestamp: Date.now(), version: CACHE_VERSION }),
    );
  } catch {
    /* localStorage full or unavailable */
  }
}

export function loadCache<T>(key: string, sundayTitle: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: CacheEntry<T> = JSON.parse(raw);
    if (parsed.sundayTitle === sundayTitle && parsed.data && parsed.version === CACHE_VERSION) {
      return parsed.data;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearCaches(keys: string[]): void {
  keys.forEach((k) => localStorage.removeItem(k));
}
