## Problème

Le compte `yapi401@gmail.com` existe bien (créé le 19/07, email confirmé, mot de passe présent) mais aucune connexion n'a jamais abouti (`last_sign_in_at = null`) et le log auth montre `400: Invalid login credentials`.

Le mot de passe stocké lors de la création via l'API Admin ne correspond pas à `ZOUM3011####` (probablement rejeté silencieusement ou hashé sur une valeur différente lors du `curl` initial).

## Correction

1. Réinitialiser le mot de passe du compte `yapi401@gmail.com` à `ZOUM3011####` via l'API Auth Admin (`PUT /auth/v1/admin/users/{id}` avec `{ "password": "ZOUM3011####", "email_confirm": true }`).
2. Vérifier immédiatement en base que `updated_at` a bougé.
3. Confirmer à l'utilisateur les identifiants de connexion sur `/auth` :
   - Email : `yapi401@gmail.com`
   - Mot de passe : `ZOUM3011####`
4. Rappeler qu'à la première connexion réussie, `/admin` demandera l'activation de la 2FA (scan QR + code à 6 chiffres).

Aucun changement de code ni de schéma DB — juste une réinitialisation de credential côté Auth.