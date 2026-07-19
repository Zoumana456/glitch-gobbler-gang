## Objectif
Intégrer le contenu du ZIP `Glitch_Gobbler_Patrol.zip` dans le projet actuel. Les tables et données existantes (`reports`, `report_sections`, `report_images`, `section_bullets`, `share_audit_log`, `profiles`) **restent intactes** — uniquement des ajouts.

## Ce que le ZIP apporte de nouveau

### Fonctionnalités
- **Entreprises (multi-tenant léger)** : table `companies`, `company_members`, employés (`company.employees.$id`). Route `/company`.
- **Procès-verbaux (Minutes)** : `report_minutes`, dashboard, éditeur, vue. Routes `/minutes`, `/minutes/$id`, `/minutes/dashboard`.
- **Notes internes sur les rapports** : nouvelle table + composant `ReportNotes`.
- **Partages nominatifs** : `report_shares` (partager à un utilisateur précis) + dialogue `SharePeopleDialog` en plus des liens publics existants.
- **Admin plateforme** : route `/admin`, `platform.functions.ts`, `reserved-names`.
- **Invitations** : route publique `/invite/$token`.
- **Recherche globale + Command palette** (`⌘K`).
- **Attachments** : `AttachmentUploader`, validation d'upload.
- **Voix** : dictée + synthèse vocale (`SpeakButton`, `/api/public/ai/speak`).

### Sécurité
- Nouveau schéma `app_private` pour fonctions SECURITY DEFINER (évite exposition PostgREST).
- Helpers `is_company_owner`, `is_report_author`, etc.
- Politiques RLS durcies sur `company_members`.
- Normalisation des noms d'entreprise (extension `unaccent`).

## Stratégie — préserver les données

### Migrations à rejouer (idempotentes, additives)
Je rejoue **uniquement** les 9 migrations non appliquées, dans l'ordre :
1. `20260718103009` — set_updated_at (CREATE OR REPLACE, safe)
2. `20260719100105` — companies, company_members, employees
3. `20260719102806` — report_minutes
4. `20260719104145` — durcissement RLS company_members
5. `20260719104351` — GRANTs sur helper functions
6. `20260719104526` — schéma `app_private`
7. `20260719105555` — report_shares (nominatifs)
8. `20260719110000` — `app_private.is_report_author`
9. `20260719113725` — unaccent + normalize_company_name

Aucune ne touche `reports`, `report_sections`, `report_images`, `section_bullets`, `share_audit_log`, `profiles` sur leurs colonnes existantes → **zéro perte de données**.

Avant de rejouer, je vérifie qu'aucune migration antérieure du ZIP n'ait été partiellement re-écrite (les 12 premières correspondent à ce qui est déjà en base — je les ignore).

### Fichiers code à ajouter (nouveaux)
- `src/components/` : `AttachmentUploader`, `CommandPalette`, `ListSkeletons`, `MinuteForm`, `MinuteView`, `ReportMinutes`, `ReportNotes`, `RequestVerificationDialog`, `SharePeopleDialog`, `SpeakButton`.
- `src/lib/` : `company.functions.ts`, `minutes.functions.ts`, `notes.functions.ts`, `platform.functions.ts`, `reserved-names.functions.ts`, `search.functions.ts`, `shares.functions.ts`, `upload-validation.ts`.
- `src/routes/_authenticated/` : `admin.tsx`, `company.tsx`, `company.employees.$id.tsx`, `minutes.$id.tsx`, `minutes.dashboard.tsx`, `minutes.index.tsx`.
- `src/routes/` : `invite.$token.tsx`.
- `src/routes/api/public/ai/speak.ts`.

### Fichiers code à remplacer (mise à jour de l'existant)
- `src/components/ReportForm.tsx` (branche notes + minutes + partage nominatif)
- `src/components/AIAssistantPanel.tsx`
- `src/components/DictationButton.tsx`, `Lightbox.tsx`
- `src/lib/reports.functions.ts` + `reports.types.ts` + `pdf-utils.tsx`
- `src/routes/_authenticated/reports.*` (index/edit/view)
- `src/routes/_authenticated/profile.tsx`, `route.tsx`, `__root.tsx`, `auth.tsx`, `index.tsx`, `share.$token.tsx`, `reset-password.tsx`
- `src/router.tsx`, `src/start.ts`, `src/server.ts`, `src/styles.css`
- `src/routeTree.gen.ts` (régénéré automatiquement par le plugin)

### Fichiers à préserver strictement (jamais touchés)
- `.env` (variables Supabase)
- `supabase/config.toml` (project_id)
- `src/integrations/supabase/{client,client.server,auth-middleware,auth-attacher,types}.ts` (auto-générés)
- Toutes les migrations SQL déjà présentes

### Dépendances
Fusion `package.json` : ajout de `file-type` (validation d'upload). Le reste est identique.

## Ordre d'exécution

1. Rejouer 9 migrations dans l'ordre via l'outil migration (une par une, l'utilisateur approuve).
2. `bun add file-type`.
3. Copier tous les **nouveaux fichiers** du ZIP vers le projet.
4. Écraser les **fichiers existants modifiés** un par un (diff rapide, aucun contenu perdu — le ZIP est basé sur la même branche + améliorations).
5. Ignorer `src/routeTree.gen.ts` (le plugin le regénère au dev/build).
6. `bun run build` + typecheck pour valider.
7. Vérifier avec Playwright : `/reports` (données existantes visibles), `/minutes`, `/company`, `/admin`.

## Ce qui reste identique pour toi
- Ton compte, tes rapports actuels, tes images uploadées : **tout reste accessible**.
- Les partages publics existants continuent de fonctionner.
- Les URLs de rapports restent stables.

## Points d'attention
- Les nouvelles routes `company/minutes/admin` seront accessibles mais **vides** au départ — tu devras créer ta première entreprise pour tester ces sections.
- L'AI Assistant reste sur Lovable AI Gateway (aucun changement de provider).
- Si une migration échoue (conflit inattendu), on s'arrête et on diagnostique avant de continuer.
