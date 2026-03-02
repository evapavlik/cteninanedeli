import { describe, it, expect } from "vitest";
import { stripHtmlTags, parseIndexFromHtml, extractReadingsFromHtml } from "./html-parser";

// Helper: mock Date to a specific day for tests that depend on "today"
function withMockedDate(fakeNow: Date, fn: () => void) {
  const realDate = globalThis.Date;
  globalThis.Date = class extends realDate {
    constructor(...args: any[]) {
      if (args.length === 0) return new realDate(fakeNow.getTime()) as any;
      // @ts-ignore
      return new realDate(...args) as any;
    }
    static now() { return fakeNow.getTime(); }
  } as any;
  try {
    fn();
  } finally {
    globalThis.Date = realDate;
  }
}

// --- Fixtures ---

// Single-page format (ccsh.cz/cyklus.html) — title in <h1>, date as "neděle DD. měsíce",
// readings + liturgical sections all on one page
const SAMPLE_SINGLE_PAGE_HTML = `
<html><body>
<h1>3. neděle postní (Oculi)</h1>
<p><em>Oči mé vždycky patří k Hospodinu.</em> (Žalm 25,15)</p>
<p>neděle 8. března</p>

<h2>První čtení z Písma: Exodus 17, 3-7</h2>
<p>Lid žíznil po vodě a reptal proti Mojžíšovi. Řekli: „Proč jsi nás vyvedl
z Egypta? Abys nás, naše syny a náš dobytek umořil žízní?" Mojžíš úpěl
k Hospodinu: „Jak se mám zachovat k tomuto lidu? Taktak že mě neukamenují."
Hospodin Mojžíšovi odpověděl: „Vyjdi před lid, vezmi s sebou některé
z izraelských starších, vezmi do ruky svou hůl, kterou jsi udeřil do Nilu,
a jdi. Já tam budu stát před tebou na skále na Chorébu."</p>

<h2>Druhé čtení z Písma: Římanům 5, 1-8</h2>
<p>Když jsme tedy ospravedlněni z víry, máme pokoj s Bohem skrze našeho Pána
Ježíše Krista, neboť skrze něho jsme vírou získali přístup k této milosti.
V ní stojíme a chlubíme se nadějí, že dosáhneme slávy Boží. A nejen to:
chlubíme se i soužením, vždyť víme, že z soužení roste vytrvalost,
z vytrvalosti osvědčenost a z osvědčenosti naděje.</p>

<h2>Evangelium: Jan 4, 5-42</h2>
<p>Ježíš přišel k samařskému městu jménem Sychar, v blízkosti pole,
které dal Jákob svému synu Josefovi; tam byla Jákobova studna. Ježíš,
unavený chůzí, usedl u té studny. Bylo kolem poledne. Tu přichází samařská
žena, aby načerpala vodu. Ježíš jí řekl: „Dej mi napít!"</p>

<h2>Tužby postní</h2>
<p>Za to, abychom čas postní v pokoře srdce a s touhou po pravdě prožívali,
modleme se k Hospodinu.</p>

<h2>Modlitba</h2>
<p>Bože, ty jsi pramen živé vody. Dej, ať žíznivá srdce nacházejí
občerstvení ve tvém slovu. Amen.</p>
</body></html>`;

// Index page HTML with Sunday entries as links (cyklus.ccsh.cz format)
const SAMPLE_INDEX_HTML = `
<html><body>
<h1>Cyklus biblických čtení</h1>
<table>
  <tr><td><a href="https://cyklus.ccsh.cz/reading/123">Ne 01.03.2026 [08](A.23): 1. neděle postní (Invocavit)</a></td></tr>
  <tr><td><a href="https://cyklus.ccsh.cz/reading/124">Ne 08.03.2026 [09](A.24): 2. neděle postní (Reminiscere)</a></td></tr>
  <tr><td><a href="https://cyklus.ccsh.cz/reading/125">Ne 15.03.2026 [10](A.25): 3. neděle postní (Oculi)</a></td></tr>
</table>
</body></html>`;

// Separate reading page HTML with all three readings (h3 headings)
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

// Reading page with <strong> tags instead of headings
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
  it("parses single-page format with h1 title and Czech date", () => {
    withMockedDate(new Date(2026, 2, 2), () => { // March 2, 2026
      const result = parseIndexFromHtml(SAMPLE_SINGLE_PAGE_HTML);
      expect(result).not.toBeNull();
      expect(result!.title).toBe("3. neděle postní (Oculi)");
      expect(result!.date).toBe("2026-03-08");
      expect(result!.url).toBe(""); // Readings are inline
    });
  });

  it("handles December→January year boundary", () => {
    withMockedDate(new Date(2026, 11, 28), () => { // Dec 28, 2026
      const html = `
        <html><body>
        <h1>1. neděle po Novém roce</h1>
        <p>neděle 4. ledna</p>
        </body></html>`;
      const result = parseIndexFromHtml(html);
      expect(result).not.toBeNull();
      expect(result!.date).toBe("2027-01-04"); // Next year
    });
  });

  it("returns null when single-page date is in the past", () => {
    withMockedDate(new Date(2026, 2, 15), () => { // March 15, 2026
      const html = `
        <html><body>
        <h1>2. neděle postní</h1>
        <p>neděle 8. března</p>
        </body></html>`;
      const result = parseIndexFromHtml(html);
      expect(result).toBeNull();
    });
  });

  it("finds the next Sunday from index HTML with links", () => {
    withMockedDate(new Date(2026, 2, 2), () => { // March 2, 2026
      const result = parseIndexFromHtml(SAMPLE_INDEX_HTML);
      expect(result).not.toBeNull();
      expect(result!.url).toBe("https://cyklus.ccsh.cz/reading/124");
      expect(result!.date).toBe("2026-03-08");
      expect(result!.title).toContain("Reminiscere");
    });
  });

  it("returns null when no upcoming Sunday found", () => {
    const html = `<a href="/old">Ne 01.01.2020: Stará neděle</a>`;
    const result = parseIndexFromHtml(html);
    expect(result).toBeNull();
  });

  it("resolves relative URLs", () => {
    withMockedDate(new Date(2026, 2, 2), () => {
      const html = `<a href="/cyklus/detail.php?id=5">Ne 08.03.2026: Test neděle</a>`;
      const result = parseIndexFromHtml(html);
      expect(result).not.toBeNull();
      expect(result!.url).toBe("https://www.ccsh.cz/cyklus/detail.php?id=5");
    });
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

  it("extracts readings from single-page HTML with h2 headings", () => {
    const result = extractReadingsFromHtml(SAMPLE_SINGLE_PAGE_HTML, "3. neděle postní (Oculi)");
    expect(result.sundayTitle).toBe("3. neděle postní (Oculi)");
    expect(result.readings).toContain("## První čtení z Písma: Exodus 17, 3-7");
    expect(result.readings).toContain("## Druhé čtení z Písma: Římanům 5, 1-8");
    expect(result.readings).toContain("## Evangelium: Jan 4, 5-42");
  });

  it("excludes liturgical sections (Tužby, Modlitba) from readings", () => {
    const result = extractReadingsFromHtml(SAMPLE_SINGLE_PAGE_HTML, "3. neděle postní (Oculi)");
    expect(result.readings).not.toContain("Tužby");
    expect(result.readings).not.toContain("Modlitba");
    expect(result.readings).not.toContain("modleme se k Hospodinu");
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
