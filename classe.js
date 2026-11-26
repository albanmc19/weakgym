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
const TOP_N = 14;         // nombre d'exercices (familles) comptés pour la force

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
  ['legpress', /presse|leg press|hack/, .28],
  ['calf', /mollet|calf/, .45],
  ['dl', /souleve|deadlift|\brdl\b|roumain|romanian|good morning/, .75],
  ['hip', /hip thrust|pont fessier|glute bridge/, .6],
  ['squat', /squat/, .8],
  ['lunge', /fente|lunge|bulgare/, 1.1],
  ['machine', /leg extension|leg curl|ischio|extension (des )?(jambes|quadriceps|cuisses)|curl (jambes|ischio|allonge|assis)|adducteur|abducteur|pec deck|butterfly|pec fly|ecarte/, .55],
  ['ohp', /militaire|overhead|shoulder press|developpe (epaule|assis|nuque)|arnold|\bohp\b/, 1.7],
  ['incline', /developpe.*incline|incline.*(press|developpe)/, 1.1],
  ['bench', /developpe|bench|chest press|\bdips?\b/, 1.0],
  ['pullup', /traction|pull up|chin up/, 1.2],
  ['pulldown', /tirage (vertical|poitrine|nuque)|pulldown|lat pull/, .95],
  ['row', /rowing|tirage|\brow\b|pendlay|t bar/, 1.0],
  ['lateral', /elevation|oiseau|reverse fly|face pull|lateral raise|rear delt/, 3.0],
  ['triceps', /triceps|barre au front|skull|pushdown|kickback|french|extension/, 1.9],
  ['curl', /curl|biceps|marteau|hammer/, 2.2],
  ['shrug', /shrug|haussement/, .6],
  ['abs', /crunch|abdo|releve de jambes|releve de genoux/, .9]
];
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function famOf(name) {
  const n = norm(name), dumb = /halter|dumbbell|\bdb\b/.test(n), m = dumb ? 1.6 : 1;   // haltères : charge par main, donc plus légère
  for (const [id, re, c] of FAMS) if (re.test(n)) return {id: id + (dumb ? '-db' : ''), coef: c * m};
  return {id: 'x:' + n, coef: m};
}

/* ---------- calcul du rating ----------
   Force   = somme, sur les 14 meilleures familles d'exercices, de  coef × (meilleure charge × (1 + reps/30))
   Volume  = somme de coef × charge × reps de toutes les séries, divisée par 1000 (plafonnée à 1000 points)
   Rating  = Force + Volume */
async function computeRating(uid) {
  const [logs, ss, ps] = await Promise.all([
    logsOf(uid),
    db.collection('sessions').get().catch(() => ({docs: []})),
    db.collection('mysessions').where('uid', '==', uid).get().catch(() => ({docs: []}))
  ]);
  const byId = {}; ss.docs.forEach(d => { byId[d.id] = d.data(); }); ps.docs.forEach(d => { byId[d.id] = d.data(); });
  const fam = {}; let vol = 0, sess = 0;
  logs.forEach(l => {
    const s = byId[l.sessionId]; if (!s || !Array.isArray(s.exercises)) return;
    let had = false;
    s.exercises.forEach((e, i) => {
      if (!e || !e.name || isTime(e) || CARDIO.test(e.name)) return;
      let raw = l.sets && Array.isArray(l.sets[i]) ? l.sets[i] : [];
      if (!raw.some(x => String(x).trim())) raw = l.w && String(l.w[i] || '').trim() ? [l.w[i]] : [];
      const loads = raw.map(x => parseLoad(String(x))).filter(x => x != null && x > 0 && x <= MAXKG);
      if (!loads.length) return;
      had = true;
      const nr = String(e.reps || '').match(/\d+/g), reps = nr ? Math.min(30, Math.max(1, +nr[nr.length - 1])) : 10;
      const {id, coef} = famOf(e.name), top = Math.max(...loads), best = top * (1 + Math.min(reps, 15) / 30);
      vol += loads.reduce((a, w) => a + w * reps, 0) * coef;
      const f = fam[id] || (fam[id] = {id, coef, best: 0, name: e.name, kg: 0, reps: 0});
      if (best > f.best) { f.best = best; f.name = e.name; f.kg = top; f.reps = reps; }
    });
    if (had) sess++;
  });
  const top = Object.values(fam).map(f => ({name: f.name, kg: f.kg, reps: f.reps, coef: f.coef, pts: f.coef * f.best})).sort((a, b) => b.pts - a.pts);
  const strength = top.slice(0, TOP_N).reduce((a, f) => a + f.pts, 0), volume = Math.min(VOL_CAP, vol / 1000);
  const rating = Math.round(strength + volume);
  return {rating, strength: Math.round(strength), volume: Math.round(volume), sessions: sess, top: top.slice(0, TOP_N), tier: tierOf(rating, sess)};
}

