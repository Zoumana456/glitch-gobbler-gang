# DailyBrief en plateforme modulaire (style Odoo)

Oui, c'est possible : au lieu d'une seule application « rapports », DailyBrief devient une plateforme avec un écran d'accueil de tuiles d'applications, des modules activables par entreprise, et de nouveaux modules métier ajoutés un par un.

## 1. Socle modulaire (à faire d'abord)

- **Registre de modules** : un fichier unique décrit chaque app (code, nom, icône, couleur, route d'entrée, description, niveau requis, plan minimum). Le menu latéral et le lanceur sont générés à partir de ce registre, plus de liste codée en dur.
- **Lanceur d'applications** `/apps` : grille de tuiles (Rapports, Procès-verbaux, Entreprise, Organigramme, Plans, + futurs modules), avec recherche rapide. Devient l'écran d'arrivée après connexion.
- **Activation par entreprise** : chaque entreprise active/désactive ses modules. Un module non activé n'apparaît ni dans le lanceur ni dans le menu, et ses routes redirigent vers `/apps` avec un message.
- **Réglages** : le propriétaire/DG gère les modules dans une page « Applications » de l'espace Entreprise ; le super admin peut forcer l'activation et voir l'usage par entreprise.
- **Menu regroupé** : le menu latéral affiche l'app courante et ses écrans, avec un bouton pour revenir au lanceur (comportement Odoo).

## 2. Nouveaux modules métier (ajout progressif)

Chaque module suit le même patron : tables dédiées, RLS par entreprise et hiérarchie, écran liste + détail, workflow de validation réutilisant le circuit hiérarchique déjà en place, notifications, export PDF quand pertinent.

Ordre proposé :

1. **Tâches / Projets** — tâches assignées, échéances, statut, lien vers un rapport.
2. **Congés & Absences** — demande, validation par le manager (circuit existant), solde, calendrier d'équipe.
3. **Présences** — pointage arrivée/départ, feuille de temps mensuelle, récap par employé.
4. **Dépenses** — note de frais avec justificatif, validation, total par période.
5. **Annuaire / RH** — fiches employés étendues (déjà partiellement présent via l'organigramme).

On implémente le socle + le module « Tâches » dans la première étape, puis les suivants un par un pour garder l'app stable.

## Détails techniques

- Registre : `src/lib/modules/registry.ts` (métadonnées + `Link` typés TanStack). Le menu de `src/routes/_authenticated/route.tsx` et la nouvelle route `src/routes/_authenticated/apps.tsx` le consomment.
- Base : table `company_modules` (`company_id`, `module_code`, `enabled`, `enabled_at`) avec GRANT + RLS (lecture par membres de l'entreprise, écriture par owner/DG et super admin) ; `subscription_plans.features` sert de plafond par plan.
- Garde d'accès : un helper `requireModule(code)` côté route (`beforeLoad`) plus vérification serveur dans les server functions du module, afin que désactiver un module coupe réellement les données.
- Module Tâches : tables `tasks` (+ `task_comments`), server functions `src/lib/tasks.functions.ts`, routes `/tasks`, `/tasks/new`, `/tasks/$id`, notifications réutilisant `notifications.server.ts`.
- Les modules existants (rapports, PV, entreprise, plans, admin) ne sont pas déplacés : seules leurs entrées de menu passent par le registre. Aucune donnée existante n'est modifiée.

## Hors périmètre pour l'instant

- Paiement réel des plans (toujours « en cours de développement »).
- Studio de personnalisation type Odoo (champs personnalisés créés par l'utilisateur).
