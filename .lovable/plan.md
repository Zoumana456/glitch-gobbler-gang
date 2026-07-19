## Plan de correction

Le problème visible est toujours : **Email ou mot de passe incorrect** pour le compte admin dédié. Je vais corriger ça sans toucher à vos rapports ni aux données existantes.

### Étapes prévues

1. **Vérifier le compte admin**
   - Confirmer que `yapi401@gmail.com` existe bien dans l’authentification.
   - Vérifier qu’il est marqué comme compte admin dédié dans le profil.
   - Vérifier qu’il est bien présent dans la liste des administrateurs plateforme.

2. **Réinitialiser proprement l’accès**
   - Définir un nouveau mot de passe temporaire fiable pour ce compte.
   - Marquer l’email comme confirmé si nécessaire, pour éviter un blocage de connexion.
   - Garder ce compte isolé : admin uniquement, sans accès création de rapports/entreprises.

3. **Tester la connexion comme un utilisateur réel**
   - Ouvrir `/auth`.
   - Tester la connexion email/mot de passe.
   - Vérifier la redirection vers `/admin`.
   - Vérifier que la protection 2FA s’affiche ensuite normalement.

4. **Ajouter une issue de secours si le login direct échoue encore**
   - Ajouter/valider un bouton ou flux “Mot de passe oublié” utilisable sur `/auth`.
   - Prévoir une page `/reset-password` si elle manque, pour que vous puissiez définir vous-même un nouveau mot de passe sans dépendre d’une modification manuelle.

### Ce qui ne sera pas modifié

- Vos rapports existants.
- Vos entreprises existantes.
- Les comptes utilisateurs normaux.
- Les données de production déjà enregistrées.

### Résultat attendu

Vous pourrez vous connecter depuis `/auth` avec le compte admin dédié, puis accéder à `/admin` après validation/activation de la 2FA.