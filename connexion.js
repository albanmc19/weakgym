/* WeakGym — Connexion quotidienne (série de jours + badge Assidu).
   Fichier à part, chargé par index.html APRÈS boutique.js. Il s'appuie sur les variables globales du site
   (user, db, myProf, $, esc, icon…) et sur window.wcApi exposé par boutique.js.

   Principe :
   - une fois par jour (jour local), on récupère un bonus de WeakCoins ; il grandit avec la série de jours consécutifs ;
   - jour 1…6 : 5, 10, 15, 20, 25, 30 · jour 7 : le BADGE ASSIDU (une seule fois) + 40 WeakCoins ;
     si on a déjà le badge, le jour 7 donne 100 WeakCoins à la place ; puis la semaine recommence au jour 1 ;
   - un jour raté remet la série à zéro.
   Chaque récupération est une preuve wcClaims/<uid>_login_<numéro du jour> (kind « login », avec le champ « streak »).
   La série se déduit de la preuve d'hier : aucune autre donnée à stocker, rien à recalculer.
   Le badge = preuve wcClaims/<uid>_loginbadge_assidu + « badge-assidu » ajouté dans users/<uid>.items (une seule fois).
   Les règles Firestore correspondantes sont dans firestore-connexion.rules.txt. */
(() => {
'use strict';

const REW = [5, 10, 15, 20, 25, 30, 40];   // jours 1…7 (le jour 7 = 40 + badge la première fois)
const WEEK_BONUS = 100;                      // jour 7 quand on a déjà le badge
const BADGE = 'badge-assidu';                // doit rester identique aux règles Firestore

const dayNum = (d = new Date()) => Math.floor((d.getTime() - d.getTimezoneOffset() * 6e4) / 864e5);   // numéro du jour local
const cyc = s => s > 0 ? (s - 1) % 7 + 1 : 0;                       // position dans la semaine (1…7)
const hasBadge = () => !!(myProf && Array.isArray(myProf.items) && myProf.items.includes(BADGE));
const amountOf = (streak, has) => { const c = cyc(streak); return c < 7 ? REW[c - 1] : has ? WEEK_BONUS : REW[6]; };
const api = () => window.wcApi;
const cref = (n, uid) => db.collection('wcClaims').doc(`${uid || user.uid}_login_${n}`);
const msToMidnight = () => { const n = new Date(), m = new Date(n); m.setHours(24, 0, 0, 0); return m - n; };

/* ---------- état : aujourd'hui déjà récupéré ? série en cours ? ---------- */
async function status() {
  const t = dayNum();
  const [a, b] = await Promise.all([cref(t).get(), cref(t - 1).get()]);
  const today = a.exists, cur = today ? (a.data().streak || 1) : b.exists ? (b.data().streak || 1) : 0;
  const done = today ? cyc(cur) : (cur % 7 === 0 ? 0 : cyc(cur));   // jours de la semaine déjà validés
  return {t, today, cur, done, nextStreak: today ? cur + 1 : cur + 1};
}

/* ---------- récupération : preuve du jour + solde (+ badge) dans une seule transaction ---------- */
async function claimToday() {
  const uid = user.uid, t = dayNum();
  const wref = db.collection('wallet').doc(uid), uref = db.collection('users').doc(uid), bref = db.collection('wcClaims').doc(`${uid}_loginbadge_assidu`);
  let out = null;
  await db.runTransaction(async tx => {
    out = null;
    const [cur, prev, w, u, bd] = await Promise.all([tx.get(cref(t)), tx.get(cref(t - 1)), tx.get(wref), tx.get(uref), tx.get(bref)]);
    if (cur.exists) return;
    const streak = prev.exists ? (prev.data().streak || 0) + 1 : 1;
    const items = u.exists && Array.isArray(u.data().items) ? u.data().items : [];
    const has = items.includes(BADGE) || bd.exists, c = cyc(streak), amount = amountOf(streak, has), gainBadge = c === 7 && !has;
    const d = w.exists ? w.data() : null, id = `${uid}_login_${t}`, now = Date.now();
    api().setBal(d ? (d.earned || 0) + amount - (d.spent || 0) : amount);
    tx.set(cref(t), {uid, kind: 'login', ref: String(t), amount, streak, at: now, ...(gainBadge ? {badge: BADGE} : {})});
    if (gainBadge) {
      tx.set(bref, {uid, kind: 'loginbadge', ref: 'assidu', amount: 0, day: String(t), at: now});
      tx.update(uref, {items: firebase.firestore.FieldValue.arrayUnion(BADGE)});
    }
    if (d) tx.update(wref, {earned: (d.earned || 0) + amount, last: id, lastKind: 'claim'});
    else tx.set(wref, {uid, earned: amount, spent: 0, last: id, lastKind: 'claim'});
    out = {amount, streak, day: c, badge: gainBadge};
  });
  if (out && out.badge) myProf.items = [...new Set([...(myProf.items || []), BADGE])];
  return out;
}

/* ---------- styles ---------- */
if (!document.getElementById('dl-style')) {
  const st = document.createElement('style'); st.id = 'dl-style';
  st.textContent = `
.dl{padding:16px;border-color:color-mix(in srgb,var(--acc) 40%,var(--line))}
.dl-h{display:flex;justify-content:space-between;align-items:center;gap:6px 10px;flex-wrap:wrap}
.dl-t{display:flex;align-items:center;gap:8px;font:700 17px var(--hf);letter-spacing:-.01em}
.dl-t .ic{width:22px;height:22px;color:var(--acc);flex:none}
.dl-s{color:var(--mute);font-size:13.5px;font-weight:600}
.dl-d{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin:12px 0}
.dl-p{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:54px;padding:6px 0;border-radius:10px;background:var(--soft);font-size:11.5px;color:var(--mute);font-weight:600}
.dl-p b{font:800 14px var(--hf);color:var(--ink)}
.dl-p.done{background:color-mix(in srgb,var(--ok) 18%,var(--soft))}.dl-p.done b{color:var(--ok)}
.dl-p.now{outline:2px solid var(--acc);outline-offset:-2px;background:var(--card)}
.dl-p span{display:inline-flex}.dl-p span svg{width:22px;height:22px}
.dl-f{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.dl-n{flex:1 1 150px;font-size:14px;color:var(--mute)}
.dl-n b{color:var(--ink)}
.dl-b{display:inline-flex;align-items:center;gap:6px}
.dl-more{margin:8px 0 0;padding:0;font-size:13.5px}
.dl-rw{list-style:none;margin:8px 0 0;padding:0}
.dl-rw li{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--line)}
.dl-rw li:first-child{border-top:0}.dl-rw li span{flex:1}
.dl-rw em{font-style:normal;font:800 17px var(--hf);color:var(--acc);display:inline-flex;align-items:center;gap:5px}
.dl-rw li svg{width:26px;height:26px}
@media(prefers-reduced-motion:no-preference){.dl-p.now{animation:dlpulse 2s ease-in-out infinite}}
@keyframes dlpulse{0%,100%{outline-color:var(--acc)}50%{outline-color:color-mix(in srgb,var(--acc) 35%,transparent)}}`;
  document.head.appendChild(st);
}

/* ---------- carte de l'accueil ---------- */
const badgeIco = px => `<span style="color:${api().WC_BADGES[BADGE].color}" title="Badge Assidu">${api().badgeSvg(BADGE).replace('<svg ', `<svg width="${px}" height="${px}" `)}</span>`;
let midT = 0, lastDay = 0;
async function mount(el) {
  if (!el || !user || !api()) return;
  let st; try { st = await status(); } catch (e) { el.innerHTML = ''; return; }   // règles / réseau indisponibles : on n'affiche rien
  if (!document.body.contains(el)) return;
  lastDay = st.t;
  const A = api(), coin = A.coin, has = hasBadge(), amt = amountOf(st.nextStreak, has), nextIsBadge = cyc(st.nextStreak) === 7 && !has;
  const pips = REW.map((r, i) => {
    const n = i + 1, isDone = n <= st.done, isNow = !st.today && n === st.done + 1;
    const inner = isDone ? '<b>✓</b>' : n === 7 ? (has ? `<b>${WEEK_BONUS}</b>` : badgeIco(22)) : `<b>${r}</b>`;
    return `<div class="dl-p ${isDone ? 'done' : ''} ${isNow ? 'now' : ''}" ${n === 7 ? `title="${has ? WEEK_BONUS + ' WeakCoins' : 'Badge Assidu + ' + r + ' WeakCoins'}"` : ''}><small>J${n}</small>${inner}</div>`;
  }).join('');
  const tomorrow = amountOf(st.cur + 1, has), tomBadge = cyc(st.cur + 1) === 7 && !has;
  const sub = st.cur > 0 ? `${st.cur} jour${st.cur > 1 ? 's' : ''} d’affilée` : 'Commence ta série';
  const note = st.today
    ? `Bonus récupéré. Reviens demain : <b>${tomBadge ? 'le badge Assidu' : '+' + tomorrow}</b>${tomBadge ? ' + ' + REW[6] : ''}${coin(15)}`
    : nextIsBadge ? `Jour 7 : le <b>badge Assidu</b> t’attend, avec <b>+${amt}</b>${coin(15)} !`
    : st.cur > 0 ? `Jour ${cyc(st.nextStreak)} : ne casse pas ta série !` : 'Connecte-toi chaque jour pour des bonus de plus en plus gros.';
  el.innerHTML = `<div class="card dl"><div class="dl-h"><span class="dl-t">${icon('cal')}Connexion quotidienne</span><span class="dl-s">${sub}</span></div>
    <div class="dl-d" role="list" aria-label="Série de la semaine">${pips}</div>
    <div class="dl-f"><span class="dl-n">${note}</span>${st.today ? '<span class="tag">✓ Récupéré</span>' : `<button id="dlgo" class="dl-b">Récupérer +${amt}${coin(18)}</button>`}</div>
    <p style="margin:0"><button class="link dl-more" id="dlinfo" type="button">Voir les bonus et le badge</button></p></div>`;
  const go = el.querySelector('#dlgo');
  if (go) go.onclick = async () => {
    go.disabled = true;
    try {
      const r = await claimToday();
      if (r) { A.wcToast(`+${r.amount} WeakCoins · Connexion quotidienne, jour ${r.day}`); if (r.badge) celebrate(r); }
    } catch (e) { console.info('WeakCoin : connexion quotidienne non créditée', e && e.code); A.wcToast('Validation impossible, réessaie.'); go.disabled = false; return; }
    mount(el);
  };
  el.querySelector('#dlinfo').onclick = () => info(st, has);
  clearTimeout(midT); midT = setTimeout(() => { if (document.body.contains(el)) mount(el); }, msToMidnight() + 1500);   // minuit passé : nouveau jour
}
/* retour sur l'appli (onglet rouvert) après minuit : on rafraîchit la carte */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !lastDay || dayNum() === lastDay) return;
  const el = document.getElementById('wcdl'); if (el) mount(el);
});

