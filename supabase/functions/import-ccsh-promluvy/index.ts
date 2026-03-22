import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  scrapePromluvaListing,
  scrapePromluvaPage,
  getPromluvaPageCount,
} from "../_shared/ccsh-promluvy-scraper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ITEMS_PER_PAGE = 6;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const action = body.action || "incremental";
    const startPage = body.startPage || 0;

    // ── count ────────────────────────────────────────────────
    if (action === "count") {
      const { count, error } = await supabase
        .from("czech_zapas_articles")
        .select("*", { count: "exact", head: true })
        .not("source_url", "is", null);

      if (error) throw error;
      return new Response(
        JSON.stringify({ count }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── bulk / incremental import ────────────────────────────
    if (action === "bulk" || action === "incremental") {
      const logs: string[] = [];
      const log = (msg: string) => {
        console.log(msg);
        logs.push(msg);
      };

      // Get existing source_urls for dedup
      const { data: existing } = await supabase
        .from("czech_zapas_articles")
        .select("source_url")
        .not("source_url", "is", null);
      const existingUrls = new Set(
        (existing || []).map((r: { source_url: string }) => r.source_url)
      );

      // Get next article_number
      const { data: maxRow } = await supabase
        .from("czech_zapas_articles")
        .select("article_number")
        .order("article_number", { ascending: false })
        .limit(1);
      let nextNumber = (maxRow?.[0]?.article_number || 0) + 1;

      // Determine pages to scrape
      let pagesToScrape: number[];
      if (action === "bulk") {
        const totalPages = await getPromluvaPageCount();
        const MAX_PAGES_PER_RUN = 5;
        const startIdx = startPage;
        const endIdx = Math.min(startIdx + MAX_PAGES_PER_RUN, totalPages);
        pagesToScrape = Array.from({ length: endIdx - startIdx }, (_, i) => (startIdx + i) * ITEMS_PER_PAGE);
        log(`Bulk import: pages ${startIdx + 1}-${endIdx} of ${totalPages}`);
      } else {
        pagesToScrape = [0];
        log("Incremental import: checking first page for new promluvy");
      }

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const offset of pagesToScrape) {
        const listings = await scrapePromluvaListing(offset);
        log(`Page offset=${offset}: found ${listings.length} promluva(s)`);

        for (const item of listings) {
          const fullUrl = `https://www.ccsh.cz${item.url}`;

          if (existingUrls.has(fullUrl)) {
            skipped++;
            continue;
          }

          await delay(300);
          const pageData = await scrapePromluvaPage(item.url);

          if (!pageData) {
            errors.push(`Failed to scrape ${item.url}`);
            continue;
          }

          // Determine year — prefer ČZ year, fallback to publication date
          const year = pageData.czYear
            || (pageData.dateISO ? parseInt(pageData.dateISO.substring(0, 4), 10) : new Date().getFullYear());

          const { error: insertError } = await supabase
            .from("czech_zapas_articles")
            .insert({
              article_number: nextNumber++,
              title: pageData.title,
              author: pageData.author,
              biblical_references: pageData.biblicalReferences,
              biblical_refs_raw: pageData.biblicalRefsRaw,
              liturgical_context: pageData.liturgicalContext,
              content_type: "kazani",
              year,
              issue_number: pageData.czIssueNumber || 0,
              source_ref: pageData.czIssueNumber
                ? `Český zápas č. ${pageData.czIssueNumber}/${year}`
                : `ccsh.cz, ${pageData.dateStr}`,
              content: pageData.content,
              source_url: pageData.sourceUrl,
              is_active: true,
            });

          if (insertError) {
            if (insertError.code === "23505") {
              skipped++;
              nextNumber--;
            } else {
              errors.push(`Insert ${item.url}: ${insertError.message}`);
              nextNumber--;
            }
          } else {
            imported++;
            existingUrls.add(fullUrl);
            log(`Imported: ${pageData.title} (${pageData.author})`);
          }
        }

        if (pagesToScrape.length > 1) await delay(300);
      }

      log(`Done: imported=${imported}, skipped=${skipped}, errors=${errors.length}`);

      return new Response(
        JSON.stringify({
          success: errors.length === 0,
          imported,
          skipped,
          errors: errors.length > 0 ? errors : undefined,
          logs,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Use: bulk, incremental, count" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("import-ccsh-promluvy error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
