# Terminer l'import de plusieurs PDF dans l'assistant IA

Le côté serveur est déjà en place : l'IA sait lire jusqu'à 10 PDF d'un coup, soit en les fusionnant en un seul rapport, soit en faisant une section par document, avec un état par fichier. Il reste l'interface de l'assistant et la vérification.

## Ce qui sera terminé

- Le bouton « PDF » de l'assistant accepte plusieurs fichiers d'un coup, et on peut aussi glisser-déposer plusieurs PDF dans le panneau.
- Une liste des fichiers choisis s'affiche avec leur état : en attente, en cours, lu, ou erreur avec le motif. Un fichier illisible n'annule pas les autres.
- Un choix avant l'import :
  - **Fusionner** : un seul rapport cohérent à partir de tous les documents.
  - **Une section par document** : chaque PDF devient une section.
- Le contenu importé complète le brouillon existant au lieu de l'effacer, avec un bouton « Annuler l'import » qui revient à l'état précédent.
- Refus immédiat, côté navigateur, des fichiers qui ne sont pas des PDF ou qui dépassent 20 Mo, et de plus de 10 fichiers.

Le comportement actuel pour une image seule, un fichier Word, ou un seul PDF reste inchangé. Rien ne change sur les rapports existants, les budgets, le partage ou les PDF exportés.

## Détails techniques

- `src/components/AIAssistantPanel.tsx` :
  - input PDF en `multiple` + zone de dépôt (`onDragOver`/`onDrop`) sur le corps du panneau.
  - état local `pendingFiles: { file, status, error }[]`, `pdfMode: PdfMergeMode`, `undoDraft: ExtractedReport | null`.
  - `handlePdfFiles(files)` : validation (type/taille/nombre), conversion base64 via `fileToBase64`, appel unique à `aiExtractFromPdfs` avec `{ files, mode, style }`, remplissage des statuts depuis `perFile`.
  - fusion non destructive : mémoriser `getDraft()` avant l'appel, puis appliquer un brouillon combiné (titre/intro/conclusion conservés s'ils existent déjà, sections ajoutées à la suite) via le `applyDraft` existant — le contrat de props reste inchangé, la fusion se fait dans le panneau.
  - toasts récapitulatifs : « X document(s) importé(s), Y échec(s) ».
- Aucun changement dans `src/lib/ai.functions.ts` (déjà terminé) ni dans `ReportForm.tsx`.
- Vérification : contrôle des types sur les fichiers touchés, puis test navigateur sur `/reports/new` avec deux PDF générés, en vérifiant que les sections des deux documents apparaissent dans le brouillon.

## Hors périmètre

- L'option « garder les fichiers en pièces jointes » du plan initial reste reportée (les pièces jointes s'ajoutent déjà manuellement dans le formulaire).
- Les erreurs de type préexistantes du module Congés, dues à des types de base de données à régénérer, ne sont pas traitées ici.
