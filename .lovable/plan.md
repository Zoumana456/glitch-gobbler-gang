# Menus latéraux détachés par module + app « Hiérarchie »

## Objectif

Chaque application a son propre menu latéral, uniquement ses écrans. Pour changer d'app, on passe par « Applications » (le lanceur). Plus aucun mélange d'apps dans la barre latérale.

## Ce qui change

1. **Suppression du bloc « Autres applications »** dans la barre latérale. Le menu ne contient plus que : « Applications » (retour au lanceur) + les écrans de l'app courante (+ « Admin plateforme » si super admin). Le bas du menu (profil, notifications, vérification d'identité, déconnexion) reste inchangé.
2. **Suppression des raccourcis ajoutés** : les petites puces d'écrans sous chaque tuile du lanceur `/apps`, et le bouton « Organigramme » ajouté dans l'en-tête de la page Entreprise. Les tuiles redeviennent de simples cartes cliquables.
3. **Nouvelle app « Hiérarchie »** dans le lanceur, avec son propre menu latéral :
   - Organigramme (`/company/hierarchie`)
   - Vue direction (`/reports/direction`) — suivi des validations hiérarchiques
   L'Organigramme sort du menu Entreprise ; l'app Entreprise garde Entreprise + Gérer les applications.
4. **Palette de commandes (⌘K)** : conserve l'accès direct à tous les écrans, y compris Organigramme, quelle que soit l'app ouverte.

## Détails techniques

- `src/lib/modules/registry.ts` : ajout du module `hierarchy` (icône Network, entry `/company/hierarchie`, core, écrans Organigramme + Vue direction) ; retrait de l'écran Organigramme du module `company`. `moduleForPath` doit reconnaître `/company/hierarchie` comme `hierarchy` avant `company` (correspondance la plus longue d'abord, sinon `/company` capte la route).
- `src/routes/_authenticated/route.tsx` : suppression de `otherModules` et du bloc JSX correspondant ; le titre de section (nom de l'app courante) reste.
- `src/routes/_authenticated/apps.tsx` : suppression du calcul `extras` et des puces de raccourcis.
- `src/routes/_authenticated/company.tsx` : retrait du bouton « Organigramme » de l'en-tête.
- `src/components/CommandPalette.tsx` : entrées alignées sur le registre mis à jour.

## Vérification

Navigation dans chaque app (Rapports, PV, Tâches, Entreprise, Hiérarchie, Plans, Profil) : le menu latéral n'affiche que les écrans de l'app ouverte, le lanceur reste la seule porte d'entrée entre apps, aucune erreur console, tests et build verts.
