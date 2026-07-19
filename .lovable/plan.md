## Objectif
Remplacer le compte super-admin actuel (`yapi401@gmail.com`) par un nouveau compte dédié `yapi.zoumana01@gmail.com` avec le mot de passe `ZOUM3011####`.

## Étapes

1. **Créer le compte auth** `yapi.zoumana01@gmail.com` via l'API Auth Admin
   - mot de passe : `ZOUM3011####`
   - email confirmé automatiquement (pas de vérification par mail requise)

2. **Marquer le profil `admin_only = true`** dans `public.profiles` pour que ce compte ne puisse pas créer d'entreprise, de rapport ou de PV (déjà bloqué par le trigger `block_admin_only_writes`).

3. **Promouvoir dans `public.platform_admins`** le nouvel utilisateur.

4. **Retirer les anciens admins** (`yapi401@gmail.com` et `yapifranckzoumana5@gmail.com` s'ils y sont encore) de `platform_admins` pour ne garder qu'un seul super-admin actif.

5. **Vérifier la connexion** via un test rapide (login API) pour confirmer que `yapi.zoumana01@gmail.com` / `ZOUM3011####` fonctionne avant de vous rendre la main.

## Connexion (après application)
- Page : `/auth`
- Email : `yapi.zoumana01@gmail.com`
- Mot de passe : `ZOUM3011####`
- Redirection automatique vers `/admin` avec la demande d'activation 2FA (scan QR code au premier login).

## Détails techniques
- Création via `POST /auth/v1/admin/users` avec `email_confirm: true` (utilise `SUPABASE_SERVICE_ROLE_KEY` côté sandbox, jamais exposé au client).
- Migration SQL pour `profiles.admin_only = true` et upsert dans `platform_admins`, plus `DELETE` des anciens admins.
- Aucun changement de code applicatif — uniquement données + auth.
