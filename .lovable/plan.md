## Objectif

Ajouter un vrai KYC (Know Your Customer) au flux de vérification d'entreprise afin qu'un super admin puisse prouver que la personne qui demande un nom réservé est bien celle qu'elle prétend être — pas juste vérifier un Kbis.

## Aujourd'hui (état confirmé par lecture du code)

- `RequestVerificationDialog` demande **1 seul fichier** (justificatif d'entreprise) + un message libre.
- Stockage : bucket privé `company-proofs`, chemin unique par utilisateur.
- Table `company_verification_requests` (12 colonnes) — un seul chemin de fichier.
- Aucune vérification d'identité personnelle, aucun selfie, aucune correspondance nom-profil-justificatif.

## Ce que le plan ajoute

### 1. Base de données (migration)

Ajouter à `company_verification_requests` :
- `identity_document_path text` — pièce d'identité (CNI / passeport / permis)
- `identity_document_type text` — enum contrôlé côté app : `id_card` | `passport` | `driving_license`
- `selfie_path text` — selfie tenant la pièce d'identité
- `full_legal_name text` — nom légal saisi par le demandeur (pour comparaison OCR)
- `ai_check_status text` — `pending` | `passed` | `flagged` | `skipped`
- `ai_check_report jsonb` — résultat du contrôle IA (score, incohérences détectées)

Aucune donnée existante n'est perdue (colonnes nullables, valeurs par défaut).

### 2. Contrôle automatique par IA (Lovable AI Gateway)

Nouvelle fonction serveur `runKycAiCheck` qui, à la soumission :
- Charge les 3 fichiers depuis `company-proofs` en signed URL.
- Envoie à `google/gemini-3.5-flash` (vision multimodale) :
  - Le justificatif d'entreprise
  - La pièce d'identité
  - Le selfie
  - Le `full_legal_name` saisi et le nom du profil
- Demande un JSON structuré :
  - Le visage du selfie correspond-il à la pièce d'identité ? (score)
  - Le nom sur la pièce d'identité correspond-il au nom saisi ?
  - La personne apparaît-elle sur le justificatif d'entreprise (mandat, extrait, statuts) ?
  - Documents lisibles / non altérés ?
  - `overall`: `passed` | `flagged` + motifs
- Stocke le rapport dans `ai_check_report` et met à jour `ai_check_status`.

L'IA est **assistante**, pas décisionnaire : un admin humain valide toujours. Un statut `flagged` ne bloque pas — il alerte visuellement le super admin dans `/admin`.

### 3. UI côté utilisateur — `RequestVerificationDialog`

Passage à un dialogue en 3 étapes claires :

```text
Étape 1 — Justificatif d'entreprise (existant)
Étape 2 — Pièce d'identité officielle (nouveau)
          └─ Type: CNI / Passeport / Permis
          └─ Upload recto (obligatoire)
          └─ Nom légal complet tel qu'inscrit sur la pièce
Étape 3 — Selfie avec la pièce d'identité (nouveau)
          └─ Bouton "Prendre une photo" (getUserMedia) OU upload
          └─ Instructions visuelles: pièce visible et lisible à côté du visage
Récapitulatif + envoi
```

Validation `zod` : type MIME, taille max 5 Mo par fichier, nom légal 2-120 caractères.

Composants : réutilise `Dialog`, `Tabs` (ou stepper simple), `Button`, `Input`, `Label` déjà présents. Nouveau petit composant `CameraCapture` pour le selfie via `navigator.mediaDevices`.

### 4. UI côté super admin — `/admin`

Ajouter à la vue de revue d'une demande :
- Galerie des 3 documents (lightbox déjà présente dans le projet).
- Bandeau du rapport IA : score, points verts/rouges, résumé lisible.
- Boutons approuver / rejeter avec motif (déjà existant).

### 5. Sécurité et RLS

- Bucket `company-proofs` : chemins isolés par `uid` (déjà en place). Politique inchangée — le demandeur écrit dans son dossier, seuls lui et les super admins peuvent lire.
- Table `company_verification_requests` : politiques existantes couvrent déjà les nouvelles colonnes.
- Les fichiers ne sont **jamais** exposés en public — signed URLs à la volée uniquement pour l'IA et l'admin.
- Le `full_legal_name` est stocké chiffré au niveau de la base ? Non — colonne texte simple, protégée par RLS (idem que les autres PII du projet). À noter comme limite si tu veux du chiffrement applicatif plus tard.

## Ce qui n'est PAS touché

- Tes rapports, images, partages actuels : intacts.
- Le flux d'onboarding entreprise pour les noms **non réservés** : inchangé.
- Google auth, structure Supabase, `.env` : inchangés.
- Les demandes de vérification déjà envoyées : conservées, colonnes vides pour l'ancien historique.

## Détails techniques

- **IA** : Lovable AI Gateway, modèle `google/gemini-3.5-flash` (multimodal image + texte, économique). Réponse en JSON strict via `Output.object` de l'AI SDK.
- **Fichiers** : côté client, validation MIME + `file-type` (déjà installé). Selfie capturé en JPEG 1280x720 max.
- **Serveur** : nouvelle server function `submitVerificationRequestKyc` (remplace `requestCompanyVerification` ou l'étend en gardant la signature actuelle pour compat), + `runKycAiCheck` appelée en post-insert asynchrone.
- **Migration** : `ALTER TABLE ADD COLUMN` uniquement, tout en nullable. Aucun `DROP`.

## Résultat attendu

Quand un utilisateur saisit "Jumia" :
1. Il voit maintenant un flux en 3 étapes clair.
2. Il envoie justificatif + pièce d'identité + selfie + son nom légal.
3. L'IA analyse automatiquement et pré-qualifie.
4. Le super admin voit tout dans `/admin` avec un rapport IA lisible et décide.
5. Beaucoup plus difficile d'usurper une marque protégée avec un simple faux PDF.
