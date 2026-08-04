# Suivi des rapports par hiérarchie d'entreprise

Objectif : structurer l'entreprise en niveaux hiérarchiques, faire remonter les rapports par validation en cascade, et donner à chaque niveau un tableau de bord de suivi.

## 1. Niveaux hiérarchiques fixes

Quatre niveaux, du plus haut au plus bas :

| Niveau | Rôle | Facultatif |
|---|---|---|
| 1 | Direction générale (DG / Président) | non — c'est le créateur de l'entreprise |
| 2 | Direction adjointe (Vice-DG / Vice-président) | oui |
| 3 | Responsable (chef de service / département) | oui |
| 4 | Employé | — |

Chaque membre reçoit en plus :
- un **intitulé de poste** affiché (ex. « Responsable RH »), libre en texte,
- un **supérieur direct** choisi parmi les membres d'un niveau strictement supérieur,
- un **département** optionnel (texte) pour regrouper les équipes.

Règles appliquées côté serveur :
- un employé ne peut être rattaché qu'à un niveau au-dessus de lui,
- pas de boucle dans l'organigramme (A → B → A interdit),
- si un manager est supprimé/banni, ses subordonnés remontent automatiquement à son propre supérieur,
- seul le DG (et l'administration plateforme) peut changer les niveaux ; un responsable peut seulement rattacher/détacher les membres de sa propre équipe.

## 2. Circuit de validation du rapport

Statuts du rapport : `brouillon` → `soumis` → `validé` (ou `rejeté`).

```text
Employé rédige (brouillon)
   -> soumet
Responsable (N3) : valide ou rejette avec commentaire
   -> si validé, remonte
Direction adjointe (N2) : valide ou rejette
   -> si validé, remonte
DG (N1) : validation finale
```

- Le rapport remonte au **supérieur direct** de l'auteur, puis niveau par niveau jusqu'au DG. S'il manque un niveau (pas de Vice-DG), le rapport passe directement au niveau suivant existant.
- Un **rejet** renvoie le rapport à l'auteur en statut « à corriger » avec le commentaire du valideur, et l'auteur peut le resoumettre.
- Chaque étape est journalisée (qui, quand, décision, commentaire) et visible dans un fil de validation sur la page du rapport.
- Un valideur ne peut jamais valider son propre rapport ; le rapport du DG est auto-validé.

## 3. Rapports de synthèse (consolidation)

Un responsable ou une direction adjointe peut générer un **rapport de synthèse** (jour ou semaine) qui agrège les rapports validés de son équipe :
- sélection de la période et des membres inclus,
- reprise automatique des points clés de chaque rapport, éditables,
- rédaction assistée par l'IA déjà en place pour produire la synthèse,
- la synthèse suit ensuite le même circuit de validation vers le niveau supérieur,
- export PDF avec la liste des rapports sources en annexe.

## 4. Trois vues de suivi

**Organigramme** (`/company/hierarchie`) — arbre de l'entreprise. Chaque carte affiche la personne, son poste, son niveau et l'état de son rapport du jour : remis, en retard, en attente de validation, validé. Glisser-déposer réservé au DG pour réorganiser les rattachements.

**Mon équipe** (`/reports/equipe`) — pour tout membre ayant des subordonnés : file des rapports à valider (avec actions valider/rejeter), taux de remise de l'équipe, membres en retard et bouton de relance.

**Vue direction** (`/reports/direction`) — pour le DG et les directions adjointes : KPIs consolidés par département et par niveau — taux de remise, nombre de retards, délai moyen de validation, rapports bloqués en attente — avec filtre de période et export.

## 5. Impacts sur l'existant

- La liste des rapports affiche désormais un badge de statut et un filtre par statut ; « Nouveau rapport » crée un brouillon.
- La visibilité des rapports s'élargit : un manager voit les rapports de toute sa branche (subordonnés directs et indirects), en plus des partages nominatifs déjà en place.
- Les liens de partage publics, les PV de réunion, les plans et l'espace super admin ne changent pas.
- Les rapports et entreprises existants sont préservés : les rapports déjà créés passent en statut « validé » pour ne pas apparaître comme en attente, et le propriétaire actuel de chaque entreprise devient DG.

## Détails techniques

Base de données (migrations) :
- `company_members` : ajout de `hierarchy_level` (1-4), `position_title`, `manager_id` (référence `company_members`), `department`. Le rôle actuel `owner`/`employee` est conservé pour la compatibilité ; `owner` est mappé sur le niveau 1.
- `reports` : ajout de `company_id`, `status` (`draft`/`submitted`/`in_review`/`approved`/`rejected`), `current_approver_id`, `submitted_at`, `approved_at`, `kind` (`individual`/`consolidated`), `period_start`/`period_end` pour les synthèses.
- Nouvelle table `report_approvals` : `report_id`, `approver_id`, `level`, `decision`, `comment`, `decided_at`.
- Nouvelle table `report_sources` : lien synthèse → rapports sources.
- Fonction `security definer` `is_manager_of(_manager uuid, _user uuid)` remontant récursivement la chaîne `manager_id`, utilisée par les policies RLS pour la lecture de branche et le droit de validation. GRANT explicites sur chaque nouvelle table.
- Trigger de validation empêchant les cycles de rattachement et les niveaux incohérents.

Application :
- `src/lib/hierarchy.functions.ts` : lecture de l'organigramme, mise à jour niveau/poste/rattachement.
- `src/lib/reports.functions.ts` : `submitReport`, `approveReport`, `rejectReport`, `listPendingApprovals`, `getBranchReports`, `createConsolidatedReport`.
- `src/lib/reports.types.ts` : statuts, niveaux et types de l'organigramme.
- Nouveaux composants : `HierarchyTree`, `ApprovalTimeline`, `ApprovalActions`, `TeamComplianceTable`, `DirectionKpis`.
- Nouvelles routes sous `_authenticated/` : `company.hierarchie`, `reports.equipe`, `reports.direction`, avec entrées de sidebar affichées selon le niveau du membre.
- Le PDF reprend le poste et le niveau de l'auteur ainsi que le fil de validation.

## Ordre de livraison suggéré

1. Migration hiérarchie + statuts de rapports + policies, avec reprise des données existantes.
2. Gestion de la hiérarchie et vue organigramme.
3. Circuit de validation (soumission, validation, rejet, fil d'historique).
4. Vue « Mon équipe » et vue direction.
5. Rapports de synthèse consolidés + export PDF.
