/* Playbox service worker — precaches the hub shell; games are cached the first time they are opened. Bump V to invalidate. */
const V = 'playbox-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'assets/icon.svg', 'assets/css/tokens.css', 'assets/css/base.css', 'assets/js/app.js', 'assets/js/sdk.js', 'games/games.json'];

self.addEventListener('install', (e) => e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  const sameOrigin = url.origin === location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;

  // Registry: network first so new games show up, cache as offline fallback.
  if (sameOrigin && url.pathname.endsWith('/games.json')) {
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(V).then((x) => x.put(req, c)); return r; }).catch(() => caches.match(req)));
    return;
  }
  // Everything else: stale-while-revalidate.
  e.respondWith(caches.open(V).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: false });
    const net = fetch(req).then((r) => { if (r.ok || r.type === 'opaque') cache.put(req, r.clone()); return r; }).catch(() => null);
    return hit || (await net) || (req.mode === 'navigate' ? cache.match('index.html') : Response.error());
  }));
});
