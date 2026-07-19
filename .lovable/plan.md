## Objectif
Rendre l'expérience "nom d'entreprise protégé" plus claire et guider l'utilisateur vers la vérification d'identité.

## Contexte actuel
Dans `src/routes/_authenticated/company.tsx`, quand `createCompany` renvoie `{ needsVerification: true }`, on affiche un simple `toast.info(...)` et on ouvre le dialogue KYC. Le toast est peu visible et ne propose pas d'action explicite. Idem sur `src/routes/_authenticated/profile.tsx` où l'utilisateur peut lancer une demande.

## Changements (UI uniquement)

1. **Toast enrichi et persistant** — remplacer `toast.info(...)` par un `toast.warning(...)` avec :
   - Titre : « Nom d'entreprise protégé »
   - Description : la raison retournée par le serveur (`res.reason`) + « Une vérification d'identité (KYC) est nécessaire pour l'utiliser. »
   - Action button « Vérifier mon identité » qui ouvre `RequestVerificationDialog` (`setVerifyOpen(true)`)
   - `duration: 10000` pour laisser le temps de lire/cliquer
   - Icône `ShieldAlert`

2. **Bannière inline sous le champ Nom** (état `needsVerification` local) — quand la mutation renvoie `needsVerification`, afficher au-dessus du bouton "Créer l'entreprise" une carte d'alerte (bordure `border-amber-500`, fond `bg-amber-50 dark:bg-amber-950/20`) contenant :
   - Icône `ShieldAlert` + titre « Ce nom est réservé »
   - Le message `reason`
   - Bouton primaire « Démarrer la vérification (KYC) » → ouvre le dialogue
   - Lien secondaire « En savoir plus » → `/profile#verification`

3. **Même logique côté `onError`** (fallback si le server renvoie une exception au lieu du signal) : détecter « protégé »/« vérification » et déclencher le même toast+bannière.

4. **Reset propre** : quand l'utilisateur modifie `newCompanyName`, effacer l'état `needsVerification` pour éviter la bannière persistante.

## Fichiers modifiés
- `src/routes/_authenticated/company.tsx` : toast enrichi, état `needsVerification`, bannière inline, reset.

## Hors périmètre
- Pas de changement serveur (`company.functions.ts` renvoie déjà le bon signal).
- Pas de changement au dialogue KYC (`RequestVerificationDialog`).
- Pas de changement DB.
