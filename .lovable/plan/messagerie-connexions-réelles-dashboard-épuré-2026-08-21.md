# Messagerie : connexions réelles + dashboard épuré

## 1. Connexion des boîtes (les deux voies)

### a) Gmail et Outlook en 1 clic (OAuth, sans passerelle)
Les API officielles Google Gmail et Microsoft Graph fonctionnent en HTTPS, donc directement compatibles avec le runtime du site (contrairement à IMAP/SMTP qui exige des sockets).

- Bouton « Connecter Gmail » et « Connecter Outlook » dans l'ajout de compte : redirection OAuth, consentement, retour sur le site, compte créé automatiquement (aucun mot de passe d'application, aucun réglage technique).
- Jetons d'accès/rafraîchissement chiffrés côté serveur avec la clé de chiffrement déjà en place.
- Relève des messages, lecture, envoi, brouillons et envois programmés passent par Gmail API / Microsoft Graph pour ces comptes.
- Prérequis à ta charge : créer les identifiants OAuth Google (Google Cloud) et Microsoft (Entra / Azure). Je te donnerai les URL de redirection exactes à coller, puis j'enregistre les identifiants comme secrets.

### b) Boîtes IMAP/SMTP professionnelles (passerelle)
- Enregistrement de l'URL et du jeton de ta passerelle (EmailEngine ou équivalent) comme secrets ; le code de passerelle existe déjà et devient opérationnel dès l'enregistrement.
- Le message « La passerelle n'est pas encore configurée » est remplacé par un état clair : si aucune passerelle n'est configurée, le formulaire IMAP manuel est masqué et seuls Gmail/Outlook sont proposés, avec une explication d'une ligne au lieu d'une erreur technique.

### c) Ce que ça change dans le formulaire d'ajout
- Étape 1 : choix du fournisseur (Gmail, Outlook, Autre).
- Gmail/Outlook : un seul clic, plus aucun champ.
- Autre : email + mot de passe, réglages avancés repliés (comportement actuel conservé), disponible uniquement si la passerelle est configurée.

## 2. Dashboard /mail allégé
Suppression de :
- le graphique « Volume envoyé (14 derniers jours) » ;
- la carte « Performance des envois (30 j) » ;
- la carte « Santé des comptes » (son action « Relever » est remplacée par un unique bouton « Tout relever » dans l'en-tête de la page).

Conservation de :
- l'en-tête et les 4 indicateurs du haut ;
- « Non-lus par compte » ;
- « Activité récente ».

## Détails techniques
- Nouveaux champs sur `email_accounts` pour les jetons OAuth chiffrés et l'expiration ; aucune donnée existante supprimée.
- Nouveau module serveur `src/lib/mail/oauth.server.ts` (échange de code, rafraîchissement) + adaptateurs `gmail.server.ts` et `graph.server.ts` exposant la même interface que `gateway.server.ts`, et un routeur qui choisit l'adaptateur selon `provider`.
- Route publique `src/routes/api/public/mail/oauth/callback.ts` pour le retour OAuth (vérification du paramètre `state`).
- Secrets à ajouter : `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `MS_OAUTH_CLIENT_ID`, `MS_OAUTH_CLIENT_SECRET`, `MAIL_GATEWAY_URL`, `MAIL_GATEWAY_TOKEN`.
- `mail.index.tsx` : retrait des blocs listés, `BarChart`/`Progress` et imports devenus inutiles nettoyés.
