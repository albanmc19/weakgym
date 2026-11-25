/* WeakGym — Notifications.
   1) Alertes dans l'appli (toasts) : une seule pile, même style pour WeakCoins, Social, erreurs…
        wgToast({kind, title, text, icon, href, extra, ms})   |   wgCount(el, de, vers)
   2) Notifications push en arrière-plan (appli fermée), envoyées par le Worker Cloudflare :
        wgPush.sync()  : abonne cet appareil si les notifications sont activées dans le profil
        wgPush.unsubscribe()  : désabonne cet appareil
   À charger AVANT social.js et boutique.js. */
(() => {
'use strict';

/* >>> À REMPLIR : l'adresse de ton Worker Cloudflare (celle qui affiche « WeakGym push : en ligne ») <<< */
const PUSH_URL = 'https://TON-WORKER.TON-PSEUDO.workers.dev';

const LS = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  del: k => { try { localStorage.removeItem(k); } catch (e) {} }
};

/* ================= 1) TOASTS ================= */
const BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>';
const CAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
const st = document.createElement('style');
st.textContent = `
#wgts{position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 10px);z-index:9999;width:min(94vw,400px);display:flex;flex-direction:column;gap:8px;pointer-events:none}
.wgt{pointer-events:auto;position:relative;overflow:hidden;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:18px;background:var(--card);color:var(--ink);border:1px solid var(--line);box-shadow:0 10px 30px rgba(0,0,0,.22);text-decoration:none;animation:wgt-in .38s cubic-bezier(.2,1.1,.3,1) both;touch-action:pan-y;cursor:pointer}
.wgt.out{animation:wgt-out .25s ease both}
.wgt-ic{flex:none;display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:color-mix(in srgb,var(--acc) 14%,var(--soft));color:var(--acc)}
.wgt-ic svg{width:24px;height:24px}
.wgt-b{min-width:0;flex:1;line-height:1.25}
.wgt-t{display:block;font:800 16px var(--hf);overflow-wrap:anywhere}
.wgt-s{display:block;color:var(--mute);font-size:14px;overflow-wrap:anywhere}
.wgt-bar{position:absolute;left:0;bottom:0;height:3px;width:100%;background:var(--acc);transform-origin:left;animation:wgt-bar linear forwards}
.wgt-coin{border-color:color-mix(in srgb,var(--acc) 55%,var(--line))}
.wgt-coin .wgt-ic{width:52px;height:52px;background:none;perspective:200px}
.wgt-coin .wgt-ic svg{width:48px;height:48px;animation:wgt-flip .9s cubic-bezier(.3,.7,.3,1) both}
.wgt-coin .wgt-t{font-size:21px;color:var(--acc);font-variant-numeric:tabular-nums}
.wgt-g{margin-top:7px}
.wgt-g i{display:block;height:6px;border-radius:99px;background:var(--soft);overflow:hidden}
.wgt-g i b{display:block;height:100%;width:0;background:var(--acc);border-radius:99px;transition:width .9s .25s cubic-bezier(.2,.8,.2,1)}
.wgt-g .wgt-s{font-size:12.5px;margin-top:3px}
@keyframes wgt-in{from{opacity:0;transform:translateY(-24px) scale(.96)}to{opacity:1;transform:none}}
@keyframes wgt-out{to{opacity:0;transform:translateY(-16px) scale(.96)}}
@keyframes wgt-bar{to{transform:scaleX(0)}}
@keyframes wgt-flip{0%{transform:rotateY(0) scale(.6)}60%{transform:rotateY(540deg) scale(1.15)}100%{transform:rotateY(720deg) scale(1)}}
@media(prefers-reduced-motion:reduce){.wgt,.wgt-ic svg,.wgt-bar{animation:none!important}.wgt-g i b{transition:none}}
`;
document.head.appendChild(st);

function kill(el) {
  if (!el || el.dataset.k) return; el.dataset.k = '1';
  el.classList.add('out'); setTimeout(() => el.remove(), 260);
}
/* kind : 'info' | 'social' | 'coin' · icon : SVG (HTML de confiance) · extra : nœud DOM ajouté sous le texte */
function wgToast(o) {
  o = o || {};
  let box = document.getElementById('wgts');
  if (!box) { box = document.createElement('div'); box.id = 'wgts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  while (box.children.length >= 3) kill(box.firstElementChild);
  const el = document.createElement(o.href ? 'a' : 'div'); el.className = 'wgt' + (o.kind ? ' wgt-' + o.kind : ''); el.setAttribute('role', 'status');
  if (o.href) el.href = o.href;
  const ic = document.createElement('span'); ic.className = 'wgt-ic'; ic.innerHTML = o.icon || (o.kind === 'social' ? CAM : BELL);
  const b = document.createElement('span'); b.className = 'wgt-b';
  if (o.title) { const t = document.createElement('b'); t.className = 'wgt-t'; t.textContent = o.title; b.appendChild(t); }
  if (o.text) { const s = document.createElement('span'); s.className = 'wgt-s'; s.textContent = o.text; b.appendChild(s); }
  if (o.extra) b.appendChild(o.extra);
  el.append(ic, b);
  const ms = o.ms || 5000, bar = document.createElement('i'); bar.className = 'wgt-bar'; bar.style.animationDuration = ms + 'ms'; el.appendChild(bar);
  box.appendChild(el);
  const timer = setTimeout(() => kill(el), ms);
  let y0 = null, swiped = false;   // glisser vers le haut = fermer
  el.addEventListener('pointerdown', e => { y0 = e.clientY; swiped = false; });
  el.addEventListener('pointermove', e => { if (y0 != null && e.clientY - y0 < -24) { swiped = true; clearTimeout(timer); kill(el); y0 = null; } });
  el.addEventListener('click', e => { if (swiped) { e.preventDefault(); return; } clearTimeout(timer); kill(el); });
  try { navigator.vibrate && navigator.vibrate(o.kind === 'coin' ? [25, 40, 25] : 20); } catch (e) {}
  return el;
}
/* compteur animé (ex. +20) */
function wgCount(el, from, to, ms, fmt) {
  fmt = fmt || (n => String(n)); ms = ms || 700;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = t => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(Math.round(from + (to - from) * e)); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
window.wgToast = wgToast; window.wgCount = wgCount;

/* ================= 2) PUSH EN ARRIÈRE-PLAN ================= */
const supported = () => location.protocol === 'https:' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const toBytes = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - s.length % 4) % 4); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const sha = async s => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))).map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
const same = (buf, bytes) => { if (!buf) return false; const a = new Uint8Array(buf); return a.length === bytes.length && a.every((v, i) => v === bytes[i]); };

