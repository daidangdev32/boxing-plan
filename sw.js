/*
 * Offline support. Network first, so updates show up straight away when you're
 * online; the cached copy is used when the gym has no signal.
 */
var CACHE = 'boxing-camp-v2';
var ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/plan.js',
  'js/signal.js',
  'js/timer.js',
  'js/app.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'fonts/sofia-sans-latin-400-normal.woff2',
  'fonts/sofia-sans-latin-600-normal.woff2',
  'fonts/sofia-sans-latin-700-normal.woff2',
  'fonts/sofia-sans-extra-condensed-latin-700-normal.woff2',
  'fonts/sofia-sans-extra-condensed-latin-800-normal.woff2',
  'fonts/sofia-sans-extra-condensed-latin-900-normal.woff2'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) { return; }
  event.respondWith(
    fetch(req)
      .then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      })
      .catch(function () {
        return caches.match(req, { ignoreSearch: true }).then(function (hit) {
          return hit || caches.match('index.html');
        });
      })
  );
});
