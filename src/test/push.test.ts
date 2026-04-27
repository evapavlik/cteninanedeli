import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => {
  const insert = vi.fn();
  const del = vi.fn();
  const eq = vi.fn();
  return {
    supabase: {
      from: vi.fn(() => ({
        insert: (...args: unknown[]) => insert(...args),
        delete: () => ({ eq: (...args: unknown[]) => eq(...args) }),
      })),
      __mocks: { insert, del, eq },
    },
  };
});

import { detectPushSupport, subscribePush } from "@/lib/push";
import { supabase } from "@/integrations/supabase/client";

const mocks = (supabase as unknown as { __mocks: { insert: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn> } }).__mocks;

const ORIGINAL_NOTIFICATION = (globalThis as { Notification?: unknown }).Notification;
const ORIGINAL_USER_AGENT = navigator.userAgent;

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, "userAgent", { configurable: true, get: () => ua });
}

function setNotification(value: unknown) {
  if (value === undefined) {
    delete (globalThis as { Notification?: unknown }).Notification;
  } else {
    (globalThis as { Notification?: unknown }).Notification = value;
  }
}

beforeEach(() => {
  mocks.insert.mockReset();
  mocks.eq.mockReset();
  // jsdom doesn't define Notification — give the tests a baseline that does
  setNotification({
    permission: "default",
    requestPermission: vi.fn(async () => "granted"),
  });
  // jsdom navigator has no serviceWorker; pretend we're in a modern browser
  if (!("serviceWorker" in navigator)) {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: {
            subscribe: vi.fn(async () => ({
              toJSON: () => ({
                endpoint: "https://push.example/x",
                keys: { p256dh: "p", auth: "a" },
              }),
            })),
          },
        }),
      },
    });
  }
  setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120");
});

afterEach(() => {
  setNotification(ORIGINAL_NOTIFICATION);
  setUserAgent(ORIGINAL_USER_AGENT);
});

describe("detectPushSupport", () => {
  it("returns ios-needs-pwa-install on iOS Safari without standalone display", () => {
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605");
    const win = {
      Notification: {},
      matchMedia: () => ({ matches: false }),
      navigator: { standalone: false },
    } as unknown as Window;
    const nav = {
      userAgent: "iPhone",
      serviceWorker: {},
    } as unknown as Navigator;
    const result = detectPushSupport({ windowRef: win, navigatorRef: nav });
    expect(result.kind).toBe("ios-needs-pwa-install");
  });

  it("returns supported for iOS Safari running as a standalone PWA", () => {
    const win = {
      Notification: {},
      matchMedia: () => ({ matches: true }),
      navigator: { standalone: true },
    } as unknown as Window;
    const nav = {
      userAgent: "iPhone",
      serviceWorker: {},
    } as unknown as Navigator;
    expect(detectPushSupport({ windowRef: win, navigatorRef: nav }).kind).toBe("supported");
  });

  it("returns no-notification-api when Notification is missing", () => {
    const win = { matchMedia: () => ({ matches: false }), navigator: {} } as unknown as Window;
    const nav = { userAgent: "Chrome", serviceWorker: {} } as unknown as Navigator;
    expect(detectPushSupport({ windowRef: win, navigatorRef: nav }).kind).toBe("no-notification-api");
  });

  it("returns no-service-worker when serviceWorker is missing", () => {
    const win = { Notification: {}, matchMedia: () => ({ matches: false }), navigator: {} } as unknown as Window;
    const nav = { userAgent: "Chrome" } as unknown as Navigator;
    expect(detectPushSupport({ windowRef: win, navigatorRef: nav }).kind).toBe("no-service-worker");
  });
});

describe("subscribePush", () => {
  it("returns permission-denied when the user blocks notifications", async () => {
    setNotification({
      permission: "default",
      requestPermission: vi.fn(async () => "denied"),
    });
    const result = await subscribePush();
    expect(result.kind).toBe("permission-denied");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("returns permission-dismissed when the user closes the dialog without choosing", async () => {
    setNotification({
      permission: "default",
      requestPermission: vi.fn(async () => "default"),
    });
    const result = await subscribePush();
    expect(result.kind).toBe("permission-dismissed");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("returns success when the row is inserted", async () => {
    mocks.insert.mockResolvedValue({ error: null });
    const result = await subscribePush();
    expect(result).toEqual({ kind: "success", alreadySubscribed: false });
    expect(mocks.insert).toHaveBeenCalledWith({
      endpoint: "https://push.example/x",
      p256dh: "p",
      auth: "a",
    });
  });

  it("treats unique_violation (23505) as success — endpoint already saved", async () => {
    mocks.insert.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });
    const result = await subscribePush();
    expect(result).toEqual({ kind: "success", alreadySubscribed: true });
  });

  it("surfaces the Supabase error code for any other failure", async () => {
    mocks.insert.mockResolvedValue({ error: { code: "42501", message: "insufficient_privilege" } });
    const result = await subscribePush();
    expect(result).toEqual({
      kind: "supabase-error",
      code: "42501",
      message: "insufficient_privilege",
    });
  });

  it("returns pushmanager-error with name + message when subscribe throws", async () => {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: {
            subscribe: vi.fn(async () => {
              const err = new Error("permission denied");
              err.name = "NotAllowedError";
              throw err;
            }),
          },
        }),
      },
    });
    const result = await subscribePush();
    expect(result.kind).toBe("pushmanager-error");
    if (result.kind === "pushmanager-error") {
      expect(result.name).toBe("NotAllowedError");
      expect(result.message).toBe("permission denied");
    }
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
