// Self-unregistering service worker to clear any leftover workers from other projects on this port
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.registration.unregister().then(() => {
    return self.clients.matchAll();
  }).then((clients) => {
    clients.forEach((client) => {
      // client clean
    });
  });
});
