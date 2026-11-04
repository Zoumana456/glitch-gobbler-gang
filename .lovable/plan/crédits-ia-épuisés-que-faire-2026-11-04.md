# Crédits IA épuisés : que faire

## Ce qui se passe
Le message « Crédits IA épuisés » ne vient pas d'un problème de votre application. Le solde de crédits IA de votre espace de travail est à zéro. Tant qu'il n'est pas rechargé, toutes les fonctions IA (assistant des rapports, agents, rapport sur deux mois, KYC, recherche d'entreprises) sont en pause.

## Étape 1 : à faire par vous (obligatoire)
1. Ouvrez les paramètres de l'espace de travail, puis « Plans & crédits ».
2. Ajoutez des crédits (ou passez à une formule supérieure). Le plan gratuit ne permet pas d'acheter des crédits.
3. Si une limite de dépense IA a été fixée par un administrateur, il faut la relever dans « Limites d'utilisation et alertes ».
4. Revenez sur la page Rapports et relancez la génération : elle repartira normalement.

## Étape 2 : améliorations proposées dans l'application (facultatif)
- Quand les crédits sont épuisés, la génération en cours s'arrête proprement et est annulée, pour que la suivante ne soit pas bloquée par le message « Une exécution est déjà en cours ».
- Un message clair dans l'assistant (« Crédits IA épuisés — rechargez puis réessayez ») au lieu d'un simple message d'échec.
- Aucune nouvelle tentative automatique tant que les crédits ne sont pas rechargés, pour éviter de multiplier les erreurs.

## Détails techniques
- Dans le pipeline des agents, une réponse 402 ou 403 de la passerelle IA est traitée comme une erreur définitive : la tâche est marquée en échec sans nouvelle tentative, et l'exécution passe au statut « failed », avec un résumé lisible.
- L'assistant et le bouton du rapport mensuel affichent ce résumé tel quel.
