import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Maximum total character budget for corpus content in the system prompt.
 * Primary documents (sort_order = 1) always get full content.
 * Lower-priority documents use summary or truncated content if budget is exceeded.
 */
const MAX_CORPUS_CHARS = 15_000;

/** Truncate text to a maximum length, ending at the last full sentence. */
function truncateToSentence(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.substring(0, maxLen);
  const lastPeriod = truncated.lastIndexOf(".");
  const lastQuestion = truncated.lastIndexOf("?");
  const lastExclaim = truncated.lastIndexOf("!");
  const cutoff = Math.max(lastPeriod, lastQuestion, lastExclaim);
  return cutoff > maxLen * 0.5 ? truncated.substring(0, cutoff + 1) : truncated + "…";
}

interface CorpusDoc {
  title: string;
  category: string;
  content: string;
  summary: string | null;
  sort_order: number;
}

/**
 * Build theological context string from corpus_documents table.
 *
 * Two-level strategy:
 * - Primary documents (sort_order = 1): full content (needed for accurate citations)
 * - Secondary documents (sort_order > 1): summary if available, otherwise truncated content
 * - Total output is capped at MAX_CORPUS_CHARS to keep token usage reasonable
 */
// deno-lint-ignore no-explicit-any
export async function buildTheologicalContext(
  supabase: any,
  profileSlug: string,
): Promise<string> {
  const { data: docs, error } = await supabase
    .from("corpus_documents")
    .select("title, category, content, summary, sort_order")
    .eq("profile_slug", profileSlug)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error loading corpus documents:", error.message);
    throw new Error("Failed to load theological corpus");
  }

  if (!docs || docs.length === 0) {
    throw new Error(`No active corpus documents found for profile "${profileSlug}"`);
  }

  console.log(`Loaded ${docs.length} corpus document(s) for profile "${profileSlug}"`);

  let totalChars = 0;
  const sections: string[] = [];

  for (const doc of docs as CorpusDoc[]) {
    const header = `[${doc.category.toUpperCase()}] ${doc.title}`;
    const separator = "=".repeat(header.length);
    const isPrimary = doc.sort_order === 1;

    let body: string;
    if (isPrimary) {
      // Primary documents: always full content (needed for citations)
      body = doc.content;
    } else if (doc.summary) {
      // Secondary documents with summary: use summary only
      body = doc.summary;
    } else {
      // Secondary documents without summary: truncate if needed
      const remaining = Math.max(MAX_CORPUS_CHARS - totalChars, 2000);
      body = truncateToSentence(doc.content, remaining);
    }

    const section = `${separator}\n${header}\n${separator}\n${body}`;
    totalChars += section.length;
    sections.push(section);

    if (totalChars >= MAX_CORPUS_CHARS) {
      console.log(`Corpus budget (${MAX_CORPUS_CHARS} chars) reached after ${sections.length} document(s)`);
      break;
    }
  }

  console.log(`Corpus context: ${sections.length} doc(s), ${totalChars} chars`);
  return sections.join("\n\n");
}

/**
 * System prompt for "context" mode — generates a JSON reading guide
 * grounded in CČSH theology. Requires the full corpus for citations.
 */
export function buildContextPrompt(theologicalContext: string): string {
  return `${theologicalContext}

Tvým úkolem je pro zadaný biblický text (jedno nebo více čtení) vytvořit stručný kontextový průvodce v duchu teologie CČSH.

Vrať JSON objekt s polem "readings", kde každý prvek odpovídá jednomu čtení a má tyto klíče:
- "title": název čtení (např. "První čtení – Iz 58,7-10")
- "intro": 1-2 věty, které může lektor říct shromáždění PŘED čtením, aby zasadil text do kontextu. Formuluj v duchu husitské teologie – zdůrazni Kristův odkaz, reformační tradici, obecenství a aktuálnost poselství pro dnešek.
- "characters": pole klíčových postav [{name, description}] – kdo je kdo v textu (max 4)
- "historical_context": 2-3 věty o historickém pozadí – kdy, kde, proč text vznikl, komu byl určen
- "main_message": 1 věta shrnující jádro/poselství textu z perspektivy CČSH – zdůrazni Ducha Kristova, obecenství, zpřítomnění Božího slova a praktický dopad do života věřícího
- "tone": jaký emocionální charakter má mít přednes (např. "slavnostní a povzbudivý", "naléhavý a varovný")
- "citations": pole 0–2 relevantních citací ze Základů víry CČSH [{question_number, text, relevance}]. question_number je číslo otázky (např. 105), text je krátká citace z odpovědi (max 2 věty), relevance je 1 věta vysvětlující spojitost s čtením. Pokud žádná otázka přímo nesouvisí, vrať prázdné pole []. NEVYMÝŠLEJ citace — používej POUZE skutečné otázky a odpovědi z dokumentu Základy víry CČSH uvedeného výše.

Vrať POUZE validní JSON, žádný markdown ani komentáře.`;
}

/**
 * System prompt for "annotate" mode — marks up biblical text with
 * performance directions for lectors. Does NOT need the theological corpus
 * because the task is purely about reading technique, not theology.
 */
export const ANNOTATE_SYSTEM_PROMPT = `Jsi expert na liturgické předčítání (lektorování) v Církvi československé husitské.
Tvým úkolem je anotovat biblický text značkami pro přednes:

Pravidla:
- **tučně** označ slova, která mají být zdůrazněna (klíčová slova, jména, důležité pojmy)
- Vlož značku [pauza] tam, kde má být krátká pauza (cca 1 sekunda) — typicky před důležitou myšlenkou nebo po čárce
- Vlož značku [dlouhá pauza] tam, kde má být delší pauza (2-3 sekundy) — typicky mezi odstavci, před závěrečným veršem
- Vlož značku [pomalu] před pasáže, které mají být čteny pomaleji (slavnostní momenty, klíčové výroky)
- Vlož značku [normálně] pro návrat k normálnímu tempu
- Zachovej celý původní text — nic neodstraňuj, nic nepřidávej kromě značek
- Neměň formátování nadpisů (## zůstane ##)
- Nevkládej žádné komentáře ani vysvětlení — vrať POUZE anotovaný text

Příklad:
Vstup: "Hospodin řekl Mojžíšovi: Jdi k faraónovi a řekni mu: Propusť můj lid."
Výstup: "**Hospodin** řekl **Mojžíšovi**: [pauza] Jdi k **faraónovi** a řekni mu: [pauza] [pomalu] **Propusť můj lid.** [normálně]"`;
