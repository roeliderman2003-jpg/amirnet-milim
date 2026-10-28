/* פטורנט – service worker (offline support).
 * Bump VERSION whenever the precache list or this file's logic changes;
 * day-to-day content updates arrive anyway via network-first. */
const VERSION = 'v3'; // v3: כל התוכן ב-free.js, פתוח לכולם
const CACHE = `petornet-${VERSION}`;
const FONT_CACHE = `petornet-fonts-${VERSION}`;

const SHELL = [
  './',
  'index.html',
  'app.js',
  'sim-app.js',
  'cloud.js',
  'free.js',
  'loader.js',
  'pro.js',
  'privacy.html',
  'terms.html',
  'accessibility.html',
  'manifest.json',
  'icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'vendor/supabase.js',
];

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Cache each file on its own so one missing file does not fail the install.
    await Promise.all(SHELL.map(async (url) => {
      try {
        const res = await fetch(new Request(url, { cache: 'reload' }));
        if (res.ok) await cache.put(url, res);
      } catch (_) { /* ignore missing/failed files */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([CACHE, FONT_CACHE]);
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('petornet-') && !keep.has(k)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Supabase (auth, REST, realtime) – never touch.
  if (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in')) return;

  // Google Fonts – stale-while-revalidate.
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(event, req));
    return;
  }

  // Any other cross-origin request – leave to the browser, no caching.
  if (url.origin !== self.location.origin) return;

  // Page navigations: network-first, fall back to the cached shell.
  // Stored under 'index.html' so OAuth callbacks (?code=...) never pollute the cache.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(networkFirst(event, req, 'index.html'));
    return;
  }

  // Everything else same-origin (JS, JSON, icons...): network-first with cache fallback,
  // so a fresh deploy is picked up immediately when online.
  event.respondWith(networkFirst(event, req));
});

async function networkFirst(event, req, cacheKey) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res.ok && res.type === 'basic') {
      const copy = res.clone();
      event.waitUntil(cache.put(cacheKey || req, copy).catch(() => {}));
    }
    return res;
  } catch (err) {
    const hit = cacheKey
      ? (await cache.match(cacheKey)) || (await cache.match('./'))
      : await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

async function staleWhileRevalidate(event, req) {
  const cache = await caches.open(FONT_CACHE);
  const cached = await cache.match(req);
  const network = fetch(req).then((res) => {
    // Opaque (no-cors) font responses are fine to store too.
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
    return res;
  }).catch(() => undefined);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  const res = await network;
  return res || Response.error();
}
