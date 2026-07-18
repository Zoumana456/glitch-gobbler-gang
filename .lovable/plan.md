## Objectif
Remplacer l'API Gemini directe (qui a un quota journalier gratuit strict et cause des 429) par le **Lovable AI Gateway** déjà intégré au projet via `LOVABLE_API_KEY`. Aucune clé à configurer, pas de quota journalier fixe : l'usage puise dans l'allocation mensuelle gratuite du workspace puis dans les crédits.

## Changements

### 1. Nouveau helper serveur `src/lib/ai-gateway.server.ts`
- Provider `createLovableAiGatewayProvider` (OpenAI-compatible, header `Lovable-API-Key`).
- Fonctions utilitaires : `callAI({ system, messages, json })` et `callAIWithImage / callAIWithPdf` (envoi multimodal via `image_url` base64 / `file` base64).
- Modèle par défaut : **`google/gemini-3.5-flash`** (rapide, multimodal, adapté aux rapports). Modèle "pro" pour analyse/style : **`google/gemini-3.1-pro-preview`**.
- Parsing JSON tolérant (réutilise `parseJsonLoose`).

### 2. Refactor `src/lib/ai.functions.ts`
- Remplacer chaque appel `callGemini(...)` par le nouveau helper `callAI(...)`.
- Conserver les schémas Zod, les prompts et la logique existante.
- Adapter les appels multimodaux (image OCR, extraction PDF) à la syntaxe messages `content: [{type:"text"},{type:"image_url",...}]` compatible OpenAI.
- Mapper les erreurs 429 / 402 en messages clairs pour l'utilisateur ("Limite atteinte, réessayez" / "Crédits épuisés").

### 3. Nettoyage
- Supprimer `src/lib/gemini.server.ts` (plus utilisé), ou le garder uniquement pour `parseJsonLoose` exporté.
- La clé `GEMINI_API_KEY` peut rester dans les secrets (inoffensive) ou être retirée plus tard.

### 4. Test de bout en bout
- Playwright : ouvrir `/reports/new` → panneau Assistant IA → envoyer un message chat → vérifier réponse.
- Tester extraction image (petit JPG) et génération complète.
- Vérifier logs AI Gateway (`ai_gateway_logs`) : statut 200, modèle `google/gemini-3.5-flash`.

## Détails techniques
- Aucun changement de schéma DB, aucun changement UI (`AIAssistantPanel.tsx` reste identique).
- `LOVABLE_API_KEY` déjà provisionnée (confirmé dans les secrets projet).
- Modèles utilisés — allocation mensuelle gratuite Lovable AI Gateway couvre un usage normal ; au-delà, débit sur crédits workspace. Pas de rate-limit journalier fixe comme le free tier Gemini.

## Ce qui reste identique
- L'UX de l'assistant, les styles métiers, les imports Image/Word/PDF, le chat mémorisé.
- La qualité (on reste sur Gemini 3.5 Flash / 3.1 Pro côté modèle, juste routés via Lovable).
