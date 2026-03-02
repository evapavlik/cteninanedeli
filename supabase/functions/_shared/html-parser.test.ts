import { describe, it, expect } from "vitest";
import { stripHtmlTags, parseIndexFromHtml, extractReadingsFromHtml } from "./html-parser";

// Sample index page HTML with Sunday entries as links
const SAMPLE_INDEX_HTML = `
<html><body>
<h1>Cyklus biblických čtení</h1>
<table>
  <tr><td><a href="https://cyklus.ccsh.cz/reading/123">Ne 01.03.2026 [08](A.23): 1. neděle postní (Invocavit)</a></td></tr>
  <tr><td><a href="https://cyklus.ccsh.cz/reading/124">Ne 08.03.2026 [09](A.24): 2. neděle postní (Reminiscere)</a></td></tr>
  <tr><td><a href="https://cyklus.ccsh.cz/reading/125">Ne 15.03.2026 [10](A.25): 3. neděle postní (Oculi)</a></td></tr>
</table>
</body></html>`;

// Sample reading page HTML with all three readings
const SAMPLE_READING_HTML = `
<html><body>
<h2>2. neděle postní (Reminiscere)</h2>

<h3>První čtení z Písma: Genesis 12,1-4a</h3>
<p>I řekl Hospodin Abramovi: „Odejdi ze své země, ze svého rodiště
a z domu svého otce do země, kterou ti ukážu. Učiním tě velkým národem,
požehnám tě, velké učiním tvé jméno. Staň se požehnáním!"</p>

<h3>Druhé čtení z Písma: Římanům 4,1-5.13-17</h3>
<p>Co tedy řekneme o Abrahamovi, praotci našem podle těla?
Kdyby Abraham dosáhl spravedlnosti svými skutky, měl by se čím chlubit
– Loss ne před Bohem!</p>

<h3>Evangelium: Jan 3,1-17</h3>
<p>Mezi farizeji byl člověk jménem Nikodém, člen židovské rady.
Ten přišel k Ježíšovi v noci a řekl mu: „Mistře, víme, že jsi učitel,
který přišel od Boha. Neboť nikdo nemůže činit ta znamení, která činíš ty,
není-li Bůh s ním."</p>
</body></html>`;

// Sample reading page with <strong> tags instead of headings
const SAMPLE_READING_HTML_STRONG = `
<html><body>
<h2>3. neděle postní (Oculi)</h2>

<strong>První čtení z Písma: Exodus 17,1-7</strong>
<p>Celá pospolitost Izraelců vytáhla z pouště Sínu po jednotlivých
stanovištích podle Hospodinova rozkazu. Utábořili se v Refídímu,
ale lid neměl vodu k pití.</p>

<strong>Druhé čtení z Písma: Římanům 5,1-8</strong>
<p>Když jsme tedy ospravedlněni z víry, máme pokoj s Bohem
skrze našeho Pána Ježíše Krista.</p>

<strong>Evangelium: Jan 4,5-42</strong>
<p>Ježíš přišel k samařskému městu jménem Sychar, v blízkosti pole,
které dal Jákob svému synu Josefovi; tam byla Jákobova studna.</p>
</body></html>`;

