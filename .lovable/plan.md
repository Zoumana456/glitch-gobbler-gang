## Objectif
Enrichir l'espace `/admin` (déjà existant) avec la gestion tarifaire (plans, prix au siège, factures manuelles, Stripe), des statistiques, la gestion des utilisateurs, un journal d'audit global, et un onglet Vérifications amélioré avec notifications email.

## Structure finale de `/admin` (7 onglets)
```
Dashboard | Entreprises | Utilisateurs | Plans & Tarifs | Factures | Vérifications | Audit | Super admins | Noms réservés
```

## 1. Base de données (une seule migration)

**`subscription_plans`** — catalogue de plans (Free / Pro / Business).
Colonnes : `code` (unique), `name`, `description`, `monthly_price_cents`, `yearly_price_cents`, `seat_limit`, `price_per_extra_seat_cents`, `features` (jsonb), `is_active`, `sort_order`, `stripe_product_id`, `stripe_price_monthly_id`, `stripe_price_yearly_id`.

**`companies` (ALTER)** — ajouter `plan_id` (FK plans, nullable), `billing_cycle` (monthly|yearly), `custom_seat_price_cents` (override optionnel), `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`.

**`company_invoices`** — factures/devis manuels ou Stripe.
Colonnes : `company_id`, `number` (auto AAAA-NNNN), `amount_cents`, `currency` (EUR), `period_start`, `period_end`, `status` (draft|sent|paid|void|overdue), `due_date`, `paid_at`, `notes`, `stripe_invoice_id`, `pdf_url`, `created_by`.

**`admin_audit_log`** — journal global.
Colonnes : `actor_id`, `actor_email`, `action` (ex. `plan.update`, `verification.approve`, `user.disable`), `entity_type`, `entity_id`, `metadata` (jsonb), `ip`, `created_at`.

**RLS/GRANT** : lecture/écriture réservées aux `platform_admins` via `is_platform_admin(auth.uid())`. Lecture propriétaire (owner) autorisée sur `subscription_plans` (actifs seulement) et sur ses propres `company_invoices`.

**Seed** : 3 plans par défaut (Free 0€/3 sièges, Pro 29€/mois/10 sièges, Business 99€/mois/50 sièges).

## 2. Server functions (`src/lib/admin.functions.ts`)
Tous protégés par `requireSupabaseAuth` + check `is_platform_admin` :
- `getAdminDashboard` — KPI : nb entreprises, users actifs 30j, rapports du mois, revenus MTD, verifications en attente
- `listPlans` / `upsertPlan` / `togglePlanActive`
- `assignCompanyPlan({ companyId, planId, billingCycle, customSeatPriceCents })`
- `listInvoices({ status?, companyId? })` / `createInvoice` / `updateInvoiceStatus` / `sendInvoice` (déclenche email)
- `listUsers({ q, page })` / `disableUser` / `enableUser` / `moveUserToCompany`
- `listAuditLog({ q, action?, page })`
- Hook `logAdminAction(...)` appelé depuis chaque mutation admin.

## 3. Stripe (bouton "Activer les paiements" dans l'onglet Plans)
- Activation via `payments--enable_stripe_payments` (plan Pro Lovable requis — signaler à l'utilisateur).
- Une fois actif : bouton "Synchroniser vers Stripe" par plan → crée Product + 2 Prices (mensuel/annuel), stocke les IDs.
- Route webhook `src/routes/api/public/webhooks/stripe.ts` : vérifie signature, met à jour `subscription_status`, ajoute une ligne dans `company_invoices` sur `invoice.paid`.
- Route `src/routes/api/checkout.ts` (authent) : crée une Checkout Session pour le plan choisi par un DG depuis `/company`.

## 4. Onglet Vérifications — refonte
Dans `admin.tsx` `VerificationsPanel` :
- Sous-onglets : **En attente** (badge count) / **Approuvées** / **Refusées** / **Toutes**.
- Vue détaillée modale par demande : docs KYC (pièce recto/verso + selfie), rapport IA, notes internes multi-lignes, boutons Approuver/Refuser avec commentaire obligatoire.
- Sur décision : `logAdminAction` + envoi email au demandeur (approuvé/refusé + motif) via templates React Email.

## 5. Emails (Lovable Emails)
Prérequis : domaine email vérifié. Sinon proposer setup email en amont.
Templates dans `src/lib/email-templates/` :
- `verification-approved.tsx`
- `verification-rejected.tsx`
- `invoice-issued.tsx` (avec bouton "Payer" si Stripe actif)

Déclenchés côté serveur dans les server fns concernés via `sendTemplateEmail`.

## 6. UI Admin — fichiers modifiés/créés
- `src/routes/_authenticated/admin.tsx` : ajouter 5 onglets (Dashboard, Utilisateurs, Plans, Factures, Audit) + refonte Vérifications.
- Nouveaux panneaux React dans `src/components/admin/` :
  `DashboardPanel.tsx`, `PlansPanel.tsx`, `InvoicesPanel.tsx`, `UsersPanel.tsx`, `AuditPanel.tsx`, `VerificationDetailDialog.tsx`.
- Ajout d'un widget côté DG dans `/company` : "Plan actuel + upgrade" (lien Stripe Checkout).

## Ordre d'implémentation
1. Migration DB + seed plans.
2. Server functions admin + logAdminAction.
3. UI onglets (Dashboard, Plans, Factures, Utilisateurs, Audit).
4. Refonte Vérifications + templates email (nécessite domaine email).
5. Activation Stripe (`enable_stripe_payments`) + sync produits + webhook + checkout — dernière étape, isolée.

## Hors périmètre
- Rapports comptables/export CSV avancés (à demander séparément si besoin).
- Multi-devise (EUR uniquement pour l'instant).
- Facturation à l'usage (usage-based) — plans à siège fixe seulement.
