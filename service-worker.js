const CACHE = 'emvy-v4-offer-hub-music-route';
const HARDENING_SCRIPT = '<script src="/car-audio-hardening.js?v=20260709"></script>';
const SITE_LINKS_SCRIPT = '<script src="/site-links.js?v=20260825"></script>';
const SHELL = [
  '/',
  '/music/',
  '/manifest.webmanifest',
  '/car-audio-hardening.js',
  '/site-links.js'
];

function isMusicPath(pathname) {
  return pathname === '/music' || pathname === '/music/' || pathname === '/music/index.html';
}

function injectMusicScripts(html) {
  if (!html) return html;
  if (html.indexOf('car-audio-hardening.js') === -1) {
    html = html.replace('</body>', HARDENING_SCRIPT + '\n</body>');
  }
  if (html.indexOf('site-links.js') === -1) {
    html = html.replace('</body>', SITE_LINKS_SCRIPT + '\n</body>');
  }
  return html;
}

function htmlResponse(res, pathname) {
  if (!isMusicPath(pathname)) return Promise.resolve(res);
  return res.text().then(function(html) {
    var headers = new Headers(res.headers);
    headers.set('Content-Type', 'text/html; charset=utf-8');
    headers.set('Cache-Control', 'no-store');
    return new Response(injectMusicScripts(html), {
      status: res.status,
      statusText: res.statusText,
      headers: headers
    });
  });
}

// Install: keep both the new brand homepage and the relocated music player
// available as their own shells. The v4 cache name intentionally invalidates
// the old assumption that '/' was the music player.
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) { return c.addAll(SHELL); })
  );
  self.skipWaiting();
});

// Activate: clear old caches so a previous cached music homepage cannot mask
// the new EMVY CHECK offer hub after the site pivot.
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
// - HTML navigation: network first; music-only helper injection only on /music/*
// - Offline navigation fallback: /music/* -> cached /music/, everything else -> cached /
// - playlist.json: network first, fall back to cache
// - Audio / images (media.emvycheck.com): network only
// - Everything else: network first, fall back to cache
self.addEventListener('fetch', function(e) {
  var requestUrl = new URL(e.request.url);
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
          return htmlResponse(res, requestUrl.pathname);
        })
        .catch(function() {
          var fallbackPath = isMusicPath(requestUrl.pathname) ? '/music/' : '/';
          return caches.match(fallbackPath).then(function(cached) {
            if (!cached) return cached;
            return htmlResponse(cached, fallbackPath);
          });
        })
    );
    return;
  }

  e.respondWith(
    fetch(e.request).catch(function() { return caches.match(e.request); })
  );
});
