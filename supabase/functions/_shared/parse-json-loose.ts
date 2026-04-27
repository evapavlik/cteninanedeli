/**
 * Tolerant JSON parser for LLM outputs.
 *
 * Gemini occasionally wraps JSON in ```json ... ``` code fences (or adds a
 * leading sentence) even when `response_format: { type: "json_object" }` is
 * set. Plain JSON.parse then fails, which silently breaks ai_cache writes and
 * forces the user to refresh until Gemini happens to return clean JSON.
 *
 * Strategy, in order:
 *   1. direct JSON.parse on the trimmed input
 *   2. strip the first ``` ... ``` (with or without `json` language tag)
 *      and parse its body
 *   3. walk the string looking for top-level balanced { ... } or [ ... ]
 *      blocks (string- and escape-aware) and try each one
 *
 * Returns the parsed value or null if every attempt fails.
 */
export function parseJsonLoose(content: unknown): unknown | null {
  if (typeof content !== "string") return null;
  const trimmed = content.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }

  const fenceMatch = trimmed.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    const inner = fenceMatch[1].trim();
    if (inner) {
      try {
        return JSON.parse(inner);
      } catch {
        /* fall through */
      }
    }
  }

  for (const candidate of extractBalancedJsonBlocks(trimmed)) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* try next candidate */
    }
  }

  return null;
}

function extractBalancedJsonBlocks(s: string): string[] {
  const blocks: string[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch !== "{" && ch !== "[") {
      i++;
      continue;
    }
    const end = findMatchingClose(s, i);
    if (end === -1) {
      i++;
      continue;
    }
    blocks.push(s.substring(i, end + 1));
    i = end + 1;
  }
  return blocks;
}

function findMatchingClose(s: string, start: number): number {
  const open = s[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}
