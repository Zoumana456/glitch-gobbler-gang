# Retrouver l'Organigramme + vérification de bout en bout

## Ce qui se passe

L'écran Organigramme existe toujours (`/company/hierarchie`) et il est bien déclaré dans le registre des applications, sous l'app « Entreprise ». Le problème vient du nouveau menu façon Odoo : la barre latérale n'affiche que les écrans de l'application courante. Depuis `/apps`, `/reports` ou `/tasks`, c'est le menu de « Rapports » qui s'affiche, donc « Organigramme » disparaît jusqu'à ce qu'on ouvre l'app Entreprise.

## Corrections proposées

1. **Menu plus lisible** : afficher, sous les écrans de l'app courante, un bloc « Autres applications » listant les apps activées (Rapports, Procès-verbaux, Tâches, Entreprise, Plans, Profil) pour qu'aucune section ne semble avoir disparu.
2. **Nom de l'app courante** : afficher un en-tête de section avec le nom de l'app en cours dans la barre latérale, pour rendre le comportement compréhensible.
3. **Accès direct à l'Organigramme** : sur la page Entreprise et dans la tuile Entreprise du lanceur, garder un bouton explicite vers l'Organigramme.
4. **Palette de commandes** : s'assurer que la recherche (⌘K) propose « Organigramme », « Applications » et « Tâches ».

## Vérification de bout en bout

Parcours vérifiés en navigateur, connecté, sur desktop et mobile (393 px) :

- Connexion, arrivée sur `/apps`, ouverture de chaque tuile.
- Rapports : liste, création, détail, soumission, validation hiérarchique, export PDF, partage public.
- Procès-verbaux : liste, création, détail.
- Tâches : liste, création, changement de statut, commentaire, notification.
- Entreprise : suivi quotidien, employés, Organigramme, page Applications (activation/désactivation d'un module et effet réel sur le menu et les routes).
- Plans, Profil, Notifications, Admin plateforme (si super admin).
- Contrôle des erreurs console/réseau à chaque étape, plus les tests automatisés existants et le build de production.

Chaque anomalie trouvée est corrigée dans la même passe, puis re-vérifiée.

## Détails techniques

- `src/routes/_authenticated/route.tsx` : ajout du bloc « Autres applications » + titre de section, construit depuis `visibleModules()`; aucun changement de logique d'accès.
- `src/routes/_authenticated/company.tsx` et `apps.tsx` : liens directs vers `/company/hierarchie`.
- `src/components/CommandPalette.tsx` : entrées alignées sur le registre des modules.
- Vérification via scripts Playwright jetables + `vitest` + build.
