/* Service worker WeakGym : installation comme une appli + notifications push.
   Réseau d'abord (les mises à jour du site arrivent tout de suite), cache en secours si le réseau est coupé.
   Firebase/Google ne sont jamais mis en cache. */
const CACHE = 'weakgym-v3';
const SHELL = ['./', 'index.html', 'social.js', 'social.css', 'classe.js', 'classe.css', 'live.js', 'update.js', 'boutique.js', 'notifs.js', 'ios-compat.js', 'i18n-dict.js', 'i18n-ru.js', 'i18n.js', 'manifest.webmanifest', 'notifications.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  /* un fichier absent ne bloque plus tout le cache (addAll échoue en bloc) */
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
/* l'appli (update.js) peut demander l'activation immédiate d'une version déjà téléchargée */
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(
    /* cache:'no-cache' = on revalide TOUJOURS auprès du serveur : le cache HTTP du téléphone ne peut plus resservir une vieille version */
    fetch(r, { cache: 'no-cache' }).then(res => {
      if (res && res.ok && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(r).then(m => m || caches.match('index.html')))
  );
});

/* ---------- Notification push reçue (appli fermée ou en arrière-plan) ----------
   Le Worker Cloudflare envoie { title, body, tag, hash }. Toujours afficher quelque chose
   (iOS/Safari retire l'autorisation si un push n'affiche rien). */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'WeakGym', {
    body: d.body || '',
    icon: d.icon || 'apple-touch-icon.png',
    badge: d.badge || 'icon-192.png',
    tag: d.tag || undefined,          // même tag = la notification est remplacée, jamais de doublon
    vibrate: [60, 40, 60],
    timestamp: Date.now(),
    data: { hash: d.hash || '#/' }
  }));
});

/* ---------- Clic : ouvre WeakGym directement sur la bonne page (#/social, #/boutique…) ---------- */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const d = e.notification.data || {};
  const hash = d.hash || (typeof d.url === 'string' && d.url.indexOf('#') >= 0 ? d.url.slice(d.url.indexOf('#')) : '');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if ('focus' in c) { c.postMessage(hash && hash !== '#/' ? { type: 'wg-nav', hash } : { type: 'wg-home' }); return c.focus(); }
    }
    return self.clients.openWindow('./' + (hash || ''));
  }));
});

/* ---------- Le navigateur a renouvelé l'abonnement push : on le ré-enregistre à la prochaine ouverture ---------- */
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => list.forEach(c => c.postMessage({ type: 'wg-resync' }))));
});
