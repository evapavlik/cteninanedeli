import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;

    // Get the raw SQL from request body
    const { sql } = await req.json();

    if (!sql || typeof sql !== "string") {
      return new Response(
        JSON.stringify({ error: "sql string required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use the built-in Deno postgres client
    const { Pool } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
    
    const pool = new Pool(dbUrl, 1, true);
    const connection = await pool.connect();

    try {
      const result = await connection.queryObject(sql);
      return new Response(
        JSON.stringify({ 
          success: true, 
          rowCount: result.rowCount,
          message: `Executed successfully` 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } finally {
      connection.release();
      await pool.end();
    }
  } catch (e) {
    console.error("seed-postily error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