let VKEY = null;
async function vapidKey() {
  if (VKEY) return VKEY;
  if (/TON-WORKER/.test(PUSH_URL)) throw new Error('PUSH_URL non renseignée dans notifs.js');
  try {
    const r = await fetch(PUSH_URL.replace(/\/$/, '') + '/vapid'); if (!r.ok) throw new Error('vapid ' + r.status);
    VKEY = (await r.text()).trim(); LS.set('wg_vapid', VKEY);
  } catch (e) { VKEY = LS.get('wg_vapid'); if (!VKEY) throw e; }   // hors ligne : dernière clé connue
  return VKEY;
}

async function subscribe(force) {
  const reg = await navigator.serviceWorker.ready, key = toBytes(await vapidKey());
  let sub = await reg.pushManager.getSubscription();
  if (sub && !same(sub.options && sub.options.applicationServerKey, key)) { await sub.unsubscribe(); sub = null; }   // clé changée côté Worker
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const j = sub.toJSON(), id = user.uid + '_' + await sha(j.endpoint);
  if (!force && LS.get('wg_push') === id && Date.now() - (+LS.get('wg_push_at') || 0) < 6048e5) return;   // déjà à jour (re-vérifié toutes les semaines)
  await db.collection('pushSubs').doc(id).set({ uid: user.uid, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, at: Date.now() });
  LS.set('wg_push', id); LS.set('wg_push_at', String(Date.now()));
}
async function unsubscribe() {
  const id = LS.get('wg_push'); LS.del('wg_push'); LS.del('wg_push_at');
  try { if (id) await db.collection('pushSubs').doc(id).delete(); } catch (e) {}
  try { const reg = await navigator.serviceWorker.getRegistration(), sub = reg && await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch (e) {}
}
async function sync(force) {
  try {
    if (!supported() || typeof user === 'undefined' || !user) return;
    const want = typeof myProf !== 'undefined' && myProf && myProf.notif === true && Notification.permission === 'granted';
    if (!want) { if (LS.get('wg_push')) await unsubscribe(); return; }
    await subscribe(force);
  } catch (e) { console.info('Push :', e && e.message); }
}
window.wgPush = { sync, unsubscribe, supported, active: () => supported() && !!LS.get('wg_push') && Notification.permission === 'granted' };

if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type === 'wg-nav' && d.hash) { location.hash = d.hash; window.scrollTo(0, 0); }   // clic sur une notification push
  else if (d.type === 'wg-resync') sync(true);
});
/* à la déconnexion, cet appareil ne doit plus recevoir les notifications du compte quitté */
try {
  if (typeof auth !== 'undefined' && auth && auth.signOut) {
    const so = auth.signOut.bind(auth);
    auth.signOut = () => Promise.race([unsubscribe(), new Promise(r => setTimeout(r, 1500))]).then(() => so());
  }
} catch (e) {}
setTimeout(() => sync(), 2000);
})();
