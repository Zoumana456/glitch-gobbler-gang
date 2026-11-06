export type ReportTemplate = {
  id: string;
  label: string;
  description: string;
  title: string;
  sections: { title: string; bullets?: string[] }[];
};

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: "chantier",
    label: "Chantier / BTP",
    description: "Météo, effectif, travaux, matériel, incidents",
    title: "Rapport de chantier",
    sections: [
      { title: "Météo & conditions" },
      { title: "Effectif présent sur site" },
      { title: "Travaux réalisés du jour" },
      { title: "Matériel & engins" },
      { title: "Incidents / Blocages sécurité" },
    ],
  },
  {
    id: "intervention",
    label: "Intervention technique / SAV",
    description: "Diagnostic, travaux, pièces, recommandations",
    title: "Rapport d'intervention technique",
    sections: [
      { title: "Diagnostic initial" },
      { title: "Matériel contrôlé" },
      { title: "Travaux effectués" },
      { title: "Pièces remplacées" },
      { title: "Recommandations client" },
    ],
  },
  {
    id: "commercial",
    label: "Visite commerciale",
    description: "Interlocuteurs, besoins, budget, prochain RDV",
    title: "Compte rendu de visite commerciale",
    sections: [
      { title: "Interlocuteurs rencontrés" },
      { title: "Besoins & opportunités détectés" },
      { title: "Budget évoqué" },
      { title: "Plan d'action & prochain RDV" },
    ],
  },
  {
    id: "audit",
    label: "Audit & Sécurité / Qualité",
    description: "Périmètre, non-conformités, risques, mesures",
    title: "Rapport d'audit",
    sections: [
      { title: "Périmètre audité" },
      { title: "Non-conformités relevées" },
      { title: "Niveau de risque" },
      { title: "Mesures correctives requises" },
    ],
  },
];
