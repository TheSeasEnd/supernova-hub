/* Supernova PWA service worker: app shell cache-first; BrettZone API is network-only
   (the app caches API data in localStorage and has a bundled snapshot fallback). */
var CACHE = 'supernova-v5';
var SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'bots.js', 'archetypes.js', 'data/archetypes.json', 'profile.js', 'calcs.js', 'data/snapshot.js', 'manifest.webmanifest', 'fonts/fonts.css', 'fonts/chakra-petch-400.woff2', 'fonts/chakra-petch-600.woff2', 'fonts/chakra-petch-700.woff2', 'fonts/chakra-petch-700-italic.woff2',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return; // let API, iframe, images go to network
  // stale-while-revalidate for shell files
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(e.request, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(e.request).then(function (r) { if (r && r.ok) c.put(e.request, r.clone()); return r; }).catch(function () { return hit || c.match('index.html'); });
      return hit || net;
    });
  }));
});
