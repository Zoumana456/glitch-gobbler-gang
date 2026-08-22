# Vérification de bout en bout — connexions Gmail et Outlook

## Ce qui est déjà confirmé

- Les 4 identifiants OAuth sont bien enregistrés côté serveur (`MAIL_GOOGLE_CLIENT_ID`/`_SECRET`, `MAIL_MICROSOFT_CLIENT_ID`/`_SECRET`) ainsi que la clé de chiffrement `MAIL_CRYPTO_KEY`.
- Le flux de code est complet : génération de l'URL de consentement, état signé (HMAC, expiration 15 min), échange du code, lecture de l'identité (profil Gmail / Microsoft Graph), enregistrement chiffré du compte, puis première synchronisation.
- La base est prête : la table des comptes possède les colonnes de jetons OAuth et la contrainte d'unicité (utilisateur + fournisseur + adresse) utilisée par l'enregistrement.

## Le point bloquant probable

L'adresse de retour envoyée au fournisseur est construite à partir de l'adresse du site où l'on clique (`origine actuelle + /api/public/mail/oauth/callback`).
Or seule l'URL de **production** a été déclarée dans les consoles Google et Microsoft. Donc :

- depuis le site publié : le retour est valide ;
- depuis l'aperçu (URL de prévisualisation) : Google/Microsoft refusent avec « redirect_uri_mismatch ».

Le test doit donc se faire sur le site publié, ou l'URL d'aperçu doit être ajoutée dans les deux consoles.

## Plan de vérification

### Étape 1 — Contrôles automatiques (je les exécute)

1. Vérifier que le serveur déclare bien les deux fournisseurs comme disponibles (Gmail + Microsoft visibles dans le dialogue d'ajout).
2. Vérifier que l'URL de consentement produite pour chaque fournisseur est correcte : bon client, bonnes permissions (lecture/écriture + envoi), retour hors ligne pour Google (`access_type=offline`) et `offline_access` pour Microsoft, adresse de retour exacte.
3. Vérifier le comportement du rappel en cas d'erreur : état absent, état falsifié, refus du fournisseur, code manquant — chaque cas doit rediriger vers Messagerie › Paramètres avec un message clair, jamais un écran blanc.
4. Vérifier que les points d'accès Google et Microsoft répondent bien aux identifiants enregistrés (rejet propre attendu sans consentement, ce qui prouve que les clés sont reconnues).

### Étape 2 — Test réel avec consentement (une action de ta part)

Le consentement ne peut pas être automatisé : il faut se connecter à ton compte Google puis à ton compte Outlook/Hotmail.

Sur le site **publié** :
1. Messagerie › Paramètres › Ajouter un compte › « Continuer avec Google » → autoriser.
2. Retour attendu : bandeau « compte connecté », le compte apparaît dans la liste, la boîte unifiée se remplit.
3. Même chose avec « Continuer avec Microsoft ».
4. Test d'envoi : rédiger un message depuis chaque compte connecté et vérifier la réception.
5. Test de rafraîchissement : après expiration du jeton (1 h) ou via une resynchronisation forcée, vérifier que le compte reste « connecté ».

Je te guide pas à pas et je lis les journaux serveur à chaque étape pour diagnostiquer toute erreur (permissions manquantes, retour refusé, jeton non renouvelé).

### Étape 3 — Corrections selon les résultats

Selon ce que révèlent les étapes 1 et 2, je corrige :
- adresse de retour à ajouter dans les consoles (je te donne l'URL exacte à coller) ;
- permissions manquantes → ajustement des permissions demandées ;
- absence de jeton de renouvellement Google (cas fréquent d'une 2ᵉ autorisation) → forcer une nouvelle demande de consentement ;
- messages d'erreur peu clairs → texte explicite dans l'interface.

## Détails techniques

- Fichiers concernés : `src/lib/mail/oauth.server.ts` (URL de consentement, échange et renouvellement des jetons, enregistrement), `src/routes/api/public/mail/oauth/callback.ts` (rappel), `src/lib/mail/transport.server.ts` avec `gmail.server.ts` / `graph.server.ts` (lecture et envoi via les API officielles), `src/lib/mail/mail.functions.ts` (état et synchronisation).
- Aucun socket IMAP/SMTP dans ce chemin : tout passe en HTTPS, donc la passerelle IMAP n'est pas nécessaire pour Gmail et Outlook.
- Aucune modification de schéma prévue ; les jetons restent chiffrés (AES-256-GCM) en base.
