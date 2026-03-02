import { describe, it, expect } from "vitest";

/**
 * Tests for the AI content validation logic used in useAIData.ts.
 * When Gemini returns 429, the edge function returns fallback entries
 * with empty AI fields (quotes=[], insight=""). These should NOT be
 * cached or displayed.
 */

// Replicates the filter logic from useAIData.ts
function filterWithInsights<T extends { insight?: string; quotes?: string[] }>(
  entries: T[],
): T[] {
  return entries.filter(
    (p) => p.insight || (p.quotes && p.quotes.length > 0),
  );
}

describe("AI content validation (postily / czech_zapas)", () => {
  it("filters out entries with empty AI fields (429 fallback)", () => {
    const fallbackEntries = [
      {
        postil_number: 1,
        title: "Test Postila",
        source_ref: "ref",
        year: 1922,
        matched_ref: "Mt 5,1-12",
        quotes: [],
        insight: "",
        relevance: "",
        preaching_angle: "",
        full_text: "Full text of the postila...",
      },
    ];
    expect(filterWithInsights(fallbackEntries)).toHaveLength(0);
  });

  it("keeps entries with insight", () => {
    const entries = [
      {
        postil_number: 1,
        title: "Test Postila",
        source_ref: "ref",
        year: 1922,
        matched_ref: "Mt 5,1-12",
        quotes: [],
        insight: "Farský zde zdůrazňuje důležitost blahoslavenství...",
        relevance: "Relevant today",
        preaching_angle: "Focus on mercy",
        full_text: "Full text...",
      },
    ];
    expect(filterWithInsights(entries)).toHaveLength(1);
  });

  it("keeps entries with quotes even if insight is empty", () => {
    const entries = [
      {
        postil_number: 1,
        title: "Test Postila",
        source_ref: "ref",
        year: 1922,
        matched_ref: "Mt 5,1-12",
        quotes: ["Kristus praví..."],
        insight: "",
        relevance: "",
        preaching_angle: "",
        full_text: "Full text...",
      },
    ];
    expect(filterWithInsights(entries)).toHaveLength(1);
  });

  it("filters mixed array: keeps valid, removes fallback", () => {
    const entries = [
      {
        postil_number: 1,
        title: "Valid",
        source_ref: "ref",
        year: 1922,
        matched_ref: "Mt 5",
        quotes: ["A quote"],
        insight: "An insight",
        relevance: "Relevant",
        preaching_angle: "An angle",
        full_text: "Full text...",
      },
      {
        postil_number: 2,
        title: "Fallback",
        source_ref: "ref",
        year: 1923,
        matched_ref: "Lk 10",
        quotes: [],
        insight: "",
        relevance: "",
        preaching_angle: "",
        full_text: "Full text...",
      },
    ];
    const result = filterWithInsights(entries);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Valid");
  });
});
