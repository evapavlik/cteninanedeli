import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, postily } = await req.json();

    if (action === "count") {
      const { count, error } = await supabase
        .from("postily")
        .select("*", { count: "exact", head: true });

      if (error) throw error;
      return new Response(
        JSON.stringify({ count }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list") {
      const { data, error } = await supabase
        .from("postily")
        .select("id, postil_number, title, biblical_references, year, issue_number, source_ref")
        .order("postil_number");

      if (error) throw error;
      return new Response(
        JSON.stringify({ postily: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete_all") {
      const { error } = await supabase
        .from("postily")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all rows

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, message: "All postily deleted" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "import") {
      if (!postily || !Array.isArray(postily) || postily.length === 0) {
        return new Response(
          JSON.stringify({ error: "postily array required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Insert in batches of 20 to avoid payload limits
      const BATCH_SIZE = 20;
      let totalInserted = 0;
      const errors: string[] = [];

      for (let i = 0; i < postily.length; i += BATCH_SIZE) {
        const batch = postily.slice(i, i + BATCH_SIZE).map((p: any) => ({
          postil_number: p.postil_number,
          title: p.title,
          biblical_references: p.biblical_references || [],
          biblical_refs_raw: p.biblical_refs_raw || null,
          liturgical_context: p.liturgical_context || null,
          year: p.year,
          issue_number: p.issue_number,
          source_ref: p.source_ref,
          biblical_text: p.biblical_text || null,
          content: p.content,
          is_active: true,
        }));

        const { data, error } = await supabase
          .from("postily")
          .insert(batch)
          .select("id");

        if (error) {
          errors.push(`Batch ${i / BATCH_SIZE + 1}: ${error.message}`);
        } else {
          totalInserted += (data?.length || 0);
        }
      }

      return new Response(
        JSON.stringify({
          success: errors.length === 0,
          inserted: totalInserted,
          total_sent: postily.length,
          errors: errors.length > 0 ? errors : undefined,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Use: import, delete_all, list, count" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("import-postily error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
