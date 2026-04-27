import { useState, useEffect } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { detectPushSupport, subscribePush, unsubscribePush } from "@/lib/push";
import { trackEvent } from "@/lib/analytics";

const LS_KEY = "ccsh-push-subscribed";

type NotifState = "unsupported" | "default" | "subscribed" | "denied" | "loading";

export function NotificationButton() {
  const [state, setState] = useState<NotifState>("default");

  useEffect(() => {
    const support = detectPushSupport();
    if (support.kind === "missing-vapid-key" || support.kind === "no-notification-api" || support.kind === "no-service-worker") {
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

  async function handleSubscribe() {
    setState("loading");
    trackEvent("push_subscribe_attempt");

    const result = await subscribePush();
    trackEvent(`push_subscribe_${result.kind}`, "code" in result ? { code: result.code } : "name" in result ? { name: result.name } : undefined);

    switch (result.kind) {
      case "success":
        localStorage.setItem(LS_KEY, "1");
        setState("subscribed");
        toast.success("Notifikace zapnuty. Ozveme se v pondělí ráno.");
        return;
      case "permission-denied":
        setState("denied");
        toast.error("Notifikace jsou zakázané v nastavení prohlížeče.");
        return;
      case "permission-dismissed":
        setState("default");
        return;
      case "ios-needs-pwa-install":
        setState("default");
        toast.message("Pro pondělní upozornění je potřeba aplikaci přidat na plochu (Sdílet → Přidat na plochu).");
        return;
      case "pushmanager-error":
        setState("default");
        console.error("[Push] pushManager.subscribe:", result);
        toast.error("Nepodařilo se zapnout notifikace. Zkus to prosím znovu.");
        return;
      case "supabase-error":
        setState("default");
        console.error("[Push] Supabase insert:", result);
        toast.error("Notifikace se nepodařilo uložit. Zkus to prosím znovu.");
        return;
      case "unsupported":
        setState("unsupported");
        return;
    }
  }

  async function handleUnsubscribe() {
    setState("loading");
    trackEvent("push_unsubscribe_attempt");
    const result = await unsubscribePush();
    trackEvent(`push_unsubscribe_${result.kind}`);
    if (result.kind === "success") {
      localStorage.removeItem(LS_KEY);
      setState("default");
    } else {
      console.error("[Push] Unsubscribe:", result);
      setState("subscribed");
    }
  }

  const isSubscribed = state === "subscribed";
  const isLoading = state === "loading";

  return (
    <button
      onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
      disabled={isLoading || state === "denied"}
      className="p-2.5 rounded-full text-foreground/60 hover:text-foreground transition-colors disabled:opacity-40"
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
        <Bell className="h-6 w-6 text-foreground/80" />
      ) : (
        <BellOff className="h-6 w-6" />
      )}
    </button>
  );
}
