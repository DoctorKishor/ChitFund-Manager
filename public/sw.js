// ══════════════════════════════════════════════════════════════════════════
// Chit Funds Manager — Progressive Web App (PWA) Service Worker
// Version: 1.0.0
// Caches static app shell for instant offline barrier display & PWA installability
// ══════════════════════════════════════════════════════════════════════════

const CACHE_NAME = 'chitfund-pwa-v1';

const STATIC_SHELL_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/logo.svg',
  '/favicon.svg',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/fonts/Awesome.ttf'
];

// 1. Install Phase — Precache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_SHELL_ASSETS).catch((err) => {
        console.warn('PWA service worker precache warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Phase — Clean Up Obsolete Caches & Claim Clients Immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Phase
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Exclude non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Strictly NEVER cache Supabase API calls, authentication tokens, or realtime websocket traffic
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/auth/') ||
    url.pathname.includes('api-health.json')
  ) {
    return; // Pass through to network directly
  }

  // Strategy A: Page Navigations (HTML documents)
  // Try Network first. If device is offline, return cached App Shell or offline.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Device is offline: Serve cached root document or dedicated offline shell
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match('/') || caches.match('/offline.html');
          });
        })
    );
    return;
  }

  // Strategy B: Static Assets (Next.js chunks, CSS, JS, fonts, SVGs, PNGs)
  // Stale-While-Revalidate for maximum responsiveness
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot|ico|css|js)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Default: Network with Cache Fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
