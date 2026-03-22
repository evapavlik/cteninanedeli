import { describe, it, expect } from "vitest";
import {
  parseCzechDate,
  extractBiblicalRefsFromTitle,
  extractLiturgicalContext,
} from "./ccsh-kazani-scraper";

// ─── parseCzechDate ─────────────────────────────────────────────
describe("parseCzechDate", () => {
  it("parses nominative month name", () => {
    expect(parseCzechDate("18. březen 2026")).toBe("2026-03-18");
  });

  it("parses genitive month name", () => {
    expect(parseCzechDate("18. března 2026")).toBe("2026-03-18");
  });

  it("handles &nbsp; in date string", () => {
    expect(parseCzechDate("18.&nbsp;březen 2026")).toBe("2026-03-18");
  });

  it("handles single-digit day", () => {
    expect(parseCzechDate("5. červen 2023")).toBe("2023-06-05");
  });

  it("handles all months", () => {
    expect(parseCzechDate("1. leden 2024")).toBe("2024-01-01");
    expect(parseCzechDate("1. září 2024")).toBe("2024-09-01");
    expect(parseCzechDate("1. prosinec 2024")).toBe("2024-12-01");
  });

  it("returns null for invalid input", () => {
    expect(parseCzechDate("invalid")).toBeNull();
    expect(parseCzechDate("18. blurp 2026")).toBeNull();
  });
});

// ─── extractBiblicalRefsFromTitle ───────────────────────────────
describe("extractBiblicalRefsFromTitle", () => {
  it("extracts simple reference from title", () => {
    const result = extractBiblicalRefsFromTitle(
      "J 9, 1-11 Ježíš činí skutky Otce a otevírá zrak slepým"
    );
    expect(result.refs).toEqual(["J 9,1-11"]);
    expect(result.raw).toBe("J 9, 1-11");
  });

  it("extracts reference with book prefix number", () => {
    const result = extractBiblicalRefsFromTitle(
      "Ř 5,19 Neposlušnost Adama a poslušnost Krista"
    );
    expect(result.refs).toEqual(["Ř 5,19"]);
  });

  it("extracts reference from Mt title", () => {
    const result = extractBiblicalRefsFromTitle(
      "Mt 2,13-23 Rodina v ohrožení a pod Boží ochranou"
    );
    expect(result.refs).toEqual(["Mt 2,13-23"]);
  });

  it("handles title with multiple refs separated by semicolon", () => {
    const result = extractBiblicalRefsFromTitle(
      "Ga 5,22-23.25; J 15,1-3.8 Ovoce Ducha z Ježíše v životě svědků a v nás"
    );
    expect(result.refs.length).toBe(2);
    expect(result.refs[0]).toMatch(/^Ga/);
    expect(result.refs[1]).toMatch(/^J/);
  });

  it("returns empty for title without biblical reference", () => {
    const result = extractBiblicalRefsFromTitle(
      "Promluva na popeleční středu při pobožnosti křížové cesty"
    );
    expect(result.refs).toEqual([]);
    expect(result.raw).toBeNull();
  });

  it("handles J 4,3–14 with en-dash", () => {
    const result = extractBiblicalRefsFromTitle(
      "J 4,3–14 Setkání Ježíše se samařskou ženou"
    );
    expect(result.refs).toEqual(["J 4,3-14"]);
  });

  it("handles Ž (Psalm) references", () => {
    const result = extractBiblicalRefsFromTitle(
      "Ž 94,16-21.15 Naděje pro bezbranné"
    );
    expect(result.refs).toEqual(["Ž 94,16-21.15"]);
  });
});

// ─── extractLiturgicalContext ───────────────────────────────────
describe("extractLiturgicalContext", () => {
  it("extracts postní neděle", () => {
    const result = extractLiturgicalContext(
      "Kázání na 4. postní neděli v kostele sv. Václava Na Zderaze v Praze 2"
    );
    expect(result).toBe("4. postní neděli");
  });

  it("extracts neděli Zmrtvýchvstání", () => {
    const result = extractLiturgicalContext(
      "Kázání na neděli Zmrtvýchvstání Páně v kostele sv. Mikuláše"
    );
    expect(result).toBe("neděli Zmrtvýchvstání Páně");
  });

  it("extracts promluva", () => {
    const result = extractLiturgicalContext(
      "Promluva na popeleční středu při pobožnosti křížové cesty"
    );
    expect(result).toBe("popeleční středu");
  });

  it("returns null when no context found", () => {
    const result = extractLiturgicalContext(
      "Sestry a bratři, dnes se zamyslíme nad textem..."
    );
    expect(result).toBeNull();
  });

  it("handles non-breaking spaces", () => {
    const result = extractLiturgicalContext(
      "Kázání na 4.\u00a0postní neděli v\u00a0kostele"
    );
    expect(result).toBe("4. postní neděli");
  });
});
