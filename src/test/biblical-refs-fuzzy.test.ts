import { describe, it, expect } from "vitest";
import { parseRef, refsOverlap } from "../../supabase/functions/_shared/biblical-refs";

describe("parseRef", () => {
  it("parses simple ref", () => {
    expect(parseRef("Ř 8,8-11")).toEqual({ book: "Ř", chapter: 8, verseStart: 8, verseEnd: 11 });
  });

  it("parses single verse", () => {
    expect(parseRef("J 14,26")).toEqual({ book: "J", chapter: 14, verseStart: 26, verseEnd: 26 });
  });

  it("parses numbered book", () => {
    expect(parseRef("2Tm 3,12")).toEqual({ book: "2Tm", chapter: 3, verseStart: 12, verseEnd: 12 });
  });

  it("returns null for invalid ref", () => {
    expect(parseRef("invalid")).toBeNull();
  });
});

describe("refsOverlap", () => {
  it("detects overlapping verse ranges", () => {
    expect(refsOverlap("Ř 8,8-11", "Ř 8,9-11")).toBe(true);
  });

  it("detects contained range", () => {
    expect(refsOverlap("J 11,1-45", "J 11,1-45")).toBe(true);
  });

  it("detects partial overlap", () => {
    expect(refsOverlap("Mt 4,1-11", "Mt 4,5-15")).toBe(true);
  });

  it("rejects non-overlapping ranges", () => {
    expect(refsOverlap("Ř 8,8-11", "Ř 8,12-17")).toBe(false);
  });

  it("rejects different books", () => {
    expect(refsOverlap("Ř 8,8-11", "J 8,8-11")).toBe(false);
  });

  it("rejects different chapters", () => {
    expect(refsOverlap("Ř 8,8-11", "Ř 9,8-11")).toBe(false);
  });

  it("handles single verse matching range", () => {
    expect(refsOverlap("J 14,26", "J 14,25-27")).toBe(true);
  });

  it("handles single verse not in range", () => {
    expect(refsOverlap("J 14,26", "J 14,1-10")).toBe(false);
  });
});