/* ---------- fenêtre « bonus et badge » ---------- */
function info(st, has) {
  const A = api(), coin = A.coin;
  const rows = REW.map((r, i) => {
    const n = i + 1, big = n === 7;
    return `<li><span><b>Jour ${n}</b>${big ? `<br><span class="mute">${has ? 'Bonus de la semaine complète' : 'Ton premier badge Assidu'}</span>` : ''}</span>${big && !has ? badgeIco(26) : ''}<em>+${big && has ? WEEK_BONUS : r}${coin(18)}</em></li>`;
  }).join('');
  const m = A.wcSheet(`<h2 style="margin-top:0">Connexion quotidienne</h2>
    <p class="mute" style="margin:0 0 4px">Récupère ton bonus une fois par jour. Plus tu enchaînes les jours, plus il grandit. Au 7<sup>e</sup> jour d’affilée : le <b>badge Assidu</b> (une seule fois, affiché à côté de ton nom). Les semaines suivantes, le jour 7 te donne <b>${WEEK_BONUS}</b> WeakCoins à la place.</p>
    <ul class="dl-rw">${rows}</ul>
    <p class="mute" style="margin:10px 0 0;font-size:14px">Un jour raté remet la série à zéro. Le nouveau jour commence à minuit.${has ? ' <b>Tu as déjà le badge Assidu.</b>' : ''}</p>
    <p class="row" style="margin:16px 0 0"><a class="btn alt" href="#/boutique" id="dlb">Ma boutique</a><button id="dlx" type="button">Fermer</button></p>`);
  m.q('#dlx').onclick = m.close; m.q('#dlb').onclick = m.close;
}

