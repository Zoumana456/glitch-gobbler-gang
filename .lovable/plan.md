# Feuille de route DailyBrief — 2 nouveaux modules + finitions

Objectif : ajouter deux applications utiles à **tous les employés** (Congés & Absences, Documents/GED), puis consolider l'existant et l'expérience mobile. Livré en 4 lots pour que chaque étape soit testable.

---

## Lot 1 — Module « Congés & Absences »

Pour l'employé :
- Écran d'accueil du module : solde de congés, mes demandes en cours, prochaines absences de l'équipe.
- Formulaire de demande : type (congé payé, maladie, sans solde, télétravail, autre), dates début/fin, demi-journée, motif, pièce justificative facultative.
- Suivi du statut : brouillon → soumise → validée / refusée, avec commentaire du validateur.

Pour le manager / la direction :
- File d'attente « À valider » avec approbation ou refus commenté, en s'appuyant sur la hiérarchie déjà en place (manager direct, puis niveau supérieur si besoin).
- Calendrier d'équipe (vue mois) montrant qui est absent, pour éviter les chevauchements.
- Alerte simple si deux personnes du même service se chevauchent.

Notifications : demande soumise, demande validée/refusée, rappel de retour.

## Lot 2 — Module « Documents » (GED d'entreprise)

- Bibliothèque par entreprise : dossiers, sous-dossiers, glisser-déposer de fichiers.
- Métadonnées : titre, description, catégorie (procédure, contrat, RH, note interne…), auteur, date.
- Versions : ré-import d'un même document conservé en historique, avec téléchargement d'une version antérieure.
- Visibilité : privé, service, entreprise entière — contrôlée côté serveur.
- Recherche par nom, catégorie et contenu texte (titre + description).
- Lien vers un rapport ou une tâche depuis un document (et inversement).

## Lot 3 — Consolidation de l'existant

- **Messagerie** : pièces jointes à l'envoi et au téléchargement, réponse/transfert avec citation, marquage lu/non lu fiable, et état clair quand un compte a besoin d'être reconnecté.
- **Rapports** : filtres combinés (période, statut, auteur, service), export PDF d'une sélection, indicateur « en attente de ma validation » visible dès l'accueil.
- **Tâches** : vue « Mes tâches du jour », rappels d'échéance, création d'une tâche directement depuis un rapport.
- **Notifications** : centre unique regroupé par module, marquage tout lu, préférences par type.

## Lot 4 — Mobile, performance, installation

- Passe responsive sur les écrans les plus utilisés (rapports, tâches, messagerie, congés) : cibles tactiles ≥ 44 px, tableaux transformés en cartes sous 768 px, barres d'action collées en bas sur mobile.
- Application installable (PWA) avec icône, écran de démarrage et navigation par onglets sur mobile.
- Chargement plus rapide : découpage du code par module, listes paginées, squelettes de chargement homogènes.
- Réduction des allers-retours réseau sur les écrans de liste.

---

## Détails techniques

Base de données (nouvelles tables, `public`, avec GRANT + RLS et politiques par entreprise/hiérarchie) :
- `leave_types`, `leave_balances`, `leave_requests`, `leave_approvals`
- `documents`, `document_folders`, `document_versions`, `document_access`
- Bucket de stockage privé `company-documents` et `leave-proofs`, accès via chemins signés.

Code :
- Nouveaux modules dans `src/lib/modules/registry.ts` (`leaves`, `documents`, non-core donc désactivables depuis `/company/applications`).
- Routes sous `src/routes/_authenticated/leaves.*` et `documents.*`, chacune avec son `head()` (titre + description propres).
- Logique serveur en `src/lib/leaves/*.functions.ts` / `*.server.ts` et `src/lib/documents/*`, en réutilisant le moteur d'approbation existant de `src/lib/hierarchy.server.ts` plutôt que d'en écrire un second.
- Notifications via `src/lib/notifications.server.ts` déjà en place.

Sécurité : aucune donnée d'un employé accessible à un autre sans lien hiérarchique ou partage explicite ; toutes les vérifications de rôle côté serveur.

## Ordre proposé

1. Lot 1 (Congés) — le plus attendu par les employés.
2. Lot 2 (Documents).
3. Lot 3 (finitions existant).
4. Lot 4 (mobile & performance).

Dis-moi si tu veux inverser l'ordre ou retirer un lot ; sinon je démarre par le Lot 1.
