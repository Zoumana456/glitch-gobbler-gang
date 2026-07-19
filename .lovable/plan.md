## Objectif
Ajouter la connexion Google sur la page `/auth` (actuellement email/mot de passe seulement).

## Changements

1. **Activer le provider Google côté Cloud** via `supabase--configure_social_auth` avec `providers: ["google"]` (managed OAuth Lovable — aucune clé à fournir).

2. **`src/routes/auth.tsx`** : ajouter un bouton **"Continuer avec Google"** au-dessus du formulaire email (séparateur "ou"), qui appelle :
   ```ts
   import { lovable } from "@/integrations/lovable";
   await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
   ```
   Gestion des états `error` / `redirected`, toast d'erreur en cas d'échec, session hydratée automatiquement au retour puis navigation vers `/reports`.

3. Email/mot de passe **conservé** (pas de `disable_providers`).

## Ce qui ne change pas
- Base de données, RLS, profils, comptes existants.
- Le trigger `handle_new_user` crée déjà le profil pour tout nouvel utilisateur (email + full_name), donc les connexions Google créeront un profil automatiquement.
