import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  scrapeSermonListing,
  scrapeSermonPage,
  getTotalPages,
} from "../_shared/ccsh-sermons-scraper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Delay helper to avoid hammering ccsh.cz */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

    // ── count ────────────────────────────────────────────────
    if (action === "count") {
      const { count, error } = await supabase
        .from("ccsh_sermons")
        .select("*", { count: "exact", head: true });

      if (error) throw error;
      return new Response(
        JSON.stringify({ count }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── list ─────────────────────────────────────────────────
    if (action === "list") {
      const { data, error } = await supabase
        .from("ccsh_sermons")
        .select("id, sermon_number, title, author, biblical_references, year, source_url, source_ref")
        .order("sermon_number", { ascending: false });

      if (error) throw error;
      return new Response(
        JSON.stringify({ sermons: data }),
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
        .from("ccsh_sermons")
        .select("source_url");
      const existingUrls = new Set(
        (existing || []).map((r: { source_url: string }) => r.source_url)
      );

      // Get next sermon_number
      const { data: maxRow } = await supabase
        .from("ccsh_sermons")
        .select("sermon_number")
        .order("sermon_number", { ascending: false })
        .limit(1);
      let nextNumber = (maxRow?.[0]?.sermon_number || 0) + 1;

      // Determine pages to scrape
      let pagesToScrape: number[];
      if (action === "bulk") {
        const totalPages = await getTotalPages();
        const maxPages = 5;
        const actualPages = Math.min(totalPages, maxPages);
        pagesToScrape = Array.from({ length: actualPages }, (_, i) => i * 8);
        log(`Bulk import: ${actualPages} pages to scrape (of ${totalPages} total, max ${maxPages} per run)`);
      } else {
        // Incremental: just first page (8 newest)
        pagesToScrape = [0];
        log("Incremental import: checking first page for new sermons");
      }

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const offset of pagesToScrape) {
        const listings = await scrapeSermonListing(offset);
        log(`Page offset=${offset}: found ${listings.length} sermon(s)`);

        for (const item of listings) {
          const fullUrl = `https://www.ccsh.cz${item.url}`;

          if (existingUrls.has(fullUrl)) {
            skipped++;
            continue;
          }

          // Fetch full sermon page
          await delay(300); // 300ms between fetches
          const sermonData = await scrapeSermonPage(item.url);

          if (!sermonData) {
            errors.push(`Failed to scrape ${item.url}`);
            continue;
          }

          // Insert into DB
          const { error: insertError } = await supabase
            .from("ccsh_sermons")
            .insert({
              sermon_number: nextNumber++,
              title: sermonData.title,
              author: sermonData.author,
              biblical_references: sermonData.biblicalReferences,
              biblical_refs_raw: sermonData.biblicalRefsRaw,
              liturgical_context: sermonData.liturgicalContext,
              year: sermonData.dateISO
                ? parseInt(sermonData.dateISO.substring(0, 4), 10)
                : new Date().getFullYear(),
              sermon_date: sermonData.dateISO,
              source_url: sermonData.sourceUrl,
              source_ref: `ccsh.cz, ${sermonData.dateStr}`,
              content: sermonData.content,
              is_active: true,
            });

          if (insertError) {
            // 23505 = unique_violation (already exists) — treat as skip
            if (insertError.code === "23505") {
              skipped++;
              nextNumber--; // reuse the number
            } else {
              errors.push(`Insert ${item.url}: ${insertError.message}`);
              nextNumber--; // reuse the number
            }
          } else {
            imported++;
            existingUrls.add(fullUrl);
            log(`Imported: ${sermonData.title}`);
          }
        }

        // Small delay between listing pages
        if (pagesToScrape.length > 1) await delay(500);
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
      JSON.stringify({ error: "Unknown action. Use: bulk, incremental, list, count" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("import-ccsh-sermons error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
