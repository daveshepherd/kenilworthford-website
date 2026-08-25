import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';

globalThis.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'pages',
    networkTimeoutSeconds: 4,
  })
);

registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'worker',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
  })
);

registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  })
);

registerRoute(
  ({ url }) => url.pathname.endsWith('/status'),
  new NetworkFirst({
    cacheName: 'api-status',
    networkTimeoutSeconds: 4,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 10 * 60,
      }),
    ],
  })
);

setCatchHandler(async ({ event }) => {
  if (event.request.destination === 'document') {
    const cachedOfflinePage = await caches.match('/offline.html');
    if (cachedOfflinePage) {
      return cachedOfflinePage;
    }
  }

  return Response.error();
});

globalThis.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    console.error('Unable to parse push payload as JSON:', error);
    payload = {
      title: 'Kenilworth Ford update',
      body: event.data ? event.data.text() : '',
    };
  }

  const notificationTitle = payload.title || 'Kenilworth Ford update';
  const notificationOptions = {
    body: payload.body || 'Tap to view latest ford status.',
    data: {
      url: payload.url || '/',
    },
  };

  if (payload.icon) {
    notificationOptions.icon = payload.icon;
  }

  if (payload.badge) {
    notificationOptions.badge = payload.badge;
  }

  event.waitUntil(globalThis.registration.showNotification(notificationTitle, notificationOptions));
});

globalThis.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const windowClient of windowClients) {
        if (windowClient.url.includes(targetUrl) && 'focus' in windowClient) {
          return windowClient.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return null;
    })
  );
});