/* ---------- cache des rangs (pour les badges partout sur le site) ---------- */
const RK = {map: {}, t: 0, p: null, mute: false};
function rkLoad(force) {
  if (!force && RK.p && Date.now() - RK.t < 60000) return RK.p;
  RK.t = Date.now();
  RK.p = RANKS().get().then(s => { const m = {}; s.docs.forEach(d => { m[d.id] = d.data(); }); RK.map = m; return m; }).catch(() => RK.map);
  return RK.p;
}
const rkBadgeHtml = u => { const r = u && RK.map[u.uid]; return !RK.mute && r && r.show === true && r.tier > 0 && r.tier < TIERS.length ? badgeHtml(r.tier) : ''; };
function rkProfileChip(uid) {
  const r = RK.map[uid]; if (!r || r.show !== true || !(r.tier > 0) || r.tier >= TIERS.length) return '';
  return `<a class="rk-chip t${r.tier}" href="#/classe">${badgeSvg(r.tier)}<b>${TIERS[r.tier].n}</b><span>${Math.round(r.rating)} pts</span></a>`;
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
  try { localStorage.setItem('wg_rk_at_' + user.uid, String(Date.now())); } catch (e) {}
}
auth.onAuthStateChanged(u => {
  if (!u) return;
  setTimeout(async () => {
    if (!user || user.uid !== u.uid) return;
    let last = 0; try { last = +localStorage.getItem('wg_rk_at_' + u.uid) || 0; } catch (e) {}
    if (Date.now() - last < 30 * 60000) { rkLoad(); return; }
    try { await syncMine(); } catch (e) {}
  }, 8000);
});

