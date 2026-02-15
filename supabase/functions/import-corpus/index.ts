import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Clean parsed PDF markdown content:
 * - Remove "## Page N" headers
 * - Remove "### Images from page N:" sections and image URLs
 * - Remove standalone page numbers (lines that are just a number)
 * - Remove parsed-documents:// references
 * - Collapse multiple blank lines
 */
function cleanContent(raw: string): string {
  const lines = raw.split("\n");
  const cleaned: string[] = [];
  let skipNextImageLines = false;

  for (const line of lines) {
    // Skip page headers
    if (/^## Page \d+/.test(line.trim())) continue;
    // Skip image section headers
    if (/^### Images from page/.test(line.trim())) {
      skipNextImageLines = true;
      continue;
    }
    // Skip image URLs (parsed-documents://)
    if (skipNextImageLines) {
      if (line.trim().startsWith("- `parsed-documents://") || line.trim() === "") {
        if (line.trim() === "") skipNextImageLines = false;
        continue;
      }
      skipNextImageLines = false;
    }
    // Skip standalone page numbers
    if (/^\s*\d{1,3}\s*$/.test(line.trim()) && line.trim().length <= 3) continue;
    // Skip parsed-documents references
    if (line.includes("parsed-documents://")) continue;

    cleaned.push(line);
  }

  // Collapse multiple blank lines into max 2
  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, title, category, content, sort_order, profile_slug, clean } = await req.json();

    if (action === "delete_all") {
      // Delete all existing corpus documents for the profile
      const { error } = await supabase
        .from("corpus_documents")
        .delete()
        .eq("profile_slug", profile_slug || "ccsh");

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, message: "All documents deleted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "insert") {
      if (!title || !content) {
        return new Response(JSON.stringify({ error: "title and content required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const finalContent = clean ? cleanContent(content) : content;

      const { data, error } = await supabase.from("corpus_documents").insert({
        profile_slug: profile_slug || "ccsh",
        title,
        category: category || "věrouka",
        content: finalContent,
        sort_order: sort_order || 1,
        is_active: true,
      }).select("id, title, category, sort_order").single();

      if (error) throw error;

      return new Response(JSON.stringify({ 
        success: true, 
        document: data,
        content_length: finalContent.length 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const { data, error } = await supabase
        .from("corpus_documents")
        .select("id, title, category, sort_order, is_active, created_at")
        .eq("profile_slug", profile_slug || "ccsh")
        .order("sort_order");

      if (error) throw error;
      return new Response(JSON.stringify({ documents: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use: delete_all, insert, list" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("import-corpus error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
