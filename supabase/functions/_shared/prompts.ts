/**
 * Shared prompt for generating preaching inspiration from Farský postily.
 * Used by both annotate-reading (on-demand) and warm-cache (pre-generation).
 */
export function buildPostilyPrompt(postilyContext: string): string {
  return `Jsi teolog Církve československé husitské. Níže je text nedělních čtení a k nim odpovídající postila (kázání) Karla Farského, zakladatele CČSH, z let 1921–1924.

Tvým úkolem je vytvořit inspiraci pro kázání. Vrať JSON objekt s těmito klíči:

- "postily": pole objektů (jeden pro každou matchovanou postilu), kde každý má:
  - "postil_number": číslo postily
  - "title": název postily
  - "source_ref": odkaz na Český zápas (ročník, číslo)
  - "year": rok vzniku
  - "matched_ref": biblický odkaz, na který postila reaguje
  - "quotes": pole 1-3 nejsilnějších doslovných citátů z Farského textu (každý max 2 věty)
  - "insight": 3-4 věty shrnující Farského pohled — co je jádro jeho výkladu, čím je originální
  - "relevance": 2-3 věty propojující Farského myšlenky s dneškem — proč je aktuální, jak může inspirovat dnešní kázání
  - "preaching_angle": 1 věta navrhující konkrétní úhel/háček pro kázání inspirovaný Farským
  - "full_text": celý text postily (zkopíruj doslova z kontextu níže)

Vrať POUZE validní JSON, žádný markdown ani komentáře.

POSTILY KARLA FARSKÉHO:
${postilyContext}`;
}

/**
 * Prompt for generating preaching inspiration from modern Český zápas articles.
 * Optionally includes a Farský postila for the same reading to highlight continuity/tension.
 */
export function buildCzechZapasPrompt(
  czContext: string,
  farskyPostila?: string,
): string {
  const farskySection = farskyPostila
    ? `\n\nPRO SROVNÁNÍ — POSTILA KARLA FARSKÉHO KE STEJNÉMU ČTENÍ:\n${farskyPostila}`
    : "";

  return `Jsi teolog Církve československé husitské. Níže je text nedělních čtení a k nim odpovídající moderní článek z Českého zápasu.
${farskySection}

Tvým úkolem je vytvořit inspiraci pro kázání. Vrať JSON objekt s těmito klíči:

- "czech_zapas": pole objektů (jeden pro každý článek), kde každý má:
  - "article_number": číslo článku
  - "title": název článku
  - "author": autor (nebo null)
  - "source_ref": odkaz na Český zápas (ročník, číslo)
  - "year": rok vzniku
  - "matched_ref": biblický odkaz, na který článek reaguje
  - "quotes": pole 1-3 nejsilnějších doslovných citátů z textu (každý max 2 věty)
  - "author_perspective": 3-4 věty shrnující autorův pohled — co je jádro jeho výkladu
  - "tension_with_farsky": ${farskyPostila ? '2-3 věty o tom, v čem se pohled liší nebo navazuje na Farského — kde je napětí, kde kontinuita' : 'null (Farského postila pro toto čtení není k dispozici)'}
  - "preaching_angle": 1 věta navrhující konkrétní úhel pro kázání inspirovaný tímto textem
  - "full_text": celý text článku (zkopíruj doslova z kontextu níže)

Vrať POUZE validní JSON, žádný markdown ani komentáře.${farskySection ? "" : "\nPole \"tension_with_farsky\" nastav na null."}

MODERNÍ ČLÁNKY Z ČESKÉHO ZÁPASU:
${czContext}`;
}

/**
 * Format czech_zapas matches into context string for the prompt.
 */
export function formatCzechZapasContext(
  matches: Array<{
    article_number: number;
    title: string;
    author: string | null;
    source_ref: string;
    matched_ref: string;
    liturgical_context: string | null;
    content: string;
  }>,
): string {
  return matches
    .map(
      (m) =>
        `---\nČLÁNEK č. ${m.article_number}: „${m.title}"\n${m.author ? `Autor: ${m.author}\n` : ""}${m.source_ref}\nBiblický odkaz: ${m.matched_ref}\n${m.liturgical_context ? `Liturgický kontext: ${m.liturgical_context}\n` : ""}---\n${m.content}`,
    )
    .join("\n\n");
}

/**
 * Format postily matches into context string for the prompt.
 */
export function formatPostilyContext(
  matches: Array<{
    postil_number: number;
    title: string;
    source_ref: string;
    matched_ref: string;
    liturgical_context: string | null;
    content: string;
  }>,
): string {
  return matches
    .map(
      (m) =>
        `---\nPOSTILA č. ${m.postil_number}: „${m.title}"\n${m.source_ref}\nBiblický odkaz: ${m.matched_ref}\n${m.liturgical_context ? `Liturgický kontext: ${m.liturgical_context}\n` : ""}---\n${m.content}`,
    )
    .join("\n\n");
}
