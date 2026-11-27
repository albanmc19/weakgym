/* WeakGym — Classé : rang, rating et classement des membres.
   Fichier à part, chargé par index.html (après social.js). Il s'appuie sur les variables globales du site
   (user, db, app, $, esc, av, icon, allUsers, logsOf, parseLoad, isTime, CARDIO, isAdmin, myProf…).

   Données : collection « ranks », un document par membre (id = uid) :
     { uid, rating, tier, sessions, show, at }
   - rating  : calculé sur l'appareil du membre à partir de ses charges (voir computeRating)
   - tier    : 0 = non classé … 7 = Unreal Power
   - show    : le membre a choisi d'afficher son badge sur son profil */
(() => {
'use strict';

const RANKS = () => db.collection('ranks');

/* ---------- rangs ---------- */
const TIERS = [
  {k: 'none',     n: 'Non classé',   min: 0},
  {k: 'bronze',   n: 'Bronze',       min: 150,  a: '#e8ad74', b: '#8a4b16', e: '#fff'},
  {k: 'argent',   n: 'Argent',       min: 400,  a: '#f0f3f8', b: '#8693a7', e: '#3a4558'},
  {k: 'or',       n: 'Or',           min: 800,  a: '#ffe985', b: '#c58a00', e: '#5a3800'},
  {k: 'platine',  n: 'Platine',      min: 1300, a: '#9ff6e8', b: '#1f9a97', e: '#05403f'},
  {k: 'diamant',  n: 'Diamant',      min: 2000, a: '#a9d6ff', b: '#2a63d6', e: '#fff'},
  {k: 'immortel', n: 'Immortel',     min: 3000, a: '#ff6f91', b: '#7d1450', e: '#fff'},
  {k: 'unreal',   n: 'Unreal Power', min: 4500, a: '#ff2d95', b: '#ffb300', c: '#25d9ff', e: '#fff'}
];
const PLACEMENT = 3;      // séances avec charges nécessaires avant d'être classé
const MAXKG = 500;        // une charge au-dessus est ignorée (faute de frappe)
const VOL_CAP = 1000;     // points maximum apportés par le volume total
const RATING_VER = 3;     // à augmenter quand le barème change : tout le monde est alors recalculé aussitôt
const TOP_N = 14;         // nombre d'exercices (familles) comptés pour la force
const WALK_PT = 1 / 3;     // marche sur tapis : 1 point toutes les 3 minutes (soit 20 pts par heure)
const WALK_CAP = 600;      // points maximum apportés par la marche sur tapis
const WALK_MAXMIN = 180;   // minutes maximum comptées par séance et par exercice (faute de frappe)

const tierOf = (rating, sessions) => {
  if (sessions < PLACEMENT) return 0;
  let t = 0; TIERS.forEach((T, i) => { if (rating >= T.min) t = i; });
  return t;
};

/* ---------- badges (SVG natifs) ---------- */
const SHIELD = 'M12 1.8l8.2 3v6.6c0 5-3.4 8.6-8.2 10.8-4.8-2.2-8.2-5.8-8.2-10.8V4.8z';
const SHINE = 'M12 1.8l8.2 3v6.6c0 .7 0 1.2-.1 1.8-4.1-1.7-12-1.7-16.2 0-.1-.6-.1-1.1-.1-1.8V4.8z';
const EMB = [
  '',
  '<path d="M8 13.8l4-3.2 4 3.2" fill="none" stroke-width="2"/>',
  '<path d="M8 11.8l4-3 4 3M8 15.8l4-3 4 3" fill="none" stroke-width="2"/>',
  '<path d="M8.2 10l3.8-2.8 3.8 2.8M8.2 13.5l3.8-2.8 3.8 2.8M8.2 17l3.8-2.8 3.8 2.8" fill="none" stroke-width="1.8"/>',
  '<path d="M12 6.6l1.7 3.5 3.8.5-2.8 2.7.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.7 3.8-.5z" stroke="none"/>',
  '<path d="M8.2 10.2L10 7.8h4l1.8 2.4L12 16.4z" stroke="none"/>',
  '<path d="M7.6 16.2V9.6l2.9 2.6 1.5-3.6 1.5 3.6 2.9-2.6v6.6z" stroke="none"/>',
  '<path d="M13 5.6L8.4 12.6h3.1L10.6 18.4l5-7.2h-3.2z" stroke="none"/>'
];
let gid = 0;
function badgeSvg(t, cls = '') {
  const T = TIERS[t]; if (!T) return '';
  if (t === 0) return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${SHIELD}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.6 2.6" opacity=".5"/></svg>`;
  const id = 'rkg' + (++gid);
  const stops = T.c ? `<stop offset="0" stop-color="${T.a}"/><stop offset=".55" stop-color="${T.b}"/><stop offset="1" stop-color="${T.c}"/>` : `<stop offset="0" stop-color="${T.a}"/><stop offset="1" stop-color="${T.b}"/>`;
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient></defs>
    <path d="${SHIELD}" fill="url(#${id})"/><path d="${SHINE}" fill="#fff" opacity=".22"/><path d="${SHIELD}" fill="none" stroke="rgba(0,0,0,.3)" stroke-width=".9"/>
    <g fill="${T.e}" stroke="${T.e}" stroke-linecap="round" stroke-linejoin="round">${EMB[t]}</g></svg>`;
}
const badgeHtml = (t, extra = '') => t > 0 ? `<span class="vb rkb ${t === 7 ? 'rk-unreal' : ''} ${extra}" role="img" aria-label="Rang ${TIERS[t].n}" title="Rang ${TIERS[t].n}">${badgeSvg(t)}</span>` : '';

/* ---------- coefficients par exercice ----------
   Plus un exercice permet de charger lourd facilement (presse…), moins chaque kilo rapporte.
   Plus il est « dur » (développé militaire, élévations…), plus chaque kilo est valorisé.
   Un exercice est compté une seule fois par famille (on garde le meilleur), pour éviter de gonfler son score avec des variantes. */
const FAMS = [
  /* — machines guidées « poussée » (avant les développés génériques) — */
  ['chestmach', /chest press|presse (a )?(pec|pectoraux|poitrine)|developpe (machine|convergent)|machine (a )?(pec|pectoraux|developpe)/, .85],
  ['shouldmach', /presse (a )?epaules?|machine (a )?(epaules?|shoulder)|shoulder press machine/, 1.2],
  /* — haltérophilie / explosif — */
  ['olympic', /arrache|snatch|epaule jete|clean|jerk|power clean|hang clean/, 1.0],
  ['thruster', /thruster/, 1.2],
  ['swing', /swing/, 1.4],
  ['sled', /traineau|sled|prowler/, .5],
  ['farmer', /farmer|marche du fermier|marche fermier/, .7],
  /* — jambes — */
  ['calfseat', /mollets? assis|calf raise assis|seated calf|soleaire/, .5],
  ['calf', /mollet|calf|donkey/, .45],
  ['hack', /hack|pendulum|belt squat/, .35],
  ['legpress', /presse|leg press/, .28],
  ['tibial', /tibial/, 1.5],
  ['rackpull', /rack pull|trap bar|hex bar|souleve.*(jambes tendues|sumo)|stiff leg/, .75],
  ['dl', /souleve|deadlift|\brdl\b|roumain|romanian/, .75],
  ['gm', /good morning/, 1.0],
  ['back', /hyperextension|extension lombaire|lombaires?|banc lombaire|back extension|reverse hyper/, 1.2],
  ['hip', /hip thrust|poussee de hanches|pont fessier|pont de hanches|glute bridge|pont\b/, .6],
  ['glutemach', /kickback (fessier|poulie|machine)|glute (kickback|drive|machine)|fessier|extension de hanche|hip extension/, .6],
  ['abductor', /abducteur|hip abduction|abduction/, .5],
  ['adductor', /adducteur|hip adduction|adduction/, .5],
  ['legcurl', /leg curl|curl (jambes?|ischio|allonge|assis|couche)|ischio|nordic/, .55],
  ['legext', /leg extension|extension (de |des )?(genoux?|jambes?|quadriceps|cuisses)|quadriceps/, .55],
  ['lunge', /fente|lunge|bulgare|split squat|step up|montees? sur banc/, 1.1],
  ['goblet', /gobelet|goblet/, 1.5],
  ['sumo', /sumo/, .8],
  ['fsquat', /front squat|squat avant|zercher/, .85],
  ['squat', /squat|smith|pistol/, .8],
  /* — épaules — */
  ['ohp', /militaire|overhead press|shoulder press|developpe (epaules?|assis|nuque|debout)|\bohp\b|push press/, 1.7],
  ['arnold', /arnold/, 2.6],
  ['landmine', /landmine/, 1.3],
  ['facepull', /face pull|tirage (au )?visage/, 2.0],
  ['reardelt', /oiseau|reverse fly|reverse pec|rear delt|deltoides? posterieur|elevations? (posterieures?|arriere)/, 3.0],
  ['upright', /tirage menton|upright row/, 1.6],
  ['front', /elevations? frontales?|front raise|frontale/, 2.4],
  /* — pectoraux — */
  ['incline', /^(?!.*curl)(developpe.*incline|incline.*(press|developpe|bench|halter|dumbbell)|\bincline\b)/, 1.1],
  ['decline', /decline/, 1.0],
  ['cgbp', /developpe couche (prise )?serre|close grip bench|prise serree.*developpe/, 1.0],
  ['pecfly', /pec fly|pec deck|butterfly|papillon|ecarte|crossover|cable fly|vis a vis|fly\b/, .55],
  ['dips', /\bdips?\b(?! banc)/, 1.0],
  ['benchdips', /dips? (sur )?banc|bench dips?/, .8],
  ['pushup', /pompe|push up/, 1.0],
  ['pullover', /pull ?over/, 1.1],
  ['bench', /developpe|bench|floor press/, 1.0],
  /* — dos — */
  ['assist', /assist/, .25],
  ['pullup', /traction|pull up|chin up|muscle up/, 1.2],
  ['straight', /bras tendus|straight arm/, 1.5],
  ['pulldown', /tirage (vertical|poitrine|nuque|poulie haute)|pulldown|lat pull|tirage .*prise (large|serree|neutre|supination)/, .95],
  ['tbar', /t bar|barre en t/, .9],
  ['row', /rowing|tirage|\brow\b|pendlay|seal row|meadows|yates/, 1.0],
  ['shrug', /shrug|haussement/, .6],
  /* — bras — */
  ['wristext', /extension (de )?poignets?|reverse wrist|poignets? (en )?(pronation|inverse)/, 1.6],
  ['wrist', /poignet|wrist|avant bras|forearm/, 1.6],
  ['hammer', /marteau|hammer/, 3.0],
  ['concentration', /concentre|concentration|zottman/, 3.2],
  ['inclcurl', /curl.*incline|incline.*curl/, 3.0],
  ['preacher', /pupitre|larry scott|preacher|spider/, 2.4],
  ['revcurl', /curl inverse|reverse curl/, 2.6],
  ['cablecurl', /curl (a la )?poulie|cable curl|curl (poulie|basse)/, 2.0],
  ['curl', /curl|biceps/, 2.2],
  ['kickback', /kickback/, 3.5],
  ['tricmach', /(triceps|dips?) machine|machine (a )?(triceps|dips?)/, 1.3],
  ['tricover', /extension (au dessus|overhead|derriere)|triceps overhead|overhead triceps|nuque.*triceps|triceps.*nuque/, 2.2],
  ['skull', /barre au front|skull|french|extension (couchee|allongee)|jm press/, 1.7],
  ['triceps', /triceps|pushdown|extension|barre en v/, 1.9],
  /* — tronc — */
  ['legraise', /releves? de (jambes|genoux)|leg raise|knee raise|elevations? (de )?(jambes|genoux)|toes to bar|\bt2b\b/, 1.2],
  ['wheel', /roue abdominale|ab wheel|roulette/, 1.2],
  ['cablecrunch', /crunch (a la )?(poulie|cable|machine)|cable crunch|abdo(minaux)? (machine|poulie)/, 1.2],
  ['crunch', /crunch|abdo|sit up|releve de buste/, .9],
  ['twist', /russian|twist|rotation|oblique|woodchop|bucheron|pallof|inclinaison laterale|side bend|flexion laterale/, 1.3],
  ['plank', /gainage|planche|plank|hollow|dead bug/, 1.5],
  /* — élévations latérales (après tout ce qui commence par « élévation ») — */
  ['lateral', /elevation|lateral|side raise/, 3.0],
  ['neck', /\bcou\b|neck/, 2.5]
];
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/* Exercice absent de la liste : on regarde s'il se fait à la machine / à la poulie (charge facile → coef réduit), sinon coef neutre. */
const MACH = /machine|poulie|cable|guidee|convergent|selectorise/;
/* marche sur tapis : nom contenant « tapis » ou « marche » (mot entier). « Marche du fermier », « marche en fente »… restent de la force */
const WALK = /\b(tapis|marche|walking|treadmill)\b/;
const NOTWALK = /fermier|farmer|fente|lunge|traineau|sled/;
const isWalk = name => { const n = norm(name); return WALK.test(n) && !NOTWALK.test(n); };
const minOf = x => {   // « 30 », « 30 min », « 45 mn », « 1h15 », « 90 s » → minutes ; une saisie en kg est ignorée
  const s = String(x == null ? '' : x).toLowerCase().replace(',', '.');
  if (/kg/.test(s)) return 0;
  let m = /(\d+(?:\.\d+)?)\s*h(?:eures?)?\s*(\d+)?/.exec(s); if (m) return +m[1] * 60 + (+m[2] || 0);
  m = /(\d+(?:\.\d+)?)\s*(?:sec|secondes?|s)\b/.exec(s); if (m) return +m[1] / 60;
  m = /\d+(?:\.\d+)?/.exec(s); return m ? +m[0] : 0;
};
function famOf(name) {
  const n = norm(name), dumb = /halter|dumbbell|\bdb\b|un bras|1 bras|unilateral|alterne|kettlebell|\bkb\b/.test(n), m = dumb ? 1.6 : 1;   // haltères / un bras : charge par main, donc plus légère
  for (const [id, re, c] of FAMS) if (re.test(n)) return {id: id + (dumb ? '-db' : ''), coef: c * m};
  return {id: 'x:' + n, coef: (MACH.test(n) ? .7 : 1) * m};
}

/* ---------- calcul du rating ----------
   Force   = somme, sur les 14 meilleures familles d'exercices, de  coef × (meilleure charge × (1 + reps/30))
   Volume  = somme de coef × charge × reps de toutes les séries, divisée par 1000 (plafonnée à 1000 points)
   Marche  = temps passé sur tapis (séances de base ET séances perso) : 1 point toutes les 3 minutes (plafonné à 600 points)
   Rating  = Force + Volume + Marche */
async function computeRating(uid) {
  const [logs, ss, ps] = await Promise.all([
    logsOf(uid),
    db.collection('sessions').get().catch(() => ({docs: []})),
    db.collection('mysessions').where('uid', '==', uid).get().catch(() => ({docs: []}))
  ]);
  const byId = {}; ss.docs.forEach(d => { byId[d.id] = d.data(); }); ps.docs.forEach(d => { byId[d.id] = d.data(); });
  return rate(logs, byId);
}
function rate(logs, byId) {
  const fam = {}; let vol = 0, sess = 0, since = '', walk = 0;
  logs.forEach(l => {
    const s = byId[l.sessionId]; if (!s || !Array.isArray(s.exercises)) return;
    let had = false;
    s.exercises.forEach((e, i) => {
      if (!e || !e.name) return;
      const walking = isWalk(e.name);
      if (!walking && (isTime(e) || CARDIO.test(e.name))) return;
      let raw = l.sets && Array.isArray(l.sets[i]) ? l.sets[i] : [];
      if (!raw.some(x => String(x).trim())) raw = l.w && String(l.w[i] || '').trim() ? [l.w[i]] : [];
      if (walking) {   // marche sur tapis : on additionne les minutes saisies (séries), plafonnées par séance
        const m = Math.min(WALK_MAXMIN, raw.reduce((a, x) => a + minOf(x), 0));
        if (m > 0) { had = true; walk += m; }
        return;
      }
      const loads = raw.map(x => parseLoad(String(x))).filter(x => x != null && x > 0 && x <= MAXKG);
      if (!loads.length) return;
      had = true;
      const nr = String(e.reps || '').match(/\d+/g), reps = nr ? Math.min(30, Math.max(1, +nr[nr.length - 1])) : 10;
      const {id, coef} = famOf(e.name), top = Math.max(...loads), best = top * (1 + Math.min(reps, 15) / 30);
      vol += loads.reduce((a, w) => a + w * reps, 0) * coef;
      const f = fam[id] || (fam[id] = {id, coef, best: 0, name: e.name, kg: 0, reps: 0});
      if (best > f.best) { f.best = best; f.name = e.name; f.kg = top; f.reps = reps; }
    });
    if (had) { sess++; if (s.date && (!since || s.date < since)) since = s.date; }
  });
  const top = Object.values(fam).map(f => ({name: f.name, kg: f.kg, reps: f.reps, coef: f.coef, pts: f.coef * f.best})).sort((a, b) => b.pts - a.pts);
  const strength = top.slice(0, TOP_N).reduce((a, f) => a + f.pts, 0), volume = Math.min(VOL_CAP, vol / 1000);
  const walkPts = Math.min(WALK_CAP, walk * WALK_PT);
  const rating = Math.round(strength + volume + walkPts);
  return {since, rating, strength: Math.round(strength), volume: Math.round(volume), walk: Math.round(walkPts), walkMin: Math.round(walk), sessions: sess, top: top.slice(0, TOP_N), tier: tierOf(rating, sess)};
}

/* ---------- recalcul pour TOUS les membres (administrateur) ----------
   Seul l'admin peut lire les séances de tout le monde (règles Firestore). Quand il ouvre l'appli (au plus toutes les 6 h)
   ou clique sur « Recalculer », les rangs des membres absents sont remis à jour à partir de TOUTES leurs séances. */
async function recomputeAll() {
  if (!isAdmin) return 0;
  let step = 'lecture des séances (collections logs, sessions, mysessions)';
  try {
  const [ls, ss, ps, users, old] = await Promise.all([db.collection('logs').get(), db.collection('sessions').get(), db.collection('mysessions').get(), allUsers(true), RANKS().get()]);
  const byId = {}; ss.docs.forEach(d => { byId[d.id] = d.data(); }); ps.docs.forEach(d => { byId[d.id] = d.data(); });
  const by = {}; ls.docs.forEach(d => { const l = d.data(); if (l && l.uid) (by[l.uid] || (by[l.uid] = [])).push(l); });
  const prev = {}; old.docs.forEach(d => { prev[d.id] = d.data(); });
  let n = 0, bt = db.batch(), k = 0; step = 'écriture des rangs (collection ranks)';
  for (const uid of Object.keys(users)) {
    if (users[uid].blocked) continue;
    const r = rate(by[uid] || [], byId), p = prev[uid];
    if (!p && r.rating === 0) continue;
    if (p && Math.round(p.rating) === r.rating && p.tier === r.tier && p.sessions === r.sessions) continue;
    bt.set(RANKS().doc(uid), {uid, rating: r.rating, tier: r.tier, sessions: r.sessions, at: Date.now()}, {merge: true}); n++;
    if (++k >= 400) { await bt.commit(); bt = db.batch(); k = 0; }
  }
  if (k) await bt.commit();
  try { localStorage.setItem('wg_rk_all', String(Date.now())); localStorage.setItem('wg_rk_allver', String(RATING_VER)); } catch (e) {}
  return n;
  } catch (e) { e.step = step; throw e; }
}

/* ---------- cache des rangs (pour les badges partout sur le site) ----------
   Écoute PERMANENTE de la collection « ranks » tant que l'utilisateur est connecté : chaque changement de rang
   (de n'importe quel membre) arrive en direct, sans délai ni relecture. Les pages s'abonnent via RKB. */
const RK = {map: {}, t: 0, p: null, mute: false};
const RKB = {subs: new Set(), on(f) { this.subs.add(f); return () => this.subs.delete(f); }, emit(t, d) { this.subs.forEach(f => { try { f(t, d); } catch (e) {} }); }};
let rkOff = null, rkRetry = null;
function rkStart() {
  if (rkOff) return;
  rkOff = RANKS().onSnapshot(sn => {
    const m = {}; sn.docs.forEach(d => { m[d.id] = d.data(); });
    RK.map = m; RK.t = Date.now(); RK.p = Promise.resolve(m);
    RKB.emit('map', m);
    try { window.dispatchEvent(new CustomEvent('rk:update')); } catch (e) {}
  }, () => { rkOff = null; clearTimeout(rkRetry); rkRetry = setTimeout(() => { if (user) rkStart(); }, 3000); });   // écoute coupée : on la relance tout de suite
}
function rkHalt() { if (rkOff) { try { rkOff(); } catch (e) {} rkOff = null; } clearTimeout(rkRetry); RK.map = {}; RK.p = null; }
function rkLoad(force) {
  if (rkOff && RK.p && !force) return RK.p;   // écoute en direct déjà active : la carte est à jour
  if (!force && RK.p && Date.now() - RK.t < 60000) return RK.p;
  RK.t = Date.now();
  RK.p = RANKS().get().then(s => { const m = {}; s.docs.forEach(d => { m[d.id] = d.data(); }); RK.map = m; return m; }).catch(() => RK.map);
  return RK.p;
}
const rkBadgeHtml = u => { const r = u && RK.map[u.uid]; return !RK.mute && r && r.show === true && r.tier > 0 && r.tier < TIERS.length ? badgeHtml(r.tier) : ''; };
const worldList = () => Object.values(RK.map).filter(r => r && r.tier > 0 && r.tier < TIERS.length).sort((a, b) => b.rating - a.rating || (a.at || 0) - (b.at || 0));
function rkProfileChip(uid) {
  const r = RK.map[uid], self = user && uid === user.uid;
  if (!r || !(r.tier > 0) || r.tier >= TIERS.length || (r.show !== true && !self)) return '';
  const T = TIERS[r.tier], nx = TIERS[r.tier + 1], wl = worldList(), pos = wl.findIndex(x => x.uid === uid) + 1;
  const pct = nx ? Math.max(0, Math.min(100, (r.rating - T.min) / (nx.min - T.min) * 100)) : 100;
  return `<a class="rk-pc t${r.tier}" href="#/classe" aria-label="Rang ${T.n}, voir le classement">
    <span class="rk-pcb ${r.tier === 7 ? 'rk-unreal' : ''}">${badgeSvg(r.tier)}</span>
    <span class="rk-pci"><small>Rang</small><b>${T.n}</b>
      <span class="rk-pcs"><b>${Math.round(r.rating)}</b> pts${pos ? ` · <b>#${pos}</b> mondial` : ''}</span>
      <span class="rk-bar"><i style="width:${pct}%"></i></span>
      <small class="rk-pcn">${nx ? `${nx.min - Math.round(r.rating)} pts avant ${nx.n}` : 'Rang maximum'}</small></span>
    <span class="rk-pcg" aria-hidden="true">›</span>
    ${self && r.show !== true ? '<em>Masqué pour les autres</em>' : ''}</a>`;
}

/* enregistre mon rating (jamais plus d'une fois toutes les 30 min en tâche de fond) */
async function saveMine(res, extra) {
  const cur = RK.map[user.uid] || {};
  const doc = {uid: user.uid, rating: res.rating, tier: res.tier, sessions: res.sessions, show: cur.show === true, at: Date.now(), ...(extra || {})};
  await RANKS().doc(user.uid).set(doc, {merge: true});
  RK.map[user.uid] = {...cur, ...doc};
  return doc;
}
async function syncMine() {
  if (!user) return;
  const res = await computeRating(user.uid);
  await saveMine(res);
  try { localStorage.setItem('wg_rk_at_' + user.uid, String(Date.now())); localStorage.setItem('wg_rk_ver_' + user.uid, String(RATING_VER)); } catch (e) {}
  RKB.emit('mine', res);
  return res;
}
let stopLogs = null, stopSess = null, syncT = null;
const stopMine = () => { if (stopLogs) { stopLogs(); stopLogs = null; } if (stopSess) { stopSess(); stopSess = null; } clearTimeout(syncT); };
auth.onAuthStateChanged(u => {
  stopMine(); rkHalt();
  if (!u) return;
  rkStart();   // classement en direct dès la connexion
  // dès que je modifie mes charges ou mes séances : recalcul presque immédiat (0,4 s, juste pour regrouper les modifications simultanées).
  // La première lecture de chaque écoute est ignorée (c'est l'état déjà enregistré).
  const watch = () => { let first = true; return () => {
    if (first) { first = false; return; }
    clearTimeout(syncT); syncT = setTimeout(() => { if (user && user.uid === u.uid) syncMine().catch(() => {}); }, 400);
  }; };
  stopLogs = db.collection('logs').where('uid', '==', u.uid).onSnapshot(watch(), () => {});
  stopSess = db.collection('mysessions').where('uid', '==', u.uid).onSnapshot(watch(), () => {});
  setTimeout(async () => {
    if (!user || user.uid !== u.uid) return;
    // 1. mon rang : au démarrage (au plus toutes les 10 min) …
    let last = 0, ver = 0; try { last = +localStorage.getItem('wg_rk_at_' + u.uid) || 0; ver = +localStorage.getItem('wg_rk_ver_' + u.uid) || 0; } catch (e) {}
    if (ver === RATING_VER && Date.now() - last < 10 * 60000) rkLoad(); else { try { await syncMine(); } catch (e) {} }
    // 2. administrateur : remet à jour les rangs de tous les membres (au plus toutes les 6 h)
    if (isAdmin) {
      let all = 0, av2 = 0; try { all = +localStorage.getItem('wg_rk_all') || 0; av2 = +localStorage.getItem('wg_rk_allver') || 0; } catch (e) {}
      if (Date.now() - all > 6 * 3600000 || av2 !== RATING_VER) { try { await recomputeAll(); } catch (e) { console.warn('Recalcul des rangs', e); } }
    }
  }, 8000);
});

/* ---------- page Classé ---------- */
let rkStopFn = null;
function rkStop() { if (rkStopFn) { try { rkStopFn(); } catch (e) {} rkStopFn = null; } }

async function classePage() {
  rkStop();
  app.innerHTML = `<div class="soc-top"><h1>${icon('trophy')}Classé</h1></div><div id="rkme"><div class="card rk-hero"><p class="mute" style="margin:0">Calcul de ton rang…</p></div></div>
    <div class="seg" id="rkt"><a href="#" data-t="all">Mondial</a><a href="#" data-t="abo">Amis</a></div><input id="rkq" type="search" placeholder="Rechercher un membre…" aria-label="Rechercher un membre" autocomplete="off"><div id="rkl"><p class="mute">Chargement…</p></div>
    ${isAdmin ? '<div class="card rk-adm"><b>Administration</b><p class="mute" style="margin:4px 0 10px">Remet à jour le rang de tous les membres à partir de toutes leurs séances, même ceux qui ne sont pas connectés.</p><button id="rkall" class="alt" style="width:100%">Recalculer tous les membres</button><p id="rkallr" class="mute" style="margin:8px 0 0" hidden></p></div>' : ''}
    <details class="card rk-how"><summary>Comment fonctionne le classement ?</summary>
      <p>Ton <b>rating</b> se calcule avec <b>toutes</b> les charges que tu as notées dans tes séances, anciennes comprises (exercices en kg) et le temps passé à marcher sur tapis. Il se met à jour tout seul à chaque ouverture du classement.</p>
      <p><b>Force</b> : pour chacun de tes meilleurs exercices, on prend ta meilleure charge (augmentée selon le nombre de reps) multipliée par un coefficient. Un exercice où l’on charge facilement (presse, par exemple) rapporte moins de points par kilo qu’un exercice difficile (développé militaire, curl, élévations…). Les exercices aux haltères sont un peu plus valorisés, car la charge est par main.</p>
      <p><b>Volume</b> : tout ce que tu soulèves au fil des séances ajoute des points (plafonné), pour récompenser la régularité.</p>
      <p><b>Marche sur tapis</b> : les minutes notées sur un exercice « tapis » ou « marche » rapportent <b>1 point toutes les 3 minutes</b> (séances de base comme séances perso, plafonné à ${WALK_CAP} points).</p>
      <p>Il faut au moins ${PLACEMENT} séances avec des charges ou de la marche sur tapis pour être classé. Les autres exercices en minutes et le cardio ne comptent pas. Seules tes charges comptent, pas ton poids de corps.</p>
      <div class="rk-lad rk-lad-t">${TIERS.map((T, i) => `<div class="${i ? '' : 'none'}"><span class="rk-bg">${badgeSvg(i)}</span><b>${T.n}</b><small>${i ? T.min + ' pts' : '< ' + TIERS[1].min + ' pts'}</small></div>`).join('')}</div>
    </details>`;
  let res = null, rulesErr = false;
  try { res = await computeRating(user.uid); } catch (e) { $('#rkme').innerHTML = `<div class="card">Erreur : ${esc(e.message)}</div>`; return; }
  try { await rkLoad(true); await saveMine(res); try { localStorage.setItem('wg_rk_at_' + user.uid, String(Date.now())); } catch (e) {} }
  catch (e) { rulesErr = e && e.code === 'permission-denied'; RK.map[user.uid] = {...(RK.map[user.uid] || {}), uid: user.uid, rating: res.rating, tier: res.tier, sessions: res.sessions}; }
  let [users, fol] = await Promise.all([allUsers(true), db.collection('follows').where('from', '==', user.uid).get().catch(() => ({docs: []}))]);
  const fset = new Set(fol.docs.map(d => d.data().to)); fset.add(user.uid);
  const build = () => Object.values(RK.map).filter(r => r && r.tier > 0 && r.tier < TIERS.length && users[r.uid] && !users[r.uid].blocked)
    .map(r => ({...r, u: users[r.uid]})).sort((a, b) => b.rating - a.rating || (a.at || 0) - (b.at || 0));
  let all = build();
  let tab = 'all', shown = 50;
  const list = () => all.filter(r => tab === 'all' || fset.has(r.uid));

  const drawMe = () => {
    const t = res.tier, T = TIERS[t], nx = TIERS[t + 1], pos = all.findIndex(r => r.uid === user.uid) + 1;
    const lo = t ? T.min : 0, hi = nx ? nx.min : lo, pct = nx ? Math.max(0, Math.min(100, (res.rating - lo) / (hi - lo) * 100)) : 100;
    const need = Math.max(0, PLACEMENT - res.sessions);
    const sub = t === 0 ? (need ? `Encore <b>${need}</b> séance${need > 1 ? 's' : ''} avec des charges ou de la marche sur tapis pour être classé.` : `Encore <b>${Math.max(0, TIERS[1].min - res.rating)}</b> pts pour atteindre ${TIERS[1].n}.`)
      : nx ? `Encore <b>${hi - res.rating}</b> pts pour atteindre <b>${nx.n}</b>.` : 'Rang maximum atteint. Respect.';
    const show = (RK.map[user.uid] || {}).show === true;
    $('#rkme').innerHTML = `${rulesErr ? '<div class="card rk-warn">Le classement n’est pas encore activé côté serveur : ajoute les règles Firestore de la collection <b>ranks</b> (voir le fichier fourni), puis rouvre cette page.</div>' : ''}
      <div class="card rk-hero ${t ? 't' + t : 'none'}"><div class="rk-big ${t === 7 ? 'rk-unreal' : ''}">${badgeSvg(t)}</div>
        <div class="rk-info"><span class="kicker">Mon rang</span><h2>${T.n}</h2>
          <p class="rk-pts"><b>${res.rating}</b> pts${t && pos ? ` · <span>#${pos} sur ${all.length}</span>` : ''}</p>
          <div class="rk-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i style="width:${pct}%"></i></div>
          <p class="mute rk-sub">${sub}</p>${res.since ? `<p class="mute rk-sub" style="margin-top:4px">Calculé sur ${res.sessions} séance${res.sessions > 1 ? 's' : ''} depuis le ${esc(new Date(res.since + 'T12:00').toLocaleDateString(WG.loc, {day: 'numeric', month: 'long', year: 'numeric'}))}.</p>` : ''}</div>
        <label class="chk rk-show" ${t ? '' : 'style="opacity:.55"'}><input id="rksh" type="checkbox" ${show ? 'checked' : ''} ${t ? '' : 'disabled'}> ${t ? 'Afficher mon badge sur mon profil' : 'Badge disponible à partir de Bronze'}</label>
      </div>
      <div class="rk-lad">${TIERS.slice(1).map((x, i) => `<div class="${i + 1 === t ? 'cur' : i + 1 < t ? 'got' : ''}"><span class="rk-bg">${badgeSvg(i + 1)}</span><b>${x.n}</b><small>${x.min} pts</small></div>`).join('')}</div>
      <details class="card rk-det"><summary>Détail de mon score</summary>
        <div class="stats s3"><div class="stat"><b>${res.strength}</b><span>Force</span></div><div class="stat"><b>${res.volume}</b><span>Volume</span></div><div class="stat"><b>${res.sessions}</b><span>Séances avec charges</span></div></div>
        ${res.top.length || res.walk ? `<div class="rk-top">${res.walk ? `<div><span><b>Marche sur tapis</b><small>${res.walkMin} min · 1 pt toutes les 3 min (max ${WALK_CAP})</small></span><b>${res.walk}</b></div>` : ''}${res.top.map(f => `<div><span><b>${esc(f.name)}</b><small>${fmtNum(f.kg)} kg × ${f.reps} · coef ×${fmtNum(f.coef)}</small></span><b>${Math.round(f.pts)}</b></div>`).join('')}</div>` : '<p class="mute">Note des charges dans tes séances : tes meilleurs exercices apparaîtront ici.</p>'}
      </details>`;
    const c = $('#rksh');
    if (c) c.onchange = async () => {
      c.disabled = true;
      try { await saveMine(res, {show: c.checked}); } catch (e) { c.checked = !c.checked; alert('Erreur : ' + e.message); }
      c.disabled = false;
    };
  };

  const link = r => '#/profil' + (r.uid === user.uid ? '' : '/' + esc(r.uid));
  const row = (r, i) => {
    RK.mute = true; const b = window.wgBadges ? wgBadges(r.u) : ''; RK.mute = false;
    const me = r.uid === user.uid;
    return `<a class="card item rk-row t${r.tier} ${me ? 'me' : ''}" href="${link(r)}"><span class="rk-n">${i + 1}</span><span class="mem"><span class="rk-ring">${av(r.u)}</span><span><b>${esc(r.u.name || 'Sans nom')}${b}${me ? ' (moi)' : ''}</b><span class="rk-tn">${TIERS[r.tier].n}</span></span></span><span class="rk-sc"><span class="rk-bg ${r.tier === 7 ? 'rk-unreal' : ''}">${badgeSvg(r.tier)}</span><b>${Math.round(r.rating)}<small>pts</small></b></span></a>`;
  };
  const pod = (r, i) => `<a class="rk-p p${i + 1} t${r.tier}" href="${link(r)}">
    ${i === 0 ? '<svg class="rk-crown" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 18l-1.2-9.5 4.7 4L12 6l4 6.5 4.7-4L19.5 18z" fill="#f5c518" stroke="#b8860b" stroke-width="1" stroke-linejoin="round"/></svg>' : ''}
    <span class="rk-pm"><span class="rk-ring">${av(r.u, 'xl')}</span><i>${i + 1}</i></span><b>${esc((r.u.name || 'Sans nom').split(' ')[0])}</b>
    <span class="rk-bg ${r.tier === 7 ? 'rk-unreal' : ''}">${badgeSvg(r.tier)}</span><span class="rk-pp">${Math.round(r.rating)}<small>pts</small></span><span class="rk-col"></span></a>`;
  let q = '';
  const drawList = () => {
    $('#rkt').querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.t === tab));
    const l = list(), box = $('#rkl'), world = tab === 'all';
    if (!l.length) { box.innerHTML = `<div class="card pg-e mute">${world ? 'Personne n’est encore classé. Note tes charges dans tes séances pour ouvrir le bal !' : 'Aucun de tes amis n’est encore classé. Abonne-toi à des membres avec la loupe de l’onglet Social.'}</div>`; return; }
    const head = `<p class="rk-cnt mute"><span class="rk-live" title="Mis à jour en temps réel">En direct</span> ${world ? `${l.length} classé${l.length > 1 ? 's' : ''} dans le monde` : `${l.length} classé${l.length > 1 ? 's' : ''} parmi tes amis`}</p>`;
    if (q) {
      const f = l.map((r, i) => ({r, i})).filter(x => (x.r.u.name || '').toLowerCase().includes(q));
      box.innerHTML = f.length ? f.map(x => row(x.r, x.i)).join('') : '<p class="mute">Aucun membre classé avec ce nom.</p>'; return;
    }
    const top3 = l.length >= 3 ? l.slice(0, 3) : [], from = top3.length ? 3 : 0;
    box.innerHTML = `${head}${top3.length ? `<div class="rk-pod">${[1, 0, 2].map(i => pod(top3[i], i)).join('')}</div>` : ''}
      ${l.slice(from, shown).map((r, i) => row(r, i + from)).join('')}
      ${l.length > shown ? '<p><button class="alt" id="rkmore" style="width:100%">Voir plus</button></p>' : ''}
      ${l.some(r => r.uid === user.uid) && !l.slice(0, shown).some(r => r.uid === user.uid) ? '<p><button class="alt" id="rkme2" style="width:100%">Voir ma position</button></p>' : ''}`;
    if ($('#rkmore')) $('#rkmore').onclick = () => { shown += 50; drawList(); };
    if ($('#rkme2')) $('#rkme2').onclick = () => { shown = l.length; drawList(); const m = box.querySelector('.rk-row.me'); if (m) m.scrollIntoView({behavior: 'smooth', block: 'center'}); };
  };
  $('#rkt').querySelectorAll('a').forEach(a => a.onclick = e => { e.preventDefault(); tab = a.dataset.t; shown = 50; drawList(); });
  $('#rkq').oninput = e => { q = e.target.value.trim().toLowerCase(); drawList(); };
  drawMe(); drawList();
  if (!$('#rkl')) return;
  /* temps réel : la page s'abonne au flux permanent (rkStart) — aucun délai, aucune relecture.
     - un membre change de rang → la liste se redessine aussitôt ;
     - je modifie mes charges / séances → mon score est recalculé (voir syncMine) et la page suit. */
  let tr = null;
  const live = () => { const c = document.querySelector('.rk-cnt'); if (c && !c.querySelector('.rk-live')) c.insertAdjacentHTML('afterbegin', '<span class="rk-live" title="Mis à jour en temps réel">En direct</span> '); };
  const redraw = () => { clearTimeout(tr); tr = setTimeout(() => { if (!$('#rkl')) return; all = build(); drawMe(); drawList(); live(); }, 60); };
  const offB = RKB.on(async (t, d) => {
    if (!$('#rkl')) return;
    if (t === 'mine') res = d;
    else {
      if (Object.keys(RK.map).some(id => !users[id])) { try { users = await allUsers(true); } catch (e) {} }
      const mine = RK.map[user.uid];
      if (mine && Math.round(mine.rating) !== res.rating) { try { res = await computeRating(user.uid); } catch (e) {} }
    }
    redraw();
  });
  live();
  rkStopFn = () => { offB(); clearTimeout(tr); };
  try { pageUnsub = rkStopFn; } catch (e) {}
  if ($('#rkall')) $('#rkall').onclick = async () => {
    const b = $('#rkall'), r = $('#rkallr'); b.disabled = true; b.textContent = 'Calcul en cours…';
    try { const n = await recomputeAll(); r.textContent = n + ' membre' + (n > 1 ? 's' : '') + ' mis à jour.'; r.hidden = false; await rkLoad(true); setTimeout(classePage, 1200); }
    catch (e) { r.textContent = 'Erreur pendant la ' + (e.step || 'opération') + ' : ' + e.message + (e.code === 'permission-denied' ? ' — publie la dernière version de firestore.rules.' : ''); r.hidden = false; b.disabled = false; b.textContent = 'Recalculer tous les membres'; }
  };
}

window.rkLoad = rkLoad;
window.rkBadgeHtml = rkBadgeHtml;
window.rkProfileChip = rkProfileChip;
window.classePage = classePage;
window.__rk = {computeRating, rate, famOf, tierOf, minOf, isWalk, TIERS};
})();
