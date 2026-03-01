import { useState, useEffect } from "react";
import { Bell, BellOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;
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

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const json = sub.toJSON();
      await supabase.from("push_subscriptions").upsert(
        {
          endpoint: json.endpoint!,
          p256dh: json.keys!.p256dh,
          auth: json.keys!.auth,
        },
        { onConflict: "endpoint" },
      );

      localStorage.setItem(LS_KEY, "1");
      setState("subscribed");
    } catch {
      setState("default");
    }
  }

  async function unsubscribe() {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
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
