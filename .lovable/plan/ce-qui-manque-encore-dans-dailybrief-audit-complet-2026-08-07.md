# Ce qui manque encore dans DailyBrief — audit complet

Bonne nouvelle d'abord : le scan de sécurité de la base ne remonte **aucun problème**. Les manques sont ailleurs.

## Constats vérifiés

| Domaine | État constaté |
| --- | --- |
| Notifications | Aucun code d'e-mail ni de notification dans l'app. Un rapport soumis, validé ou rejeté ne prévient personne. |
| Paiement | Les plans existent en base, mais aucun encaissement réel : le changement de plan reste une simple demande à traiter à la main. |
| Robustesse des pages | Quasi aucune page n'a d'écran d'erreur ou « page introuvable » dédié (2 occurrences sur 20 pages). Une panne réseau donne un écran cassé. |
| Mobile | 5 fichiers utilisent une hauteur d'écran qui coupe le contenu sur téléphone (barres du navigateur). |
| Installation / partage | Pas de manifeste d'app, pas d'icône d'écran d'accueil, pas d'image de prévisualisation quand on partage un lien. |
| Référencement | Pas de `robots.txt`, pas de sitemap. |
| Accessibilité | 23 boutons icône seule pour 22 `aria-label` au total : plusieurs boutons ne sont pas annoncés par un lecteur d'écran. |
| Tests | Aucun test automatisé dans le projet. |

## Ce que je propose de construire, par priorité

### 1. Notifications (le manque le plus visible pour tes utilisateurs)
- E-mail au valideur quand un rapport lui est soumis ; e-mail à l'auteur quand c'est validé ou rejeté (avec le commentaire).
- Un centre de notifications dans l'app : cloche dans la barre latérale, liste des évènements non lus, clic qui ouvre le rapport concerné.
- Rappel quotidien optionnel « tu n'as pas encore déposé ton rapport ».

### 2. Fiabilité de l'interface
- Écran d'erreur et « page introuvable » cohérents sur toutes les pages, avec bouton « réessayer » et retour aux rapports.
- Correction des hauteurs d'écran pour le mobile.
- Passe d'accessibilité : libellés sur tous les boutons icône, textes alternatifs sur les images.

### 3. Facturation réelle — en attente (en cours de développement)
Reportée : aucune API de paiement n'est encore branchée. Affiché comme « en cours de développement » côté produit.
- Branchement d'un vrai encaissement (Stripe) sur les plans : abonnement mensuel/annuel, sièges supplémentaires, page de retour, facture consultable.
- L'admin garde la main pour les cas sur mesure.

### 4. Présence publique
- Manifeste + icônes pour installer DailyBrief sur l'écran d'accueil du téléphone.
- Image de prévisualisation pour les liens partagés (accueil, tarifs, partage public).
- `robots.txt` et sitemap.

### 5. Filet de sécurité
- Tests automatisés sur les points sensibles : qui voit quels rapports, circuit de validation, expiration des liens de partage.

## Détails techniques

- Notifications e-mail : activer Lovable Email, gabarits transactionnels, envoi depuis les server functions de `src/lib/approvals.functions.ts` et `reports.functions.ts` (jamais côté client). Notifications in-app : nouvelle table `notifications` (RLS `auth.uid() = user_id`, GRANT `authenticated`/`service_role`), écriture via server function ou trigger, lecture via `useQuery`.
- Robustesse : ajouter `errorComponent` / `notFoundComponent` sur chaque `createFileRoute` de `src/routes`, factorisés dans un composant partagé ; remplacer `h-screen` par `h-dvh` dans `__root.tsx`, `_authenticated/route.tsx`, `auth.tsx`, `reset-password.tsx`, `share.$token.tsx`.
- Paiement : `enable_stripe_payments`, colonnes Stripe déjà présentes sur `companies`, webhook sous `src/routes/api/public/` avec vérification de signature.
- PWA/SEO : `public/manifest.webmanifest` + icônes + balises `theme-color` / `apple-touch-icon` dans `__root.tsx` ; `og:image` / `twitter:image` en URL absolue sur `index.tsx`, `pricing.tsx`, `share.$token.tsx`.
- Tests : Vitest sur `hierarchy.server.ts` (`visibleMembers`, `descendantIds`, `nextApproverOf`) et sur la validation des jetons de partage.

Dis-moi par quel bloc tu veux commencer — je peux aussi tout enchaîner dans l'ordre ci-dessus.
