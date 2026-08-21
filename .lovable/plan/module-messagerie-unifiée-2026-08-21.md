# Module Messagerie unifiée

Nouveau module DailyBrief « Messagerie » : plusieurs comptes e-mail dans une seule interface, activable/désactivable comme les autres applications (Rapports, PV, Tâches). Module détaché : aucune dépendance aux rapports, PV ou fiches entreprise.

## Interface complète (données réelles, pas de démo)

- **Tableau de bord** `/mail` : liste des comptes connectés (logo fournisseur, nom, adresse, non-lus, statut, dernière synchro), bouton « + Ajouter un compte ». Si aucun compte : écran « Ajouter mon premier compte ».
- **Boîte unifiée** `/mail/inbox` : 4 colonnes responsive — Comptes / Dossiers (Réception, Envoyés, Brouillons, Spam, Corbeille, Archives, Favoris) / Liste des messages / Lecture. Sur mobile, navigation par écrans successifs avec retour.
- **Vue « Tous les comptes »** : messages fusionnés triés par date, badge du compte d'origine sur chaque ligne.
- **Lecture** : expéditeur, destinataires, Cc, date, objet, corps HTML assaini, pièces jointes, compte utilisé. Actions : répondre, répondre à tous, transférer, archiver, supprimer, lu/non-lu, favori, télécharger pièce jointe, imprimer.
- **Rédaction** : « + Nouveau message », choix du compte expéditeur, À / Cc / Cci, objet, éditeur riche (gras, italique, souligné, listes, liens), pièces jointes, signature, Envoyer / Enregistrer comme brouillon, sauvegarde auto du brouillon.
- **Recherche et filtres** : recherche globale multi-comptes ; filtres compte, expéditeur, destinataire, date, objet, lu/non-lu, pièces jointes, favoris, importance.
- **Conversations** : regroupement par fil, messages dépliables.
- **Paramètres → Comptes e-mail** : renommer, compte principal, désactiver, reconnecter, tester la connexion, supprimer, éditer la signature (auto / manuelle / aucune).
- **Notifications** : compteur « Messagerie (12) » dans le menu et cloche existante alimentée à chaque synchronisation.
- **Espace admin** : nouvel onglet « Messagerie » — nombre de comptes par fournisseur, utilisateurs actifs, synchronisations, erreurs, journal. L'admin voit les métadonnées de comptes, jamais le contenu des e-mails.

## Connexion des comptes

- **Gmail / Google Workspace** : OAuth 2.0 officiel via le connecteur Lovable Gmail (chaque utilisateur autorise son propre compte, aucun mot de passe demandé).
- **Outlook / Hotmail / Microsoft 365** : OAuth 2.0 officiel via le connecteur Lovable Outlook.
- **IMAP / SMTP (mail professionnel)** : formulaire complet (adresse, identifiant, mot de passe, hôte/port/sécurité IMAP et SMTP) avec test de connexion obligatoire avant enregistrement. Identifiants chiffrés, jamais réaffichés en clair.
- **Yahoo Mail** : traité comme un compte IMAP/SMTP (Yahoo impose un mot de passe d'application) avec préréglage des serveurs Yahoo.

Point important sur IMAP/SMTP/Yahoo : le serveur qui héberge l'application ne peut pas ouvrir de connexions IMAP/SMTP directes. Pour que ces comptes fonctionnent réellement, l'application appellera une passerelle e-mail externe (service IMAP/SMTP accessible en HTTP, type EmailEngine ou Nylas). Je livre l'UI, le test de connexion, le stockage chiffré et tous les appels ; il faudra fournir la clé d'accès de cette passerelle pour que les comptes professionnels et Yahoo deviennent opérationnels. Gmail et Microsoft fonctionnent sans elle.

## Sécurité et données

- Aucun contenu d'e-mail stocké dans la base : lecture en direct chez le fournisseur, cache mémoire court le temps de l'affichage.
- Jetons OAuth et mots de passe IMAP chiffrés (AES-256-GCM) et lisibles uniquement par le serveur.
- Isolation stricte par utilisateur : un utilisateur ne voit que ses comptes (règles d'accès base + vérification serveur à chaque appel).
- Journal des événements sensibles : connexion, déconnexion, synchronisation, échec, envoi, suppression de compte, révocation — sans contenu de message.
- Suppression d'un compte : les données du compte disparaissent du SaaS, les e-mails restent chez le fournisseur (option A du cahier des charges).
- Limites de taille et de type sur les pièces jointes envoyées.
- Messages d'erreur clairs : « Autorisation à renouveler » + bouton Reconnecter, « Serveur de messagerie injoignable », etc.

## Non inclus dans cette livraison

Quotas par forfait (illimité pour l'instant, comme demandé), planification d'envoi, modèles, règles automatiques, IA de résumé/réponse, synchronisation contacts et calendrier, intégrations CRM/Documents/Calendrier. Prévus en versions 2 et 3.

## Détails techniques

Nouvelles tables : `email_accounts` (utilisateur, fournisseur, adresse, nom affiché, jetons/identifiants chiffrés, hôtes IMAP/SMTP, statut, compte principal, signature, dernière synchro), `email_folders`, `email_drafts`, `email_sync_logs`. RLS scopée sur `auth.uid()` + GRANT explicites ; les colonnes de secrets ne sont accessibles qu'au rôle serveur.

Backend : server functions TanStack (`src/lib/mail/*.functions.ts` + helpers `*.server.ts`) — `listAccounts`, `connectOAuthAccount`, `saveImapAccount`, `testAccountConnection`, `listFolders`, `listMessages`, `getMessage`, `sendMessage`, `replyMessage`, `forwardMessage`, `setRead`, `setStarred`, `moveMessage`, `getAttachment`, `saveDraft`, `syncAccount`, `deleteAccount`. Gmail via l'API Gmail et Outlook via Microsoft Graph, appelés au nom de l'utilisateur signé par le gateway connecteur Lovable ; IMAP/SMTP via la passerelle HTTP décrite plus haut. Route publique `src/routes/api/public/mail/sync` pour la synchronisation planifiée en arrière-plan (vérification de signature), avec repli sur une synchro à l'ouverture du module.

Front-end : routes `src/routes/_authenticated/mail.*` (dashboard, inbox, compose, settings), enregistrement du module `mail` dans `src/lib/modules/registry.ts` (activable depuis « Gérer les applications »), composants dédiés `src/components/mail/`, chiffrement dans `src/lib/mail/crypto.server.ts` avec un secret généré côté serveur, assainissement HTML des corps de messages.

Étapes : 1) migration base + secrets, 2) liaison des connecteurs Gmail et Microsoft, 3) couche serveur fournisseurs, 4) interface complète, 5) admin + journal + notifications, 6) passerelle IMAP/SMTP et tests de bout en bout.
