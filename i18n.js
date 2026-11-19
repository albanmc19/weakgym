/* WeakGym · moteur de langue
   - Les textes de l'appli restent écrits en français dans le code ; ce moteur les traduit à l'affichage
     grâce à i18n-dict.js (dictionnaire + motifs). Un texte sans traduction reste en français.
   - Langue : choix enregistré (wg_lang) > langue du navigateur (fr/en/de/es) > français.
   - API : WG.lang, WG.loc (ex. "en-GB", pour les dates), WG.LANGS, WG.set(code), WG.t(texte), WG.picker(afficher) */
(function () {
  'use strict';
  var LANGS = {fr: 'Français', en: 'English', de: 'Deutsch', es: 'Español'};
  var LOC = {fr: 'fr-FR', en: 'en-GB', de: 'de-DE', es: 'es-ES'};
  var COL = {en: 1, de: 2, es: 3};
  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  var SKIP = {SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, CODE: 1};

  var lang = '';
  try { lang = localStorage.getItem('wg_lang') || ''; } catch (e) {}
  if (!LANGS[lang]) {
    var nl = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'fr'];
    lang = 'fr';
    for (var i = 0; i < nl.length; i++) { var c = String(nl[i]).slice(0, 2).toLowerCase(); if (LANGS[c]) { lang = c; break; } }
  }

  var norm = function (s) { return String(s).replace(/\s+/g, ' ').trim(); };
  var MAP = new Map();
  (window.WG_DICT || []).forEach(function (r) { MAP.set(norm(r[0]), r); });
  var PAT = window.WG_PAT || [];

  function lookup(core) {
    var r = MAP.get(core);
    if (r) return r[COL[lang]] || null;
    for (var i = 0; i < PAT.length; i++) if (PAT[i][0].test(core)) return core.replace(PAT[i][0], PAT[i][COL[lang]]);
    return null;
  }
  function tr(s) {
    if (lang === 'fr' || typeof s !== 'string') return s;
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), core = norm(m[2]);
    if (!core) return s;
    var out = lookup(core);
    return out == null ? s : m[1] + out + m[3];
  }

  /* ---- DOM ---- */
  var orig = new WeakMap(), last = new WeakMap();
  function skip(el) {
    if (!el || el.nodeType !== 1) return false;
    if (SKIP[el.tagName]) return true;
    return !!(el.closest && el.closest('[data-notr]'));
  }
  function doText(n) {
    var cur = n.nodeValue, o;
    if (last.has(n) && last.get(n) === cur) o = orig.get(n);          // notre propre écriture
    else { o = cur; orig.set(n, cur); }                                // texte écrit par l'appli
    var out = lang === 'fr' ? o : tr(o);
    if (out !== cur) n.nodeValue = out;
    last.set(n, out);
  }
  function doAttrs(el, only) {
    var list = only ? [only] : ATTRS;
    for (var i = 0; i < list.length; i++) {
      var a = list[i], cur = el.getAttribute && el.getAttribute(a);
      if (cur == null) continue;
      var st = el.__wg || (el.__wg = {}), e = st[a], o;
      if (e && e.l === cur) o = e.o; else o = cur;
      var out = lang === 'fr' ? o : tr(o);
      if (out !== cur) el.setAttribute(a, out);
      st[a] = {o: o, l: out};
    }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { if (!skip(root.parentNode)) doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (skip(root)) return; doAttrs(root); }
    var tw = document.createTreeWalker(root, 4), n;
    while ((n = tw.nextNode())) if (!skip(n.parentNode)) doText(n);
    if (root.querySelectorAll) {
      var els = root.querySelectorAll('[placeholder],[aria-label],[title],[alt]');
      for (var k = 0; k < els.length; k++) if (!skip(els[k])) doAttrs(els[k]);
    }
  }

  var mo = null;
  function ensureObserver() {
    if (mo || !window.MutationObserver) return;
    mo = new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if (m.type === 'childList') { for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]); }
        else if (m.type === 'characterData') { if (!skip(m.target.parentNode)) doText(m.target); }
        else if (m.type === 'attributes') { if (!skip(m.target)) doAttrs(m.target, m.attributeName); }
      }
    });
    mo.observe(document.documentElement, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS});
  }

  function set(l) {
    if (!LANGS[l]) return false;
    lang = l; WG.lang = l; WG.loc = LOC[l];
    try { localStorage.setItem('wg_lang', l); } catch (e) {}
    document.documentElement.lang = l;
    ensureObserver();
    walk(document.documentElement);
    return true;
  }

  /* petit sélecteur de langue dans l'en-tête (visiteurs non connectés) */
  function picker(show) {
    var h = document.querySelector('header'); if (!h) return;
    var s = document.getElementById('lgsel');
    if (!s) {
      s = document.createElement('select'); s.id = 'lgsel'; s.setAttribute('data-notr', ''); s.setAttribute('aria-label', 'Langue');
      s.style.cssText = 'width:auto;flex:none;padding:6px 10px;font-size:14px;border-radius:99px';
      Object.keys(LANGS).forEach(function (k) { s.appendChild(new Option(LANGS[k], k)); });
      s.onchange = function () { set(s.value); location.reload(); };
      h.appendChild(s);
    }
    s.value = lang; s.hidden = !show;
  }

  /* alert / confirm / prompt traduits */
  ['alert', 'confirm', 'prompt'].forEach(function (f) {
    var o = window[f]; if (!o) return;
    window[f] = function (m, d) { return o.call(window, typeof m === 'string' ? tr(m) : m, d); };
  });

  var WG = window.WG = {lang: lang, loc: LOC[lang], LANGS: LANGS, set: set, t: tr, picker: picker};
  document.documentElement.lang = lang;
  if (lang !== 'fr') {
    ensureObserver();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { walk(document.documentElement); });
    else walk(document.documentElement);
  }
})();
