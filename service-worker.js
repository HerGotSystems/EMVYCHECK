const CACHE = 'emvy-v1';
const SHELL = [
  '/',
  '/manifest.webmanifest'
];

// Install: cache the shell
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) { return c.addAll(SHELL); })
  );
  self.skipWaiting();
});

// Activate: clear old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch strategy:
// - Shell (index.html): network first, fall back to cache
// - playlist.json: network first, fall back to cache (stale ok)
// - Audio / images (media.emvycheck.com): network only, no caching (files too large)
// - Everything else: network first, fall back to cache
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // Never try to cache cross-origin audio/media
  if (url.includes('media.emvycheck.com')) {
    return; // let browser handle it normally
  }

  // playlist.json — network first, cache fallback
  if (url.includes('playlist.json')) {
    e.respondWith(
      fetch(e.request)
        .then(function(res) {
          var clone = res.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
          return res;
        })
        .catch(function() { return caches.match(e.request); })
    );
    return;
  }

  // HTML shell — network first, cache fallback
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(function(res) {
          var clone = res.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
          return res;
        })
        .catch(function() { return caches.match('/'); })
    );
    return;
  }

  // Default: network first
  e.respondWith(
    fetch(e.request).catch(function() { return caches.match(e.request); })
  );
});
