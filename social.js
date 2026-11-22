/* WeakGym — Social : fil de photos, j'aime (privés si voulu), profils, recherche de membres.
   Fichier à part, chargé par index.html. Il s'appuie sur les variables globales du site
   (user, db, app, $, esc, av, allUsers, memRow, wireFollow…) et remplace profilePage / membersPage. */
(() => {
'use strict';

const POSTS = () => db.collection('posts'), LIKES = () => db.collection('likes'), COMMENTS = () => db.collection('comments');
const okImg = p => typeof p === 'string' && p.length < 900000 && /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(p);

/* ---------- modération : réglages ---------- */
const MOD = {
  block: 0.6,    // porno + hentai >= 60 %  -> photo refusée
  review: 0.25,  // porno + hentai >= 25 %  -> publiée mais masquée en attendant l'admin
  sexy: 0.75,    // « suggestif » >= 75 %   -> idem
  reports: 3     // nombre de signalements qui masquent automatiquement une publication
};
const TF_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.20.0/dist/tf.min.js';
const NSFW_URL = 'https://cdn.jsdelivr.net/npm/nsfwjs@2.4.2/dist/nsfwjs.min.js';
/* mots interdits dans la légende (comparés sans accents, sans majuscules, chiffres « leet » corrigés) */
const BAD = [/\bnazi(s|sme|ste|stes)?\b/, /\bhitler\w*/, /\bheil\b/, /\b(swastika|svastika)\b/, /\bcroix gammee\b/, /\bkkk\b/, /\bwhite power\b/,
  /\b(goebbels|himmler|goering|mengele)\b/, /\bporn\w*/, /\bnudes?\b/];
const BAD_FLAT = ['hitler', 'swastika', 'svastika', 'goebbels', 'himmler'];
function badCaption(t) {
  const n = String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[013457@$]/g, c => ({0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', '$': 's'}[c])).replace(/[^a-z]+/g, ' ');
  return BAD.some(r => r.test(n)) || BAD_FLAT.some(w => n.replace(/ /g, '').includes(w));
}
const loadJs = src => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('Chargement impossible : ' + src)); document.head.appendChild(s); });
let nsfwP = null;
function nsfwModel() {
  if (!nsfwP) nsfwP = (async () => {
    if (!window.tf) await loadJs(TF_URL);
    if (!window.nsfwjs) await loadJs(NSFW_URL);
    return await window.nsfwjs.load();
  })().catch(e => { nsfwP = null; throw e; });
  return nsfwP;
}
/* 'ok' | 'review' | 'block' ; lève une erreur si l'analyse est impossible */
async function checkPhoto(dataUrl) {
  const run = (async () => {
    const model = await nsfwModel(), im = new Image(); im.src = dataUrl; await im.decode();
    const pr = {}; (await model.classify(im)).forEach(r => { pr[r.className] = r.probability; });
    const hard = (pr.Porn || 0) + (pr.Hentai || 0);
    console.info('Modération photo', pr);
    if (hard >= MOD.block) return 'block';
    if (hard >= MOD.review || (pr.Sexy || 0) >= MOD.sexy) return 'review';
    return 'ok';
  })();
  return Promise.race([run, new Promise((_, ko) => setTimeout(() => ko(new Error('Délai dépassé')), 30000))]);
}
const hiddenPost = p => p.review === true || (p.rep | 0) >= MOD.reports;
const SV = {
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  lockC: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M7 11V8a5 5 0 0 1 10 0v3"/></svg>',
  lockO: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M7 11V8a5 5 0 0 1 9.6-1.7"/></svg>',
  chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>'
};
/* ---------- badges (attribués uniquement par l'admin : champ users.badges) ---------- */
const SEAL = '<rect x="4" y="4" width="16" height="16" rx="4" fill="currentColor"/><rect x="4" y="4" width="16" height="16" rx="4" fill="currentColor" transform="rotate(45 12 12)"/>';
const BADGES = {
  verified: {label: 'Vérifié', color: 'var(--vf)', mark: '<path d="M8 12.3l2.7 2.7 5.5-5.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'},
  coach: {label: 'Coach', color: 'var(--acc)', mark: '<path fill="#fff" d="M12 7.2l1.4 3 3.3.4-2.4 2.3.6 3.2-2.9-1.7-2.9 1.7.6-3.2-2.4-2.3 3.3-.4z"/>'},
  founder: {label: 'Fondateur', color: 'var(--warn)', mark: '<path fill="#fff" d="M12 7l4 5-4 5-4-5z"/>'}
};
const wgBadges = u => (u && Array.isArray(u.badges) ? u.badges : []).filter(k => BADGES[k]).slice(0, 3).map(k =>
  `<span class="vb" style="color:${BADGES[k].color}" role="img" aria-label="${BADGES[k].label}" title="${BADGES[k].label}"><svg viewBox="0 0 24 24" aria-hidden="true">${SEAL}${BADGES[k].mark}</svg></span>`).join('') + (window.wcBadgesHtml ? wcBadgesHtml(u) : '');
function badgeModal(u, done) {
  const cur = new Set(Array.isArray(u.badges) ? u.badges : []);
  const m = sheet(`<h2 style="margin-top:0">Badges de ${esc(u.name || 'ce membre')}</h2>
    ${Object.entries(BADGES).map(([k, b]) => `<label class="chk"><input type="checkbox" data-k="${k}" ${cur.has(k) ? 'checked' : ''}><span class="vb" style="color:${b.color};margin:0"><svg viewBox="0 0 24 24" aria-hidden="true">${SEAL}${b.mark}</svg></span>${b.label}</label>`).join('')}
    <p id="be" class="err" hidden></p>
    <p class="row" style="margin:16px 0 0"><button id="bs">Enregistrer</button><button class="alt" id="bx" type="button">Annuler</button></p>`);
  m.q('#bx').onclick = m.close;
  m.q('#bs').onclick = async () => {
    const sel = [...m.el.querySelectorAll('[data-k]')].filter(i => i.checked).map(i => i.dataset.k), b = m.q('#bs'); b.disabled = true;
    try { await db.collection('users').doc(u.uid).update({badges: sel.length ? sel : firebase.firestore.FieldValue.delete()}); ucache = null; m.close(); done && done(); }
    catch (x) { m.q('#be').textContent = 'Erreur : ' + x.message; m.q('#be').hidden = false; b.disabled = false; }
  };
}
const ago = ms => {
  const m = Math.round((Date.now() - ms) / 6e4);
  if (m < 1) return 'à l’instant'; if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24); if (j < 7) return `il y a ${j} j`;
  return new Date(ms).toLocaleDateString(WG.loc, {day: 'numeric', month: 'short', year: 'numeric'});
};

