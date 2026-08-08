# Vérification responsive mobile — corrections ciblées

## Ce que j'ai vérifié

J'ai chargé l'application en largeur téléphone (393 px) sur les pages : accueil, tarifs, connexion, rapports, entreprise, hiérarchie, PV, plans, audit des rôles, direction, équipe.

Bonne nouvelle : **aucune page ne déborde horizontalement** (pas de scroll latéral parasite) et aucune erreur console n'est apparue. La navigation mobile (menu hamburger + en-tête collant) fonctionne.

## Problèmes réellement constatés

1. **Tableaux écrasés (le plus visible).** Sur la page Entreprise / suivi quotidien, les en-têtes se collent et deviennent illisibles : « EmployéEmailStatut ». Cause confirmée dans le code : les tableaux sont dans un conteneur `overflow-x-auto` mais gardent `w-full`, donc ils se compressent au lieu de défiler. Même schéma dans l'espace admin (Utilisateurs, Factures) et sur la page Audit des rôles (colonne « Rapports lus » coupée).
2. **Ligne de filtre date sur la hiérarchie** : les boutons « Hier / Aujourd'hui » + le champ date tiennent tout juste et le champ est très étroit.
3. **Filtres de mois sur la liste des rapports** : les deux sélecteurs (largeur fixe 170 px) tiennent de justesse et le libellé « Jusqu'à aujourd'hui » est tronqué.
4. **En-têtes de page** : titre + badges + bouton s'empilent correctement, mais sans la structure grille recommandée, un nom d'entreprise long risque de pousser la mise en page.

## Corrections proposées

### 1. Tableaux lisibles sur mobile
- Donner une largeur minimale aux tableaux (`min-w-[720px]`) dans leur conteneur défilant + `whitespace-nowrap` sur les en-têtes, pour un défilement horizontal propre au lieu d'un écrasement.
- Ajouter un indicateur visuel discret de défilement (dégradé sur le bord droit) pour signaler qu'on peut faire glisser.
- Pages concernées : Entreprise (2 tableaux), Audit des rôles, Admin → Utilisateurs, Admin → Factures.

### 2. Filtres et barres d'action
- Hiérarchie : passer la ligne de filtre date en pile sur mobile (boutons sur une ligne, champ date pleine largeur), rangée en `sm:` comme aujourd'hui.
- Liste des rapports : sélecteurs de mois en pleine largeur sur mobile (`w-full sm:w-[170px]`), la flèche « → » masquée en dessous de `sm`.

### 3. En-têtes de page robustes
- Appliquer le schéma grille recommandé aux en-têtes (titre + actions) des pages Rapports, Entreprise, Hiérarchie, Plans : `grid-cols-[minmax(0,1fr)_auto]` sur mobile, `flex` à partir de `sm:`, avec `min-w-0` / `truncate` sur les textes longs.

### 4. Contrôle final
Nouvelle passe automatisée à 393 px (et 360 px) sur toutes les pages avec captures, pour confirmer l'absence de débordement et la lisibilité des tableaux.

## Détails techniques
Modifications purement front-end (classes Tailwind), aucun changement de logique métier, de requêtes ni de base de données. Fichiers touchés : `src/routes/_authenticated/company.tsx`, `company.hierarchie.tsx`, `reports.index.tsx`, `reports.audit-roles.tsx`, `plans.tsx`, `src/components/admin/UsersPanel.tsx`, `src/components/admin/InvoicesPanel.tsx`.
