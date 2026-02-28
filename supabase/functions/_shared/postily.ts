import { extractAllRefsFromMarkdown } from "./biblical-refs.ts";

export interface CzechZapasMatch {
  id: string;
  article_number: number;
  title: string;
  author: string | null;
  biblical_references: string[];
  liturgical_context: string | null;
  content_type: string;
  year: number;
  issue_number: number;
  source_ref: string;
  content: string;
  matched_ref: string;
}

/**
 * Find modern Český zápas articles matching the biblical references in the given Sunday readings markdown.
 * Uses the same GIN overlap strategy as findMatchingPostily.
 * Falls back to liturgical_context match (same Sunday name, previous years) if no direct ref match.
 */
export async function findMatchingCzechZapas(
  supabase: any,
  markdownContent: string,
  liturgicalContext?: string,
): Promise<CzechZapasMatch[]> {
  const { allRefs } = extractAllRefsFromMarkdown(markdownContent);

  // Primary: match by biblical references
  if (allRefs.length > 0) {
    const arrayLiteral = `{${allRefs.map(r => `"${r}"`).join(",")}}`;
    const { data, error } = await supabase
      .from("czech_zapas_articles")
      .select("id, article_number, title, author, biblical_references, liturgical_context, content_type, year, issue_number, source_ref, content")
      .eq("is_active", true)
      .filter("biblical_references", "ov", arrayLiteral);

    if (!error && data && data.length > 0) {
      console.log(`Found ${data.length} Czech zápas article(s) by biblical ref`);
      return (data as any[]).map((row) => {
        const matchedRef = (row.biblical_references as string[]).find((r: string) => allRefs.includes(r)) || allRefs[0];
        return { ...row, matched_ref: matchedRef } as CzechZapasMatch;
      });
    }
    if (error) console.error("Error querying czech_zapas_articles by refs:", error.message);
  }

  // Fallback: match by liturgical_context (same Sunday name from previous years)
  if (liturgicalContext) {
    const { data, error } = await supabase
      .from("czech_zapas_articles")
      .select("id, article_number, title, author, biblical_references, liturgical_context, content_type, year, issue_number, source_ref, content")
      .eq("is_active", true)
      .ilike("liturgical_context", `%${liturgicalContext}%`)
      .order("year", { ascending: false })
      .limit(2);

    if (!error && data && data.length > 0) {
      console.log(`Found ${data.length} Czech zápas article(s) by liturgical context: ${liturgicalContext}`);
      return (data as any[]).map((row) => ({
        ...row,
        matched_ref: row.biblical_references?.[0] || "",
      } as CzechZapasMatch));
    }
  }

  console.log("No matching Czech zápas articles found");
  return [];
}

export interface PostilaMatch {
  id: string;
  postil_number: number;
  title: string;
  biblical_references: string[];
  liturgical_context: string | null;
  year: number;
  issue_number: number;
  source_ref: string;
  biblical_text: string | null;
  content: string;
  matched_ref: string; // which Sunday reading ref matched
}

/**
 * Find postily matching the biblical references in the given Sunday readings markdown.
 */
export async function findMatchingPostily(
  supabase: any,
  markdownContent: string,
): Promise<PostilaMatch[]> {
  const { allRefs } = extractAllRefsFromMarkdown(markdownContent);

  if (allRefs.length === 0) {
    console.log("No biblical references found in markdown");
    return [];
  }

  console.log("Looking for postily matching refs:", allRefs);

  // PostgREST array literal: values containing commas must be double-quoted
  // e.g. {"Mt 4,1-11","Gn 2,15-17"} — without quotes, commas split the values
  const arrayLiteral = `{${allRefs.map(r => `"${r}"`).join(",")}}`;

  const { data, error } = await supabase
    .from("postily")
    .select("id, postil_number, title, biblical_references, liturgical_context, year, issue_number, source_ref, biblical_text, content")
    .eq("is_active", true)
    .filter("biblical_references", "ov", arrayLiteral);

  if (error) {
    console.error("Error querying postily:", error.message);
    return [];
  }

  if (!data || data.length === 0) {
    console.log("No matching postily found");
    return [];
  }

  console.log(`Found ${data.length} matching postil(s)`);

  // Annotate each match with which ref matched
  return (data as any[]).map((row) => {
    const matchedRef = (row.biblical_references as string[]).find((r: string) => allRefs.includes(r)) || allRefs[0];
    return { ...row, matched_ref: matchedRef } as PostilaMatch;
  });
}
