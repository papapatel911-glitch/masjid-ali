const CACHE = 'masjid-ali-v2';
const ASSETS = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Prayer times: always try network first; cache under a stable key
  // (the page adds a ?t= cache-buster, so ignore the query when matching)
  if (url.pathname === '/prayer-times.json') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put('/prayer-times.json', clone));
          return res;
        })
        .catch(() => caches.match('/prayer-times.json'))
    );
    return;
  }

  // The app shell: network-first so updates reach installed users,
  // falling back to cache when offline
  if (e.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request).then(cached => cached || caches.match('/')))
    );
    return;
  }

  // Everything else (icons, manifest): cache-first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
