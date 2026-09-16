const CACHE_NAME='swarup-sir-knowledge-hub-v5';
const APP_SHELL=[
  '/',
  '/index.html',
  '/main.html',
  '/student-login.html',
  '/school-login.html',
  '/school-dashboard.html',
  '/teacher-login.html',
  '/student-app.webmanifest',
  '/skh-icon-192.png',
  '/skh-icon-512.png',
  '/skh-icon.png'
];
self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
));
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET'||!req.url.startsWith(self.location.origin))return;
  event.respondWith(fetch(req).then(res=>{
    const copy=res.clone();caches.open(CACHE_NAME).then(c=>c.put(req,copy)).catch(()=>{});return res;
  }).catch(()=>caches.match(req).then(r=>r||caches.match('/index.html'))));
});
