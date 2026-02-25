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
