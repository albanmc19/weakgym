/* Service worker WeakGym : permet l'installation du site comme une appli.
   Réseau d'abord (les mises à jour du site arrivent tout de suite),
   cache en secours si le réseau est coupé. Firebase/Google ne sont jamais mis en cache. */
const CACHE = 'weakgym-v1';
const SHELL = ['./', 'index.html', 'ios-compat.js', 'manifest.webmanifest', 'notifications.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(
    fetch(r).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
      return res;
    }).catch(() => caches.match(r).then(m => m || caches.match('index.html')))
  );
});

/* Clic sur une notification de rappel : ouvre WeakGym sur l'accueil */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
    for (const c of list) {
      if ('focus' in c) { c.postMessage({type: 'wg-home'}); return c.focus(); }
    }
    return self.clients.openWindow('./');
  }));
});
