# Simplifier l'ajout d'un compte e-mail

Vous avez raison : aujourd'hui la fenêtre affiche 11 champs, dont 7 réglages techniques (serveurs, ports, sécurité, identifiant IMAP) qui sont déjà connus pour Gmail, Outlook et Yahoo. L'utilisateur n'a en réalité besoin que de deux informations.

## Nouvelle expérience

Étape unique, deux champs :

```text
+------------------------------------------+
|  Connecter un compte e-mail              |
|                                          |
|  Adresse e-mail   [ vous@gmail.com   ]   |
|  Mot de passe     [ ................ ]   |
|                                          |
|  ✓ Gmail détecté automatiquement         |
|  ℹ Utilisez un mot de passe d'application|
|    -> lien vers la procédure Google      |
|                                          |
|  > Réglages avancés (facultatif)         |
|                                          |
|         [ Connecter le compte ]          |
+------------------------------------------+
```

- **Détection automatique du fournisseur** à partir du domaine de l'adresse :
  gmail.com / googlemail.com -> Gmail, outlook / hotmail / live / msn -> Microsoft,
  yahoo -> Yahoo, sinon serveur professionnel.
- Pour un domaine professionnel inconnu, les serveurs sont devinés
  (`imap.<domaine>` / `smtp.<domaine>`) et un message discret invite à vérifier
  dans les réglages avancés si la connexion échoue.
- **Nom affiché** pré-rempli avec le nom du profil, **étiquette interne** et
  **identifiant IMAP** disparaissent du formulaire principal (valeurs déduites).
- **Réglages avancés** replié par défaut : serveurs, ports et sécurité restent
  accessibles pour les boîtes pro, avec des listes déroulantes (SSL/TLS,
  STARTTLS, aucune) au lieu de champs texte libres.
- Le bouton « Tester la connexion » n'est plus obligatoire : la connexion est
  testée automatiquement à l'enregistrement, et en cas d'échec un message clair
  indique quoi corriger et ouvre les réglages avancés.
- Aide contextuelle par fournisseur avec lien direct vers la page de création du
  mot de passe d'application (Google, Microsoft, Yahoo).

## Détails techniques

- `src/lib/mail/types.ts` : ajout d'une fonction `detectProvider(email)` et de
  valeurs de repli pour un domaine personnalisé.
- `src/components/mail/AddMailAccountDialog.tsx` : réécriture du formulaire
  (2 champs + `Collapsible` pour l'avancé, `Select` pour la sécurité,
  détection auto sur saisie de l'e-mail, test intégré à la sauvegarde).
- Aucun changement de base de données ni de logique serveur : la charge envoyée
  à `saveMailAccount` reste identique, seuls les champs sont pré-remplis.
