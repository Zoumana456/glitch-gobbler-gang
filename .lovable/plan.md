# Simplification de l'interface Messagerie + solution Hotmail

## Contexte

- Azure (Microsoft OAuth) n'est pas disponible : le user n'a pas pu créer l'app.
- L'IMAP/SMTP nécessite une passerelle externe (`MAIL_GATEWAY_URL` + `MAIL_GATEWAY_TOKEN`) car le runtime ne peut pas ouvrir de sockets TCP. Sans passerelle, le bouton « Connecter » échoue pour tout compte IMAP.
- Le dashboard `/mail` est surchargé : 4 cartes de stats + 2 cartes + 6 boutons + 2 alertes + texte verbeux.

## Partie 1 — Alléger le dashboard `/mail`

**Fichier** : `src/routes/_authenticated/mail.index.tsx`

1. **Conserver les 4 cartes de stats** (Messages non lus, Envoyés 7j, Envois programmés, Pièces jointes) telles quelles.
2. **Raccourcir l'en-tête** :
   - Supprimer le sous-titre verbeux.
   - Réduire à 3 boutons principaux : « Ajouter un compte », « Rédiger », « Boîte unifiée ».
   - Déplacer « Synchroniser », « Envois programmés », « Paramètres » dans un menu déroulant compact (DropdownMenu) ou en liens discrets sous le titre.
3. **Raccourcir l'alerte passerelle** : un message court sur une ligne au lieu d'un bloc.
4. **Conserver** les deux cartes : « Non-lus par compte » (pie chart) et « Activité récente ».

## Partie 2 — Alléger la boîte de dialogue « Connecter un compte »

**Fichier** : `src/components/mail/AddMailAccountDialog.tsx`

1. **Raccourcir la description** du dialog : une ligne au lieu de deux.
2. **Supprimer l'alerte verbeuse** pour les comptes pro (le bloc `Alert` avec `imap.votre-domaine`). La remplacer par un simple texte d'une ligne.
3. **Conserver uniquement** : champ e-mail, champ mot de passe, message de détection compact, lien d'aide (un seul lien), et la section avancée repliée.
4. **Alléger le texte des indices** : raccourcir le hint Microsoft et les autres à une phrase.
5. La section OAuth ne s'affiche que si au moins un provider est configuré — c'est déjà le cas, pas de changement.

## Partie 3 — Activer OAuth Microsoft (le user a trouvé les identifiants Azure)

Le user a récupéré l'ID client et le secret Microsoft. On les enregistre via le formulaire sécurisé (`secrets--add_secret`) sous les noms attendus par `src/lib/mail/oauth.server.ts`.

**Actions** :
1. Ouvrir le formulaire sécurisé pour `MAIL_MICROSOFT_CLIENT_ID` et `MAIL_MICROSOFT_CLIENT_SECRET` (et les variantes `MICROSOFT_OAUTH_CLIENT_ID` / `MICROSOFT_OAUTH_CLIENT_SECRET` déjà supportées).
2. Vérifier que `oauth.server.ts` lit bien ces variables pour activer le bouton « Continuer avec Microsoft ».
3. Une fois les secrets enregistrés et publiés, le bouton « Continuer avec Microsoft » apparaît dans le dialog d'ajout de compte — Hotmail/Outlook se connecte en un clic, sans mot de passe, sans IMAP, sans passerelle.

## Partie 4 — Nettoyer le code inutilisé

- Si les stat cards sont supprimées, retirer les imports morts (`PieChart`, `Cell`, `Legend`, `Tooltip`, `ResponsiveContainer`, `StatCard`, `Paperclip`, etc.).
- Garder le head() SEO intact.
