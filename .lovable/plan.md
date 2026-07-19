# Parcours de récupération de compte

Aujourd'hui vous avez déjà un lien « Mot de passe oublié » sur `/auth` et une page `/reset-password`, mais le parcours est minimal : pas de détection de session recovery, pas de confirmation du nouveau mot de passe, et surtout **aucune issue si vous perdez votre appareil 2FA admin** (vous êtes définitivement bloqué à l'étape MfaGate).

Ce plan couvre les deux cas de blocage :

## 1. Mot de passe oublié (utilisateur et admin)

- Page `/auth` : mode « Mot de passe oublié » déjà présent — je le laisse tel quel, avec juste un message plus clair sur ce qui va se passer (« Vous recevrez un email avec un lien valide 1h »).
- Refonte de `/reset-password` :
  - Détection du `PASSWORD_RECOVERY` event Supabase pour valider que la page a été ouverte depuis un lien de récupération légitime.
  - Message clair si arrivé sur la page sans lien recovery (avec CTA « Demander un nouveau lien »).
  - Champ « nouveau mot de passe » + « confirmation » + toggle œil (comme sur `/auth`).
  - Longueur mini 8 caractères, messages d'erreur alignés (HIBP, credentials, etc.).
  - Après succès : redirection vers `/reports` (ou `/admin` si compte admin_only).

## 2. Perte de l'appareil 2FA (super admin)

Cas critique : l'admin peut se connecter (email + mot de passe → session `aal1`) mais reste bloqué sur `MfaGate` sans code TOTP.

- **Bouton « Je n'ai plus mon authentificateur »** ajouté sur l'écran MfaGate (uniquement visible quand un facteur vérifié existe).
- Au clic : envoi d'un email de récupération à l'adresse du compte via `resetPasswordForEmail` (redirect vers `/reset-password?mfa_reset=1`).
- Sur `/reset-password`, si `mfa_reset=1` est présent et la session est bien en recovery, en plus de changer le mot de passe on appelle une nouvelle fonction serveur `emergencyResetMyMfa` qui désenrôle **tous les facteurs 2FA du compte connecté** (via `supabaseAdmin.auth.admin.mfa.deleteFactor`, autorisée uniquement pour l'utilisateur lui-même).
- Après la réinitialisation, retour à l'écran MfaGate qui affichera « Activer la 2FA » (enrôlement d'un nouveau QR code).

Sécurité : la réinitialisation exige possession de l'email + connaissance du mot de passe (ou reset via email). L'attaquant devrait donc compromettre les deux facteurs pour contourner la 2FA — équivalent au niveau de sécurité d'une connexion classique.

## 3. Point d'entrée « J'ai perdu l'accès à mon compte »

Sur `/auth` (mode connexion), ajout d'un petit lien discret « J'ai perdu l'accès à mon compte » qui bascule sur le mode « Mot de passe oublié » avec un texte explicatif couvrant les deux cas (mot de passe oublié et 2FA perdue).

## Détails techniques

- Nouveau server fn `emergencyResetMyMfa` dans `src/lib/platform.functions.ts` :
  - Middleware `requireSupabaseAuth`.
  - `supabaseAdmin.auth.admin.mfa.listFactors(userId)` puis `deleteFactor` pour chaque facteur.
  - Journalisation optionnelle dans `admin_audit_log` si le compte est platform_admin.
- Aucune migration SQL nécessaire.
- Aucun changement de configuration Supabase Auth.
- Aucune modification de la route `_authenticated` gate.

## Fichiers touchés

- `src/routes/reset-password.tsx` — refonte complète.
- `src/routes/auth.tsx` — petit texte d'aide en mode « forgot » + lien d'entrée récupération.
- `src/components/admin/MfaGate.tsx` — bouton « Je n'ai plus mon authentificateur ».
- `src/lib/platform.functions.ts` — ajout de `emergencyResetMyMfa`.
