import { useState, useEffect } from "react";
import { Bell, BellOff } from "lucide-react";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const LS_KEY = "ccsh-push-subscribed";

type NotifState = "unsupported" | "default" | "subscribed" | "denied" | "loading";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padded = base64String + "==".substring(0, (4 - (base64String.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function NotificationButton() {
  const [state, setState] = useState<NotifState>("default");

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !VAPID_PUBLIC_KEY) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    if (localStorage.getItem(LS_KEY) === "1") {
      setState("subscribed");
    }
  }, []);

  if (state === "unsupported") return null;

  async function subscribe() {
    setState("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }

      console.log("[Push] ANON KEY:", SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.substring(0, 20) + "…" : "MISSING/UNDEFINED");
      console.log("[Push] URL:", SUPABASE_URL || "MISSING/UNDEFINED");

      const reg = await navigator.serviceWorker.ready;
      console.log("[Push] SW registered:", reg.scope);

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      console.log("[Push] Subscription created:", sub.endpoint);

      const json = sub.toJSON();
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/push_subscriptions?on_conflict=endpoint`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            "Prefer": "resolution=merge-duplicates",
          },
          body: JSON.stringify({
            endpoint: json.endpoint!,
            p256dh: json.keys!.p256dh,
            auth: json.keys!.auth,
          }),
        },
      );
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error("[Push] Supabase upsert error:", res.status, body);
        setState("default");
        return;
      }

      console.log("[Push] Subscription saved to DB ✓");
      localStorage.setItem(LS_KEY, "1");
      setState("subscribed");
    } catch (e) {
      console.error("[Push] Subscribe error:", e);
      setState("default");
    }
  }

  async function unsubscribe() {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(
          `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`,
          {
            method: "DELETE",
            headers: {
              "apikey": SUPABASE_ANON_KEY,
              "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            },
          },
        );
        await sub.unsubscribe();
      }
      localStorage.removeItem(LS_KEY);
      setState("default");
    } catch {
      setState("subscribed");
    }
  }

  const isSubscribed = state === "subscribed";
  const isLoading = state === "loading";

  return (
    <button
      onClick={isSubscribed ? unsubscribe : subscribe}
      disabled={isLoading || state === "denied"}
      className="p-2 rounded-full text-foreground/60 hover:text-foreground transition-colors disabled:opacity-40"
      aria-label={
        state === "denied"
          ? "Notifikace jsou zakázány v nastavení prohlížeče"
          : isSubscribed
          ? "Zrušit notifikace"
          : "Zapnout pondělní notifikace"
      }
      title={
        state === "denied"
          ? "Notifikace jsou zakázány v nastavení prohlížeče"
          : isSubscribed
          ? "Zrušit notifikace"
          : "Zapnout pondělní notifikace"
      }
    >
      {isSubscribed ? (
        <Bell className="h-5 w-5 text-foreground/80" />
      ) : (
        <BellOff className="h-5 w-5" />
      )}
    </button>
  );
}
