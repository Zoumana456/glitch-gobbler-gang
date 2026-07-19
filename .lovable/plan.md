## Objectif
Détecter automatiquement les tentatives d'usurpation lorsqu'un utilisateur saisit un nom d'entreprise qui correspond à une société ivoirienne connue — sans devoir maintenir manuellement la liste dans `reserved_company_names`.

## Approche : vérification automatique en arrière-plan via IA + cache

On garde le mécanisme `reserved_company_names` existant (liste blanche stricte) et on **ajoute** une couche IA qui interroge le web (Lovable AI Gateway avec grounding Google Search) pour repérer les marques/entreprises réelles de Côte d'Ivoire.

### 1. Nouvelle table de cache

Migration : `company_name_risk_cache`
- `slug text primary key` (nom normalisé)
- `risk_level text` — `none` | `low` | `medium` | `high`
- `matched_entity text` — nom officiel trouvé (ex : « Jumia Côte d'Ivoire »)
- `evidence text` — courte justification (source/URL)
- `checked_at timestamptz default now()`
- RLS : lecture `authenticated`, écriture réservée aux server fns (service_role).
- GRANTs standards + `service_role` full.

TTL : 30 jours. Une entrée `high` sert de blocage tant que non expirée.

### 2. Server function `checkCompanyNameRisk`

Fichier : `src/lib/company-risk.functions.ts` (nouveau)
- Input : `{ name: string }`
- Étapes :
  1. Normaliser en slug.
  2. Lire le cache — si frais et `risk_level != none`, retourner directement.
  3. Sinon, appeler Lovable AI Gateway (`google/gemini-2.5-flash` avec l'outil `google_search`) avec un prompt :
     > « Est-ce que "<name>" correspond à une entreprise, marque ou institution reconnue en Côte d'Ivoire (banque, opérateur télécom, société cotée, ONG, administration, franchise) ? Réponds en JSON : `{risk_level, matched_entity, evidence}`. »
  4. Écrire le résultat en cache via `supabaseAdmin` (upsert).
  5. Retourner `{ risk_level, matched_entity, evidence }`.

### 3. Intégration dans `createCompany`

Fichier : `src/lib/company.functions.ts` (lignes 139-169)
- Après le check `reserved_company_names`, ajouter :
  - Si `risk_level === "high"` et pas de demande KYC approuvée sur ce slug → renvoyer le même signal `{ id: null, needsVerification: true, reason: "Ce nom correspond à « <matched_entity> » (…). Ouvrez une demande de vérification pour l'utiliser." }`.
  - Sinon on continue la création.

### 4. UI temps réel dans le formulaire d'entreprise

Fichier : `src/routes/_authenticated/company.tsx`
- Sur le champ « Nom de l'entreprise » (mode création), ajouter un debounce 700ms qui appelle `checkCompanyNameRisk`.
- Afficher un badge dynamique sous le champ :
  - `none` → rien
  - `low` → info bleue « Aucune correspondance connue »
  - `medium` → avertissement orange
  - `high` → alerte rouge avec bouton « Demander la vérification »
- Le bouton « Créer » n'est pas bloqué (le gate reste côté serveur), mais un toast avertit avant soumission si `high`.

### 5. Points hors périmètre
- On ne peuple **pas** manuellement `reserved_company_names` avec toutes les entreprises ivoiriennes — la couche IA + grounding s'en occupe dynamiquement. L'admin peut toujours forcer un nom via l'onglet « Noms réservés » (comportement inchangé).
- Coût maîtrisé grâce au cache 30 jours + normalisation slug.

## Sécurité
- Fonction IA nécessite `requireSupabaseAuth`.
- Écriture dans le cache via `supabaseAdmin` chargé dans le handler uniquement.
- Le résultat IA n'est jamais opposable à l'utilisateur sans humain dans la boucle : `high` déclenche seulement le KYC, jamais un rejet définitif.