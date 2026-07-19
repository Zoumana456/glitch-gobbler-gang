
## Objectif

Créer un compte **exclusivement administrateur** pour `yapi401@gmail.com` (mot de passe `ZOUM3011####`), qui :
- N'a pas encore de compte dans la base
- Ne doit **jamais** posséder d'entreprise ni de rapports
- Sert uniquement à gérer la plateforme via `/admin`

Le compte actuellement promu (`yapifranckzoumana5@gmail.com`) sera rétrogradé pour ne laisser QUE le nouveau compte admin.

## Étapes

### 1. Création du compte auth (via serveur)
Appel `supabaseAdmin.auth.admin.createUser` avec :
- `email: yapi401@gmail.com`
- `password: ZOUM3011####`
- `email_confirm: true` (pas de mail de confirmation)
- `user_metadata: { full_name: "DailyBrief Admin", role: "platform_admin_only" }`

Le trigger `handle_new_user` créera automatiquement une ligne `profiles`.

### 2. Marquage "admin-only" du compte
Ajout d'une colonne `admin_only BOOLEAN NOT NULL DEFAULT false` sur `profiles` (migration).
Le nouveau profil est passé à `admin_only = true`.

### 3. Blocage côté application
- **`createCompanyFn`** (`src/lib/company.functions.ts`) : refuse si `profiles.admin_only = true` → message clair "Compte réservé à l'administration".
- **Server fns rapports/minutes** (création) : même contrôle.
- **UI** (`src/routes/_authenticated/*`) : lorsque `admin_only = true`, la sidebar affiche uniquement le lien Administration et Profil (masque Rapports / Minutes / Entreprise). Redirection automatique vers `/admin` après login.

### 4. Politique RLS de renfort
Ajout d'une policy `CHECK` sur `companies` et `reports` :  
`author_id/owner_id` ne peut pas correspondre à un user dont `profiles.admin_only = true`.  
→ Défense en profondeur si l'UI est contournée.

### 5. Ajout à `platform_admins`
Insertion du nouveau `user_id` dans `platform_admins`.  
**Retrait** de `yapifranckzoumana5@gmail.com` de `platform_admins` (via `removePlatformAdmin` ou insert direct de suppression) pour ne conserver que le compte dédié.

> Note : la 2FA (TOTP) devra être configurée à la 1ère connexion via `MfaGate` déjà en place — obligatoire pour accéder à `/admin`.

## Livrables

1. Migration SQL : colonne `profiles.admin_only` + policies de blocage.
2. Insert : création user auth + profile flaggé + entrée `platform_admins` + retrait de l'ancien admin.
3. Modifs code :
   - `company.functions.ts`, `reports.functions.ts`, `minutes.functions.ts` → garde `admin_only`.
   - `routes/_authenticated/route.tsx` (ou layout sidebar) → masque les liens non-admin et redirige vers `/admin`.
4. Communication des identifiants au user avec rappel : se connecter → activer 2FA immédiatement.

## Questions avant implémentation

1. Confirmez-vous que `yapifranckzoumana5@gmail.com` doit **perdre** son statut super admin (conservé uniquement pour usage courant / rapports) ?  
2. Souhaitez-vous que le compte admin-only puisse quand même voir en **lecture seule** les rapports d'autres entreprises (utile pour du support) ou strictement rien ?
