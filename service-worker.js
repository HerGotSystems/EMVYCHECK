const CACHE = 'emvy-v2-car-audio';
const HARDENING_SCRIPT = '<script src="/car-audio-hardening.js?v=20260709"></script>';
const SHELL = [
  '/',
  '/manifest.webmanifest',
  '/car-audio-hardening.js'
];

function injectCarHardening(html) {
  if (!html || html.indexOf('car-audio-hardening.js') !== -1) return html;
  return html.replace('</body>', HARDENING_SCRIPT + '\n</body>');
}

function htmlWithHardening(res) {
  return res.text().then(function(html) {
    return new Response(injectCarHardening(html), {
      status: res.status,
      statusText: res.statusText,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  });
}

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
// - Shell (index.html): network first, inject car audio hardening, fall back to cache
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

  // HTML shell — network first, inject car audio hardening, cache fallback
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(function(res) {
          var clone = res.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
          return htmlWithHardening(res);
        })
        .catch(function() {
          return caches.match('/').then(function(cached) {
            if (!cached) return cached;
            return htmlWithHardening(cached);
          });
        })
    );
    return;
  }

  // Default: network first
  e.respondWith(
    fetch(e.request).catch(function() { return caches.match(e.request); })
  );
});