describe("stripHtmlTags", () => {
  it("removes basic HTML tags", () => {
    expect(stripHtmlTags("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  it("converts <br> to newline", () => {
    expect(stripHtmlTags("line1<br>line2<br/>line3")).toBe("line1\nline2\nline3");
  });

  it("decodes HTML entities", () => {
    expect(stripHtmlTags("&amp; &lt; &gt; &ndash; &mdash;")).toBe("& < > – —");
  });

  it("collapses multiple newlines", () => {
    expect(stripHtmlTags("<p>a</p><p>b</p><p>c</p>")).toBe("a\n\nb\n\nc");
  });
});

describe("parseIndexFromHtml", () => {
  it("finds the next Sunday from index HTML", () => {
    // Mock Date to be March 2, 2026
    const realDate = globalThis.Date;
    const mockNow = new Date(2026, 2, 2); // March 2, 2026
    globalThis.Date = class extends realDate {
      constructor(...args: any[]) {
        if (args.length === 0) return new realDate(mockNow.getTime()) as any;
        // @ts-ignore
        return new realDate(...args) as any;
      }
      static now() { return mockNow.getTime(); }
    } as any;

    try {
      const result = parseIndexFromHtml(SAMPLE_INDEX_HTML);
      expect(result).not.toBeNull();
      expect(result!.url).toBe("https://cyklus.ccsh.cz/reading/124");
      expect(result!.date).toBe("2026-03-08");
      expect(result!.title).toContain("Reminiscere");
    } finally {
      globalThis.Date = realDate;
    }
  });

  it("returns null when no upcoming Sunday found", () => {
    const html = `<a href="/old">Ne 01.01.2020: Stará neděle</a>`;
    const result = parseIndexFromHtml(html);
    expect(result).toBeNull();
  });

  it("resolves relative URLs", () => {
    const html = `<a href="/cyklus/detail.php?id=5">Ne 08.03.2026: Test neděle</a>`;

    const realDate = globalThis.Date;
    const mockNow = new Date(2026, 2, 2);
    globalThis.Date = class extends realDate {
      constructor(...args: any[]) {
        if (args.length === 0) return new realDate(mockNow.getTime()) as any;
        // @ts-ignore
        return new realDate(...args) as any;
      }
      static now() { return mockNow.getTime(); }
    } as any;

    try {
      const result = parseIndexFromHtml(html);
      expect(result).not.toBeNull();
      expect(result!.url).toBe("https://www.ccsh.cz/cyklus/detail.php?id=5");
    } finally {
      globalThis.Date = realDate;
    }
  });
});

describe("extractReadingsFromHtml", () => {
  it("extracts all three readings from h3 headings", () => {
    const result = extractReadingsFromHtml(SAMPLE_READING_HTML, "2. neděle postní");
    expect(result.sundayTitle).toBe("2. neděle postní");
    expect(result.readings).toContain("## První čtení z Písma: Genesis 12,1-4a");
    expect(result.readings).toContain("## Druhé čtení z Písma: Římanům 4,1-5.13-17");
    expect(result.readings).toContain("## Evangelium: Jan 3,1-17");
  });

  it("readings contain the biblical text", () => {
    const result = extractReadingsFromHtml(SAMPLE_READING_HTML, "2. neděle postní");
    expect(result.readings).toContain("Hospodin Abramovi");
    expect(result.readings).toContain("Abrahamovi");
    expect(result.readings).toContain("Nikodém");
  });

  it("sections are separated by ---", () => {
    const result = extractReadingsFromHtml(SAMPLE_READING_HTML, "2. neděle postní");
    const parts = result.readings.split("---");
    expect(parts.length).toBe(3);
  });

  it("extracts readings from <strong> tags", () => {
    const result = extractReadingsFromHtml(SAMPLE_READING_HTML_STRONG, "3. neděle postní");
    expect(result.readings).toContain("## První čtení z Písma: Exodus 17,1-7");
    expect(result.readings).toContain("## Evangelium: Jan 4,5-42");
    expect(result.readings).toContain("Jákobova studna");
  });

  it("returns empty readings when no sections found", () => {
    const html = "<html><body><p>No readings here</p></body></html>";
    const result = extractReadingsFromHtml(html, "Test");
    expect(result.readings).toBe("");
  });

  it("validates minimum content length per section", () => {
    const shortHtml = `
      <h3>První čtení z Písma: Test</h3>
      <p>Short.</p>
      <h3>Evangelium: Mt 1,1</h3>
      <p>Also short.</p>
    `;
    const result = extractReadingsFromHtml(shortHtml, "Test");
    // Sections with < 50 chars body are skipped
    expect(result.readings).toBe("");
  });

  it("strips HTML from the title", () => {
    const result = extractReadingsFromHtml(SAMPLE_READING_HTML, "<b>2. neděle</b> postní");
    expect(result.sundayTitle).toBe("2. neděle postní");
  });
});
