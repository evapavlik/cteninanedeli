import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type PushSupport =
  | { kind: "supported" }
  | { kind: "missing-vapid-key" }
  | { kind: "no-notification-api" }
  | { kind: "no-service-worker" }
  | { kind: "ios-needs-pwa-install" };

export type SubscribeResult =
  | { kind: "success"; alreadySubscribed: boolean }
  | { kind: "permission-denied" }
  | { kind: "permission-dismissed" }
  | { kind: "ios-needs-pwa-install" }
  | { kind: "pushmanager-error"; name: string; message: string }
  | { kind: "supabase-error"; code: string | null; message: string }
  | { kind: "unsupported"; reason: PushSupport["kind"] };

export type UnsubscribeResult =
  | { kind: "success" }
  | { kind: "error"; message: string };

export interface PushDeps {
  windowRef?: Window;
  navigatorRef?: Navigator;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padded = base64String + "==".substring(0, (4 - (base64String.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function isIos(nav: Navigator): boolean {
  return /iPad|iPhone|iPod/.test(nav.userAgent) && !("MSStream" in window);
}

function isStandalone(win: Window): boolean {
  return (
    win.matchMedia?.("(display-mode: standalone)").matches === true ||
    (win.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function detectPushSupport(deps: PushDeps = {}): PushSupport {
  const win = deps.windowRef ?? window;
  const nav = deps.navigatorRef ?? navigator;
  if (!VAPID_PUBLIC_KEY) return { kind: "missing-vapid-key" };
  if (!("Notification" in win)) return { kind: "no-notification-api" };
  if (!("serviceWorker" in nav)) return { kind: "no-service-worker" };
  // iOS Safari exposes Notification + serviceWorker but only delivers Web Push
  // when the app is installed to the Home Screen (standalone display mode).
  if (isIos(nav) && !isStandalone(win)) return { kind: "ios-needs-pwa-install" };
  return { kind: "supported" };
}

export async function subscribePush(deps: PushDeps = {}): Promise<SubscribeResult> {
  const support = detectPushSupport(deps);
  if (support.kind === "ios-needs-pwa-install") {
    return { kind: "ios-needs-pwa-install" };
  }
  if (support.kind !== "supported") {
    return { kind: "unsupported", reason: support.kind };
  }

  const permission = await Notification.requestPermission();
  if (permission === "denied") return { kind: "permission-denied" };
  if (permission !== "granted") return { kind: "permission-dismissed" };

  let sub: PushSubscription;
  try {
    const reg = await navigator.serviceWorker.ready;
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
    });
  } catch (e) {
    const err = e as Error;
    return { kind: "pushmanager-error", name: err.name || "Error", message: err.message || String(e) };
  }

  const json = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").insert({
    endpoint: json.endpoint!,
    p256dh: json.keys!.p256dh,
    auth: json.keys!.auth,
  });

  // 23505 = unique_violation: endpoint already saved, treat as success
  if (error && error.code !== "23505") {
    return { kind: "supabase-error", code: error.code ?? null, message: error.message };
  }
  return { kind: "success", alreadySubscribed: error?.code === "23505" };
}

export async function unsubscribePush(): Promise<UnsubscribeResult> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    return { kind: "success" };
  } catch (e) {
    return { kind: "error", message: (e as Error).message };
  }
}
