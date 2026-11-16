# Portfolio · Mattéo Vandenesse — VDN Social Studio

Site statique (HTML/CSS/JS, sans build). Déployé automatiquement par Cloudflare (Workers) à chaque mise à jour de la branche `main`.

- `index.html` : la page du portfolio (direction A). Données dans le script en bas de page :
  `PROJECTS`, `LIVE` (Bord terrain), `POSTS` (posts LinkedIn et stories), `F` (fiches projets, ouvertes avec `?p=`) et `ORD` (ordre des fiches).
- Version anglaise : dictionnaire `EN` (+ `EN2` pour les textes de la direction A). Clé = texte français exact.
- `fonts/figtree.woff2` : police Figtree (licence SIL Open Font License), servie depuis le site.
- `media/` : images, vidéos et CV.
- `tunnel.js` et `vendor/three/` : ancienne DA « Le Tunnel », plus utilisés par la page mais conservés.
