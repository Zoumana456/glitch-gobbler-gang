# Simplification de l'interface Messagerie + solution Hotmail

## Contexte

- Azure (Microsoft OAuth) n'est pas disponible : le user n'a pas pu créer l'app.
- L'IMAP/SMTP nécessite une passerelle externe (`MAIL_GATEWAY_URL` + `MAIL_GATEWAY_TOKEN`) car le runtime ne peut pas ouvrir de sockets TCP. Sans passerelle, le bouton « Connecter » échoue pour tout compte IMAP.
- Le dashboard `/mail` est surchargé : 4 cartes de stats + 2 cartes + 6 boutons + 2 alertes + texte verbeux.

## Partie 1 — Alléger le dashboard `/mail`

**Fichier** : `src/routes/_authenticated/mail.index.tsx`

1. **Supprimer les 4 cartes de stats** (Messages non lus, Envoyés 7j, Envois programmés, Pièces jointes). L'utilisateur a déjà demandé de ne garder que « Non-lus par compte » et « Activité récente ».
2. **Raccourcir l'en-tête** :
   - Supprimer le sous-titre verbeux.
   - Réduire à 3 boutons principaux : « Ajouter un compte », « Rédiger », « Boîte unifiée ».
   - Déplacer « Synchroniser », « Envois programmés », « Paramètres » dans un menu déroulant compact (DropdownMenu) ou en liens discrets sous le titre.
3. **Raccourcir l'alerte passerelle** : un message court sur une ligne au lieu d'un bloc.
4. **Conserver** les deux cartes : « Non-lus par compte » (pie chart) et « Activité récente ».
5. Supprimer l'import de `recharts`/`stats` si les stat cards sont retirées et que les données ne servent plus au dashboard. Vérifier que `mailDashboardStats` reste utile pour les deux cartes restantes (unreadByAccount + recent).

## Partie 2 — Alléger la boîte de dialogue « Connecter un compte »

**Fichier** : `src/components/mail/AddMailAccountDialog.tsx`

1. **Raccourcir la description** du dialog : une ligne au lieu de deux.
2. **Supprimer l'alerte verbeuse** pour les comptes pro (le bloc `Alert` avec `imap.votre-domaine`). La remplacer par un simple texte d'une ligne.
3. **Conserver uniquement** : champ e-mail, champ mot de passe, message de détection compact, lien d'aide (un seul lien), et la section avancée repliée.
4. **Alléger le texte des indices** : raccourcir le hint Microsoft et les autres à une phrase.
5. La section OAuth ne s'affiche que si au moins un provider est configuré — c'est déjà le cas, pas de changement.

## Partie 3 — Solution Hotmail sans Azure

**Problème** : sans OAuth Microsoft ni passerelle IMAP, Hotmail ne peut pas se connecter.

**Approche** : 
- Azure app registration est en réalité **gratuit** sur https://entra.microsoft.com (anciennement Azure AD). Le user a buté sur l'inscription Azure (carte bancaire demandée). Sur Entra, un compte personnel Microsoft suffit pour créer une app gratuite.
- En attendant, on rend l'interface honnête : si ni OAuth ni passerelle ne sont configurés, l'alerte indique clairement « Aucune méthode de connexion active » avec un lien vers les paramètres, au lieu de textes vagues.
- Si le user veut activer l'IMAP : il faut déployer une passerelle (EmailEngine ou équivalent) sur un host qui permet les sockets TCP (Railway, Fly.io, VPS). On documente ce besoin de façon concise dans les paramètres.

**Modifications** :
- `mail.index.tsx` : alerte plus claire quand rien n'est configuré.
- `mail.settings.tsx` : ajouter une section d'aide compacte expliquant les 2 chemins (OAuth Google gratuit / Passerelle IMAP) avec liens.

## Partie 4 — Nettoyer le code inutilisé

- Si les stat cards sont supprimées, retirer les imports morts (`PieChart`, `Cell`, `Legend`, `Tooltip`, `ResponsiveContainer`, `StatCard`, `Paperclip`, etc.).
- Garder le head() SEO intact.
