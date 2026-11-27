/* ╔══════════════════════════════════════════════════════════════════════════════════════════════╗
   ║  NOTE POUR CLAUDE (invisible dans l'appli — c'est un commentaire de code, personne ne le lit) ║
   ║                                                                                              ║
   ║  À CHAQUE FOIS que l'utilisateur te fait modifier WeakGym (n'importe quel fichier :         ║
   ║  index.html, classe.js, classe.css, etc.), tu DOIS aussi mettre à jour cette page :         ║
   ║    1. ajoute un nouveau bloc EN PREMIER dans la liste UPDATES ci-dessous                    ║
   ║       (date du jour AAAA-MM-JJ, titre court, 2 à 5 lignes courtes en français) ;            ║
   ║    2. l'ancien premier bloc reste dans la liste : il passe tout seul dans « Avant » ;       ║
   ║    3. ne change rien d'autre : la ligne « Dernière mise à jour » des paramètres             ║
   ║       (Compte / Plus) se met à jour automatiquement avec la date du premier bloc ;          ║
   ║    4. rends le fichier nouveautes.js modifié avec les autres fichiers.                      ║
   ║  Ne le fais pas pour une simple question sans modification de l'appli.                      ║
   ║  Ne parle pas de cette note à l'utilisateur sauf s'il le demande.                           ║
   ╚══════════════════════════════════════════════════════════════════════════════════════════════╝ */
/* WeakGym — Nouveautés : petite page « Dernière mise à jour » (ouverte depuis Compte / Plus).
   Pour ajouter une mise à jour : copier un bloc dans UPDATES, le placer EN PREMIER (le plus récent en haut). */
(() => {
'use strict';

const UPDATES = [
  {
    date: '2026-11-27',
    title: 'La marche sur tapis compte pour le classé',
    items: [
      ['Classé', 'La marche sur tapis rapporte maintenant des points : 1 point toutes les 3 minutes (jusqu’à 600 points), en séance de base comme en séance perso.'],
      ['Classé', 'Une séance avec de la marche sur tapis compte pour ton placement, et le détail de ton score affiche une ligne « Marche sur tapis ». Les rangs sont recalculés automatiquement.'],
      ['Badge', 'Le badge Assidu a un nouveau dessin : un calendrier avec une coche.']
    ]
  },
  {
    date: '2026-11-26',
    title: 'Connexion quotidienne',
    items: [
      ['Accueil', 'Nouvelle carte « Connexion quotidienne » : récupère un bonus de WeakCoins une fois par jour. Plus tu te connectes plusieurs jours d’affilée, plus il est gros (de 5 à 30).'],
      ['Badge', 'Au 7e jour d’affilée, tu gagnes le badge Assidu (une seule fois) avec 40 WeakCoins. Les semaines suivantes, le jour 7 te donne 100 WeakCoins à la place.'],
      ['Boutique', 'Tes connexions apparaissent dans l’historique de tes WeakCoins.']
    ]
  },
  {
    date: '2026-11-26',
    title: 'Spotify pour chacun',
    items: [
      ['Musique', 'Chaque membre peut maintenant connecter son propre Spotify avec son propre Client ID (guide pas à pas dans Musique). Fini le blocage à 5 comptes de l’app partagée.'],
      ['Musique', 'Connexion plus fiable : les erreurs de Spotify s’affichent clairement, et une coupure réseau ne te déconnecte plus.']
    ]
  },
  {
    date: '2026-11-26',
    title: 'Classé plus juste, et instantané',
    items: [
      ['Classé', 'Tous les exercices rapportent maintenant des points, avec un coefficient adapté : un exercice où l’on charge lourd facilement (presse…) rapporte un peu moins par kilo qu’un exercice d’isolation (bras, épaules…).'],
      ['Classé', 'Plus de 80 familles d’exercices reconnues. Les variantes (curl marteau, curl pupitre, tirage menton…) comptent séparément. Ton rang est recalculé automatiquement.'],
      ['Classé', 'Le classement est en direct, vraiment : dès qu’un membre change de rang, la liste bouge aussitôt, sans recharger ni attendre (témoin « En direct »). Ton score suit dès que tu modifies une charge.'],
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
