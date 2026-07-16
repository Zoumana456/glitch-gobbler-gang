
## Objectif

Intégrer un assistant IA complet (Google Gemini) dans l'éditeur de rapport : conversation d'aide à la rédaction, imports multi-sources (image OCR, PDF, Word), outils one-shot (corriger, reformuler, résumer, détecter incohérences) et 8 styles de rédaction.

## Fournisseur & clé

- Ajouter le secret `GEMINI_API_KEY` (Google AI Studio) via `add_secret`.
- Tous les appels passent par des `createServerFn` (jamais côté client).
- Modèles :
  - `gemini-2.5-flash` par défaut (rapide, économique) — chat, outils courts.
  - `gemini-2.5-pro` pour "génération complète" et "détection d'incohérences".
- Endpoint : `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=$GEMINI_API_KEY`, format natif Gemini (`contents`/`parts`, `systemInstruction`, `responseMimeType: application/json` avec `responseSchema` pour les sorties structurées).

## Architecture serveur (`src/lib/ai.functions.ts`)

Nouvelles fonctions server (mémoire session, pas de table) :

| Fonction | Entrée | Sortie | Modèle |
|---|---|---|---|
| `aiChat` | `{ history:[{role,parts}], userMessage, reportDraft, style }` | `{ reply, updatedDraft?, missingInfo:[] }` structuré | flash |
| `aiExtractFromImage` | `{ base64, mimeType }` | `ExtractedReport` (OCR + structuration) | flash |
| `aiExtractFromPdf` | `{ base64, mimeType, filename }` | `ExtractedReport` | flash (existant, réutilisé/étendu) |
| `aiExtractFromDocx` | `{ base64, filename }` | `ExtractedReport` | flash — texte brut extrait côté serveur via `mammoth`, puis Gemini |
| `aiImprove` | `{ text, action: "fix-fr" \| "rephrase" \| "shorten" \| "expand" }` | `{ text }` | flash |
| `aiSummarize` | `{ report, mode: "short" \| "executive" }` | `{ summary }` | flash |
| `aiDetectIssues` | `{ report }` | `{ issues:[{type,message,location}] }` (dates, montants, doublons, incohérences) | pro |
| `aiApplyStyle` | `{ report, style }` | `LoadedReport`-shape reformulé | pro |
| `aiGenerateFull` | `{ history, style }` | rapport complet structuré | pro |

Toutes utilisent `requireSupabaseAuth` (assistants réservés aux utilisateurs connectés). Historique de chat = état React, envoyé à chaque appel.

Dépendance à ajouter : `mammoth` (extraction texte DOCX, pure JS, compatible Worker).

## Frontend

### 1. Panneau de chat dans `ReportForm.tsx`

Nouveau composant `src/components/AIAssistantPanel.tsx` (drawer/sheet à droite) :
- Fil de messages (markdown via `react-markdown`, déjà installé sinon à ajouter).
- Composer avec :
  - Zone de texte + envoi.
  - Boutons d'import : 📷 Photo, 📄 PDF, 📝 Word — déclenchent l'extraction et injectent le résultat.
  - Bouton micro (réutilise `DictationButton` existant).
- Sélecteur de style (8 options du cahier des charges).
- Bouton "Générer le rapport" → appelle `aiGenerateFull` et remplit tous les champs du form.
- Bouton "Détecter les incohérences" → liste d'issues cliquables.

### 2. Menu "Améliorer avec l'IA" par champ

Petit menu ✨ à côté du titre / intro / conclusion / descriptions de section avec :
Corriger le français · Reformuler · Version courte · Version longue · Résumé exécutif (sur le rapport entier).

### 3. Sélecteur de style global

Nouveau champ en haut du formulaire (Select) : Administratif, Technique, Chantier, Intervention, Maintenance, Mission, Visite, Audit. Utilisé par `aiGenerateFull` et `aiApplyStyle`. Non persisté en base au V1.

## Structure enrichie du rapport

Le cahier des charges cite : Titre, Objet, Contexte, Description, Observations, Analyse, Recommandations, Conclusion.

Le modèle actuel a : `title`, `intro`, `sections[]`, `conclusion`. On mappe la structure demandée sur des **sections préréglées** que l'IA remplit (`title` = "Contexte", "Observations", "Analyse", "Recommandations", etc.), plus `intro` = Objet et `conclusion` = Conclusion. Aucune migration schéma nécessaire.

## Limites & gestion d'erreurs

- Fichier max côté client : 15 Mo image, 20 Mo PDF/DOCX (Gemini inline base64 ≈ 20 Mo max).
- Codes 429 / 402 (quota Google) remontés en toast clair.
- Sortie JSON invalide → retry unique avec message "corrige et renvoie du JSON valide".

## Fichiers touchés

- `src/lib/ai.functions.ts` — étendu (toutes les fonctions ci-dessus, migration Lovable Gateway → Gemini direct).
- `src/components/AIAssistantPanel.tsx` — nouveau.
- `src/components/AIFieldMenu.tsx` — nouveau (menu ✨).
- `src/components/ReportForm.tsx` — intégration panneau + menus + sélecteur de style.
- `package.json` — `mammoth`, éventuellement `react-markdown` si absent.

## Hors périmètre V1

- Persistance de l'historique de conversation (session uniquement, confirmé).
- Export Word (l'export PDF existe déjà).
- Traduction (mentionnée dans le CdC mais pas dans la portée choisie).
- Vraie recherche de doublons entre rapports différents (limité au rapport en cours).
