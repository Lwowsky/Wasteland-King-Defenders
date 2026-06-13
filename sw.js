const WKD_SW_VERSION = 'wkd-sw-v190';
const STATIC_CACHE = `${WKD_SW_VERSION}-static`;
const RUNTIME_CACHE = `${WKD_SW_VERSION}-runtime`;
const STATIC_ASSET_RE = /\.(?:html|css|js|mjs|png|webp|svg|ico|json)$/i;

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll([
    '/', '/index.html', '/stats.html', '/region-table.html', '/public-plan.html', '/notifications.html',
    '/css/styles.css', '/css/base.css', '/css/header.css', '/css/responsive.css', '/js/core/app-boot.js',
    '/public-cache/stats-summary.json', '/public-cache/stats-version.json'
  ]).catch(() => null)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('wkd-sw-') && !key.startsWith(WKD_SW_VERSION)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

function shouldCache(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return false;
  if (url.pathname.startsWith('/public-cache/')) return true;
  return STATIC_ASSET_RE.test(url.pathname) || url.pathname === '/' || url.pathname.endsWith('/');
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (!shouldCache(request)) return;
  event.respondWith((async () => {
    const cache = await caches.open(request.url.includes('/public-cache/') ? RUNTIME_CACHE : STATIC_CACHE);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) {
      event.waitUntil(fetch(request).then(response => {
        if (response && response.ok) cache.put(request, response.clone()).catch(() => null);
      }).catch(() => null));
      return cached;
    }
    try {
      const response = await fetch(request);
      if (response && response.ok) cache.put(request, response.clone()).catch(() => null);
      return response;
    } catch (error) {
      return cached || Response.error();
    }
  })());
});