/* ---------- écran de félicitations (badge obtenu) ---------- */
function celebrate(r) {
  const A = api(), sp = [[-62, -50], [62, -44], [-70, 18], [70, 26], [0, -72], [-30, 66], [34, 64]];
  const m = A.wcSheet(`<div class="wc-win">
    <div class="wc-big">${sp.map(([x, y]) => `<i style="--x:${x}px;--y:${y}px"></i>`).join('')}${badgeIco(100)}</div>
    <h2>Une semaine complète !</h2>
    <p style="margin:0 0 4px">Tu as obtenu le <b>badge Assidu</b> et <b>+${r.amount} WeakCoins</b>.</p>
    <p class="mute" style="margin:0">Il s’affiche désormais à côté de ton nom, sur ton profil et tes publications. Tu le gardes à vie.</p>
    <p class="row" style="margin:18px 0 0"><button class="alt" id="dlp" type="button">Voir mon profil</button><button id="dlok" type="button">Super !</button></p></div>`);
  m.q('#dlok').onclick = m.close;
  m.q('#dlp').onclick = () => { m.close(); location.hash = '#/profil/' + user.uid; };
}

window.wcLoginMount = mount;
window.__wcLogin = {dayNum, cyc, amountOf, claimToday, status};   // pour les tests
})();
