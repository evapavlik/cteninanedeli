import { describe, it, expect } from "vitest";
import {
  extractBiblicalRefsFromPromluvaTitle,
  extractCzIssue,
} from "./ccsh-promluvy-scraper";

describe("extractBiblicalRefsFromPromluvaTitle", () => {
  it("extracts ref from parenthesized format", () => {
    const result = extractBiblicalRefsFromPromluvaTitle(
      "Já jsem vzkříšení i život (J 11,1-45)"
    );
    expect(result.refs).toEqual(["J 11,1-45"]);
    expect(result.raw).toBe("J 11,1-45");
  });

  it("extracts ref with en-dash", () => {
    const result = extractBiblicalRefsFromPromluvaTitle(
      "Podobenství o soudci a vdově (L 18,1–8)"
    );
    expect(result.refs).toEqual(["Lk 18,1-8"]);
  });

  it("extracts multiple refs separated by semicolon", () => {
    const result = extractBiblicalRefsFromPromluvaTitle(
      "Sebezapření Petra (J 21,18-19; 2 Tm 4,6)"
    );
    expect(result.refs.length).toBe(2);
    expect(result.refs[0]).toBe("J 21,18-19");
    expect(result.refs[1]).toBe("2Tm 4,6");
  });

  it("returns empty for title without biblical ref", () => {
    const result = extractBiblicalRefsFromPromluvaTitle(
      "Uzdravení slepého - záznamy z neděle 15.3."
    );
    expect(result.refs).toEqual([]);
    expect(result.raw).toBeNull();
  });

  it("returns empty for title with non-biblical parenthesized text", () => {
    const result = extractBiblicalRefsFromPromluvaTitle(
      "Pokušení na poušti (záznamy z neděle)"
    );
    expect(result.refs).toEqual([]);
  });

  it("handles &nbsp; in title", () => {
    const result = extractBiblicalRefsFromPromluvaTitle(
      "Já jsem vzkříšení i&nbsp;život (J 11,1-45)"
    );
    expect(result.refs).toEqual(["J 11,1-45"]);
  });

  it("handles quoted title with ref", () => {
    const result = extractBiblicalRefsFromPromluvaTitle(
      '\u201EDej mi nap\u00EDt\u201C (J 4,5-12)'
    );
    expect(result.refs).toEqual(["J 4,5-12"]);
  });
});

describe("extractCzIssue", () => {
  it("extracts from (ČZ N/YYYY) format", () => {
    const result = extractCzIssue("(ČZ 12/2026) Byl nemocen jeden člověk...");
    expect(result.issueNumber).toBe(12);
    expect(result.year).toBe(2026);
  });

  it("extracts from Český zápas č. format", () => {
    const result = extractCzIssue(
      "Autor: Petra Šenková\nČeský zápas č. 12/2026 z 22. 3. 2026"
    );
    expect(result.issueNumber).toBe(12);
    expect(result.year).toBe(2026);
  });

  it("returns null when no ČZ reference found", () => {
    const result = extractCzIssue("Sestry a bratři, dnes se zamyslíme...");
    expect(result.issueNumber).toBeNull();
    expect(result.year).toBeNull();
  });
});
