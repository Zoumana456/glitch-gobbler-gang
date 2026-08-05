# Vérification du mapping des rôles + repli des mois passés

## 1. Audit du mapping hiérarchique (vérifié en base)

Ce que fait réellement la règle d'accès `is_manager_of(viewer, auteur)` :

- vrai si le viewer est dans la chaîne des supérieurs de l'auteur (`manager_id`, jusqu'à 10 niveaux) ;
- vrai si le viewer est le propriétaire de l'entreprise de l'auteur ;
- faux sinon.

Elle est utilisée par : lecture des rapports de la branche (`reports`), lecture du journal de validation (`report_approvals`), et mise à jour par le valideur en cours. Les droits d'exécution sont bien accordés au rôle connecté et au rôle serveur (l'erreur « permission denied » précédente est résolue).

Écart trouvé, à corriger :

- Un **DG / Président de niveau 1 qui n'est pas le propriétaire du compte entreprise** ne voit rien en base, alors que l'application (organigramme, KPIs direction) le considère comme voyant toute l'entreprise. Cas typique : l'entreprise a été créée par un assistant/administrateur, puis le DG a été rattaché ensuite.
- Vice-DG et responsables : conformes, ils ne voient que leur branche descendante. Pas de changement.
- Les employés ne voient que leurs propres rapports. Pas de changement.

Correction proposée : étendre la règle pour qu'un membre de **niveau 1** de la même entreprise soit reconnu comme supérieur de tous les membres de cette entreprise, en plus du propriétaire. La logique applicative (`visibleMembers`) devient alors strictement alignée avec la base.

## 2. Rapports des mois passés masqués par défaut

Sur la page Rapports, les rapports sont déjà regroupés par mois. Changement :

- le mois en cours reste ouvert ;
- chaque mois antérieur s'affiche comme un en-tête cliquable replié (mois, année, nombre de rapports) et se déplie au clic ;
- l'état déplié/replié est conservé pendant la navigation dans la page ;
- une recherche active déplie automatiquement les mois qui contiennent des résultats, pour ne rien cacher.

## Détails techniques

- Migration : `CREATE OR REPLACE FUNCTION app_private.is_manager_of` ajoutant une branche « membre de niveau 1 de la même entreprise » (via `company_members.hierarchy_level = 1` et même `company_id`), en conservant `SECURITY DEFINER`, `search_path = public` et les grants existants. Aucune politique RLS n'est modifiée, aucune donnée touchée.
- UI : `src/routes/_authenticated/reports.index.tsx` — ajout d'un état `openMonths: Set<string>` initialisé au mois courant, `<Collapsible>` (shadcn) autour de la grille de chaque groupe, ouverture forcée quand `search` est non vide.
