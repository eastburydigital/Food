// Offline support. Network first, so a new deploy shows up straight away;
// the cache is only used when the phone is offline.
// __BUILD__ is replaced with a unique id on every Netlify build (see netlify.toml).
const VERSION = 'gk-__BUILD__';
const SHELL = ['/', '/index.html', '/styles.css', '/js/app.js', '/js/store.js', '/js/scale.js', '/js/aisles.js', '/js/recommend.js', '/recipes.json', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.all(SHELL.map((url) => fetch(url, { cache: 'no-cache' }).then((res) => clean(res) && c.put(url, res)).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Only keep real files: not redirects (e.g. a login page) or errors.
function clean(res) {
  return res && res.ok && !res.redirected && res.type === 'basic';
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const res = await fetch(req);
      if (clean(res)) cache.put(req, res.clone());
      return res;
    } catch {
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;
      if (req.mode === 'navigate') return (await cache.match('/index.html')) || Response.error();
      return Response.error();
    }
  })());
});
