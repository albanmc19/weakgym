/* WeakGym — Boutique & WeakCoin.
   Fichier à part, chargé par index.html (après social.js). Il s'appuie sur les variables globales du site
   (user, db, app, $, esc, myProf, isAdmin, today…) et sur les règles Firestore « WeakCoin » :
   - wallet/<uid>            : { uid, earned, spent, last, lastKind }  (solde = earned − spent)
   - wcClaims/<uid>_<type>_<réf> : preuve d'un gain (séance terminée = 20, pesée du jour = 5)
   - wcBuys/<uid>_<article>  : preuve d'un achat (au prix exact de shop/<article>)
   - users/<uid>.items       : articles possédés (jamais retirés)
   - shop/<article>          : prix officiels, synchronisés quand l'admin ouvre la boutique.

   POUR AJOUTER UN ARTICLE : ajoute une ligne dans CATALOG (et, si c'est un badge, dans WC_BADGES). */
(() => {
'use strict';

/* ---------- catalogue ---------- */
const REWARD = {seance: 20, poids: 5};   // doit rester identique aux règles Firestore
const CATALOG = [
  {id: 'badge-boutique', type: 'badge', name: 'Badge Boutique', price: 100,
   desc: 'Un badge exclusif affiché à côté de ton nom, sur ton profil et tes publications. À toi pour toujours.'}
];

/* ---------- badges de boutique (en plus des badges admin de social.js) ---------- */
const SEAL = '<rect x="4" y="4" width="16" height="16" rx="4" fill="currentColor"/><rect x="4" y="4" width="16" height="16" rx="4" fill="currentColor" transform="rotate(45 12 12)"/>';
const WC_BADGES = {
  'badge-boutique': {
    label: 'Badge Boutique', color: '#8b5cf6',
    mark: '<circle cx="12" cy="12" r="4.6" fill="none" stroke="#fff" stroke-width="1.7"/><rect x="10.9" y="9.3" width="2.4" height="5.4" rx=".8" fill="#fff" transform="translate(12 12) skewX(-12) translate(-12 -12)"/>'
  }
};
const badgeSvg = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${SEAL}${WC_BADGES[k].mark}</svg>`;
/* appelé par wgBadges() de social.js : renvoie les badges de boutique possédés par un membre */
window.wcBadgesHtml = u => !u || !Array.isArray(u.items) ? '' : Object.keys(WC_BADGES).filter(k => u.items.includes(k)).map(k =>
  `<span class="vb" style="color:${WC_BADGES[k].color}" role="img" aria-label="${WC_BADGES[k].label}" title="${WC_BADGES[k].label} · acheté avec des WeakCoins">${badgeSvg(k)}</span>`).join('');

/* ---------- logo WeakCoin : pièce aux couleurs de l'appli, avec la barre penchée du logo WeakGym ---------- */
const coin = (px = 20) => `<svg class="wc-coin" width="${px}" height="${px}" viewBox="0 0 48 48" role="img" aria-label="WeakCoin"><circle cx="24" cy="24" r="22" style="fill:var(--acc)"/><circle cx="24" cy="24" r="17.5" fill="none" stroke="var(--acc-ink)" stroke-opacity=".45" stroke-width="1.8"/><rect x="19" y="13" width="10" height="22" rx="3.4" style="fill:var(--acc-ink)" transform="translate(24 24) skewX(-12) translate(-24 -24)"/></svg>`;
const fmtN = n => Number(n || 0).toLocaleString('fr-FR');

/* ---------- styles ---------- */
const st = document.createElement('style');
st.textContent = `
.wc-coin{flex:none;vertical-align:middle;display:inline-block}
.wc-bal{display:flex;align-items:center;gap:16px;padding:20px;border-color:color-mix(in srgb,var(--acc) 45%,var(--line));box-shadow:0 0 0 3px color-mix(in srgb,var(--acc) 10%,transparent)}
.wc-bal .wc-coin{width:64px;height:64px}
.wc-bal small{display:block;color:var(--mute);font-weight:600}
.wc-bal b{display:block;font:800 clamp(34px,9vw,48px)/1 var(--hf);letter-spacing:-.03em}
.wc-bal b span{font-size:.42em;letter-spacing:0;color:var(--mute);font-weight:700;margin-left:6px}
.wc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;margin:12px 0}
.wc-it{position:relative;display:flex;flex-direction:column;gap:10px;margin:0;overflow:hidden}
.wc-it.own{border-color:color-mix(in srgb,var(--ok) 55%,var(--line))}
.wc-ph{display:grid;place-items:center;height:110px;border-radius:12px;background:radial-gradient(circle at 50% 40%,color-mix(in srgb,var(--acc) 14%,var(--soft)),var(--soft))}
.wc-ph svg{width:72px;height:72px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.22))}
.wc-it h3{font:700 19px var(--hf);letter-spacing:-.01em;margin:0}
.wc-it p{margin:0;color:var(--mute);font-size:14px}
.wc-pr{display:inline-flex;align-items:center;gap:6px;font:800 20px var(--hf)}
.wc-ft{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:auto}
.wc-own{position:absolute;top:12px;right:-34px;transform:rotate(38deg);background:var(--ok);color:#fff;font-weight:700;font-size:12px;padding:3px 38px;letter-spacing:.02em}
.wc-how{list-style:none;padding:0;margin:0}
.wc-how li{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--line)}
.wc-how li:first-child{border-top:0}
.wc-how li span{flex:1}
.wc-how em{font-style:normal;font:800 18px var(--hf);color:var(--acc);display:inline-flex;align-items:center;gap:5px}
.wc-empty{text-align:center;color:var(--mute);padding:26px 18px}
.wc-win{text-align:center}
.wc-win .wc-big{position:relative;display:grid;place-items:center;width:120px;height:120px;margin:6px auto 10px}
.wc-win .wc-big svg{width:100px;height:100px;filter:drop-shadow(0 10px 16px rgba(0,0,0,.3));animation:wcpop .6s cubic-bezier(.2,1.4,.4,1) both}
.wc-win .wc-big i{position:absolute;width:8px;height:8px;border-radius:50%;background:var(--acc);opacity:0;animation:wcspark .9s ease-out .25s both}
.wc-win h2{margin:6px 0 4px}
@keyframes wcpop{from{transform:scale(.2) rotate(-30deg);opacity:0}to{transform:none;opacity:1}}
@keyframes wcspark{0%{opacity:1;transform:translate(0,0) scale(1)}100%{opacity:0;transform:translate(var(--x),var(--y)) scale(.3)}}
#wc-toast{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translate(-50%,30px);opacity:0;z-index:80;display:flex;align-items:center;gap:10px;background:var(--card);color:var(--ink);border:1px solid color-mix(in srgb,var(--acc) 55%,var(--line));border-radius:99px;padding:10px 18px 10px 12px;font-weight:600;box-shadow:var(--sh);transition:transform .3s cubic-bezier(.2,.8,.3,1),opacity .3s;pointer-events:none;max-width:calc(100vw - 24px)}
#wc-toast.on{transform:translate(-50%,0);opacity:1}
@media(max-width:600px){#wc-toast{bottom:calc(92px + env(safe-area-inset-bottom))}}
`;
document.head.appendChild(st);

/* ---------- petite fenêtre (même rendu que les autres feuilles de l'appli) ---------- */
function wcSheet(html) {
  const el = document.createElement('div'); el.className = 'modal';
  el.innerHTML = `<div class="sheet" role="dialog">${html}</div>`;
  document.body.appendChild(el);
  const onKey = e => { if (e.key === 'Escape') close(); };
  const close = () => { document.removeEventListener('keydown', onKey); el.remove(); };
  el.onclick = e => { if (e.target === el) close(); };
  document.addEventListener('keydown', onKey);
  return {el, q: s => el.querySelector(s), close};
}

/* ---------- message flash « +20 WeakCoins » ---------- */
let toastT = 0;
function wcToast(text) {
  let t = document.getElementById('wc-toast');
  if (!t) { t = document.createElement('div'); t.id = 'wc-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.innerHTML = coin(26) + '<span></span>'; t.lastChild.textContent = text;
  void t.offsetWidth; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3200);
}

/* ---------- portefeuille ---------- */
async function getWallet() {
  try { const d = await db.collection('wallet').doc(user.uid).get(); const w = d.exists ? d.data() : {}; return {earned: w.earned || 0, spent: w.spent || 0}; }
  catch (e) { return {earned: 0, spent: 0}; }
}
const balanceOf = w => Math.max(0, w.earned - w.spent);

/* Gain : crée la preuve (wcClaims) ET augmente le solde dans la même transaction. Une seule fois par séance / par jour. */
async function claim(kind, ref) {
  const uid = user.uid, amount = REWARD[kind], id = `${uid}_${kind}_${ref}`;
  const cref = db.collection('wcClaims').doc(id), wref = db.collection('wallet').doc(uid);
  let gained = false;
  await db.runTransaction(async tx => {
    gained = false;
    if ((await tx.get(cref)).exists) return;
    const w = await tx.get(wref), d = w.exists ? w.data() : null;
    tx.set(cref, {uid, kind, ref, amount, at: Date.now()});
    if (d) tx.update(wref, {earned: (d.earned || 0) + amount, last: id, lastKind: 'claim'});
    else tx.set(wref, {uid, earned: amount, spent: 0, last: id, lastKind: 'claim'});
    gained = true;
  });
  return gained ? amount : 0;
}
const tried = new Set();
async function tryClaim(kind, ref, label) {
  const k = kind + ':' + ref; if (!user || tried.has(k)) return;
  tried.add(k);
  try { const n = await claim(kind, ref); if (n) wcToast(`+${n} WeakCoins · ${label}`); }
  catch (e) { tried.delete(k); console.info('WeakCoin : gain non crédité', e && e.code); }
}
/* appelé par index.html quand une séance est enregistrée : récompense si tous les exercices sont cochés */
window.wcSession = (sid, total, done) => {
  const n = Object.values(done || {}).filter(v => v === true).length;
  if (total > 0 && n >= total) tryClaim('seance', sid, 'Séance terminée');
};
/* appelé par index.html quand la pesée du jour est enregistrée */
window.wcWeight = date => { if (date === today()) tryClaim('poids', date, 'Pesée du jour'); };

/* ---------- achat : preuve d'achat + débit + article ajouté, dans la même transaction ---------- */
async function buy(item, price) {
  const uid = user.uid, bid = `${uid}_${item.id}`;
  const bref = db.collection('wcBuys').doc(bid), wref = db.collection('wallet').doc(uid), uref = db.collection('users').doc(uid);
  await db.runTransaction(async tx => {
    if ((await tx.get(bref)).exists) throw new Error('Tu possèdes déjà cet article.');
    const w = await tx.get(wref), d = w.exists ? w.data() : {earned: 0, spent: 0};
    if ((d.earned || 0) - (d.spent || 0) < price) throw new Error('Solde insuffisant.');
    tx.set(bref, {uid, item: item.id, price, at: Date.now()});
    tx.update(wref, {spent: (d.spent || 0) + price, last: bid, lastKind: 'buy'});
    tx.update(uref, {items: firebase.firestore.FieldValue.arrayUnion(item.id)});
  });
  myProf.items = [...new Set([...(myProf.items || []), item.id])];
}

/* ---------- page Boutique ---------- */
async function boutiquePage() {
  app.innerHTML = '<h1>Boutique</h1><p class="mute">Chargement…</p>';
  const prices = {};
  const [w, ud] = await Promise.all([
    getWallet(),
    db.collection('users').doc(user.uid).get().catch(() => null),
    db.collection('shop').get().then(q => q.docs.forEach(d => { prices[d.id] = d.data().price; })).catch(() => {})
  ]);
  if (ud && ud.exists && Array.isArray(ud.data().items)) myProf.items = ud.data().items;
  /* l'admin publie les prix officiels du catalogue (les règles refusent tout achat à un autre prix) */
  if (isAdmin) await Promise.all(CATALOG.filter(it => prices[it.id] !== it.price).map(it =>
    db.collection('shop').doc(it.id).set({name: it.name, price: it.price}).then(() => { prices[it.id] = it.price; }).catch(e => console.warn('Boutique : prix non publié', e))));

  if (!ICO.scale) ICO.scale = '<path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>';
  const owned = new Set(myProf.items || []);
  let bal = balanceOf(w);

  const card = it => {
    const price = prices[it.id], has = owned.has(it.id), left = price - bal;
    const preview = it.type === 'badge' && WC_BADGES[it.id] ? `<span style="color:${WC_BADGES[it.id].color}">${badgeSvg(it.id)}</span>` : coin(64);
    const act = has ? '<span class="tag">✓ Possédé à vie</span>'
      : price == null ? '<span class="mute">Bientôt disponible</span>'
      : `<button data-b="${esc(it.id)}" ${left > 0 ? 'disabled' : ''}>${left > 0 ? `Il te manque ${fmtN(left)}` : 'Acheter'}</button>`;
    return `<article class="card wc-it ${has ? 'own' : ''}">${has ? '<span class="wc-own">ACHETÉ</span>' : ''}
      <div class="wc-ph">${preview}</div>
      <h3>${esc(it.name)}</h3><p>${esc(it.desc)}</p>
      <div class="wc-ft"><span class="wc-pr">${coin(22)}${price == null ? '–' : fmtN(price)}</span>${act}</div></article>`;
  };

  app.innerHTML = `<h1>Boutique</h1><p class="mute" style="margin:0 0 6px">Dépense tes WeakCoins pour débloquer des articles.</p>
    <div class="card wc-bal">${coin(64)}<div><small>Mon solde</small><b id="wcn">${fmtN(bal)}<span>WeakCoins</span></b></div></div>
    <h2>Articles</h2>
    ${CATALOG.length ? `<div class="wc-grid">${CATALOG.map(card).join('')}</div><p class="mute" style="font-size:14px">D’autres articles arrivent bientôt.</p>` : '<div class="card wc-empty">La boutique est vide pour le moment. Reviens bientôt !</div>'}
    <h2>Gagner des WeakCoins</h2>
    <div class="card"><ul class="wc-how">
      <li>${icon('dumb')}<span><b>Terminer une séance</b><br><span class="mute">Coche tous les exercices (une fois par séance)</span></span><em>+${REWARD.seance}${coin(18)}</em></li>
      <li>${icon('scale')}<span><b>Enregistrer ta pesée du jour</b><br><span class="mute">Une fois par jour</span></span><em>+${REWARD.poids}${coin(18)}</em></li>
    </ul></div>`;
  app.querySelectorAll('.wc-how .ic').forEach(i => { i.style.cssText = 'width:26px;height:26px;color:var(--acc);flex:none'; });

  app.querySelectorAll('[data-b]').forEach(b => b.onclick = () => {
    const it = CATALOG.find(x => x.id === b.dataset.b), price = prices[it.id];
    const m = wcSheet(`<h2 style="margin-top:0">Confirmer l’achat</h2>
      <p style="margin:0 0 14px"><b>${esc(it.name)}</b> pour <span class="wc-pr" style="font-size:18px">${coin(20)}${fmtN(price)}</span></p>
      <p class="mute" style="margin:0 0 4px">Solde après achat : <b>${fmtN(bal - price)}</b> WeakCoins. Un achat est définitif.</p>
      <p id="wce" class="err" hidden></p>
      <p class="row" style="margin:16px 0 0"><button id="wcy">Acheter</button><button class="alt" id="wcx" type="button">Annuler</button></p>`);
    m.q('#wcx').onclick = m.close;
    m.q('#wcy').onclick = async () => {
      const y = m.q('#wcy'); y.disabled = true;
      try { await buy(it, price); m.close(); celebrate(it); boutiquePage(); }
      catch (e) { const er = m.q('#wce'); er.textContent = e.code === 'permission-denied' ? 'Achat refusé : solde ou prix invalide. Réessaie.' : (e.message || 'Erreur'); er.hidden = false; y.disabled = false; }
    };
  });
}

/* écran de confirmation après un achat */
function celebrate(it) {
  const bd = WC_BADGES[it.id], sp = [[-62, -50], [62, -44], [-70, 18], [70, 26], [0, -72], [-30, 66], [34, 64]];
  const m = wcSheet(`<div class="wc-win">
    <div class="wc-big">${sp.map(([x, y]) => `<i style="--x:${x}px;--y:${y}px"></i>`).join('')}${bd ? `<span style="color:${bd.color}">${badgeSvg(it.id)}</span>` : coin(100)}</div>
    <h2>Achat réussi !</h2>
    <p style="margin:0 0 4px"><b>${esc(it.name)}</b> est à toi.</p>
    <p class="mute" style="margin:0">${bd ? 'Il s’affiche désormais à côté de ton nom, sur ton profil et tes publications. Tu le gardes à vie.' : 'Tu le gardes à vie.'}</p>
    <p class="row" style="margin:18px 0 0">${bd ? '<button class="alt" id="wcp">Voir mon profil</button>' : ''}<button id="wcok">Super !</button></p></div>`);
  m.q('#wcok').onclick = m.close;
  const p = m.q('#wcp'); if (p) p.onclick = () => { m.close(); location.hash = '#/profil/' + user.uid; };
}

window.boutiquePage = boutiquePage;
window.wcBalance = async () => balanceOf(await getWallet());
})();
