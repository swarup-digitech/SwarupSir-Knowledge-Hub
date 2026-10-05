// Student PWA service worker (v9).
// IMPORTANT: this worker must never touch scripts, fonts or any cross-origin request
// (MathJax, jsPDF, Supabase, CDNs...). Earlier versions intercepted every GET and, when the
// network call failed, answered with index.html or with nothing, which broke MathJax:
// "A ServiceWorker intercepted the request and encountered an unexpected error".
const CACHE='skh-pwa-v9-student-only';
const APP_SHELL=['/index.html','/student-app.webmanifest','/skh-icon.png','/skh-icon-192.png','/skh-icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE)
      // Cache each file separately so one missing file cannot make the whole install fail.
      .then(c=>Promise.all(APP_SHELL.map(u=>c.add(u).catch(()=>{}))))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  // Never intercept cross-origin requests (CDNs, Supabase, fonts, ...).
  if(url.origin!==self.location.origin) return;
  // Only page navigations get the offline fallback. Scripts, CSS, fonts, images, JSON,
  // /mathjax/... etc. go straight to the browser/network, untouched.
  if(req.mode!=='navigate') return;
  e.respondWith(
    fetch(req).catch(()=>
      caches.match(req).then(r=>r||caches.match('/index.html')).then(r=>r||Response.error())
    )
  );
});
