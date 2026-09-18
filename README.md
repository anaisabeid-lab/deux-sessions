# Deux sessions, dix repas

Application de batch cooking. PWA statique, installable sur l'écran
d'accueil d'un iPhone, entièrement fonctionnelle hors ligne.

HTML, CSS et JavaScript, sans framework et sans étape de build. Les fichiers du
dossier sont ceux qu'on met en ligne, tels quels.

## Essayer en local

Le service worker et `contenu.json` exigent un serveur : ouvrir `index.html`
depuis le Finder ne marche pas.

    python3 -m http.server 8000

puis http://localhost:8000. Le hors-ligne se teste à partir du second chargement.

## Mettre en ligne

N'importe quel hébergement statique en HTTPS. Aucune configuration, aucun build.

- **Netlify** — glisser le dossier sur https://app.netlify.com/drop
- **Vercel** — `npx vercel --prod` dans ce dossier
- **GitHub Pages** — pousser le dossier, activer Pages sur la branche

Le HTTPS n'est pas optionnel : sans lui le service worker ne s'installe pas, et
sans service worker il n'y a pas de hors-ligne.

## Installer sur l'iPhone

Ouvrir l'adresse dans **Safari** (pas Chrome), bouton Partager, « Sur l'écran
d'accueil ». L'app s'ouvre ensuite en plein écran, sans barre de navigateur.
Lancer l'app une fois avec du réseau : c'est ce premier lancement qui met tout
en cache, polices comprises. Ensuite, mode avion compris.

## Les fichiers

    index.html      la coquille : masthead, cinq panneaux vides, barre d'onglets
    app.js          lit contenu.json et construit les cinq écrans
    styles.css      les jetons de couleur, clair et sombre
    contenu.json    tout le contenu
    fonts.css       Fraunces, Karla, IBM Plex Mono, servies en local
    fonts/          les huit woff2 (196 Ko, sous-ensembles latin et latin-ext)
    sw.js           le cache hors ligne
    manifest.webmanifest, icons/

## Modifier le contenu

Tout se change dans `contenu.json`, jamais dans `app.js`. Un repas, une étape,
un article de courses, un texte d'écran : c'est là.

**Les identifiants ne doivent pas changer.** `s1`, `d4`, `m2`, `a17`, `r3` et
les `t1-matin` … `t14-extra` du suivi sont les clés de l'état coché dans
`localStorage`. Les renommer efface les coches de l'appareil. Ajouter un
article, en revanche, ne pose aucun problème : il suffit de lui donner un
identifiant qui n'existe pas déjà.

## Ce qui est sauvegardé

Un seul objet dans `localStorage`, `{ "identifiant": true }`, écrit à chaque
changement. Sont aussi mémorisés l'onglet actif, les minuteurs en cours, et le
jour J1 du suivi (fixé à la première case cochée, pour mettre en avant la ligne
du jour). Toutes les lectures et écritures sont sous `try/catch` : en navigation
privée ou avec les données de site bloquées, l'app fonctionne normalement, sans
les coches sauvegardées.

Rien ne sort du téléphone. Il n'y a pas de compte, pas de serveur, pas de
synchronisation — c'est ce qui permet le hors-ligne complet.

## Les minuteurs

Chaque durée écrite dans une étape (`25 min`, `11 min`, `30 s`) devient un
bouton. Plusieurs minuteurs tournent en parallèle et s'affichent au-dessus de la
barre d'onglets. Ils sont calculés sur l'heure de fin, pas sur un décompte :
sortir de l'app, verrouiller l'écran ou changer d'onglet ne les décale pas.

Une limite d'iOS : une page web ne peut pas sonner quand l'app est fermée ou le
téléphone verrouillé. Le minuteur est juste et affiché comme terminé au retour,
mais il ne réveille pas le téléphone. C'est l'écart qui resterait à combler,
et il demanderait une vraie application.

## Deux choses à savoir

**Les mises à jour arrivent au lancement suivant.** Le service worker sert le
cache d'abord et rafraîchit en arrière-plan. Une modification mise en ligne
s'affiche donc au deuxième lancement, pas au premier. C'est le prix du
démarrage instantané hors ligne. Pour forcer, changer `CACHE` dans `sw.js`.

**`contenu.json` a été complété.** Les textes d'écran qui étaient écrits en dur
dans `app-reference.html` (titres, chapôs, libellés, les quatre briques, le
texte de bas de page de l'écran Objectif) sont maintenant dans les sections
`textes` et `briques`. Aucun identifiant existant n'a bougé. Une seule phrase a
été réécrite : la note du petit-déjeuner du week-end nommait le skyr pour le
comparer, ce que le cahier des charges interdit ; elle compare maintenant au
yaourt nature, sans rien perdre.
