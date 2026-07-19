## Objectifs

1. Retirer la vérification KYC de l'espace super-admin.
2. Ajouter un espace « Plans » côté entreprise (après connexion) pour consulter et choisir un plan.
3. Retirer la barre de recherche de l'onglet Utilisateurs de l'admin et ajouter une recherche globale dans l'onglet Dashboard.
4. Permettre au super-admin de supprimer ou bannir un utilisateur (compte + accès) depuis l'onglet Utilisateurs.

## 1. Retirer KYC de /admin

`src/routes/_authenticated/admin.tsx` :
- Supprimer l'onglet `verifications` (TabsTrigger + TabsContent) et la fonction `VerificationsPanel`.
- Retirer les imports `listVerificationRequests`, `reviewVerificationRequest`, `ShieldCheck` (si plus utilisé), et `RequestVerificationDialog` associés.
- Retirer la carte « Vérifications en attente » de `DashboardPanel.tsx` (rester sur 5 KPI).

Note : on garde en base la table `company_verification_requests` et les fonctions serveur (utilisées ailleurs pour débloquer un nom réservé) — on ne supprime que l'onglet admin.

## 2. Espace Plans pour l'entreprise

Nouvelle route `src/routes/_authenticated/plans.tsx` :
- Liste les plans actifs via `listPlans` (déjà existant, renvoie uniquement `is_active=true` pour non-admins).
- Affiche prix mensuel/annuel, sièges inclus, fonctionnalités, badge « Plan actuel » pour le plan lié à l'entreprise du user.
- Bouton « Choisir ce plan » qui appelle une nouvelle server fn `requestPlanChange` (crée une entrée dans un journal simple ou passe `pending_plan_id` sur la company — voir « Détails techniques »).

Nouvelle server fn `requestPlanChange({ planId, billingCycle })` dans `src/lib/company.functions.ts` :
- Vérifie que l'utilisateur est propriétaire (`owner_id`) de la company.
- Met à jour `companies.pending_plan_id`, `pending_billing_cycle`, `pending_requested_at`.
- Le super-admin approuve ensuite via l'onglet Entreprises existant (bouton « Assigner plan » à ajouter, utilise `assignCompanyPlan`).

Migration SQL : ajout des 3 colonnes `pending_plan_id / pending_billing_cycle / pending_requested_at` sur `companies` (colonnes optionnelles, ne casse rien).

Menu latéral (`src/routes/_authenticated/route.tsx`) : ajouter l'entrée « Plans » (icône `Package`), visible pour tout compte non `admin_only`.

## 3. Recherche : sortir de l'onglet Utilisateurs, entrer dans Dashboard

`src/components/admin/UsersPanel.tsx` : retirer complètement l'input de recherche et l'état `q/debouncedQ`. La liste reste triée par date d'inscription (500 dernières).

`src/components/admin/DashboardPanel.tsx` : ajouter en haut un champ de recherche qui utilise la fn existante `globalSearch` (rapports / PV / employés / entreprises). Résultats groupés affichés sous les KPI. C'est la même recherche que la palette Cmd+K, mais visible et découvrable dans le dashboard admin.

## 4. Bannir / supprimer un utilisateur

Migration SQL :
- Ajouter `profiles.is_banned boolean not null default false` et `profiles.banned_at timestamptz`.
- Ajouter policy / trigger : un profil banni ne peut plus INSERT/UPDATE sur `reports`, `report_minutes`, `companies` (réutilise l'esprit du trigger `block_admin_only_writes`).

Nouvelles server fns dans `src/lib/admin.functions.ts` :
- `banUser({ userId, reason })` : marque `is_banned=true`, log audit, révoque toutes les sessions Auth (`supabaseAdmin.auth.admin.signOut(userId, "global")`).
- `unbanUser({ userId })` : remet `is_banned=false`.
- `deleteUser({ userId })` : `supabaseAdmin.auth.admin.deleteUser(userId)` — les FK `ON DELETE CASCADE` (profils, membres) prennent le relais. Refuse si `userId` est dans `platform_admins`.

`src/components/admin/UsersPanel.tsx` :
- Nouvelle colonne « Statut » (Actif / Banni).
- Menu d'actions par ligne (`⋯`) : « Bannir » / « Réactiver » / « Supprimer » avec confirmation (`AlertDialog`), champ raison pour le ban.
- Un super-admin ne peut ni se bannir ni se supprimer.

## Détails techniques

- Toutes les fns admin passent par `assertAdmin(context.userId, context.claims)` (déjà en place, exige 2FA).
- La suppression Auth cascade via `on delete cascade` sur `profiles.id → auth.users.id` (déjà en place). Vérifier que `companies.owner_id` a bien `on delete` défini ; sinon migration pour ajouter `on delete set null` ou empêcher la suppression si le user est owner d'une company avec des membres.
- `is_banned` est lu par un trigger `assert_not_banned(user_id)` similaire à `assert_not_admin_only`, câblé sur les mêmes tables (`companies`, `company_members`, `reports`, `report_minutes`).
- Pas de changement à `_authenticated/route.tsx` niveau gate : la révocation de session Auth fait que le user banni est déconnecté au prochain refresh de token.
- Aucune donnée existante n'est supprimée par cette évolution.
