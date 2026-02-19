import { supabase } from "@/integrations/supabase/client";

// Simple session ID persisted for the browser tab
const SESSION_ID =
  sessionStorage.getItem("analytics_sid") ??
  (() => {
    const id = crypto.randomUUID();
    sessionStorage.setItem("analytics_sid", id);
    return id;
  })();

/**
 * Fire-and-forget event tracking.
 * Failures are silently swallowed so they never affect UX.
 */
export function trackEvent(
  eventName: string,
  eventData?: Record<string, unknown>,
) {
  supabase
    .from("analytics_events" as any)
    .insert({
      event_name: eventName,
      event_data: eventData ?? {},
      session_id: SESSION_ID,
    })
    .then(({ error }) => {
      if (error) console.warn("[analytics]", error.message);
    });
}
