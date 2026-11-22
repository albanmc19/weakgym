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
const REWARD = {seance: 20, poids: 5, quete: 25};   // doit rester identique aux règles Firestore
const CATALOG = [
  {id: 'badge-boutique', type: 'badge', name: 'Badge Boutique', price: 250,
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
.wc-net{display:inline-grid;place-items:center;border-radius:28%;flex:none;box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)}
.wc-nets{display:flex;flex-wrap:wrap;gap:12px}.wc-nets a{display:inline-block;transition:transform .15s}.wc-nets a:hover{transform:translateY(-2px)}.wc-nets .off{opacity:.35;filter:grayscale(1)}
.wc-q{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:10px 0}
.wc-q .wc-qt{flex:1 1 170px;min-width:0}.wc-q .wc-qt b{font-weight:600}
.wc-q em{font-style:normal;font:800 18px var(--hf);color:var(--acc);display:inline-flex;align-items:center;gap:5px}
.wc-q.dn{opacity:.75}
.wc-net .ic{width:56%;height:56%}
.wc-gh{font:700 16px var(--hf);color:var(--mute);margin:20px 0 4px;letter-spacing:-.01em}
.wc-dh{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:20px}
.wc-dh .wc-gh{margin:0 0 4px}
.wc-cd{font-weight:600;font-size:14px;color:var(--mute)}.wc-cd b{font:800 16px var(--hf);color:var(--acc);font-variant-numeric:tabular-nums;margin-left:4px}
.wc-cam{position:relative;margin:10px auto;border-radius:14px;overflow:hidden;background:#000;aspect-ratio:3/4;max-height:58vh;width:auto}
.wc-cam video,.wc-cam canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.wc-cam.mir video,.wc-cam.mir canvas{transform:scaleX(-1)}
.wc-cnt{position:absolute;left:10px;top:10px;display:flex;align-items:baseline;gap:6px;background:rgba(0,0,0,.55);color:#fff;border-radius:12px;padding:4px 12px}
.wc-cnt b{font:800 38px/1 var(--hf)}.wc-cnt span{font-weight:600;opacity:.8}
.wc-cs{min-height:3em;margin:6px 0 0;text-align:center;font-weight:600}
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
async function claim(kind, ref, amount = REWARD[kind], extra = {}) {
  const uid = user.uid, id = `${uid}_${kind}_${ref}`;
  const cref = db.collection('wcClaims').doc(id), wref = db.collection('wallet').doc(uid);
  let gained = false;
  await db.runTransaction(async tx => {
    gained = false;
    if ((await tx.get(cref)).exists) return;
    const w = await tx.get(wref), d = w.exists ? w.data() : null;
    tx.set(cref, {uid, kind, ref, amount, at: Date.now(), ...extra});
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


/* ---------- réseaux de WeakGym (liens saisis par l'admin dans shop : collection socials/<réseau>) ---------- */
/* tracés officiels des logos (jeu Simple Icons, domaine public CC0) ; Facebook = pastille bleue complète, les autres = glyphe blanc sur la couleur de la marque */
const NETS = [
  {id: 'instagram', name: 'Instagram', bg: 'linear-gradient(45deg,#f9ce34,#ee2a7b 55%,#6228d7)', ph: 'https://www.instagram.com/…', d: 'M7.03.084c-1.277.06-2.149.264-2.91.563a5.9 5.9 0 0 0-2.124 1.388 5.9 5.9 0 0 0-1.38 2.127C.321 4.926.12 5.8.064 7.076s-.069 1.688-.063 4.947.021 3.667.083 4.947c.061 1.277.264 2.149.563 2.911.308.789.72 1.457 1.388 2.123a5.9 5.9 0 0 0 2.129 1.38c.763.295 1.636.496 2.913.552 1.278.056 1.689.069 4.947.063s3.668-.021 4.947-.082c1.28-.06 2.147-.265 2.91-.563a5.9 5.9 0 0 0 2.123-1.388 5.9 5.9 0 0 0 1.38-2.129c.295-.763.496-1.636.551-2.912.056-1.28.07-1.69.063-4.948-.006-3.258-.02-3.667-.081-4.947-.06-1.28-.264-2.148-.564-2.911a5.9 5.9 0 0 0-1.387-2.123 5.86 5.86 0 0 0-2.128-1.38C19.074.322 18.202.12 16.924.066 15.647.009 15.236-.006 11.977 0S8.31.021 7.03.084m.14 21.693c-1.17-.05-1.805-.245-2.228-.408a3.7 3.7 0 0 1-1.382-.895 3.7 3.7 0 0 1-.9-1.378c-.165-.423-.363-1.058-.417-2.228-.06-1.264-.072-1.644-.08-4.848-.006-3.204.006-3.583.061-4.848.05-1.169.246-1.805.408-2.228.216-.561.477-.96.895-1.382a3.7 3.7 0 0 1 1.379-.9c.423-.165 1.057-.361 2.227-.417 1.265-.06 1.644-.072 4.848-.08 3.203-.006 3.583.006 4.85.062 1.168.05 1.804.244 2.227.408.56.216.96.475 1.382.895s.681.817.9 1.378c.165.422.362 1.056.417 2.227.06 1.265.074 1.645.08 4.848.005 3.203-.006 3.583-.061 4.848-.051 1.17-.245 1.805-.408 2.23-.216.56-.477.96-.896 1.38a3.7 3.7 0 0 1-1.378.9c-.422.165-1.058.362-2.226.418-1.266.06-1.645.072-4.85.079s-3.582-.006-4.848-.06m9.783-16.192a1.44 1.44 0 1 0 1.437-1.442 1.44 1.44 0 0 0-1.437 1.442M5.839 12.012a6.161 6.161 0 1 0 12.323-.024 6.162 6.162 0 0 0-12.323.024M8 12.008A4 4 0 1 1 12.008 16 4 4 0 0 1 8 12.008'},
  {id: 'tiktok', name: 'TikTok', bg: '#000', ph: 'https://www.tiktok.com/@…', d: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07'},
  {id: 'youtube', name: 'YouTube', bg: '#f00', ph: 'https://www.youtube.com/@…', d: 'M23.498 6.186a3.02 3.02 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.02 3.02 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.02 3.02 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.02 3.02 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814M9.545 15.568V8.432L15.818 12z'},
  {id: 'snapchat', name: 'Snapchat', bg: '#fffc00', ph: 'https://www.snapchat.com/add/…', stroke: '#111', d: 'M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301a1 1 0 0 1 .464-.104c.182 0 .359.029.509.09.45.149.734.479.734.838q.022.674-1.213 1.168c-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509a.6.6 0 0 1-.045.225c-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03a3 3 0 0 1-.538-.074 6 6 0 0 0-1.273-.135c-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884a7 7 0 0 0-.928-.074c-.54 0-.958.089-1.272.149a3 3 0 0 1-.54.074c-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226a.6.6 0 0 1-.055-.225.496.496 0 0 1 .42-.509c3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809a2 2 0 0 1-.346-.119c-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z'},
  {id: 'facebook', name: 'Facebook', bg: '#1877f2', ph: 'https://www.facebook.com/…', full: true, d: 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a9 9 0 0 1 1.141.195v3.325a9 9 0 0 0-.653-.036 27 27 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.7 1.7 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647'},
  {id: 'x', name: 'X', bg: '#000', ph: 'https://x.com/…', d: 'M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z'},
  {id: 'discord', name: 'Discord', bg: '#5865f2', ph: 'https://discord.gg/…', d: 'M20.317 4.37a19.8 19.8 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.3 18.3 0 0 0-5.487 0 13 13 0 0 0-.617-1.25.08.08 0 0 0-.079-.037A19.7 19.7 0 0 0 3.677 4.37a.1.1 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.08.08 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.08.08 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13 13 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10 10 0 0 0 .372-.292.07.07 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.07.07 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.08.08 0 0 0 .084.028 19.8 19.8 0 0 0 6.002-3.03.08.08 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03M8.02 15.33c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418m7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418'}
];
const netLogo = (n, px = 40) => n.full
  ? `<span class="wc-net" style="width:${px}px;height:${px}px;background:#fff;border-radius:50%"><svg viewBox="0 0 24 24" width="${px}" height="${px}" aria-hidden="true"><path fill="${n.bg}" d="${n.d}"/></svg></span>`
  : `<span class="wc-net" style="width:${px}px;height:${px}px;background:${n.bg}"><svg viewBox="0 0 24 24" width="${Math.round(px * .6)}" height="${Math.round(px * .6)}" aria-hidden="true"><path fill="#fff" ${n.stroke ? `stroke="${n.stroke}" stroke-width=".7" stroke-linejoin="round"` : ''} d="${n.d}"/></svg></span>`;
const okLink = u => { try { const x = new URL(u); return x.protocol === 'https:' && !x.username && !x.password; } catch (e) { return false; } };
async function loadSocials() {
  const out = {};
  try { (await db.collection('socials').get()).docs.forEach(d => { const u = d.data().url; if (NETS.some(n => n.id === d.id) && okLink(u)) out[d.id] = u; }); } catch (e) {}
  return out;
}
/* modale admin : saisir / modifier / effacer les liens */
function editSocials(links, done) {
  const m = wcSheet(`<h2 style="margin-top:0">Liens des réseaux WeakGym</h2>
    <p class="mute" style="margin:0 0 6px">Laisse vide pour retirer un réseau. Chaque réseau renseigné devient une quête (+${REWARD.quete} WeakCoins) dans la boutique.</p>
    ${NETS.map(n => `<label for="wcl-${n.id}" style="display:flex;align-items:center;gap:10px">${netLogo(n, 28)}${n.name}</label><input id="wcl-${n.id}" type="url" inputmode="url" placeholder="${esc(n.ph)}" value="${esc(links[n.id] || '')}">`).join('')}
    <p id="wcle" class="err" hidden></p>
    <p class="row" style="margin:16px 0 0"><button id="wcls">Enregistrer</button><button class="alt" id="wclx" type="button">Annuler</button></p>`);
  m.q('#wclx').onclick = m.close;
  m.q('#wcls').onclick = async () => {
    const er = m.q('#wcle'); er.hidden = true;
    const bt = db.batch(); let bad = '';
    NETS.forEach(n => {
      const v = m.q('#wcl-' + n.id).value.trim(), ref = db.collection('socials').doc(n.id);
      if (!v) { if (links[n.id]) bt.delete(ref); }
      else if (!okLink(v) || v.length > 300) bad = bad || n.name;
      else bt.set(ref, {url: v});
    });
    if (bad) { er.textContent = bad + ' : le lien doit commencer par https://'; er.hidden = false; return; }
    const b = m.q('#wcls'); b.disabled = true;
    try { await bt.commit(); m.close(); done && done(); }
    catch (e) { er.textContent = 'Erreur : ' + e.message; er.hidden = false; b.disabled = false; }
  };
}
/* bas de la page « Plus » : logos cliquables des réseaux (l'admin voit tous les réseaux et peut modifier les liens) */
async function socialsMount(el) {
  if (!el) return;
  const links = await loadSocials(), list = isAdmin ? NETS : NETS.filter(n => links[n.id]);
  if (!list.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<h2>Suis WeakGym</h2><div class="card"><div class="wc-nets">${list.map(n => links[n.id]
    ? `<a href="${esc(links[n.id])}" target="_blank" rel="noopener noreferrer" aria-label="${n.name}" title="${n.name}">${netLogo(n, 52)}</a>`
    : `<span class="off" title="${n.name} : lien non défini">${netLogo(n, 52)}</span>`).join('')}</div>
    ${isAdmin ? '<p style="margin:14px 0 0"><button class="alt" id="wcsed">Modifier les liens</button></p>' : ''}</div>`;
  if (isAdmin) el.querySelector('#wcsed').onclick = () => editSocials(links, () => socialsMount(el));
}
window.wcSocialsMount = socialsMount;


/* ---------- quêtes : suivre WeakGym sur un réseau ---------- */
const VISIT = n => `wg_q_${user.uid}_${n}`, WAIT = 8;   // le bouton « Valider » se débloque 8 s après le clic sur « Y aller »
const visitedAt = n => { try { return +localStorage.getItem(VISIT(n)) || 0; } catch (e) { return 0; } };
/* défis : montants et conditions identiques aux règles Firestore (fonction defiOk) */
ICO.bell = '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>';
ICO.flame = '<path d="M12 22a7 7 0 0 0 7-7c0-4-3-6-4-10-2 1-3 3-3 5-1-1-2-2-2-4-3 2-5 5-5 9a7 7 0 0 0 7 7z"/>';
ICO.bag = ICO.shop;
const cnt = (c, k) => (k === 'seance' ? c.seance : c.poids).length;
const DEFIS = [
  /* profil */
  {g: 'Mon profil', id: 'photo', title: 'Ajoute ta photo de profil', sub: 'Montre-toi à la communauté', amount: 15, ic: 'user', href: '#/profil', cur: c => +(typeof c.prof.photo === 'string' && c.prof.photo.length > 0), goal: 1},
  {g: 'Mon profil', id: 'bio', title: 'Écris ta bio', sub: 'Objectif, salle, programme…', amount: 10, ic: 'pen', href: '#/profil', cur: c => +(typeof c.prof.bio === 'string' && c.prof.bio.trim().length > 0), goal: 1},
  {g: 'Mon profil', id: 'notif', title: 'Active les rappels de séance', sub: 'Un rappel pour ne pas rater ta séance', amount: 10, ic: 'bell', href: '#/plus', cur: c => +(c.prof.notif === true), goal: 1},
  {g: 'Mon profil', id: 'wtarget', title: 'Fixe ton objectif de poids', sub: 'Dans « Mon poids »', amount: 10, ic: 'scale', href: '#/poids', cur: c => +(c.prof.wtarget != null), goal: 1},
  {g: 'Mon profil', id: 'wgoal', title: 'Choisis ton objectif de séances', sub: 'Combien de séances par semaine ?', amount: 10, ic: 'cal', href: '#/progres', cur: c => +(c.prof.wgoal != null), goal: 1},
  /* séances terminées (preuves = tes récompenses de séance) */
  {g: 'Séances', id: 'seance1', title: 'Termine ta première séance', sub: 'Coche tous les exercices', amount: 15, ic: 'dumb', href: '#/calendrier', pk: 'seance', cur: c => cnt(c, 'seance'), goal: 1},
  {g: 'Séances', id: 'seance5', title: 'Termine 5 séances', sub: 'Séances WeakGym terminées', amount: 30, ic: 'dumb', href: '#/calendrier', pk: 'seance', cur: c => cnt(c, 'seance'), goal: 5},
  {g: 'Séances', id: 'seance10', title: 'Termine 10 séances', sub: 'Séances WeakGym terminées', amount: 60, ic: 'dumb', href: '#/calendrier', pk: 'seance', cur: c => cnt(c, 'seance'), goal: 10},
  /* pesées (une par jour) */
  {g: 'Pesées', id: 'poids1', title: 'Fais ta première pesée', sub: 'Enregistre ton poids du jour', amount: 10, ic: 'scale', href: '#/poids', pk: 'poids', cur: c => cnt(c, 'poids'), goal: 1},
  {g: 'Pesées', id: 'poids5', title: 'Enregistre 5 pesées', sub: 'Un jour différent à chaque fois', amount: 20, ic: 'scale', href: '#/poids', pk: 'poids', cur: c => cnt(c, 'poids'), goal: 5},
  {g: 'Pesées', id: 'poids10', title: 'Enregistre 10 pesées', sub: 'Un jour différent à chaque fois', amount: 40, ic: 'scale', href: '#/poids', pk: 'poids', cur: c => cnt(c, 'poids'), goal: 10},
  /* fidélité : ancienneté du compte */
  {g: 'Fidélité', id: 'age7', title: 'Une semaine avec WeakGym', sub: 'jours', amount: 10, ic: 'flame', unit: 'jours', cur: c => c.days, goal: 7},
  {g: 'Fidélité', id: 'age30', title: 'Un mois avec WeakGym', sub: 'jours', amount: 25, ic: 'flame', unit: 'jours', cur: c => c.days, goal: 30},
  {g: 'Fidélité', id: 'age90', title: 'Trois mois avec WeakGym', sub: 'jours', amount: 50, ic: 'flame', unit: 'jours', cur: c => c.days, goal: 90},
  /* boutique */
  {g: 'Boutique', id: 'achat1', title: 'Fais ton premier achat', sub: 'Dépense des WeakCoins dans la boutique', amount: 10, ic: 'bag', scroll: true, cur: c => +(c.w.spent > 0), goal: 1},
  {g: 'Boutique', id: 'cumul500', title: 'Cumule 500 WeakCoins', sub: 'WeakCoins gagnés au total', amount: 25, ic: 'bag', href: '#/calendrier', cur: c => c.w.earned, goal: 500},
  {g: 'Boutique', id: 'cumul1000', title: 'Cumule 1 000 WeakCoins', sub: 'WeakCoins gagnés au total', amount: 50, ic: 'bag', href: '#/calendrier', cur: c => c.w.earned, goal: 1000}
];
const wcCtx = (prof, cl, w) => ({prof: prof || {}, w, seance: cl.seance, poids: cl.poids, days: prof && prof.joined ? Math.floor((Date.now() - prof.joined) / 864e5) : 0});
function questsHtml(socials, cl, prof, w) {
  if (!ICO.scale) ICO.scale = '<path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>';
  const c = wcCtx(prof, cl, w);
  const row = (tile, title, sub, amount, act, done) => `<div class="card wc-q ${done ? 'dn' : ''}">${tile}<span class="wc-qt"><b>${esc(title)}</b><br><span class="mute">${esc(sub)}</span></span><em>+${amount}${coin(18)}</em>${act}</div>`;
  const dfs = DEFIS.map(d => {
    const done = cl.ids.has(`${user.uid}_defi_${d.id}`), cur = d.cur(c), ready = !done && cur >= d.goal;
    const sub = done ? 'Quête accomplie' : d.goal > 1 ? `${fmtN(Math.min(cur, d.goal))} / ${fmtN(d.goal)}${d.unit ? ' ' + d.unit : ''}${d.unit ? '' : ' · ' + d.sub}` : d.sub;
    const act = done ? '<span class="tag">✓ Terminée</span>' : ready ? `<button data-df="${d.id}">Récupérer</button>`
      : d.href ? `<a class="btn" href="${d.href}">Y aller</a>` : d.scroll ? '<button class="alt" data-scroll="1">Voir les articles</button>'
      : `<span class="mute" style="font-weight:600">Dans ${fmtN(d.goal - cur)} j</span>`;
    return {g: d.g, done, html: row(`<span class="wc-net" style="width:44px;height:44px;background:var(--acc);color:var(--acc-ink)">${icon(d.ic)}</span>`, d.title, sub, d.amount, act, done)};
  });
  const nets = NETS.filter(n => socials[n.id]).map(n => {
    const done = cl.ids.has(`${user.uid}_quete_${n.id}`), v = visitedAt(n.id);
    const act = done ? '<span class="tag">✓ Terminée</span>'
      : v ? `<button data-ok="${n.id}" disabled>Valider</button>`
      : `<a class="btn" data-go="${n.id}" href="${esc(socials[n.id])}" target="_blank" rel="noopener noreferrer">Y aller</a>`;
    return {g: 'Réseaux WeakGym', done, html: row(netLogo(n, 44), `Suis WeakGym sur ${n.name}`, done ? 'Quête accomplie' : 'Abonne-toi, puis reviens valider', REWARD.quete, act, done)};
  });
  const all = [...dfs, ...nets], nb = all.filter(x => x.done).length;
  const groups = ['Mon profil', 'Séances', 'Pesées', 'Fidélité', 'Boutique', 'Réseaux WeakGym'];
  return dailyHtml(cl) + `<h3 class="wc-gh" style="margin-top:26px">Quêtes uniques</h3><p class="mute" style="margin:0">${nb} / ${all.length} quêtes terminées</p>` + groups.map(g => {
    const l = all.filter(x => x.g === g);
    return l.length ? `<h3 class="wc-gh">${g}</h3>${l.map(x => x.html).join('')}`
      : g === 'Réseaux WeakGym' ? `<h3 class="wc-gh">${g}</h3><div class="card wc-empty">Aucune quête réseau pour le moment.${isAdmin ? '<br>Ajoute les liens : Plus › Suis WeakGym › Modifier les liens.' : ''}</div>` : '';
  }).join('');
}
let qTimer = 0;
function wireQuests(cl) {
  clearInterval(qTimer);
  app.querySelectorAll('[data-scroll]').forEach(b => b.onclick = () => { const g = app.querySelector('.wc-grid'); if (g) g.scrollIntoView({behavior: 'smooth', block: 'center'}); });
  app.querySelectorAll('[data-df]').forEach(b => b.onclick = async () => {
    const d = DEFIS.find(x => x.id === b.dataset.df); b.disabled = true;
    try {
      const extra = d.pk ? {proofs: (d.pk === 'seance' ? cl.seance : cl.poids).slice(0, d.goal)} : {};
      const g = await claim('defi', d.id, d.amount, extra); if (g) wcToast(`+${g} WeakCoins · ${d.title}`); boutiquePage();
    } catch (e) { console.info('WeakCoin : défi non validé', e && e.code); wcToast('Validation impossible, réessaie.'); b.disabled = false; }
  });
  const tick = () => {
    const bs = app.querySelectorAll('[data-ok]');
    if (!bs.length) { clearInterval(qTimer); return; }
    bs.forEach(b => { const left = WAIT - Math.floor((Date.now() - visitedAt(b.dataset.ok)) / 1000); b.disabled = left > 0; b.textContent = left > 0 ? `Valider (${left})` : 'Valider'; });
  };
  const arm = b => { b.onclick = async () => {
    const n = b.dataset.ok, net = NETS.find(x => x.id === n); b.disabled = true;
    try { const g = await claim('quete', n); if (g) wcToast(`+${g} WeakCoins · Quête ${net.name}`); boutiquePage(); }
    catch (e) { console.info('WeakCoin : quête non validée', e && e.code); wcToast('Validation impossible, réessaie.'); b.disabled = false; }
  }; };
  app.querySelectorAll('[data-ok]').forEach(arm);
  app.querySelectorAll('[data-go]').forEach(a => a.addEventListener('click', () => {
    const n = a.dataset.go; try { localStorage.setItem(VISIT(n), String(Date.now())); } catch (e) {}
    const b = document.createElement('button'); b.dataset.ok = n; b.disabled = true; b.textContent = `Valider (${WAIT})`;
    setTimeout(() => { a.replaceWith(b); arm(b); tick(); clearInterval(qTimer); qTimer = setInterval(tick, 1000); }, 400);
  }));
  if (app.querySelector('[data-ok]')) { tick(); qTimer = setInterval(tick, 1000); }
}

/* ---------- quêtes du jour : se réinitialisent à minuit (heure locale du téléphone) ---------- */
const dayKey = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const msToMidnight = () => { const n = new Date(), m = new Date(n); m.setHours(24, 0, 0, 0); return m - n; };
const fmtLeft = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map(v => String(v).padStart(2, '0')).join(':'); };
/* POUR AJOUTER UNE QUÊTE DU JOUR : une ligne ici (le « type » choisit le détecteur caméra) */
const DAILY = [
  {id: 'pompes', type: 'pushup', title: 'Fais 10 pompes', sub: 'Validées par la caméra de ton téléphone', amount: 15, goal: 10, ic: 'dumb'}
];
function dailyHtml(cl) {
  const day = dayKey();
  const rows = DAILY.map(d => {
    const done = cl.ids.has(`${user.uid}_daily_${day}_${d.id}`);
    const act = done ? '<span class="tag">✓ Terminée</span>' : `<button data-daily="${d.id}">Commencer</button>`;
    return `<div class="card wc-q ${done ? 'dn' : ''}"><span class="wc-net" style="width:44px;height:44px;background:var(--acc);color:var(--acc-ink)">${icon(d.ic)}</span><span class="wc-qt"><b>${esc(d.title)}</b><br><span class="mute">${esc(done ? 'Quête accomplie · reviens demain' : d.sub)}</span></span><em>+${d.amount}${coin(18)}</em>${act}</div>`;
  }).join('');
  return `<div class="wc-dh"><h3 class="wc-gh">Quêtes du jour</h3><span class="wc-cd">Nouvelles quêtes dans <b id="wcdq">${fmtLeft(msToMidnight())}</b></span></div>${rows}`;
}
let dTimer = 0;
function wireDaily() {
  clearInterval(dTimer);
  if (!app.querySelector('#wcdq')) return;
  const day = dayKey();
  dTimer = setInterval(() => {
    const e = document.getElementById('wcdq');
    if (!e) { clearInterval(dTimer); return; }
    if (dayKey() !== day) { clearInterval(dTimer); boutiquePage(); return; }   // minuit passé : nouvelles quêtes
    e.textContent = fmtLeft(msToMidnight());
  }, 1000);
  app.querySelectorAll('[data-daily]').forEach(b => b.onclick = () => openCounter(DAILY.find(x => x.id === b.dataset.daily)));
}

/* ---------- détecteur de pompes (MediaPipe Pose, tourne 100 % sur le téléphone : aucune image n'est envoyée) ---------- */
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MP_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
let poseP = null;
function loadPose() {
  if (poseP) return poseP;
  poseP = (async () => {
    const {FilesetResolver, PoseLandmarker} = await import(MP + '/vision_bundle.mjs');
    const fs = await FilesetResolver.forVisionTasks(MP + '/wasm');
    const mk = delegate => PoseLandmarker.createFromOptions(fs, {baseOptions: {modelAssetPath: MP_MODEL, delegate}, runningMode: 'VIDEO', numPoses: 1});
    try { return await mk('GPU'); } catch (e) { return await mk('CPU'); }
  })().catch(e => { poseP = null; throw e; });
  return poseP;
}
const SIDES = [{s: 11, e: 13, w: 15, h: 23, a: 27}, {s: 12, e: 14, w: 16, h: 24, a: 28}];
const angleDeg = (a, b, c) => {
  const v1 = [a.x - b.x, a.y - b.y], v2 = [c.x - b.x, c.y - b.y], n = Math.hypot(...v1) * Math.hypot(...v2);
  return n ? Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / n))) * 180 / Math.PI : 180;
};
/* Une pompe = corps en planche (vu de profil) + coude qui descend sous ~100° puis remonte au-dessus de ~150°, dos droit. */
function pushupCounter() {
  let state = 'init', ang = null, tDown = 0, bad = false, count = 0;
  return {
    get count() { return count; },
    feed(lm, aspect, now) {
      const pt = i => ({x: lm[i].x * aspect, y: lm[i].y, v: lm[i].visibility ?? 0});
      const side = SIDES.map(k => ({k, v: (pt(k.s).v + pt(k.e).v + pt(k.w).v + pt(k.h).v) / 4})).sort((a, b) => b.v - a.v)[0].k;
      const S = pt(side.s), E = pt(side.e), W = pt(side.w), H = pt(side.h), A = pt(side.a);
      const out = {side, count: false, ok: false, msg: ''};
      if (S.v < .5 || E.v < .5 || W.v < .5) { out.msg = 'Je ne te vois pas bien : montre-toi en entier, de profil.'; return out; }
      const far = A.v > .4 ? A : H.v > .5 ? H : null;
      if (!far) { out.msg = 'Recule un peu pour qu’on voie tout ton corps.'; return out; }
      const dx = Math.abs(S.x - far.x), dy = Math.abs(S.y - far.y);
      if (dx < .2 || dy / dx > .6) { out.msg = 'Mets-toi en position de pompe, de profil par rapport à la caméra.'; state = state === 'down' ? 'init' : state; return out; }
      out.ok = true;
      const raw = angleDeg(S, E, W); ang = ang == null ? raw : ang * .5 + raw * .5;
      out.angle = ang;
      const straight = A.v > .4 && H.v > .5 ? angleDeg(S, H, A) : 180;
      if (state === 'init') { out.msg = 'Tends les bras (position haute) pour commencer.'; if (ang >= 150) state = 'up'; }
      else if (state === 'up') { out.msg = 'Descends !'; if (ang <= 100) { state = 'down'; tDown = now; bad = false; } }
      else {
        out.msg = 'Remonte !';
        if (straight < 140) bad = true;
        if (ang >= 150) {
          state = 'up';
          if (!bad && now - tDown >= 250) { count++; out.count = true; }
          else if (bad) out.msg = 'Pompe non comptée : garde le dos droit.';
        }
      }
      return out;
    }
  };
}
async function openCounter(d) {
  const el = document.createElement('div'); el.className = 'modal';
  el.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(d.title)}">
    <h2 style="margin-top:0">${esc(d.title)}</h2>
    <p class="mute" style="margin:0 0 4px;font-size:14px">Pose ton téléphone au sol, appuyé contre un mur, à 1,5–2 m, et mets-toi de profil : on doit voir tout ton corps. La vidéo reste sur ton téléphone.</p>
    <div class="wc-cam" id="wcam"><video id="wcv" playsinline muted></video><canvas id="wcc"></canvas><div class="wc-cnt"><b id="wcpc">0</b><span>/ ${d.goal}</span></div></div>
    <p class="wc-cs" id="wcs">Démarrage de la caméra…</p>
    <p class="row" style="margin:12px 0 0"><button class="alt" id="wcflip" type="button">Changer de caméra</button><button class="alt" id="wcq" type="button">Fermer</button></p></div>`;
  document.body.appendChild(el);
  const $q = s => el.querySelector(s), vid = $q('#wcv'), cv = $q('#wcc'), ctx = cv.getContext('2d'), say = t => { $q('#wcs').textContent = t; };
  let alive = true, raf = 0, stream = null, wake = null, facing = 'user', lastT = -1, pose = null, ctr = pushupCounter();
  const stop = () => { alive = false; cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(t => t.stop()); try { wake && wake.release(); } catch (e) {} };
  const close = () => { stop(); document.removeEventListener('keydown', onKey); el.remove(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  $q('#wcq').onclick = close;
  el.onclick = e => { if (e.target === el) close(); };

  async function startCam() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('nocam');
    stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: facing, width: {ideal: 640}, height: {ideal: 480}}, audio: false});
    vid.srcObject = stream; await vid.play();
    $q('#wcam').classList.toggle('mir', facing === 'user');
    $q('#wcam').style.aspectRatio = (vid.videoWidth || 3) + ' / ' + (vid.videoHeight || 4);
    cv.width = vid.videoWidth; cv.height = vid.videoHeight;
  }
  $q('#wcflip').onclick = async () => { facing = facing === 'user' ? 'environment' : 'user'; try { await startCam(); } catch (e) { say('Impossible de changer de caméra.'); } };

  const draw = r => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!r.side || !r.lm) return;
    const k = r.side, P = i => [r.lm[i].x * cv.width, r.lm[i].y * cv.height];
    ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.strokeStyle = r.ok ? '#43d3a0' : '#ff8a3d'; ctx.fillStyle = '#fff';
    ctx.beginPath(); [k.w, k.e, k.s, k.h, k.a].forEach((i, n) => { const [x, y] = P(i); n ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    [k.w, k.e, k.s, k.h, k.a].forEach(i => { const [x, y] = P(i); ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); });
  };
  const loop = () => {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    if (vid.readyState < 2 || vid.currentTime === lastT) return;
    lastT = vid.currentTime;
    let res; try { res = pose.detectForVideo(vid, performance.now()); } catch (e) { return; }
    const lm = res.landmarks && res.landmarks[0];
    if (!lm) { draw({}); say('Je ne te vois pas : place-toi devant la caméra.'); return; }
    const r = ctr.feed(lm, vid.videoWidth / vid.videoHeight, performance.now()); r.lm = lm; draw(r);
    $q('#wcpc').textContent = ctr.count;
    if (r.count) { try { navigator.vibrate && navigator.vibrate(40); } catch (e) {} }
    say(r.msg);
    if (ctr.count >= d.goal) finish();
  };
  async function finish() {
    stop(); say('Bravo ! Validation en cours…');
    try {
      const g = await claim('daily', `${dayKey()}_${d.id}`, d.amount);
      close(); if (g) wcToast(`+${g} WeakCoins · ${d.title}`); boutiquePage();
    } catch (e) {
      console.info('WeakCoin : quête du jour non validée', e && e.code);
      say('Validation impossible, vérifie ta connexion puis réessaie.');
      const b = document.createElement('button'); b.textContent = 'Réessayer'; b.onclick = () => { b.remove(); finish(); }; $q('#wcs').after(b);
    }
  }
  try {
    try { wake = navigator.wakeLock ? await navigator.wakeLock.request('screen') : null; } catch (e) {}
    await startCam();
    say('Chargement du détecteur (quelques secondes la première fois)…');
    pose = await loadPose();
    if (!alive) return;
    say('Tends les bras (position haute) pour commencer.');
    loop();
  } catch (e) {
    console.info('WeakCoin : caméra/détecteur', e && (e.name || e.message));
    say(e && e.name === 'NotAllowedError' ? 'Accès à la caméra refusé : autorise-la dans les réglages du navigateur, puis réessaie.'
      : e && e.message === 'nocam' ? 'La caméra n’est pas disponible ici (il faut une connexion sécurisée https).'
      : 'Le détecteur n’a pas pu se charger. Vérifie ta connexion puis réessaie.');
  }
}

/* ---------- page Boutique ---------- */
async function boutiquePage() {
  app.innerHTML = '<h1>Boutique</h1><p class="mute">Chargement…</p>';
  const prices = {};
  const [w, ud, socials, claimed] = await Promise.all([
    getWallet(),
    db.collection('users').doc(user.uid).get().catch(() => null),
    loadSocials(),
    db.collection('wcClaims').where('uid', '==', user.uid).get().then(q => ({ids: new Set(q.docs.map(d => d.id)), seance: q.docs.filter(d => d.data().kind === 'seance').map(d => d.data().ref), poids: q.docs.filter(d => d.data().kind === 'poids').map(d => d.data().ref)})).catch(() => ({ids: new Set(), seance: [], poids: []})),
    db.collection('shop').get().then(q => q.docs.forEach(d => { prices[d.id] = d.data().price; })).catch(() => {})
  ]);
  if (ud && ud.exists && Array.isArray(ud.data().items)) myProf.items = ud.data().items;
  /* l'admin publie les prix officiels du catalogue (les règles refusent tout achat à un autre prix) */
  if (isAdmin) await Promise.all(CATALOG.filter(it => prices[it.id] !== it.price).map(it =>
    db.collection('shop').doc(it.id).set({name: it.name, price: it.price}).then(() => { prices[it.id] = it.price; }).catch(e => console.warn('Boutique : prix non publié', e))));

  const prof = ud && ud.exists ? ud.data() : myProf;
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
    <h2>Quêtes</h2>${questsHtml(socials, claimed, prof, w)}
    <h2>Gagner des WeakCoins</h2>
    <div class="card"><ul class="wc-how">
      <li>${icon('dumb')}<span><b>Terminer une séance</b><br><span class="mute">Coche tous les exercices (une fois par séance)</span></span><em>+${REWARD.seance}${coin(18)}</em></li>
      <li>${icon('user')}<span><b>Terminer des quêtes</b><br><span class="mute">Profil, séances, pesées, fidélité, réseaux : une fois chacune</span></span><em>10 à 60${coin(18)}</em></li>
      <li>${icon('flame')}<span><b>Quêtes du jour</b><br><span class="mute">De nouvelles quêtes chaque jour, remises à zéro à minuit</span></span><em>+15${coin(18)}</em></li>
      <li>${icon('scale')}<span><b>Enregistrer ta pesée du jour</b><br><span class="mute">Une fois par jour</span></span><em>+${REWARD.poids}${coin(18)}</em></li>
    </ul></div>`;
  app.querySelectorAll('.wc-how .ic').forEach(i => { i.style.cssText = 'width:26px;height:26px;color:var(--acc);flex:none'; });

  wireQuests(claimed);
  wireDaily();
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
