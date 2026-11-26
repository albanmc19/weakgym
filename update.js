/* WeakGym — Mises à jour automatiques de l'appli installée (PWA).
   Chargé par index.html (après live.js). Il :
   - demande au navigateur de chercher une nouvelle version à l'ouverture, au retour sur l'appli,
     quand le réseau revient, et toutes les 30 minutes ;
   - quand une nouvelle version est prête, recharge l'appli tout seul ;
   - mais pas en pleine séance ni pendant une saisie : une alerte propose alors de relancer
     (et l'appli se relance toute seule dès que la personne a fini). */
(() => {
'use strict';
if (!('serviceWorker' in navigator) || location.protocol !== 'https:') return;
const sw = navigator.serviceWorker, KEY = 'wg_upd_reload';
let pending = false, hadCtl = !!sw.controller, lastCheck = 0;

const inSession = () => /^#\/seance\//.test(location.hash || '');
const busy = () => {
  const a = document.activeElement;
  return !!(a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) || !!document.querySelector('.modal');
};

function reloadNow() {
  try {                                                     // garde-fou : jamais deux rechargements en moins de 20 s
    const t = +sessionStorage.getItem(KEY) || 0;
    if (Date.now() - t < 20000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch (e) {}
  try { if (typeof flushSession === 'function') flushSession(); } catch (e) {}   // enregistre la séance en cours
  location.reload();
}

function toast() {
  if (document.querySelector('.upd-toast')) return;
  const a = document.createElement('a');
  a.className = 'soc-toast upd-toast'; a.href = '#';
  a.textContent = 'Mise à jour de WeakGym prête. Touche ici pour relancer.';
  a.onclick = e => { e.preventDefault(); reloadNow(); };
  document.body.appendChild(a);
}

function apply() {
  if (busy() || inSession()) { pending = true; toast(); return; }
  reloadNow();
}
const retry = () => { if (pending && !busy() && !inSession()) reloadNow(); };
setInterval(retry, 10000);
addEventListener('hashchange', retry);

sw.addEventListener('controllerchange', () => {
  if (!hadCtl) { hadCtl = true; return; }                   // toute première installation : rien à recharger
  apply();
});

function check(force) {
  if (!force && Date.now() - lastCheck < 60000) return;
  lastCheck = Date.now();
  sw.getRegistration().then(reg => {
    if (!reg) return;
    if (reg.waiting) reg.waiting.postMessage({type: 'SKIP_WAITING'});   // version déjà téléchargée mais en attente
    return reg.update();
  }).catch(() => {});
}
addEventListener('load', () => setTimeout(() => check(true), 2000));
document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
addEventListener('online', () => check(true));
setInterval(() => check(true), 30 * 60000);
})();
