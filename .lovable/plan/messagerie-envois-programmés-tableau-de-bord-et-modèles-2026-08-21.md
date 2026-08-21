# Messagerie : envois programmés, tableau de bord et modèles

Trois ajouts au module Messagerie existant (comptes, boîte unifiée, brouillons, signatures simples).

## 1. Planification d'envoi

- Dans la fenêtre de rédaction : un bouton « Programmer l'envoi » avec choix de la date et de l'heure (plus des raccourcis : dans 1 h, demain 8 h, lundi 8 h).
- Nouvelle page « Envois programmés » dans la messagerie : liste des e-mails en attente, envoyés, échoués, avec possibilité de modifier l'heure, d'envoyer immédiatement ou d'annuler.
- Un traitement automatique tourne toutes les 5 minutes côté serveur : il prend les envois arrivés à échéance, les expédie via le compte choisi, puis marque le résultat (envoyé ou échec avec le motif, jusqu'à 3 tentatives).
- Fuseau horaire : les heures sont saisies dans le fuseau du navigateur et stockées en UTC.

## 2. Tableau de bord messagerie

Remplace la page d'accueil actuelle du module par un vrai tableau de bord :

- Cartes clés : messages non lus (total et par compte), e-mails envoyés sur 7 et 30 jours, envois programmés en attente, échecs de synchronisation.
- Santé des comptes : état de connexion, dernière synchronisation, nombre de non-lus, bouton de resynchronisation par compte.
- Graphiques : volume envoyé par jour (14 derniers jours), répartition des messages reçus par compte.
- Performance des envois : taux de réussite, nombre d'échecs, nombre de pièces jointes envoyées et volume total.
- Activité récente : dernières synchronisations et derniers envois (issus du journal existant).

## 3. Modèles d'e-mails et signatures par compte

- Nouvelle section « Modèles » dans les paramètres de messagerie : créer, renommer, modifier, dupliquer, supprimer des modèles (nom, objet, corps enrichi). Portée personnelle ou partagée avec l'entreprise.
- Variables automatiques dans les modèles : `{{prenom}}`, `{{nom_complet}}`, `{{entreprise}}`, `{{date}}`, `{{mon_nom}}` — remplacées à l'insertion.
- Dans la fenêtre de rédaction : sélecteur « Utiliser un modèle » qui remplit l'objet et le corps, et sélecteur de signature.
- Signatures : plusieurs signatures par compte (une par défaut), insertion automatique à la rédaction/réponse, éditeur dans les paramètres du compte.

## Détails techniques

Base de données (nouvelle migration, aucune donnée existante touchée) :

- `email_scheduled_messages` : account_id, user_id, destinataires (to/cc/bcc), objet, corps, pièces jointes (métadonnées + chemin storage), `scheduled_at`, `status` (pending/sending/sent/failed/canceled), `attempts`, `last_error`, `sent_at`. RLS : propriétaire uniquement ; GRANT authenticated + service_role.
- `email_templates` : user_id, company_id (nullable), name, subject, body_html, `scope` (personal/company), is_active. RLS : lecture personnelle ou même entreprise, écriture par l'auteur.
- `email_signatures` : account_id, user_id, name, body_html, is_default. RLS : propriétaire.
- Triggers `set_updated_at` sur les trois tables.

Serveur :

- `src/lib/mail/scheduling.functions.ts` + `scheduling.server.ts` : CRUD des envois programmés (`requireSupabaseAuth`), envoi immédiat, annulation.
- `src/routes/api/public/mail/dispatch-scheduled.ts` : route protégée par un secret d'en-tête, déclenchée par pg_cron toutes les 5 minutes ; sélectionne les échéances via le client admin, réutilise le chemin d'envoi existant de `mail.server.ts`, écrit dans `email_sync_logs`.
- `src/lib/mail/templates.functions.ts` : CRUD modèles et signatures.
- `src/lib/mail/stats.functions.ts` : agrégats du tableau de bord (comptes, journaux, envois programmés, compteurs de non-lus).

Interface :

- `mail.index.tsx` réécrit en tableau de bord (recharts, cartes shadcn, tokens de couleur existants).
- Nouvelle route `mail.scheduled.tsx` ; entrée ajoutée dans la navigation du module mail.
- `ComposeMailDialog.tsx` : ajout du sélecteur de modèle, du sélecteur de signature et du mode planification.
- `mail.settings.tsx` : onglets Comptes / Modèles / Signatures / Journal.
