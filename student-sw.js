/* Student PWA service worker — V13
 * - Pre-caches the app shell one file at a time, so one missing file no
 *   longer makes the whole install fail.
 * - Caches ONLY files from this website. Supabase / API responses (which
 *   contain student data) and CDN files are never stored on the device.
 * - Network first; the cached copy is used only when offline.
 */
const CACHE = 'skh-pwa-v13-student';
const APP_SHELL = [
  '/main.html',
  '/common-ui.js',
  '/common-ui.js?v=13',
  '/index.html',
  '/student-course-selection.html',
  '/student-login.html',
  '/school-login.html',
  '/school-dashboard.html',
  '/student-app.webmanifest',
  '/skh-icon.png',
  '/skh-icon-192.png',
  '/skh-icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(APP_SHELL.map(async (url) => {
      const res = await fetch(url, { cache: 'no-cache' });
      if (res.ok) await cache.put(url, res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;      // Supabase, CDNs: browser handles normally
  if (url.pathname.startsWith('/rest/') || url.pathname.startsWith('/auth/') ||
      url.pathname.startsWith('/functions/') || url.pathname.startsWith('/storage/')) return;

  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch (err) {
      const cached = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (cached) return cached;
      if (req.mode === 'navigate') {
        return (await caches.match('/main.html')) || (await caches.match('/index.html')) ||
          new Response('You are offline. Please reconnect and try again.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
      throw err;
    }
  })());
});
