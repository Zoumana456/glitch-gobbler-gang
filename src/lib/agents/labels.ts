type V = "default" | "secondary" | "destructive" | "outline";
export const RUN_STATUS: Record<string, { label: string; variant: V }> = {
  pending: { label: "En attente", variant: "secondary" },
  planning: { label: "Planification", variant: "default" },
  running: { label: "En cours", variant: "default" },
  waiting_validation: { label: "Validation requise", variant: "outline" },
  completed: { label: "Terminé", variant: "secondary" },
  completed_with_warnings: { label: "Terminé avec avertissements", variant: "outline" },
  failed: { label: "Échec", variant: "destructive" },
  cancelled: { label: "Annulé", variant: "outline" },
};
export const TASK_STATUS: Record<string, string> = {
  pending: "En attente",
  running: "En cours",
  retrying: "Nouvelle tentative",
  done: "Terminé",
  failed: "Échec",
  cancelled: "Annulé",
  skipped: "Ignoré (agent désactivé)",
};
export const AGENT_NAME: Record<string, string> = {
  orchestrator: "Orchestrateur",
  collect: "Collecte",
  prepare: "Préparation",
  analyze: "Analyse",
  quality: "Contrôle qualité",
  write: "Rédaction",
  generate: "Génération",
};
