
## 1. Base de données (migration)

- **`reports`**: ajouter `share_expires_at TIMESTAMPTZ NULL`.
- **`share_audit_log`** (nouvelle table):
  - `report_id` (fk reports), `actor_id` (uuid, nullable pour anon), `action` TEXT (`created` | `copied` | `revoked` | `regenerated` | `viewed` | `exported`), `ip` TEXT nullable, `user_agent` TEXT nullable, `created_at`.
  - GRANT: `SELECT` pour `authenticated` (RLS filtrera par `author_id`), `ALL` pour `service_role`. Pas d'accès `anon`.
  - RLS: seul l'auteur du rapport lié peut lire (`EXISTS (SELECT 1 FROM reports WHERE reports.id = share_audit_log.report_id AND reports.author_id = auth.uid())`). Insertions uniquement via `supabaseAdmin` server-side.
- **`getSharedReport`** met à jour la RLS anon existante pour rejeter les rapports avec `share_expires_at < now()`.

## 2. Server functions (`src/lib/reports.functions.ts`)

- **`enableShare`** accepte `expiresInDays?: number` (null = pas d'expiration), écrit `share_expires_at`, journalise `created` ou `regenerated` (si un token existait déjà).
- **`revokeShare`** journalise `revoked`.
- **`logShareEvent`** nouvelle fn authentifiée pour `copied`.
- **`getShareToken`** retourne aussi `expires_at`.
- **`getSharedReport`** (public):
  - Refuse si `share_expires_at` est passé (throw "Lien expiré").
  - Journalise `viewed` via `supabaseAdmin` (best-effort, capture IP via `getRequest()` headers).
- **`logSharedExport`** (public, prend token) — journalise `exported`.
- **`getShareAuditLog`** (auth) — retourne l'historique pour le propriétaire.

## 3. UI — Dialogue de partage (`reports.$id.index.tsx`)

- Sélecteur d'expiration lors de la génération: **Aucune / 24h / 7j / 30j / Personnalisé**.
- Affichage: URL, badge "Expire le JJ/MM/YYYY" (ou "Sans expiration"), état "Expiré" si dépassé avec bouton régénérer.
- Bouton **Régénérer** (revoke + enable) qui journalise `regenerated`.
- Bouton **Copier** appelle `logShareEvent('copied')`.
- Section **Historique d'activité** (repliable) listant les 20 derniers événements (icône + date + action + IP tronquée).

## 4. Vue publique enrichie (`src/routes/share.$token.tsx`)

- **En-tête sticky** avec titre, auteur, date + bouton PDF (déjà présent, journalise `exported`).
- **Table des matières** latérale (desktop) / accordéon (mobile) listant les sections avec ancres de navigation.
- **Lightbox paginée**: navigation ← → clavier (déjà partiellement dans `Lightbox`), indicateur "3 / 12".
- **États vides** cohérents: sections sans contenu = message discret; rapport sans images = pas de bloc vide.
- **Écran "Lien expiré"** distinct de "Lien invalide" (basé sur le message d'erreur).
- **Footer** de la page publique: "Rapport partagé en lecture seule · Généré via Lovable Rapports".
- Mode lecture seule cohérent: aucune action de mutation, focus visible pour navigation clavier.

## 5. PDF export sur la vue publique

Déjà présent (`downloadReportPdf(query.data)`). Ajouter l'appel `logSharedExport({ token })` avant/après téléchargement pour tracer.

## Détails techniques

- Le composant `Lightbox` supporte déjà `onChange`; ajouter le compteur "index/total" dans son rendu si absent.
- La table des matières utilise `id={sectionSlug}` sur chaque `<section>` et scroll doux.
- Toutes les insertions d'audit passent par `supabaseAdmin` chargé dynamiquement dans le handler (respect règle `.functions.ts`).
- Aucun changement au client Supabase généré.

## Ordre de livraison

1. Migration (table audit + colonne expiration).
2. Server functions (expiration, audit, régénération).
3. Dialogue de partage enrichi.
4. Vue publique enrichie + journalisation export/view.
