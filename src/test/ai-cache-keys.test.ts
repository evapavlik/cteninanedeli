import { describe, it, expect } from "vitest";
import * as keys from "@/lib/ai-cache-keys";

describe("AI cache keys", () => {
  it("AI_CACHE_KEYS contains every exported *_CACHE_KEY constant", () => {
    // Guards against adding a new AI cache without wiring its invalidation:
    // a forgotten key would keep serving stale data after content changes.
    const exportedKeys = Object.entries(keys)
      .filter(([name]) => name.endsWith("_CACHE_KEY"))
      .map(([, value]) => value);

    expect(exportedKeys.length).toBeGreaterThan(0);
    for (const key of exportedKeys) {
      expect(keys.AI_CACHE_KEYS).toContain(key);
    }
    expect(keys.AI_CACHE_KEYS).toHaveLength(exportedKeys.length);
  });

  it("keys are unique", () => {
    expect(new Set(keys.AI_CACHE_KEYS).size).toBe(keys.AI_CACHE_KEYS.length);
  });
});
