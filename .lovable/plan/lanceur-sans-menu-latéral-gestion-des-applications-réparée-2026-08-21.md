# Lanceur sans menu latéral + gestion des applications réparée

## 1. Page « Mes applications » en plein écran

Aujourd'hui `/apps` s'affiche avec la barre latérale, et comme le lanceur n'appartient à aucune application, la barre affiche par défaut le menu « Rapports » — ce qui est trompeur.

À faire :
- Sur `/apps` (et sur `/company/applications`, même logique de page « système »), masquer entièrement la barre latérale desktop et le tiroir mobile.
- Garder une en-tête simple en haut : logo DailyBrief, recherche (⌘K), notifications, avatar/profil, déconnexion — donc rien n'est perdu.
- Depuis une application, le lanceur reste accessible par l'entrée « Applications » du menu ; depuis le lanceur, on entre dans une app et la barre latérale de cette app réapparaît.

## 2. Gestion des applications qui ne fonctionne pas

Constat vérifié : la table des applications d'entreprise est vide, aucun interrupteur n'a donc jamais été enregistré, alors que le compte utilisé est bien propriétaire de son entreprise et que les droits d'accès à la table sont corrects. La cause exacte de l'échec de l'enregistrement n'est pas encore confirmée.

À faire, dans cet ordre :
1. Reproduire l'action dans le navigateur (connexion, `/company/applications`, bascule de « Tâches ») et lire l'erreur réelle côté serveur.
2. Corriger la cause identifiée. Piste principale : l'ordre de construction de la fonction serveur d'enregistrement (validation déclarée avant le contrôle d'authentification), qui peut faire échouer l'appel avant l'écriture.
3. Afficher un message d'erreur explicite en cas d'échec, et un retour visuel immédiat sur l'interrupteur (état en cours, retour arrière si erreur).
4. Vérifier l'effet réel après enregistrement : l'application désactivée disparaît du lanceur et du menu, ses écrans deviennent inaccessibles, et l'état survit à un rechargement.
5. Rendre l'entrée « Gérer les applications » visible pour le propriétaire aussi bien depuis le lanceur que depuis l'application Entreprise.

## Détails techniques

- `src/routes/_authenticated/route.tsx` : ajouter une liste de chemins « chrome-less » (`/apps`, `/company/applications`) ; quand le chemin courant y figure, ne pas rendre `<aside>` ni le tiroir mobile, supprimer le padding gauche et rendre une barre supérieure compacte (logo, ⌘K, `NotificationsBell`, avatar, déconnexion).
- `src/lib/modules.functions.ts` : dans `setModuleEnabled`, placer `.middleware([requireSupabaseAuth])` avant `.inputValidator(...)`, puis `.handler(...)` ; conserver le `upsert` sur la clé `(company_id, module_code)`.
- `src/routes/_authenticated/company.applications.tsx` : mutation optimiste + invalidation de `["my-modules"]`, message d'erreur exact retourné par le serveur.
- Vérification : script Playwright jetable (connexion, bascule, rechargement, contrôle du menu et du lanceur), plus `vitest` et contrôle des types.
