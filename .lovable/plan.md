## Objectif

Rendre l'app identifiable (nom + logo + favicon) et rendre la **vérification d'identité** accessible sans devoir passer par l'erreur « nom réservé ». Afficher l'avatar de l'utilisateur en haut à droite partout dans l'espace connecté.

## 1. Identité de marque

- **Nom** : **DailyBrief** — sous-titre : *Team reports, made simple*.
- **Palette** (verrouillée) : `#0F172A` (slate 900), `#3B82F6` (blue 500), `#F8FAFC` (slate 50).
- **Logo** : monogramme géométrique « DB » minimal moderne — carré arrondi bleu (#3B82F6) sur fond slate, monogramme en blanc. Généré via `imagegen--generate_image` (transparent PNG) → `src/assets/logo-dailybrief.png`.
- **Favicon** : version carrée du monogramme → `public/favicon-dailybrief.png`, référencé dans `src/routes/__root.tsx` (et suppression de `public/favicon.ico` par défaut).
- Mise à jour de `head()` du root : `title`, `og:title`, `og:description`, `twitter:*` avec « DailyBrief — Team reports made simple ».

## 2. Barre de navigation globale (`AppTopBar`)

Nouveau composant `src/components/AppTopBar.tsx`, monté dans `src/routes/_authenticated/route.tsx` juste avant `<Outlet />` (donc visible partout dans l'espace connecté, jamais sur `/auth` ni sur les pages publiques de partage).

Contenu :
- **Gauche** : logo + wordmark « DailyBrief », `<Link to="/reports">`.
- **Centre** (desktop) : liens rapides Rapports · Entreprise · PV · Administration (uniquement si admin).
- **Droite** : 
  - Avatar de l'utilisateur (photo depuis `profiles.avatar_url`, sinon initiales).
  - Menu déroulant (shadcn `DropdownMenu`) :
    - En-tête : nom + email
    - **Mon profil** → `/profile`
    - **Vérifier mon identité / entreprise** → ouvre `RequestVerificationDialog` (voir §3)
    - **Mes demandes de vérification** → nouvel écran (voir §4)
    - Séparateur
    - **Se déconnecter**

Récupération avatar via un petit `useQuery(["me-profile"])` qui appelle une nouvelle server fn `getMyProfileMini` (retourne `{ full_name, email, avatar_url, is_admin }`). Signed URL pour l'avatar si stocké en bucket privé.

## 3. Ouverture directe du KYC depuis le menu

Aujourd'hui `RequestVerificationDialog` exige un `companyName`. On ajoute un petit dialogue préalable **« Choisir le nom à vérifier »** :
- Champ texte pré-rempli avec le nom de l'entreprise actuelle si l'utilisateur en a une (via `getMyCompany`), sinon vide.
- Bouton **Continuer** → ouvre le dialogue KYC 3 étapes existant avec ce nom.

Ainsi la vérification est déclenchable **avant même de tenter de créer une entreprise** avec un nom réservé.

## 4. Section « Vérification d'identité » dans `/profile`

Nouveau bloc en bas de `src/routes/_authenticated/profile.tsx` :
- Explication courte : « Pour utiliser un nom d'entreprise protégé (marque connue, entité officielle), une vérification KYC est requise. »
- Liste des demandes existantes de l'utilisateur (via `getMyVerificationRequests` déjà présente) : nom demandé, statut (badge `pending` / `approved` / `rejected`), date, note admin éventuelle, statut du contrôle IA.
- Bouton **« Nouvelle demande de vérification »** → même mini-dialogue qu'au §3.

Aucun changement de schéma DB nécessaire — toutes les fonctions existent déjà.

## 5. Avatar : correctifs d'affichage

Sur `/profile` (déjà présent) : garder tel quel, mais harmoniser (fallback initiales avec la même palette).

Nouveaux points d'affichage :
- `AppTopBar` (§2)
- Cartes de rapport dans `/reports` (auteur) : afficher un mini `Avatar` à côté du nom d'auteur.
- Vue publique de partage (`/share/$token`) : afficher l'avatar de l'auteur à côté de son nom pour crédibilité — via l'URL signée déjà retournée côté serveur si dispo, sinon fallback initiales (aucune fuite de PII).

## 6. Détails techniques

**Server function nouvelle** : `src/lib/profile.functions.ts` → `getMyProfileMini` (auth requise, retourne `full_name`, `email`, signed URL avatar 1h, flag `is_admin` via `platform_admins`).

**Aucune migration DB.** Aucun nouveau bucket. Aucun secret ajouté.

**TypeScript & lint** : vérification via `bunx tsgo --noEmit` en fin de chantier.

## Fichiers touchés

- `src/routes/__root.tsx` — meta/title/favicon
- `src/routes/_authenticated/route.tsx` — insertion `<AppTopBar />`
- `src/routes/_authenticated/profile.tsx` — section vérifications + refonte carte
- `src/routes/_authenticated/reports.index.tsx` — mini avatar auteur (optionnel léger)
- `src/routes/share.$token.tsx` — mini avatar auteur (optionnel léger)
- `src/components/AppTopBar.tsx` *(nouveau)*
- `src/components/StartVerificationDialog.tsx` *(nouveau : sélection du nom puis lancement KYC)*
- `src/lib/profile.functions.ts` *(nouveau : `getMyProfileMini`)*
- `src/assets/logo-dailybrief.png` *(nouveau, généré)*
- `public/favicon-dailybrief.png` *(nouveau, généré)*
- `public/favicon.ico` — supprimé

## Résultat attendu

1. Bandeau haut identifiable avec logo bleu **DailyBrief** + avatar rond en haut à droite.
2. Un clic sur l'avatar → menu contenant explicitement **« Vérifier mon identité / entreprise »**.
3. Page **Profil** : encadré listant les demandes de vérification + bouton pour en lancer une, sans devoir passer par l'échec de création d'entreprise.
