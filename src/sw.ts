/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

// Workbox injects the precache manifest here at build time
precacheAndRoute(self.__WB_MANIFEST);

// Handle incoming push notifications
self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;

  const data = event.data.json() as { title: string; body: string; url?: string };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/pwa-icon-192.png",
      badge: "/pwa-icon-192.png",
      data: { url: data.url ?? "/" },
    }),
  );
});

// Open the app when user taps the notification
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if already open
        for (const client of clientList) {
          if ("focus" in client) return client.focus();
        }
        // Otherwise open a new window
        return self.clients.openWindow(event.notification.data?.url ?? "/");
      }),
  );
});