/* ---------- page Classé ---------- */
async function classePage() {
  app.innerHTML = `<div class="soc-top"><h1>${icon('trophy')}Classé</h1></div><div id="rkme"><div class="card rk-hero"><p class="mute" style="margin:0">Calcul de ton rang…</p></div></div>
    <div class="seg" id="rkt"><a href="#" data-t="all">Général</a><a href="#" data-t="abo">Abonnements</a></div><div id="rkl"><p class="mute">Chargement…</p></div>
    <details class="card rk-how"><summary>Comment fonctionne le classement ?</summary>
      <p>Ton <b>rating</b> se calcule avec les charges que tu notes dans tes séances (exercices en kg). Il se met à jour tout seul à chaque ouverture du classement.</p>
      <p><b>Force</b> : pour chacun de tes meilleurs exercices, on prend ta meilleure charge (augmentée selon le nombre de reps) multipliée par un coefficient. Un exercice où l’on charge facilement (presse, par exemple) rapporte moins de points par kilo qu’un exercice difficile (développé militaire, curl, élévations…). Les exercices aux haltères sont un peu plus valorisés, car la charge est par main.</p>
      <p><b>Volume</b> : tout ce que tu soulèves au fil des séances ajoute des points (plafonné), pour récompenser la régularité.</p>
      <p>Il faut au moins ${PLACEMENT} séances avec des charges pour être classé. Les exercices en minutes et le cardio ne comptent pas. Seules tes charges comptent, pas ton poids de corps.</p>
      <div class="rk-lad rk-lad-t">${TIERS.map((T, i) => `<div class="${i ? '' : 'none'}"><span class="rk-bg">${badgeSvg(i)}</span><b>${T.n}</b><small>${i ? T.min + ' pts' : '< ' + TIERS[1].min + ' pts'}</small></div>`).join('')}</div>
    </details>`;
  let res = null, rulesErr = false;
  try { res = await computeRating(user.uid); } catch (e) { $('#rkme').innerHTML = `<div class="card">Erreur : ${esc(e.message)}</div>`; return; }
  try { await rkLoad(true); await saveMine(res); try { localStorage.setItem('wg_rk_at_' + user.uid, String(Date.now())); } catch (e) {} }
  catch (e) { rulesErr = e && e.code === 'permission-denied'; RK.map[user.uid] = {...(RK.map[user.uid] || {}), uid: user.uid, rating: res.rating, tier: res.tier, sessions: res.sessions}; }
  const [users, fol] = await Promise.all([allUsers(true), db.collection('follows').where('from', '==', user.uid).get().catch(() => ({docs: []}))]);
  const fset = new Set(fol.docs.map(d => d.data().to)); fset.add(user.uid);
  const all = Object.values(RK.map).filter(r => r && r.tier > 0 && r.tier < TIERS.length && users[r.uid] && !users[r.uid].blocked && (r.uid === user.uid || isAdmin || users[r.uid].private !== true))
    .map(r => ({...r, u: users[r.uid]})).sort((a, b) => b.rating - a.rating || (a.at || 0) - (b.at || 0));
  let tab = 'all', shown = 50;
  const list = () => all.filter(r => tab === 'all' || fset.has(r.uid));

  const drawMe = () => {
    const t = res.tier, T = TIERS[t], nx = TIERS[t + 1], pos = all.findIndex(r => r.uid === user.uid) + 1;
    const lo = t ? T.min : 0, hi = nx ? nx.min : lo, pct = nx ? Math.max(0, Math.min(100, (res.rating - lo) / (hi - lo) * 100)) : 100;
    const need = Math.max(0, PLACEMENT - res.sessions);
    const sub = t === 0 ? (need ? `Encore <b>${need}</b> séance${need > 1 ? 's' : ''} avec des charges pour être classé.` : `Encore <b>${Math.max(0, TIERS[1].min - res.rating)}</b> pts pour atteindre ${TIERS[1].n}.`)
      : nx ? `Encore <b>${hi - res.rating}</b> pts pour atteindre <b>${nx.n}</b>.` : 'Rang maximum atteint. Respect.';
    const show = (RK.map[user.uid] || {}).show === true;
    $('#rkme').innerHTML = `${rulesErr ? '<div class="card rk-warn">Le classement n’est pas encore activé côté serveur : ajoute les règles Firestore de la collection <b>ranks</b> (voir le fichier fourni), puis rouvre cette page.</div>' : ''}
      <div class="card rk-hero ${t ? 't' + t : 'none'}"><div class="rk-big ${t === 7 ? 'rk-unreal' : ''}">${badgeSvg(t)}</div>
        <div class="rk-info"><span class="kicker">Mon rang</span><h2>${T.n}</h2>
          <p class="rk-pts"><b>${res.rating}</b> pts${t && pos ? ` · <span>#${pos} sur ${all.length}</span>` : ''}</p>
          <div class="rk-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i style="width:${pct}%"></i></div>
          <p class="mute rk-sub">${sub}</p></div>
        <label class="chk rk-show" ${t ? '' : 'style="opacity:.55"'}><input id="rksh" type="checkbox" ${show ? 'checked' : ''} ${t ? '' : 'disabled'}> ${t ? 'Afficher mon badge sur mon profil' : 'Badge disponible à partir de Bronze'}</label>
      </div>
      <div class="rk-lad">${TIERS.slice(1).map((x, i) => `<div class="${i + 1 === t ? 'cur' : i + 1 < t ? 'got' : ''}"><span class="rk-bg">${badgeSvg(i + 1)}</span><b>${x.n}</b><small>${x.min} pts</small></div>`).join('')}</div>
      <details class="card rk-det"><summary>Détail de mon score</summary>
        <div class="stats s3"><div class="stat"><b>${res.strength}</b><span>Force</span></div><div class="stat"><b>${res.volume}</b><span>Volume</span></div><div class="stat"><b>${res.sessions}</b><span>Séances avec charges</span></div></div>
        ${res.top.length ? `<div class="rk-top">${res.top.map(f => `<div><span><b>${esc(f.name)}</b><small>${fmtNum(f.kg)} kg × ${f.reps} · coef ×${fmtNum(f.coef)}</small></span><b>${Math.round(f.pts)}</b></div>`).join('')}</div>` : '<p class="mute">Note des charges dans tes séances : tes meilleurs exercices apparaîtront ici.</p>'}
      </details>`;
    const c = $('#rksh');
    if (c) c.onchange = async () => {
      c.disabled = true;
      try { await saveMine(res, {show: c.checked}); } catch (e) { c.checked = !c.checked; alert('Erreur : ' + e.message); }
      c.disabled = false;
    };
  };

  const row = (r, i) => {
    RK.mute = true; const b = window.wgBadges ? wgBadges(r.u) : ''; RK.mute = false;
    const me = r.uid === user.uid;
    return `<a class="card item rk-row ${me ? 'me' : ''}" href="#/profil${me ? '' : '/' + esc(r.uid)}"><span class="rk-n n${i + 1}">${i + 1}</span><span class="mem">${av(r.u)}<span><b>${esc(r.u.name || 'Sans nom')}${b}${me ? ' (moi)' : ''}</b><span class="mute">${TIERS[r.tier].n}</span></span></span><span class="rk-sc"><span class="rk-bg ${r.tier === 7 ? 'rk-unreal' : ''}">${badgeSvg(r.tier)}</span><b>${Math.round(r.rating)}</b></span></a>`;
  };
  const pod = (r, i) => `<a class="rk-p p${i + 1}" href="#/profil${r.uid === user.uid ? '' : '/' + esc(r.uid)}"><span class="rk-pm">${av(r.u, 'xl')}<i>${i + 1}</i></span><b>${esc((r.u.name || 'Sans nom').split(' ')[0])}</b><span class="rk-bg ${r.tier === 7 ? 'rk-unreal' : ''}">${badgeSvg(r.tier)}</span><small>${Math.round(r.rating)} pts</small></a>`;
  const drawList = () => {
    $('#rkt').querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.t === tab));
    const l = list(), box = $('#rkl');
    if (!l.length) { box.innerHTML = `<div class="card pg-e mute">${tab === 'abo' ? 'Personne parmi tes abonnements n’est encore classé.' : 'Personne n’est encore classé. Note tes charges dans tes séances pour ouvrir le bal !'}</div>`; return; }
    const top3 = l.length >= 3 ? l.slice(0, 3) : [];
    box.innerHTML = `${top3.length ? `<div class="rk-pod">${[1, 0, 2].map(i => pod(top3[i], i)).join('')}</div>` : ''}
      ${l.slice(top3.length ? 3 : 0, shown).map((r, i) => row(r, i + (top3.length ? 3 : 0))).join('')}
      ${l.length > shown ? '<p><button class="alt" id="rkmore" style="width:100%">Voir plus</button></p>' : ''}
      ${all.some(r => r.uid === user.uid) && !l.slice(0, shown).some(r => r.uid === user.uid) && l.some(r => r.uid === user.uid) ? '<p><button class="alt" id="rkme2" style="width:100%">Voir ma position</button></p>' : ''}`;
    if ($('#rkmore')) $('#rkmore').onclick = () => { shown += 50; drawList(); };
    if ($('#rkme2')) $('#rkme2').onclick = () => { shown = l.length; drawList(); const m = box.querySelector('.rk-row.me'); if (m) m.scrollIntoView({behavior: 'smooth', block: 'center'}); };
  };
  $('#rkt').querySelectorAll('a').forEach(a => a.onclick = e => { e.preventDefault(); tab = a.dataset.t; shown = 50; drawList(); });
  drawMe(); drawList();
}

window.rkLoad = rkLoad;
window.rkBadgeHtml = rkBadgeHtml;
window.rkProfileChip = rkProfileChip;
window.classePage = classePage;
window.__rk = {computeRating, famOf, tierOf, TIERS};
})();
