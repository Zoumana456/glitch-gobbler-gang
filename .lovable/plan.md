## Objectif

Importer le contenu du zip `pixel-perfect-clone-10008-main.zip` dans le projet actuel et résoudre l'erreur de publication.

## Étapes

1. **Extraction sécurisée du zip**
   - Extraire dans `/tmp/upload/` (hors du repo)
   - Vérifier l'absence de `.git` avant toute copie
   - Lister les fichiers pour repérer d'éventuels artefacts non souhaités (`node_modules`, `dist`, `.env` avec secrets, `package-lock.json` en doublon de `bun.lock`)

2. **Fusion dans le projet**
   - Copier via `rsync` en excluant `.git`, `node_modules`, `dist`, `package-lock.json`, `.lovable/`
   - Écraser `src/`, `public/`, `package.json`, `components.json`, config Tailwind/Vite/TS si présents dans le zip
   - Préserver les fichiers critiques du template TanStack Start: `src/router.tsx`, `src/start.ts`, `src/server.ts`, `src/routes/__root.tsx`, `src/routeTree.gen.ts` (auto-généré), `vite.config.ts` — les remplacer uniquement si le zip fournit des équivalents compatibles TanStack

3. **Diagnostic du problème de publication**
   - Lancer `bun install` pour installer les nouvelles dépendances déclarées dans `package.json` du zip
   - Vérifier le build (`bun run build`) — la publication échoue quasi systématiquement à cause d'une erreur de build (import manquant, route TanStack mal nommée, TypeScript strict)
   - Lire les logs du dev server et corriger les erreurs remontées

4. **Corrections attendues côté TanStack Start**
   - Le zip semble venir d'un ancien template (présence de `package-lock.json`, `DictationButton.tsx`, `ReportForm.tsx`) potentiellement basé sur React Router / Vite classique
   - Adapter les composants au routing `src/routes/*.tsx` de TanStack Start si nécessaire
   - Corriger les imports `react-router-dom` → `@tanstack/react-router`
   - S'assurer que chaque `<Link to="...">` cible une route existante

5. **Vérification finale**
   - Build clean, pas d'erreur TypeScript
   - Aperçu fonctionnel
   - Puis relancer la publication

## Note

Le message "on n'arrive pas à publier" vient presque toujours d'un **build en échec**. Une fois les erreurs de build corrigées, la publication redevient possible via le bouton Publish. Je ne peux pas cliquer sur Publish à votre place, mais je m'assure que le build passe.
