// WeakGym : notifications push GRATUITES via Cloudflare Workers (pas de carte bancaire).
// Toutes les minutes, le Worker cherche les nouvelles photos du Social et prévient les abonnés de l'auteur.
// Secret à créer dans Cloudflare : SA_JSON = contenu du fichier « compte de service » téléchargé depuis la console Firebase.

const enc = s => new TextEncoder().encode(s);
const b64u = buf => { const a = new Uint8Array(buf); let s = ''; for (const x of a) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - s.length % 4) % 4); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };

// ---------- Web Push : chiffrement (RFC 8291) + signature VAPID ----------
async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}
async function encryptPayload(p256dh, authB64, text) {
  const ua = unb64u(p256dh), auth = unb64u(authB64);
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const ikm = await hkdf(auth, shared, cat(enc('WebPush: info\0'), ua, asPub), 32);
  const cek = await hkdf(salt, ikm, enc('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(enc(text), new Uint8Array([2]))));
  const hdr = new Uint8Array(21); hdr.set(salt); new DataView(hdr.buffer).setUint32(16, 4096); hdr[20] = 65;
  return cat(hdr, asPub, ct);
}
async function vapidJwt(aud, pubB64, dB64, sub) {
  const pub = unb64u(pubB64);
  const jwk = { kty: 'EC', crv: 'P-256', x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), d: dB64, ext: true };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const h = b64u(enc(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))), c = b64u(enc(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub })));
  return h + '.' + c + '.' + b64u(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc(h + '.' + c)));
}

