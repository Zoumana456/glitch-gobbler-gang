## Problème

La page d'accueil ne se charge pas car l'app essaie d'utiliser Supabase (authentification, base de données) mais les variables d'environnement `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY` ne sont pas configurées.

Erreur console :
> Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY. Connect Supabase in Lovable Cloud.

## Solution

Activer **Lovable Cloud** pour ce projet. Cela va :
- Provisionner automatiquement la base de données, l'auth et le stockage
- Injecter les variables d'environnement nécessaires
- Débloquer immédiatement la page d'accueil et toutes les routes (dont `/reports`, `/auth`)

## Étapes

1. Activer Lovable Cloud sur le projet.
2. Vérifier que le préviews charge la page d'accueil sans erreur.
3. Re-publier l'app pour que la version en production reçoive aussi la configuration.

Aucun changement de code n'est nécessaire — le projet est déjà câblé pour Lovable Cloud, il manque juste l'activation.