const CACHE_NAME = 'codereve-v1';

// Minimal caching - only cache the shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Pass through all requests - no caching for now
self.addEventListener('fetch', (event) => {
  // Let all requests pass through to network
  return;
});