// ---------- Firestore (API REST, compte de service) ----------
let TOK = null, BUDGET = 44;   // l'offre gratuite autorise 50 requêtes sortantes par exécution
const F = (url, opt) => { BUDGET--; return fetch(url, opt); };
const pem = p => Uint8Array.from(atob(p.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), c => c.charCodeAt(0));
async function token(env) {
  if (TOK && TOK.exp > Date.now() + 60000) return TOK.v;
  const sa = JSON.parse(env.SA_JSON), now = Math.floor(Date.now() / 1000);
  const h = b64u(enc(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))), c = b64u(enc(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })));
  const key = await crypto.subtle.importKey('pkcs8', pem(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const jwt = h + '.' + c + '.' + b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc(h + '.' + c)));
  const r = await F('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt });
  const j = await r.json(); if (!j.access_token) throw new Error('Jeton refusé : ' + JSON.stringify(j));
  TOK = { v: j.access_token, exp: Date.now() + j.expires_in * 1000 }; return TOK.v;
}
const root = env => 'https://firestore.googleapis.com/v1/projects/' + JSON.parse(env.SA_JSON).project_id + '/databases/(default)/documents';
async function call(env, url, opt = {}) {
  const t = await token(env);
  return F(url, { ...opt, headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' } });
}
const g = (d, k) => { const v = d && d.fields && d.fields[k]; if (!v) return undefined; return 'stringValue' in v ? v.stringValue : 'integerValue' in v ? +v.integerValue : 'doubleValue' in v ? v.doubleValue : 'booleanValue' in v ? v.booleanValue : undefined; };
const idOf = d => d.name.split('/').pop();
const val = v => typeof v === 'number' ? { integerValue: String(Math.round(v)) } : { stringValue: String(v) };
async function fsGet(env, path) { const r = await call(env, root(env) + '/' + path); if (r.status === 404) return null; if (!r.ok) throw new Error('Lecture ' + path + ' : ' + r.status); return r.json(); }
async function fsPatch(env, path, obj) {
  const mask = Object.keys(obj).map(k => 'updateMask.fieldPaths=' + k).join('&'), fields = {}; for (const k in obj) fields[k] = val(obj[k]);
  const r = await call(env, root(env) + '/' + path + '?' + mask, { method: 'PATCH', body: JSON.stringify({ fields }) }); if (!r.ok) throw new Error('Écriture ' + path + ' : ' + r.status);
}
async function fsQuery(env, q) { const r = await call(env, root(env) + ':runQuery', { method: 'POST', body: JSON.stringify({ structuredQuery: q }) }); if (!r.ok) throw new Error('Requête : ' + r.status + ' ' + (await r.text()).slice(0, 200)); return (await r.json()).filter(x => x.document).map(x => x.document); }
async function fsBatchGet(env, paths) { const base = root(env); const r = await call(env, base + ':batchGet', { method: 'POST', body: JSON.stringify({ documents: paths.map(p => base + '/' + p) }) }); if (!r.ok) throw new Error('Lecture groupée : ' + r.status); return (await r.json()).filter(x => x.found).map(x => x.found); }
const eq = (f, v) => ({ fieldFilter: { field: { fieldPath: f }, op: 'EQUAL', value: { stringValue: v } } });

// ---------- Clés VAPID : créées automatiquement la première fois, gardées dans Firestore (meta/push) ----------
let VAPID = null;
async function getVapid(env, meta) {
  if (VAPID) return VAPID;
  meta = meta || await fsGet(env, 'meta/push');
  let pub = g(meta, 'vapidPub'), d = g(meta, 'vapidD');
  if (!pub || !d) {
    const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']), jwk = await crypto.subtle.exportKey('jwk', k.privateKey);
    pub = b64u(cat(new Uint8Array([4]), unb64u(jwk.x), unb64u(jwk.y))); d = jwk.d;
    await fsPatch(env, 'meta/push', { vapidPub: pub, vapidD: d });
  }
  return (VAPID = { pub, d });
}

// ---------- Envoi ----------
async function notifyPost(env, p, vapid) {
  const fol = await fsQuery(env, { from: [{ collectionId: 'follows' }], where: eq('to', p.uid), limit: 500 });
  const ids = [...new Set(fol.map(x => g(x, 'from')).filter(x => x && x !== p.uid))].slice(0, 100);
  if (!ids.length) return;
  const users = await fsBatchGet(env, ['users/' + p.uid, ...ids.map(i => 'users/' + i)]), by = {}; users.forEach(u => { by[idOf(u)] = u; });
  const author = by[p.uid]; if (author && g(author, 'blocked') === true) return;
  const name = String(g(author, 'name') || 'Un membre').split(' ')[0].slice(0, 40);
  let who = ids.filter(i => by[i] && g(by[i], 'notif') === true && g(by[i], 'notifSocial') !== false && g(by[i], 'blocked') !== true);   // respecte la case « Prévenir quand un membre que je suis publie »
  if (g(author, 'private') === true && who.length) {   // profil privé : seulement les membres que l'auteur suit en retour (comme dans l'appli)
    const back = await fsQuery(env, { from: [{ collectionId: 'follows' }], where: eq('from', p.uid), limit: 500 });
    const okSet = new Set(back.map(x => g(x, 'to'))); who = who.filter(i => okSet.has(i));
  }
  if (!who.length) return;
  const subs = [];
  for (let i = 0; i < who.length && BUDGET > 8; i += 30) {
    const part = who.slice(i, i + 30);
    subs.push(...await fsQuery(env, { from: [{ collectionId: 'pushSubs' }], where: { fieldFilter: { field: { fieldPath: 'uid' }, op: 'IN', value: { arrayValue: { values: part.map(x => ({ stringValue: x })) } } } } }));
  }
  const payload = JSON.stringify({ wg: 1, title: name + ' a publié une photo 📸', body: p.text ? String(p.text).slice(0, 100) : 'Viens voir sa nouvelle publication.', tag: 'wg-post-' + p.id, hash: '#/social' }), jwts = {};
  const subject = 'https://' + JSON.parse(env.SA_JSON).project_id + '.firebaseapp.com';
  for (const s of subs) {
    if (BUDGET <= 1) break;
    const endpoint = g(s, 'endpoint'); if (!endpoint) continue;
    try {
      const aud = new URL(endpoint).origin; jwts[aud] = jwts[aud] || await vapidJwt(aud, vapid.pub, vapid.d, subject);
      const body = await encryptPayload(g(s, 'p256dh'), g(s, 'auth'), payload);
      const r = await F(endpoint, { method: 'POST', headers: { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'normal', Authorization: 'vapid t=' + jwts[aud] + ', k=' + vapid.pub }, body });
      if (r.status === 404 || r.status === 410) { const t = await token(env); await F('https://firestore.googleapis.com/v1/' + s.name, { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } }); }   // appareil désinscrit
    } catch (e) { console.log('Envoi impossible', String(e).slice(0, 200)); }
  }
}
async function run(env) {
  BUDGET = 44;
  const meta = await fsGet(env, 'meta/push'), last = g(meta, 'lastAt');
  if (!last) { await fsPatch(env, 'meta/push', { lastAt: Date.now() }); return; }   // première exécution : on n'envoie rien pour l'existant
  const docs = await fsQuery(env, { from: [{ collectionId: 'posts' }], where: { fieldFilter: { field: { fieldPath: 'at' }, op: 'GREATER_THAN', value: { integerValue: String(last) } } }, orderBy: [{ field: { fieldPath: 'at' }, direction: 'ASCENDING' }], limit: 10 });
  if (!docs.length) return;
  const vapid = await getVapid(env, meta);
  for (const d of docs) {
    if (BUDGET < 10) break;   // le reste sera traité à la minute suivante
    const p = { id: idOf(d), uid: g(d, 'uid'), at: g(d, 'at'), review: g(d, 'review'), text: g(d, 'text') };
    await fsPatch(env, 'meta/push', { lastAt: p.at });   // marqué avant l'envoi : jamais de doublon
    if (p.review === true || !p.uid) continue;           // photo douteuse : pas de notification
    await notifyPost(env, p, vapid);
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (url.pathname === '/vapid') {   // clé publique, lue par l'appli au moment d'activer les notifications
      try { const v = await getVapid(env); return new Response(v.pub, { headers: { ...cors, 'Content-Type': 'text/plain', 'Cache-Control': 'public, max-age=3600' } }); }
      catch (e) { return new Response('Erreur : ' + e.message, { status: 500, headers: cors }); }
    }
    return new Response('WeakGym push : en ligne', { headers: cors });
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(run(env).catch(e => console.log('Erreur', String(e)))); }
};
