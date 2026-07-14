
# Plan d'améliorations

Basé sur tes choix (UX & design + Collaboration & partage) plus mes suggestions.

## 1. UX & design de la liste des rapports
- Cartes de rapport plus soignées : vignette de la 1re image en aperçu, badge date, nom de l'auteur avec avatar.
- Filtres rapides : « Mes rapports » / « Tous », plus filtre par auteur.
- Compteur de résultats et état vide illustré quand la recherche ne renvoie rien.
- En-têtes de mois « collants » (sticky) lors du scroll.

## 2. Mise en page PDF plus pro
- Page de couverture avec titre, date en toutes lettres, auteur.
- En-tête/pied de page sur chaque page (titre du rapport à gauche, pagination « 2 / 8 » à droite).
- Images légendées centrées avec cadre léger + légende en italique.
- Puces avec vrai retrait et interligne aéré, éviter les coupures de section en bas de page.

## 3. Collaboration & partage
- **Bouton « Dupliquer »** sur un rapport (copie titre + sections + puces, sans les images, prêt à éditer).
- **Lien de partage en lecture seule** : jeton unique par rapport → route publique `/share/:token` affichant le rapport sans nav ni édition. Révocable depuis la page rapport.
- **Export en un clic** : bouton « Télécharger le PDF » déjà présent, ajouter « Copier le lien de partage ».

## 4. Suggestions supplémentaires (mes ajouts)
- **Autosave brouillon** dans le formulaire (localStorage) pour ne rien perdre en cas de fermeture accidentelle.
- **Réordonnancement** des sections et des puces par flèches ↑ ↓ (simple, pas de drag & drop pour rester léger).
- **Aperçu image en grand** (lightbox) déjà présent — j'ajoute la navigation clavier ← → entre images.
- **Indicateur de sauvegarde** (« Enregistré à 14:32 ») après un enregistrement réussi.

## Détails techniques
- Nouvelle colonne `reports.share_token` (text, nullable, unique) + politique RLS `SELECT` publique quand `share_token = <param>`.
- Route publique `src/routes/share.$token.tsx` (SSR autorisé, pas de garde d'auth).
- Server fn `duplicateReport` sous `_authenticated` qui recopie sections + bullets.
- Refonte `pdf-utils.tsx` : page de couverture + `Page` fixe avec `fixed` header/footer via `@react-pdf/renderer`.
- Composant `ReportCard` extrait pour la liste, avec vignette signée via URL déjà résolue côté serveur.

## Ce que je NE change pas
- La logique métier de génération/édition existante.
- Le schéma de sections/puces/images.
- Les règles RLS déjà durcies (auteur uniquement).

Dis-moi si je retire, ajoute ou réordonne des points avant que je passe en build.
