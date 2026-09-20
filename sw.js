const CACHE_NAME = 'swarup-sir-knowledge-hub-v7';
const APP_SHELL = [
  '/',
  '/index.html',
  '/main.html',
  '/student-login.html',
  '/teacher-login.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  event.respondWith(fetch(req).then(res => {
    const copy=res.clone(); caches.open(CACHE_NAME).then(c=>c.put(req,copy)).catch(()=>{}); return res;
  }).catch(()=>caches.match(req).then(r=>r || caches.match('/main.html') || caches.match('/index.html'))));
});
