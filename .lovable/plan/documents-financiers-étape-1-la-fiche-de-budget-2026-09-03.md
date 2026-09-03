# Documents financiers — étape 1 : la fiche de budget

Objectif : ajouter aux rapports une famille de « styles de document » financiers (budget, devis, proforma, facture, bon de commande), chacun avec sa propre saisie et son propre rendu écran/PDF. On commence par le **budget**, en tableau détaillé, et l'architecture est posée pour brancher les autres types ensuite sans tout refaire.

## Ce que vous obtenez maintenant

1. **Nouveau choix de style à la création** : à côté de « Rapport journalier » et « Rapport consolidé », un choix « Budget » (les entrées Devis / Proforma / Facture apparaissent grisées avec la mention « bientôt » pour montrer la suite).
2. **Écran de saisie budget** dédié, différent du formulaire de rapport classique :
   - En-tête : titre, numéro du document (auto : `BUD-2026-0001`, modifiable), date, période concernée, devise au choix (FCFA, EUR, USD, GHS…), taux de TVA au choix (0, 9, 18 % ou libre), objet / bénéficiaire.
   - **Tableau de lignes** avec : Catégorie, Rubrique (désignation), Unité, Quantité, Prix unitaire, **Montant prévu** (calculé), **Réalisé**, **Écart** (calculé = prévu − réalisé), % d'exécution, Observations.
   - Regroupement par catégorie avec **sous-totaux** repliables, ajout/suppression/réordonnancement des lignes, duplication d'une ligne.
   - **Bas de tableau** : Total prévu, Total réalisé, Écart global, Total HT, TVA (selon taux), Total TTC — recalculés en direct.
   - Notes / hypothèses budgétaires, pièces jointes et signature du responsable comme sur les autres documents.
3. **Rendu écran (vue du document)** en tableau propre, lisible sur mobile (défilement horizontal), avec bandeau de totaux.
4. **Rendu PDF spécifique « fiche de budget »** : bandeau titre + numéro, bloc méta (période, devise, objet), tableau à colonnes fines avec en-têtes gris, lignes zébrées, sous-totaux par catégorie en gras, bloc totaux encadré en fin de tableau, montants alignés à droite et formatés selon la devise, écarts négatifs en rouge, pagination et rappel des en-têtes de colonnes sur chaque page, bloc signature.
5. **Intégration au reste** : le budget apparaît dans la liste des rapports avec un badge « Budget », entre dans la recherche, le partage par lien, la duplication et le circuit de validation hiérarchique existant, exactement comme un rapport.

## Détails techniques

**Base de données** (migration unique, aucune donnée existante touchée) :
- `reports` : nouvelles colonnes `doc_type text not null default 'report'` (valeurs : `report`, `budget`, puis `quote`, `proforma`, `invoice`), `doc_number text`, `currency text default 'XOF'`, `tax_rate numeric default 0`, `period_label text`, `counterparty text`. Les rapports existants restent en `doc_type = 'report'`.
- Nouvelle table `public.report_budget_lines` : `id`, `report_id` (FK cascade), `category`, `label`, `unit`, `quantity numeric`, `unit_price numeric`, `planned_amount numeric`, `actual_amount numeric`, `notes`, `position int`. Ordre obligatoire : CREATE TABLE → GRANT (`authenticated`, `service_role`) → ENABLE RLS → policies calquées sur `report_sections` (accès via le rapport parent : auteur, partages, hiérarchie validante).
- Vue publique du partage : les lignes de budget sont renvoyées par la fonction serveur de partage existante après validation du jeton et de l'expiration (pas de policy `anon`).

**Code** :
- `src/lib/reports.types.ts` : types `DocType`, `BudgetLine`, `BudgetTotals`, extension de `LoadedReport` / `ReportPayload` / `ReportListItem`.
- `src/lib/budget.ts` (nouveau, pur) : calculs prévu/réalisé/écart, sous-totaux par catégorie, HT/TVA/TTC, formatage devise — testé unitairement.
- `src/lib/reports.functions.ts` : `upsertReport` et `getReport` gèrent les lignes de budget et les nouveaux champs ; génération du numéro de document côté serveur.
- `src/components/budget/BudgetForm.tsx` + `BudgetLinesTable.tsx` (nouveaux) ; `reports.new.tsx` et `reports.$id.edit.tsx` choisissent le formulaire selon `doc_type`.
- `src/components/budget/BudgetView.tsx` pour la vue écran ; `src/routes/_authenticated/reports.$id.index.tsx` et `share.$token.tsx` branchent la vue selon `doc_type`.
- `src/lib/pdf-utils.tsx` : nouveau `BudgetPdfDocument` + `downloadBudgetPdf`, styles de tableau séparés des styles rapport ; les points d'entrée d'export existants aiguillent selon `doc_type` (le bundle multi-documents continue de fonctionner).
- Aucune modification des fichiers auto-générés ni du module de messagerie/congés.

## Suite (préparée, non incluse dans cette étape)
Devis, proforma et facture réutiliseront la même table de lignes et les mêmes calculs, avec en plus : client/destinataire, validité de l'offre, conditions de paiement, remises, et un rendu PDF commercial distinct.
