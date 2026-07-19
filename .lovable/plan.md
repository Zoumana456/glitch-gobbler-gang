# Feuille de route DailyBrief → production-ready

Audit rapide de l'app (rapports, entreprises, KYC, admin, IA, partage). Voici ce qui manque ou peut être renforcé, classé par priorité.

## 1. Fiabilité & sécurité (P0 — à faire en premier)

- **Rate-limiting IA** : le check de nom d'entreprise et l'assistant Gemini sont appelés par utilisateur authentifié sans limite → un utilisateur peut vider les crédits Lovable AI. Ajouter un compteur par `user_id` + fenêtre glissante (table `ai_usage_log`) et retour `429` propre.
- **Modération des uploads** : `report-images`, `report-attachments`, `company-proofs` acceptent tout MIME/taille. Imposer taille max (5 Mo images, 10 Mo PDF), whitelist MIME, et scan basique.
- **Audit log unifié** : `admin_audit_log` et `share_audit_log` existent, mais rien ne trace les actions dangereuses (ban, suppression user, reset MFA d'urgence, changement de plan). Étendre la journalisation.
- **Session 2FA** : le `MfaGate` couvre `/admin`, mais un admin qui perd son téléphone n'a que le reset email. Ajouter codes de secours (backup codes chiffrés) à la première activation.
- **Politiques RLS restantes** : passer un dernier scan (`security--run_security_scan`) et fermer les policies trop larges éventuelles.

## 2. UX & parcours utilisateur (P1)

- **Onboarding guidé** : au 1er login, wizard 3 étapes (profil → entreprise ou rejoindre → premier rapport). Aujourd'hui l'utilisateur atterrit sur une page vide.
- **États vides soignés** : `/reports`, `/minutes`, dashboard entreprise — illustrations + CTA clairs quand aucune donnée.
- **Notifications in-app** : cloche dans la topbar pour invitations reçues, rapports partagés, KYC approuvé, changement de plan validé.
- **Recherche globale** : `Cmd+K` (cmdk est déjà dans shadcn) pour naviguer entre rapports, PV, employés, pages.
- **Mode brouillon explicite** : distinguer visuellement "brouillon" vs "publié" sur les rapports, avec bouton "Publier" séparé de "Enregistrer".
- **Responsive mobile** : audit rapide — sidebar `/admin` et le formulaire de rapport sont serrés en < 400px.
- **Dark mode** : les tokens existent (styles.css) mais plusieurs écrans forcent du blanc. Un pass de nettoyage.

## 3. Fonctionnalités manquantes (P1)

- **Notifications email** : Resend (via connector) pour invitations, KYC validé/refusé, rapport partagé, plan expirant. Aujourd'hui tout se joue in-app.
- **Export bulk** : bouton "Exporter tous mes rapports" (ZIP de PDFs) sur `/reports`.
- **Statistiques employé** : sur la fiche employé côté DG — nb rapports/mois, taux de complétion, tendance.
- **Templates de rapports** : le DG définit des modèles réutilisables (sections + questions types) que les employés instancient.
- **Commentaires sur rapports** : fil de discussion DG ↔ employé sur un rapport (table `report_comments`).
- **Recherche full-text** dans le contenu des rapports (Postgres `tsvector` + index GIN).

## 4. Facturation & business (P2)

- **Paiement réel** : les plans sont demandés/approuvés à la main. Intégrer Stripe (via `payments--enable_stripe_payments`) pour paiement mensuel/annuel automatique.
- **Cycle de vie plan** : dates de début/fin, renouvellement auto, downgrade auto en fin de période, alerte 7j avant expiration.
- **Factures PDF** : générer un vrai PDF téléchargeable pour chaque `company_invoice`.
- **Grille tarifaire publique** : page `/pricing` en public route avec SEO propre.

## 5. Performance & qualité technique (P2)

- **Pagination** : liste des rapports, employés, factures, audit — actuellement tout est chargé d'un coup.
- **Images optimisées** : compresser côté client (browser-image-compression) avant upload, servir en WebP.
- **Preloading LCP** : hero et logo via `head().links`.
- **Cache TanStack Query** : ajuster `staleTime` et `gcTime` par type de donnée (données admin longues, dashboard courtes).
- **Tests E2E** : suite Playwright couvrant les 5 parcours clés (signup, création rapport, invitation, partage, admin ban).
- **Monitoring** : logger les erreurs serveur (server-function-logs suffisent au début, sinon Sentry).

## 6. SEO & référencement (P3)

- Page d'accueil publique + `/pricing` + `/about` + `/legal/*` avec `head()` par route (title, description, OG).
- `public/llms.txt` + `public/robots.txt` + sitemap.
- Page `/blog` optionnelle si contenu prévu.

## 7. Conformité (P3)

- Pages **Mentions légales**, **Politique de confidentialité**, **CGU/CGV** — obligatoires en Côte d'Ivoire + RGPD pour utilisateurs UE.
- Bandeau cookies si analytics ajouté.
- Export & suppression de compte côté utilisateur (droit RGPD).

## Comment on avance

Je propose d'attaquer par **P0 (sécurité/fiabilité)** puis **P1 (UX + fonctionnalités manquantes)** en lots courts. Dis-moi si tu veux :

- **(A)** que je démarre par P0 en entier (rate-limit IA + uploads + audit + backup codes 2FA + scan sécurité),
- **(B)** que je m'attaque à un lot précis parmi la liste (dis lequel),
- **(C)** un plan resserré "MVP commercial" : notifications email + Stripe + pricing publique + onboarding, pour pouvoir vendre.

Rien n'est encore modifié — c'est un plan à valider.
