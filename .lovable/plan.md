## Objectif
Masquer, pour les comptes super administrateurs (admin_only), le lien « Vérifier mon identité » (KYC) et la barre de recherche dans la sidebar.

## Modification
Fichier : `src/routes/_authenticated/route.tsx`

Dans `SidebarInner`, la variable `adminOnly` existe déjà (ligne 204). On l'utilise pour :

1. **Barre de recherche** (lignes 290-308) : envelopper le bloc dans `{!adminOnly && (...)}` — un super admin n'a rien à chercher côté rapports/PV/employés.
2. **Lien « Vérifier mon identité »** (lignes 374-385) : envelopper dans `{!adminOnly && (...)}` — un compte admin-only n'a pas de rapports à produire donc pas besoin de KYC.

Le reste (avatar, déconnexion, navigation admin) reste inchangé.

## Notes
- Aucune modification de logique métier, ni de base de données.
- Les utilisateurs standards (non admin-only) conservent la recherche et le lien KYC.
- Le raccourci clavier ⌘K reste actif globalement mais sans point d'entrée visuel pour les admins — acceptable puisqu'ils n'ont pas de données à indexer.