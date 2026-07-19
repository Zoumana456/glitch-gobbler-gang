## Objectif
Vous donner accès à `/admin` en enregistrant votre compte dans la table `platform_admins`.

## Compte cible
- Email : `yapifranckzoumana5@gmail.com`
- user_id : `5ff4d716-9a62-4c62-8098-b62dd4876e87`

(Le compte `yapi401@gmail.com` n'existe pas dans la base — merci de confirmer que c'est bien le bon compte avant que j'exécute.)

## Action
Insérer une ligne dans `public.platform_admins` :

```sql
INSERT INTO public.platform_admins (user_id)
VALUES ('5ff4d716-9a62-4c62-8098-b62dd4876e87')
ON CONFLICT (user_id) DO NOTHING;
```

## Résultat attendu
- Après reconnexion (ou refresh), le lien "Administration" apparaît dans la sidebar.
- Vous pouvez ouvrir `/admin` et voir les 9 onglets (Dashboard, Entreprises, Utilisateurs, Plans, Factures, Vérifications, Noms réservés, Super admins, Audit).

## Sécurité
Changez le mot de passe que vous avez partagé par précaution — je ne l'ai ni lu ni utilisé, mais un mot de passe ne doit jamais être envoyé dans le chat.
