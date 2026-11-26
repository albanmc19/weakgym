/* WeakGym — Nouveautés : petite page « Dernière mise à jour » (ouverte depuis Compte / Plus).
   Pour ajouter une mise à jour : copier un bloc dans UPDATES, le placer EN PREMIER (le plus récent en haut). */
(() => {
'use strict';

const UPDATES = [
  {
    date: '2026-11-26',
    title: 'Classé plus juste, et en direct',
    items: [
      ['Classé', 'Tous les exercices rapportent maintenant des points, avec un coefficient adapté : un exercice où l’on charge lourd facilement (presse…) rapporte un peu moins par kilo qu’un exercice d’isolation (bras, épaules…).'],
      ['Classé', 'Plus de 80 familles d’exercices reconnues. Les variantes (curl marteau, curl pupitre, tirage menton…) comptent séparément. Ton rang est recalculé automatiquement.'],
      ['Classé', 'Le classement se met à jour en temps réel, sans recharger la page (témoin « En direct »).'],
      ['Compte', 'Nouvelle page Nouveautés pour suivre les changements de l’application.']
    ]
  }
];

const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString((window.WG && WG.loc) || 'fr-FR', {day: 'numeric', month: 'long', year: 'numeric'});
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

const block = (u, open) => `<${open ? 'div class="card nw-card"' : 'details class="card nw-old"'}>
  ${open ? '' : `<summary><b>${esc(u.title)}</b> <span class="mute">· ${esc(fmt(u.date))}</span></summary>`}
  ${open ? `<span class="kicker">Dernière mise à jour · ${esc(fmt(u.date))}</span><h2 class="nw-t">${esc(u.title)}</h2>` : ''}
  <ul class="nw-l">${u.items.map(([t, x]) => `<li><span class="nw-tag">${esc(t)}</span><span>${esc(x)}</span></li>`).join('')}</ul>
</${open ? 'div' : 'details'}>`;

function nouveautesPage() {
  const [last, ...old] = UPDATES;
  app.innerHTML = `<p style="margin:0"><a class="link" href="#/plus" style="padding-left:0">← Compte</a></p><h1 style="margin-top:0">Nouveautés</h1>
    ${block(last, true)}
    ${old.length ? `<h2>Avant</h2>${old.map(u => block(u, false)).join('')}` : ''}`;
}

window.nouveautesPage = nouveautesPage;
window.wgNews = {label: fmt(UPDATES[0].date), date: UPDATES[0].date};
})();
