import { describe, it, expect } from "vitest";
import { parseJsonLoose } from "./parse-json-loose";

describe("parseJsonLoose", () => {
  describe("happy path", () => {
    it("parses a plain object", () => {
      expect(parseJsonLoose('{"a": 1}')).toEqual({ a: 1 });
    });

    it("parses a plain array", () => {
      expect(parseJsonLoose('[{"a": 1}, {"b": 2}]')).toEqual([{ a: 1 }, { b: 2 }]);
    });

    it("parses with surrounding whitespace", () => {
      expect(parseJsonLoose('  \n\t{"a": 1}\n  ')).toEqual({ a: 1 });
    });

    it("preserves nested structures", () => {
      const obj = { readings: [{ title: "x", citations: [{ q: 1 }] }] };
      expect(parseJsonLoose(JSON.stringify(obj))).toEqual(obj);
    });
  });

  describe("Gemini code-fence wrappers", () => {
    it("strips ```json fence", () => {
      const input = '```json\n{"a": 1}\n```';
      expect(parseJsonLoose(input)).toEqual({ a: 1 });
    });

    it("strips uppercase ```JSON fence", () => {
      const input = '```JSON\n{"a": 1}\n```';
      expect(parseJsonLoose(input)).toEqual({ a: 1 });
    });

    it("strips ``` fence without language tag", () => {
      const input = '```\n{"a": 1}\n```';
      expect(parseJsonLoose(input)).toEqual({ a: 1 });
    });

    it("strips fence with array body", () => {
      const input = '```json\n[{"a": 1}]\n```';
      expect(parseJsonLoose(input)).toEqual([{ a: 1 }]);
    });

    it("strips fence with leading whitespace", () => {
      const input = '   ```json\n{"a": 1}\n```   ';
      expect(parseJsonLoose(input)).toEqual({ a: 1 });
    });

    it("handles fence with extra text after", () => {
      const input = '```json\n{"a": 1}\n```\n\nThat\'s the result.';
      expect(parseJsonLoose(input)).toEqual({ a: 1 });
    });
  });

  describe("leading/trailing prose", () => {
    it("extracts JSON when preceded by prose", () => {
      const input = 'Here is the JSON you requested:\n{"a": 1}';
      expect(parseJsonLoose(input)).toEqual({ a: 1 });
    });

    it("extracts JSON when followed by prose", () => {
      const input = '{"a": 1}\n\nHope this helps!';
      expect(parseJsonLoose(input)).toEqual({ a: 1 });
    });

    it("extracts JSON when surrounded by prose", () => {
      const input = 'Sure! {"a": 1} — done.';
      expect(parseJsonLoose(input)).toEqual({ a: 1 });
    });

    it("extracts top-level array surrounded by prose", () => {
      const input = 'Result: [{"a": 1}, {"b": 2}] — that\'s it.';
      expect(parseJsonLoose(input)).toEqual([{ a: 1 }, { b: 2 }]);
    });
  });

  describe("string content with braces", () => {
    it("ignores braces inside JSON strings", () => {
      const obj = { a: "this has { and } and [ ] inside" };
      expect(parseJsonLoose(JSON.stringify(obj))).toEqual(obj);
    });

    it("handles escaped quotes inside strings", () => {
      const obj = { a: 'she said "hi" to me' };
      expect(parseJsonLoose(JSON.stringify(obj))).toEqual(obj);
    });

    it("handles escaped backslashes followed by quote", () => {
      const obj = { a: "C:\\path\\file" };
      expect(parseJsonLoose(JSON.stringify(obj))).toEqual(obj);
    });

    it("handles strings with newlines and tabs", () => {
      const obj = { a: "line1\nline2\ttabbed" };
      expect(parseJsonLoose(JSON.stringify(obj))).toEqual(obj);
    });
  });

  describe("realistic LLM outputs", () => {
    it("parses a context-style response with code fence", () => {
      const payload = {
        readings: [
          {
            title: "První čtení",
            intro: "Slovo úvodu.",
            characters: [{ name: "Petr", description: "učedník" }],
            historical_context: "kontext",
            main_message: "poselství",
            tone: "klidně",
            citations: [{ question_number: 12, text: "...", relevance: "..." }],
            farsky: { quote: "...", source_ref: "Postila č. 1" },
          },
        ],
      };
      const input = "```json\n" + JSON.stringify(payload, null, 2) + "\n```";
      expect(parseJsonLoose(input)).toEqual(payload);
    });

    it("parses a postily-style response with prose preamble", () => {
      const payload = {
        postily: [
          { postil_number: 1, title: "...", insight: "...", quotes: ["..."] },
        ],
      };
      const input = "Tady je výsledek:\n\n" + JSON.stringify(payload);
      expect(parseJsonLoose(input)).toEqual(payload);
    });

    it("returns the first balanced block when multiple are present", () => {
      const input = '{"a": 1}\n{"b": 2}';
      expect(parseJsonLoose(input)).toEqual({ a: 1 });
    });
  });

  describe("failure cases", () => {
    it("returns null for empty string", () => {
      expect(parseJsonLoose("")).toBeNull();
    });

    it("returns null for whitespace-only string", () => {
      expect(parseJsonLoose("   \n\t  ")).toBeNull();
    });

    it("returns null for non-string input", () => {
      expect(parseJsonLoose(null)).toBeNull();
      expect(parseJsonLoose(undefined)).toBeNull();
      expect(parseJsonLoose(42)).toBeNull();
      expect(parseJsonLoose({ a: 1 })).toBeNull();
    });

    it("returns null when no JSON is present", () => {
      expect(parseJsonLoose("Just plain text without any JSON.")).toBeNull();
    });

    it("returns null for malformed JSON inside fence", () => {
      const input = '```json\n{"a": 1, "b":}\n```';
      expect(parseJsonLoose(input)).toBeNull();
    });

    it("returns null for truncated object (no matching close)", () => {
      const input = '{"a": 1, "b": [1, 2, 3';
      expect(parseJsonLoose(input)).toBeNull();
    });

    it("returns null for unmatched-quote pseudo-JSON", () => {
      const input = '{"a": "unterminated string';
      expect(parseJsonLoose(input)).toBeNull();
    });
  });
});
