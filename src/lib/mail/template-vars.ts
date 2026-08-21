export type TemplateVars = {
  recipient?: string;
  senderName?: string;
  companyName?: string;
  fullName?: string;
};

/** Remplace les variables `{{...}}` d'un modèle d'e-mail. */
export function applyTemplateVariables(input: string, vars: TemplateVars = {}): string {
  const recipient = vars.recipient ?? "";
  const firstName = recipient.includes("@")
    ? recipient
        .split("@")[0]!
        .split(/[._-]+/)[0]!
        .replace(/^\w/, (c) => c.toUpperCase())
    : recipient;

  const map: Record<string, string> = {
    prenom: firstName,
    nom_complet: vars.fullName ?? recipient,
    destinataire: recipient,
    entreprise: vars.companyName ?? "",
    mon_nom: vars.senderName ?? "",
    date: new Date().toLocaleDateString("fr-FR"),
    heure: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  };

  return input.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (full, key: string) => {
    const value = map[key.toLowerCase()];
    return value === undefined ? full : value;
  });
}

export const TEMPLATE_VARIABLES = [
  { token: "{{prenom}}", description: "Prénom déduit du premier destinataire" },
  { token: "{{destinataire}}", description: "Adresse du premier destinataire" },
  { token: "{{nom_complet}}", description: "Nom complet du destinataire" },
  { token: "{{entreprise}}", description: "Nom de votre entreprise" },
  { token: "{{mon_nom}}", description: "Votre nom d'expéditeur" },
  { token: "{{date}}", description: "Date du jour" },
  { token: "{{heure}}", description: "Heure d'insertion" },
];
