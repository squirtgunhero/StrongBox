// StrongBox Service Worker for PWA and Push Notifications

const CACHE_NAME = "strongbox-v1";
const STATIC_ASSETS = ["/", "/manifest.json"];

// Install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch — network first, cache fallback
self.addEventListener("fetch", (event) => {
  // Skip non-GET and API requests
  if (event.request.method !== "GET") return;
  if (event.request.url.includes("/api/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push notifications
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "StrongBox";
  const options = {
    body: data.message || data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.actionUrl || "/" },
    tag: data.tag || "strongbox-notification",
    requireInteraction: data.requireInteraction || false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click — open the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus existing window or open new
        for (const client of clients) {
          if (client.url.includes(self.location.origin)) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
