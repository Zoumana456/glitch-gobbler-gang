
## Objectif

Confirmer que les pages principales (`/`, `/auth`, `/reports`) du site publié https://glitch-gobbler-gang.lovable.app se chargent correctement, avant et après authentification, sans erreurs runtime.

## Étapes de vérification (Playwright headless)

1. **Anonyme — chargement public**
   - Ouvrir `https://glitch-gobbler-gang.lovable.app/` → doit rediriger vers `/reports`, qui est protégée, donc rediriger vers `/auth` (via `_authenticated/route.tsx`).
   - Ouvrir `https://glitch-gobbler-gang.lovable.app/auth` → page connexion visible (form email + bouton Google).
   - Ouvrir `https://glitch-gobbler-gang.lovable.app/reports` → doit rediriger vers `/auth`.
   - Capturer console errors + network 4xx/5xx.
   - Screenshots à chaque étape.

2. **Authentifié — après login**
   - Utiliser la session Supabase gérée si `LOVABLE_BROWSER_AUTH_STATUS=injected` sur l'URL de production. Sinon créer un compte de test via l'UI (email/password) ou demander à l'utilisateur des identifiants.
   - Après injection de session / login, naviguer vers `/` → doit rediriger vers `/reports` et afficher la liste.
   - Naviguer vers `/reports` directement → page liste rapports rendue.
   - Vérifier appels serverFn (`listReports`) : headers `Authorization: Bearer …` présents, réponses 200.
   - Rafraîchir `/reports` (hard reload) pour confirmer que la route protégée survit à un refresh.
   - Screenshots + console + network log.

3. **Diagnostic**
   - Si une page échoue : lire console, network, HTML rendu, et identifier la cause (SSR crash, redirect loop, bearer manquant, 401 serverFn, module server-only leaké, etc.).
   - Rapporter précisément la ou les pages qui posent problème et l'erreur exacte.

## Livrable

Rapport résumé avec, pour chaque page et chaque état (anonyme / authentifié) :
- statut HTTP final, URL finale
- rendu visuel (screenshot)
- erreurs console/network éventuelles
- verdict OK / KO + cause si KO

Aucune modification de code n'est prévue dans ce plan — uniquement de la vérification. Si un bug est détecté, je reviendrai avec un plan de correction ciblé.
