/* WeakGym — Temps réel : séances et historique mis à jour sans relancer l'appli.
   Fichier à part, chargé par index.html (après classe.js). Il s'appuie sur les variables globales du site
   (auth, user, db, isAdmin, myProf, route, histCache…).
   - écoute les séances de base (sessions), mes séances perso (mysessions) et mes fiches de suivi (logs) ;
   - à chaque modification venue d'ailleurs (coach, autre appareil), vide le cache de l'historique et
     rafraîchit la page en cours, SAUF si la personne est en train d'écrire ou qu'une fenêtre est ouverte ;
   - pendant une séance (#/seance/…), la page n'est pas rechargée de force : une alerte propose d'actualiser. */
(() => {
'use strict';

let stops = [], tm = null, tries = 0, lastKind = '';
const stopAll = () => { stops.forEach(f => { try { f(); } catch (e) {} }); stops = []; clearTimeout(tm); };

/* pages qu'on peut rafraîchir sans rien perdre : accueil, calendrier, liste des séances, historique, progrès, liste admin */
const SAFE = /^#\/(calendrier|seances|historique|progres|admin)?$/;
const IN_SESSION = /^#\/seance\//;

const busy = () => {
  const a = document.activeElement;
  return !!(a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) || !!document.querySelector('.modal');
};

function toast() {
  if (document.querySelector('.live-toast')) return;
  const a = document.createElement('a');
  a.className = 'soc-toast live-toast'; a.href = '#';
  a.textContent = 'Cette séance vient d’être modifiée. Touche ici pour actualiser.';
  a.onclick = e => { e.preventDefault(); a.remove(); if (typeof route === 'function') route(); };
  document.body.appendChild(a);
  setTimeout(() => a.remove(), 15000);
}

function refresh() {
  const h = location.hash || '#/';
  if (SAFE.test(h)) {
    if (busy() && tries < 6) { tries++; clearTimeout(tm); tm = setTimeout(refresh, 4000); return; }
    tries = 0;
    if (busy() || typeof route !== 'function') return;
    const y = window.scrollY;
    Promise.resolve(route()).finally(() => window.scrollTo(0, y));
  } else if (IN_SESSION.test(h) && lastKind === 'sessions') toast();
}

function changed(kind) {
  try { histCache = {}; } catch (e) {}      // l'historique et les stats seront recalculés
  lastKind = kind; tries = 0;
  clearTimeout(tm); tm = setTimeout(refresh, 800);
}

function listen(q, kind) {
  let first = true;
  stops.push(q.onSnapshot(sn => {
    if (first) { first = false; return; }                 // 1re lecture = état actuel, rien à rafraîchir
    if (sn.metadata.hasPendingWrites) return;             // mes propres écritures en cours : déjà à l'écran
    if (!sn.docChanges().length) return;
    changed(kind);
  }, () => {}));
}

auth.onAuthStateChanged(u => {
  stopAll();
  if (!u) return;
  setTimeout(() => {
    if (!user || user.uid !== u.uid) return;
    if (isAdmin || !(myProf && myProf.mode === 'perso')) listen(db.collection('sessions'), 'sessions');
    listen(db.collection('mysessions').where('uid', '==', u.uid), 'sessions');
    listen(db.collection('logs').where('uid', '==', u.uid), 'logs');
  }, 3000);
});
})();
