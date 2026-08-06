const CACHE = 'emvy-v3-art-grid-links';
const HARDENING_SCRIPT = '<script src="/car-audio-hardening.js?v=20260709"></script>';
const SITE_LINKS_SCRIPT = '<script src="/site-links.js?v=20260805"></script>';
const SHELL = [
  '/',
  '/manifest.webmanifest',
  '/car-audio-hardening.js',
  '/site-links.js'
];

function injectSiteScripts(html) {
  if (!html) return html;
  if (html.indexOf('car-audio-hardening.js') === -1) {
    html = html.replace('</body>', HARDENING_SCRIPT + '\n</body>');
  }
  if (html.indexOf('site-links.js') === -1) {
    html = html.replace('</body>', SITE_LINKS_SCRIPT + '\n</body>');
  }
  return html;
}

function htmlWithSiteScripts(res) {
  return res.text().then(function(html) {
    return new Response(injectSiteScripts(html), {
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
// - HTML navigation: network first, inject homepage helpers, fall back to cached root
// - playlist.json: network first, fall back to cache
// - Audio / images (media.emvycheck.com): network only
// - Everything else: network first, fall back to cache
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  if (url.includes('media.emvycheck.com')) {
    return;
  }

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

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(function(res) {
          var clone = res.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
          return htmlWithSiteScripts(res);
        })
        .catch(function() {
          return caches.match('/').then(function(cached) {
            if (!cached) return cached;
            return htmlWithSiteScripts(cached);
          });
        })
    );
    return;
  }

  e.respondWith(
    fetch(e.request).catch(function() { return caches.match(e.request); })
  );
});
