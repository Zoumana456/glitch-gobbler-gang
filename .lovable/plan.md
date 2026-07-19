## Objectif

Rendre la page de connexion évidente à trouver et ajouter un bouton « afficher/masquer » sur le champ mot de passe.

## Où vous connecter aujourd'hui

L'écran de connexion existe déjà à l'adresse `/auth` (page `src/routes/auth.tsx`). Le lien direct depuis votre site publié :

```
https://rapport-journaliere.lovable.app/auth
```

Sur cet écran vous avez :
- « Continuer avec Google » (le bouton que vous utilisez habituellement)
- ou email + mot de passe (mode « Connexion » par défaut)

Le lien « Créer un compte » n'est utile que si vous n'avez pas encore de compte — sinon restez sur « Connexion ».

## Modifications à faire

1. **Ajouter un bouton œil (afficher/masquer) dans le champ mot de passe**
   - Fichier : `src/routes/auth.tsx`
   - Sur le champ `#password` (mode signin et signup) : passer le `type` de `password` à `text` selon un nouvel état `showPassword`.
   - Icône `Eye` / `EyeOff` de `lucide-react`, positionnée à droite dans l'input (bouton `type="button"` pour ne pas soumettre le formulaire).
   - `aria-label` dynamique « Afficher le mot de passe » / « Masquer le mot de passe ».

2. **Mieux signaler « où me connecter »**
   - Sur la page d'accueil `/` (`src/routes/index.tsx`) : s'assurer qu'un bouton « Se connecter » bien visible pointe vers `/auth`. Si un utilisateur déjà connecté arrive, le rediriger vers `/reports` (déjà géré par `/auth`).
   - Ajouter une petite mention sous le titre de la carte : « Déjà un compte ? Utilisez « Connexion ». Nouveau ? Cliquez sur « Créer un compte » en bas. » pour lever l'ambiguïté.

3. (Optionnel, si vous le souhaitez) Ajouter le même bouton œil sur la page `/reset-password`.

## Détail technique

- Nouvel état local dans `AuthPage` : `const [showPassword, setShowPassword] = useState(false);`
- Champ mot de passe entouré d'un `<div className="relative">` avec l'`Input` (padding-right augmenté) et un `<button>` absolu à droite qui bascule `showPassword`.
- Aucun changement backend, aucun changement de base de données, aucun impact sur les rapports existants.

Confirmez-vous que je peux appliquer ces changements ?