/* ---------- photo : redimensionnée + compressée (stockée dans Firestore, pas de vidéo) ---------- */
function readPostPhoto(file) {
  return new Promise((ok, ko) => {
    if (!file || !/^image\//.test(file.type)) return ko(new Error('Choisis une image.'));
    const fr = new FileReader();
    fr.onerror = () => ko(new Error('Lecture impossible.'));
    fr.onload = () => {
      const im = new Image();
      im.onerror = () => ko(new Error('Image non lisible.'));
      im.onload = () => {
        let S = 1080, q = .82, u;
        for (let i = 0; i < 8; i++) {
          const k = Math.min(1, S / Math.max(im.width, im.height)), c = document.createElement('canvas');
          c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
          const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
          u = c.toDataURL('image/jpeg', q);
          if (u.length < 600000) return ok(u);
          q = Math.max(.5, q - .1); S = Math.round(S * .85);
        }
        ko(new Error('Image trop lourde.'));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/* ---------- j'aime ---------- */
async function countBy(col, id) {
  try {
    const q = col().where('post', '==', id);
    if (typeof q.count === 'function') { try { return (await q.count().get()).data().count; } catch (e) {} }
    return (await q.get()).size;
  } catch (e) { return null; }
}
async function newState() {
  const [users, mine] = await Promise.all([allUsers(true), LIKES().where('uid', '==', user.uid).get().catch(() => ({docs: []}))]);
  return {users, me: new Set(mine.docs.map(d => d.data().post)), counts: {}, cc: {}};
}
async function loadCounts(st, list) {
  await Promise.all(list.flatMap(p => [
    (p.uid === user.uid || !p.hideLikes) && !(p.id in st.counts) ? countBy(LIKES, p.id).then(n => { st.counts[p.id] = n; }) : null,
    !(p.id in st.cc) ? countBy(COMMENTS, p.id).then(n => { st.cc[p.id] = n; }) : null].filter(Boolean)));
}
const fromDocs = ds => ds.docs.map(d => ({id: d.id, ...d.data()})).filter(p => okImg(p.img) && (!hiddenPost(p) || isAdmin || p.uid === user.uid));

/* ---------- carte de publication ---------- */
function mountPost(p, st, onGone) {
  const mine = p.uid === user.uid, u = st.users[p.uid] || {uid: p.uid, name: 'Ancien membre'};
  const cnt = st.counts[p.id], showN = (mine || !p.hideLikes) && cnt != null, liked = st.me.has(p.id);
  const el = document.createElement('div');
  el.innerHTML = `<article class="card post">
    <div class="post-h"><a class="mem" href="#/profil/${esc(p.uid)}">${av(u)}<span><b>${esc(u.name || 'Sans nom')}${wgBadges(u)}</b><span class="mute">${ago(p.at)}</span></span></a>
      ${mine ? `<button class="alt pk" data-lk title="${p.hideLikes ? 'Les autres ne voient pas le nombre de j’aime' : 'Les autres voient le nombre de j’aime'}">${p.hideLikes ? SV.lockC + 'J’aime privés' : SV.lockO + 'J’aime publics'}</button>` : ''}${!mine ? '<button class="alt pk" data-rp>Signaler</button>' : ''}${mine || isAdmin ? '<button class="del pk" data-del>' + (mine ? 'Supprimer' : 'Supprimer (admin)') + '</button>' : ''}</div>
    ${hiddenPost(p) ? `<div class="mod-b"><span>${isAdmin && !mine ? (p.review === true ? 'À vérifier (détection automatique)' : (p.rep | 0) + ' signalements') + ' · masquée pour les membres' : 'En vérification : seuls toi et l’administrateur la voient pour l’instant.'}</span>${isAdmin ? '<button class="alt pk" data-ok>Rétablir</button>' : ''}</div>` : ''}
    <img class="post-i" src="${p.img}" alt="Photo de ${esc(u.name || 'membre')}" loading="lazy">
    <div class="post-a"><button class="heart ${liked ? 'on' : ''}" data-like aria-pressed="${liked}" aria-label="J’aime">${SV.heart}<span class="hn">${showN ? cnt : ''}</span></button>
      <button class="heart cm" data-cm aria-expanded="false" aria-label="Commentaires">${SV.chat}<span class="hn">${st.cc[p.id] != null ? st.cc[p.id] : ''}</span></button></div>
    ${p.text ? `<p class="post-t"><b>${esc(u.name || 'Sans nom')}</b>${esc(p.text)}</p>` : '<div style="height:10px"></div>'}
    <div class="cmts" hidden></div></article>`;
  const root = el.firstElementChild, q = s => root.querySelector(s);
  q('[data-like]').onclick = async e => {
    const b = e.currentTarget, ref = LIKES().doc(p.id + '_' + user.uid), was = st.me.has(p.id);
    b.disabled = true;
    try {
      if (was) { await ref.delete(); st.me.delete(p.id); if (st.counts[p.id] != null) st.counts[p.id]--; }
      else { await ref.set({post: p.id, uid: user.uid, at: Date.now()}); st.me.add(p.id); if (st.counts[p.id] != null) st.counts[p.id]++; }
      b.classList.toggle('on', !was); b.setAttribute('aria-pressed', String(!was));
      b.querySelector('.hn').textContent = (mine || !p.hideLikes) && st.counts[p.id] != null ? st.counts[p.id] : '';
    } catch (x) { alert('Erreur : ' + x.message); }
    b.disabled = false;
  };
  const cbox = q('.cmts'), cb = q('[data-cm]'); let list = null;
  const setN = () => { cb.querySelector('.hn').textContent = list ? list.length : (st.cc[p.id] != null ? st.cc[p.id] : ''); if (list) st.cc[p.id] = list.length; };
  const drawC = () => {
    cbox.innerHTML = `<div class="cl">${list.length ? list.map(c => {
      const cu = st.users[c.uid] || {uid: c.uid, name: 'Ancien membre'}, can = c.uid === user.uid || mine || isAdmin;
      return `<div class="cm-i"><a href="#/profil/${esc(c.uid)}" aria-hidden="true" tabindex="-1">${av(cu)}</a><p><a href="#/profil/${esc(c.uid)}"><b>${esc(cu.name || 'Sans nom')}</b>${wgBadges(cu)}</a> ${esc(c.text)}<small>${ago(c.at)}${can ? ` · <button class="cdel" data-cd="${esc(c.id)}">Supprimer</button>` : ''}</small></p></div>`;
    }).join('') : '<p class="mute small">Aucun commentaire pour le moment.</p>'}</div>
      <div class="cm-f"><input maxlength="300" placeholder="Ajouter un commentaire…" aria-label="Commentaire" autocomplete="off"><button type="button">Envoyer</button></div>`;
    cbox.querySelectorAll('[data-cd]').forEach(b => b.onclick = async () => {
      if (!confirm('Supprimer ce commentaire ?')) return; b.disabled = true;
      try { await COMMENTS().doc(b.dataset.cd).delete(); list = list.filter(c => c.id !== b.dataset.cd); setN(); drawC(); } catch (x) { alert('Erreur : ' + x.message); b.disabled = false; }
    });
    const inp = cbox.querySelector('input'), send = cbox.querySelector('.cm-f button');
    const go = async () => {
      const text = inp.value.trim(); if (!text) return; send.disabled = true;
      try {
        const c = {post: p.id, uid: user.uid, text: text.slice(0, 300), at: Date.now()};
        c.id = (await COMMENTS().add(c)).id; list.push(c); setN(); drawC(); cbox.querySelector('input').focus();
      } catch (x) { alert('Erreur : ' + x.message); send.disabled = false; }
    };
    send.onclick = go; inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
  };
  cb.onclick = async () => {
    const open = cbox.hidden; cbox.hidden = !open; cb.setAttribute('aria-expanded', String(open));
    if (!open) return;
    if (!list) {
      cbox.innerHTML = '<p class="mute small" style="margin:0">Chargement…</p>';
      try { list = (await COMMENTS().where('post', '==', p.id).get()).docs.map(d => ({id: d.id, ...d.data()})).sort((a, b) => a.at - b.at); }
      catch (x) { cbox.innerHTML = '<p class="err">Commentaires indisponibles.</p>'; return; }
      setN();
    }
    drawC(); cbox.querySelector('input').focus();
  };
  if (!mine) {
    q('[data-rp]').onclick = async e => {
      const b = e.currentTarget;
      if (!confirm('Signaler cette photo comme inappropriée ?')) return;
      b.disabled = true;
      try {
        const bt = db.batch();
        bt.set(db.collection('reports').doc(p.id + '_' + user.uid), {post: p.id, uid: user.uid, at: Date.now()});
        bt.update(POSTS().doc(p.id), {rep: firebase.firestore.FieldValue.increment(1)});
        await bt.commit();
        b.textContent = 'Signalée';
      } catch (x) { b.textContent = 'Déjà signalée'; }
    };
  }
  if (isAdmin && hiddenPost(p)) {
    q('[data-ok]').onclick = async () => {
      try { await POSTS().doc(p.id).update({review: false, rep: 0}); p.review = false; p.rep = 0; root.parentNode.replaceChild(mountPost(p, st, onGone), root); }
      catch (x) { alert('Erreur : ' + x.message); }
    };
  }
  if (mine) {
    q('[data-lk]').onclick = async () => {
      try { await POSTS().doc(p.id).update({hideLikes: !p.hideLikes}); p.hideLikes = !p.hideLikes; if (!(p.id in st.counts)) await loadCounts(st, [p]); root.parentNode.replaceChild(mountPost(p, st, onGone), root); }
      catch (x) { alert('Erreur : ' + x.message); }
    };
  }
  if (mine || isAdmin) {
    q('[data-del]').onclick = async () => {
      if (!confirm(mine ? 'Supprimer cette publication ?' : 'Supprimer la publication de ' + (u.name || 'ce membre') + ' ?')) return;
      try {
        try { const c = await COMMENTS().where('post', '==', p.id).get(); const b = db.batch(); c.docs.forEach(d => b.delete(d.ref)); if (c.size) await b.commit(); } catch (e) {}
        await POSTS().doc(p.id).delete();
        if (isAdmin) { try { const l = await LIKES().where('post', '==', p.id).get(); const b = db.batch(); l.docs.forEach(d => b.delete(d.ref)); if (l.size) await b.commit(); } catch (e) {} }
        onGone && onGone(p);
      } catch (x) { alert('Erreur : ' + x.message); }
    };
  }
  return root;
}

/* ---------- fenêtres ---------- */
function sheet(html, cls = '') {
  const el = document.createElement('div'); el.className = 'modal';
  el.innerHTML = `<div class="sheet ${cls}" role="dialog">${html}</div>`;
  document.body.appendChild(el);
  const onKey = e => { if (e.key === 'Escape') close(); };
  const close = () => { document.removeEventListener('keydown', onKey); el.remove(); el.dispatchEvent(new Event('closed')); };
  el.onclick = e => { if (e.target === el) close(); };
  document.addEventListener('keydown', onKey);
  return {el, q: s => el.querySelector(s), close};
}

function composeModal(done) {
  const m = sheet(`<h2 style="margin-top:0">Nouvelle publication</h2>
    <input id="cf" type="file" accept="image/*" aria-label="Photo">
    <img id="cp" class="cmp-p" alt="" hidden>
    <label for="ct">Légende</label><textarea id="ct" rows="3" maxlength="300" placeholder="Ta séance, ton record, ton ressenti…"></textarea>
    <label class="chk"><input id="ch" type="checkbox"> Cacher le nombre de j’aime aux autres</label>
    <p id="cst" class="mute small" hidden></p>
    <p id="ce" class="err" hidden></p>
    <p class="row" style="margin:16px 0 0"><button id="cs" disabled>Publier</button><button class="alt" id="cx" type="button">Annuler</button></p>`);
  let img = '', review = false, tk = 0;
  const err = t => { const e = m.q('#ce'); e.textContent = t; e.hidden = !t; };
  const status = t => { const e = m.q('#cst'); e.textContent = t; e.hidden = !t; };
  m.q('#cx').onclick = m.close;
  m.q('#cf').onchange = async e => {
    const my = ++tk; err(''); status(''); img = ''; review = false; m.q('#cs').disabled = true; m.q('#cp').hidden = true;
    try {
      const data = await readPostPhoto(e.target.files[0]);
      status('Vérification de la photo…');
      let v; try { v = await checkPhoto(data); } catch (x) { console.warn('Modération indisponible', x); v = 'unavailable'; }
      if (my !== tk) return;
      status('');
      if (v === 'block') { e.target.value = ''; err('Cette photo ne peut pas être publiée : elle semble contenir du contenu sexuel.'); return; }
      img = data; review = !isAdmin && v !== 'ok';
      const p = m.q('#cp'); p.src = img; p.hidden = false;
      if (review) status(v === 'unavailable' ? 'Vérification automatique indisponible : ta photo sera visible par les autres après validation de l’administrateur.' : 'Cette photo sera visible par les autres après validation de l’administrateur.');
      m.q('#cs').disabled = false;
    } catch (x) { if (my !== tk) return; status(''); m.q('#cp').hidden = true; err(x.message); }
  };
  m.q('#cs').onclick = async () => {
    if (!img) return; const b = m.q('#cs'); err('');
    const text = m.q('#ct').value.trim().slice(0, 300);
    if (badCaption(text)) { err('La légende contient un mot interdit.'); return; }
    b.disabled = true;
    try {
      await POSTS().add({uid: user.uid, img, text, hideLikes: m.q('#ch').checked, at: Date.now(), ...(review ? {review: true} : {})});
      m.close(); done && done();
    } catch (x) { err('Erreur : ' + x.message); b.disabled = false; }
  };
}

function listModal(title, list, myFol, onChange) {
  const m = sheet(`<div class="row nowrap" style="align-items:center"><h2 style="margin:0;flex:1">${title} (${list.length})</h2><button class="alt" id="lx" style="flex:none">Fermer</button></div><div id="ll" style="margin-top:8px"></div>`);
  let changed = false;
  const draw = () => {
    const l = m.q('#ll');
    l.innerHTML = list.length ? list.map(x => memRow(x, user.uid, myFol)).join('') : '<p class="mute">Personne pour le moment.</p>';
    wireFollow(l, async () => { changed = true; const r = await db.collection('follows').where('from', '==', user.uid).get(); myFol.clear(); r.docs.forEach(d => myFol.add(d.data().to)); draw(); });
  };
  m.q('#lx').onclick = m.close;
  m.el.addEventListener('click', e => { if (e.target.closest('a')) m.close(); });
  m.el.addEventListener('closed', () => { if (changed) onChange && onChange(); });
  draw();
}

/* ---------- page Social ---------- */
async function socialPage() {
  const me = {uid: user.uid, name: myProf.name || nm(user), photo: myProf.photo};
  app.innerHTML = `<div class="soc-top"><h1>${icon('planet')}Social</h1><div class="soc-act">
      <a class="ibtn" href="#/messages" aria-label="Messages">${icon('chat')}${unread ? `<span class="bd">${unread}</span>` : ''}</a>
      <a class="ibtn" href="#/membres" aria-label="Rechercher des membres">${SV.search}</a>
      <a href="#/profil" aria-label="Mon profil">${av(me)}</a></div></div>
    <button id="np" class="soc-new">${SV.plus} Publier une photo</button>
    <div class="seg" id="st"><a href="#" data-t="abo">Abonnements</a><a href="#" data-t="all">Tout le monde</a></div>
    <div id="feed"><p class="mute">Chargement…</p></div>`;
  const [ps, fol, st] = await Promise.all([POSTS().orderBy('at', 'desc').limit(60).get(), db.collection('follows').where('from', '==', user.uid).get(), newState()]);
  const fset = new Set(fol.docs.map(d => d.data().to)); fset.add(user.uid);
  let posts = fromDocs(ps).filter(p => !(st.users[p.uid] && st.users[p.uid].blocked));
  let tab = fol.size ? 'abo' : 'all', tok = 0;
  const draw = async () => {
    const my = ++tok, box = $('#feed');
    $('#st').querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.t === tab));
    const list = posts.filter(p => tab === 'all' || fset.has(p.uid)).slice(0, 30);
    if (!list.length) { box.innerHTML = `<div class="card pg-e mute">${tab === 'abo' ? 'Rien à voir pour le moment. Abonne-toi à des membres avec la loupe, ou publie ta première photo.' : 'Aucune publication pour le moment.'}</div>`; return; }
    await loadCounts(st, list);
    if (my !== tok) return;
    box.innerHTML = ''; list.forEach(p => box.appendChild(mountPost(p, st, g => { posts = posts.filter(x => x.id !== g.id); draw(); })));
  };
  $('#st').querySelectorAll('a').forEach(a => a.onclick = e => { e.preventDefault(); tab = a.dataset.t; draw(); });
  $('#np').onclick = () => composeModal(socialPage);
  draw();
}

/* ---------- Rechercher des membres ---------- */
async function membersPage() {
  app.innerHTML = '<p class="mute">Chargement…</p>';
  const [us, mine] = await Promise.all([allUsers(true), db.collection('follows').where('from', '==', user.uid).get()]);
  let fol = new Set(mine.docs.map(d => d.data().to)), q = '';
  const list = Object.values(us).filter(u => !u.blocked && u.uid !== user.uid).sort((a, b) => (isOnline(b.seen) ? 1 : 0) - (isOnline(a.seen) ? 1 : 0) || (b.seen || 0) - (a.seen || 0));
  app.innerHTML = `<p style="margin:0"><a class="link" href="#/social" style="padding-left:0">← Social</a></p><h1 style="margin-top:0">Rechercher</h1>
    <input id="mq" type="search" placeholder="Rechercher un nom…" aria-label="Rechercher" autocomplete="off"><div id="ml" style="margin-top:8px"></div>`;
  const draw = () => {
    const r = list.filter(u => (u.name || '').toLowerCase().includes(q));
    $('#ml').innerHTML = r.length ? r.map(u => memRow(u, user.uid, fol)).join('') : '<p class="mute">Personne trouvé.</p>';
    wireFollow($('#ml'), async () => { const m = await db.collection('follows').where('from', '==', user.uid).get(); fol = new Set(m.docs.map(d => d.data().to)); draw(); });
  };
  $('#mq').oninput = e => { q = e.target.value.trim().toLowerCase(); draw(); };
  draw();
}

/* ---------- Profil (façon Instagram) ---------- */
async function profilePage(uid) {
  uid = uid || user.uid;
  const self = uid === user.uid;
  app.innerHTML = '<p class="mute">Chargement…</p>';
  const [ud, fr, fg, ps, mine, st] = await Promise.all([
    db.collection('users').doc(uid).get(), db.collection('follows').where('to', '==', uid).get(), db.collection('follows').where('from', '==', uid).get(),
    POSTS().where('uid', '==', uid).get(), db.collection('follows').where('from', '==', user.uid).get(), newState()]);
  if (!ud.exists) { app.innerHTML = '<h1>Profil introuvable</h1><a class="btn alt" href="#/membres">Rechercher des membres</a>'; return; }
  const users = st.users, u = {uid, ...ud.data()}; if (self) myProf = ud.data();
  const followers = fr.docs.map(d => d.data()).sort((a, b) => b.at - a.at).map(f => users[f.from]).filter(Boolean);
  const following = fg.docs.map(d => d.data()).sort((a, b) => b.at - a.at).map(f => users[f.to]).filter(Boolean);
  const myFol = new Set(mine.docs.map(d => d.data().to));
  let posts = fromDocs(ps).sort((a, b) => b.at - a.at), iFollow = fr.docs.some(d => d.data().from === user.uid);
  const joined = u.joined ? new Date(u.joined).toLocaleDateString(WG.loc, {month: 'long', year: 'numeric'}) : '';
  const showJoined = joined && (self || !u.hideJoined);
  const stat = (k, n, l) => `<button data-s="${k}"><b>${n}</b><span>${l}</span></button>`;
  app.innerHTML = `${self ? '' : '<p style="margin:0"><a class="link" href="#/social" style="padding-left:0">← Social</a></p>'}
    <div class="pr">${av(u, 'xl')}<div class="pr-s">${stat('posts', posts.length, 'Publications')}${stat('followers', followers.length, 'Abonnés')}${stat('following', following.length, 'Abonnements')}</div></div>
    <h1 class="pr-n">${esc(u.name || 'Sans nom')}${wgBadges(u)}</h1>
    <p class="pr-m"><span class="${isOnline(u.seen) || self ? 'on-t' : ''}">${lastSeen(u.seen, self)}</span>${showJoined ? ` · Membre depuis ${esc(joined)}${self && u.hideJoined ? ' (masqué)' : ''}` : ''}${!self && following.some(x => x.uid === user.uid) ? ' · <b>Te suit</b>' : ''}</p>
    ${u.bio ? `<p class="bio pr-b">${esc(u.bio)}</p>` : '<div style="height:10px"></div>'}
    <div class="pr-act">${self ? '<button id="ed" class="alt">Modifier le profil</button><button id="np">Publier</button>' : fbtn(uid, iFollow).replace('class="fb', 'id="mainf" style="min-height:46px;font-size:16px" class="fb')}${isAdmin ? '<button id="bg" class="alt">Badges</button>' : ''}</div>
    ${self ? `<div class="card" id="edbox" hidden>
      <label>Photo de profil</label>
      <div class="row nowrap" style="align-items:center"><span id="edav">${av(u)}</span><input id="edf" type="file" accept="image/*"><button class="alt" id="edrm" type="button" style="flex:none">Retirer</button></div>
      <label for="edn">Nom affiché</label><input id="edn" maxlength="30" value="${esc(u.name || '')}">
      <label for="edb">Bio</label><textarea id="edb" rows="2" maxlength="140" placeholder="Objectif, salle, programme…">${esc(u.bio || '')}</textarea>
      <label class="chk"><input id="edj" type="checkbox" ${u.hideJoined ? '' : 'checked'}> Afficher « Membre depuis »</label>
      <p id="eder" class="err" hidden></p>
      <p class="row" style="margin:14px 0 0"><button id="eds">Enregistrer</button><button class="alt" id="edc" type="button">Annuler</button></p></div>` : ''}
    <div id="pg"></div>`;

  const drawGrid = () => {
    $('#pg').innerHTML = posts.length ? `<div class="pg">${posts.map((p, i) => `<button data-i="${i}" aria-label="Voir la publication"><img src="${p.img}" alt="" loading="lazy"></button>`).join('')}</div>`
      : `<div class="card pg-e mute">${self ? 'Tu n’as encore rien publié.' : 'Aucune publication pour le moment.'}</div>`;
    $('#pg').querySelectorAll('[data-i]').forEach(b => b.onclick = async () => {
      const p = posts[+b.dataset.i]; await loadCounts(st, [p]);
      const m = sheet(''); m.q('.sheet').style.padding = '0'; m.q('.sheet').appendChild(mountPost(p, st, () => { m.close(); profilePage(uid); }));
    });
  };
  drawGrid();
  const open = k => k === 'posts' ? $('#pg').scrollIntoView({behavior: 'smooth'}) : k === 'followers' ? listModal('Abonnés', followers, myFol, () => profilePage(uid)) : listModal('Abonnements', following, myFol, () => profilePage(uid));
  app.querySelectorAll('[data-s]').forEach(b => b.onclick = () => open(b.dataset.s));

  if ($('#bg')) $('#bg').onclick = () => badgeModal(u, () => profilePage(uid));
  if (!self) {
    let on = iFollow; const b = $('#mainf');
    b.onclick = async () => {
      b.disabled = true;
      try { await toggleFollow(uid, on); on = !on; profilePage(uid); } catch (e) { alert('Erreur : ' + e.message); b.disabled = false; }
    };
    return;
  }
  let photo = u.photo || '';
  $('#np').onclick = () => composeModal(() => profilePage(uid));
  $('#ed').onclick = () => { $('#edbox').hidden = false; $('#ed').hidden = true; };
  $('#edc').onclick = () => profilePage(uid);
  $('#edrm').onclick = () => { photo = ''; $('#edav').innerHTML = av({...u, photo: ''}); };
  $('#edf').onchange = async e => {
    const er = $('#eder'); er.hidden = true;
    try { photo = await readPhoto(e.target.files[0]); $('#edav').innerHTML = av({...u, photo}); } catch (x) { er.textContent = x.message; er.hidden = false; }
  };
  $('#eds').onclick = async () => {
    const b = $('#eds'), er = $('#eder'), name = $('#edn').value.trim(), F = firebase.firestore.FieldValue;
    if (!name) { er.textContent = 'Le nom ne peut pas être vide.'; er.hidden = false; return; }
    b.disabled = true;
    try {
      const data = {name, bio: $('#edb').value.trim().slice(0, 140), photo: photo || F.delete(), hideJoined: $('#edj').checked ? F.delete() : true};
      await db.collection('users').doc(uid).update(data);
      myProf = {...myProf, name, bio: data.bio, photo}; if (!photo) delete myProf.photo;
      if ($('#edj').checked) delete myProf.hideJoined; else myProf.hideJoined = true;
      ucache = null; setWho(); profilePage(uid);
    } catch (x) { er.textContent = 'Erreur : ' + x.message; er.hidden = false; b.disabled = false; }
  };
}

window.wgBadges = wgBadges;
window.socialPage = socialPage;
window.membersPage = membersPage;
window.profilePage = profilePage;
})();
