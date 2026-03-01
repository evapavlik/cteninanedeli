import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWebPush } from "../_shared/web-push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * send-monday-notifications: Sends personalized Web Push notifications to all subscribers.
 * Designed to be called via pg_cron every Monday at 6:00 UTC.
 *
 * Required Supabase secrets:
 *   VAPID_PUBLIC_KEY  — base64url-encoded 65-byte uncompressed EC public key
 *   VAPID_PRIVATE_KEY — base64url-encoded 32-byte EC private scalar
 *   VAPID_SUBJECT     — mailto: or https: URI identifying the sender
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
  const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
  const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:info@ccsh.cz";

  const log: string[] = [];
  const addLog = (msg: string) => { console.log(msg); log.push(msg); };

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    addLog("VAPID keys not configured — aborting");
    return new Response(JSON.stringify({ success: false, log }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // --- Step 1: Load the latest reading with its notification sentence ---
    const { data: reading, error: readingError } = await supabase
      .from("readings_cache")
      .select("sunday_title, notification_sentence")
      .not("notification_sentence", "is", null)
      .order("sunday_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (readingError || !reading) {
      addLog("No reading with notification_sentence found — aborting");
      return new Response(JSON.stringify({ success: false, log }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    addLog(`Sending notifications for: "${reading.sunday_title}"`);

    const payload = JSON.stringify({
      title: reading.sunday_title,
      body: reading.notification_sentence,
      url: "/",
    });

    // --- Step 2: Load all push subscriptions ---
    const { data: subscriptions, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth");

    if (subsError) {
      addLog(`Failed to load subscriptions: ${subsError.message}`);
      return new Response(JSON.stringify({ success: false, log }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      addLog("No subscriptions found — nothing to send");
      return new Response(JSON.stringify({ success: true, sent: 0, log }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    addLog(`Found ${subscriptions.length} subscription(s)`);

    // --- Step 3: Send to each subscription ---
    let sent = 0;
    let failed = 0;
    const toRemove: string[] = [];

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          const status = await sendWebPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            payload,
            VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY,
            VAPID_SUBJECT,
          );

          if (status === 201 || status === 200 || status === 202) {
            sent++;
          } else if (status === 410 || status === 404) {
            // Subscription expired or invalid — mark for removal
            toRemove.push(sub.id);
            addLog(`Subscription expired (${status}), queued for removal: ${sub.endpoint.substring(0, 40)}…`);
          } else {
            failed++;
            addLog(`Push failed (${status}): ${sub.endpoint.substring(0, 40)}…`);
          }
        } catch (e) {
          failed++;
          addLog(`Push error: ${(e as Error).message}`);
        }
      }),
    );

    // --- Step 4: Remove expired subscriptions ---
    if (toRemove.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", toRemove);
      addLog(`Removed ${toRemove.length} expired subscription(s)`);
    }

    addLog(`Done — sent: ${sent}, failed: ${failed}, removed: ${toRemove.length}`);

    return new Response(
      JSON.stringify({ success: true, sent, failed, removed: toRemove.length, log }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    addLog(`Fatal error: ${(e as Error).message}`);
    return new Response(JSON.stringify({ success: false, error: (e as Error).message, log }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
