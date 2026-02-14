import { describe, it, expect, beforeEach } from "vitest";

const CONTEXT_CACHE_KEY = "ccsh-context-cache";
const ANNOTATE_CACHE_KEY = "ccsh-annotate-cache";

function saveContextToCache(sundayTitle: string, readings: any[]) {
  localStorage.setItem(CONTEXT_CACHE_KEY, JSON.stringify({ sundayTitle, readings, timestamp: Date.now() }));
}

function loadContextFromCache(sundayTitle: string): any[] | null {
  try {
    const raw = localStorage.getItem(CONTEXT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.sundayTitle === sundayTitle && parsed.readings) return parsed.readings;
    return null;
  } catch { return null; }
}

function saveAnnotateToCache(sundayTitle: string, annotated: string) {
  localStorage.setItem(ANNOTATE_CACHE_KEY, JSON.stringify({ sundayTitle, annotated, timestamp: Date.now() }));
}

function loadAnnotateFromCache(sundayTitle: string): string | null {
  try {
    const raw = localStorage.getItem(ANNOTATE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.sundayTitle === sundayTitle && parsed.annotated) return parsed.annotated;
    return null;
  } catch { return null; }
}

describe("Context cache", () => {
  beforeEach(() => localStorage.clear());

  it("returns null when empty", () => {
    expect(loadContextFromCache("test")).toBeNull();
  });

  it("saves and loads correctly", () => {
    const readings = [{ title: "Ex 24", intro: "test" }];
    saveContextToCache("7. neděle", readings);
    expect(loadContextFromCache("7. neděle")).toEqual(readings);
  });

  it("returns null for different sunday", () => {
    saveContextToCache("7. neděle", [{ title: "Ex 24" }]);
    expect(loadContextFromCache("8. neděle")).toBeNull();
  });
});

describe("Annotate cache", () => {
  beforeEach(() => localStorage.clear());

  it("returns null when empty", () => {
    expect(loadAnnotateFromCache("test")).toBeNull();
  });

  it("saves and loads correctly", () => {
    saveAnnotateToCache("7. neděle", "## Annotated [pauza] text");
    expect(loadAnnotateFromCache("7. neděle")).toBe("## Annotated [pauza] text");
  });

  it("returns null for different sunday", () => {
    saveAnnotateToCache("7. neděle", "text");
    expect(loadAnnotateFromCache("8. neděle")).toBeNull();
  });
});
