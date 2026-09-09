# Importer plusieurs PDF dans un rapport avec l'assistant IA

Aujourd'hui l'assistant IA n'accepte qu'un seul fichier à la fois : le bouton PDF ouvre un choix de fichier unique et le contenu importé remplace le brouillon. Objectif : pouvoir sélectionner plusieurs PDF d'un coup, laisser l'IA les lire tous, puis obtenir un seul rapport structuré.

## Ce que l'utilisateur verra

- Le bouton « PDF » permet de sélectionner plusieurs fichiers (et le glisser-déposer de plusieurs PDF dans le panneau IA).
- Une petite liste apparaît avec chaque fichier, son état (en attente / en cours / lu / erreur). Un fichier illisible n'annule pas les autres.
- Un choix avant l'import :
  - **Fusionner** : l'IA combine tous les PDF en un seul rapport cohérent (titre, objet, sections, conclusion).
  - **Une section par document** : chaque PDF devient une section, dans l'ordre choisi.
- Le contenu importé complète le brouillon en cours au lieu de l'écraser quand un brouillon existe déjà ; un message le confirme et le bouton « Annuler l'import » revient au brouillon précédent.
- Les PDF importés restent aussi joignables au rapport comme pièces jointes (case à cocher « garder les fichiers en pièces jointes »).

## Limites et garde-fous

- Maximum 10 PDF par import, 20 Mo par fichier, seuls les vrais PDF sont acceptés (contrôle du contenu, pas seulement de l'extension).
- Les fichiers sont traités par petits lots pour éviter les limites de requêtes de l'IA ; si la limite est atteinte, l'import reprend après une courte attente et prévient l'utilisateur.
- Aucun changement sur les rapports existants, les budgets, le partage ou les PDF exportés.

## Détails techniques

- `src/lib/ai.functions.ts` : nouvelle fonction serveur `aiExtractFromPdfs` (authentifiée) prenant `{ files: [{ filename, base64, mimeType }], mode: "merge" | "per-document", style? }`. Elle envoie chaque PDF en bloc `file` (`data:application/pdf;base64,...`) selon `ai-multimodal-input`, valide la taille/le nombre en entrée avec Zod, et renvoie le schéma `ExtractedReport` déjà existant plus un tableau `perFile` d'états.
  - Mode `merge` : une extraction par document (modèle par défaut) puis une passe de consolidation avec `PRO_MODEL` qui produit le rapport final.
  - Mode `per-document` : une extraction par document, puis assemblage local en sections (une section par fichier, titre = titre extrait ou nom du fichier).
  - Gestion d'erreurs selon `ai-gateway-error-semantics` : 429/5xx retentés avec attente bornée, 400/402/403 remontés tels quels au fichier concerné.
- `src/lib/ai-gateway.server.ts` : inchangé (le bloc `file` est déjà supporté par `AIContent`).
- `src/components/AIAssistantPanel.tsx` : input PDF en `multiple`, zone de dépôt, état local `pendingFiles` avec statut par fichier, sélecteur de mode, appel à `aiExtractFromPdfs`, fusion non destructive du brouillon (`applyDraft` étendu d'un mode `append`) et bouton d'annulation via une copie du brouillon précédent.
- `src/lib/upload-validation.ts` : réutilisé pour le contrôle des PDF côté client (règle `report-attachments`) ; l'option pièces jointes réutilise `AttachmentUploader`/le bucket existant, sans nouvelle table.
- Vérification : typecheck, puis test Playwright qui importe deux PDF de test dans `/reports/new` et contrôle que les sections des deux documents apparaissent dans le brouillon.
