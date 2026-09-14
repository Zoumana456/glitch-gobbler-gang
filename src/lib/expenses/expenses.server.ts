export type ExpenseStatus = "draft" | "submitted" | "approved" | "rejected";

export const EXPENSE_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  submitted: "En attente",
  "En attente": "En attente",
  approved: "Approuvée",
  rejected: "Refusée",
};

export const EXPENSE_CATEGORIES = [
  "transport",
  "repas",
  "hebergement",
  "fournitures",
  "carburant",
  "communication",
  "autre",
] as const;

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  transport: "Transport",
  repas: "Repas",
  hebergement: "Hébergement",
  fournitures: "Fournitures",
  carburant: "Carburant",
  communication: "Communication",
  autre: "Autre",
};

export type ExpenseRow = {
  id: string;
  title: string;
  amount: number;
  currency: string;
  expense_date: string;
  category: string | null;
  description: string | null;
  receipt_url: string | null;
  status: string;
  author_id: string;
  author_name: string | null;
  manager_id: string | null;
  decision_comment: string | null;
  decided_at: string | null;
  created_at: string;
};

export function normalizeStatus(status: string | null): ExpenseStatus {
  if (status === "En attente" || !status) return "submitted";
  if (["draft", "submitted", "approved", "rejected"].includes(status))
    return status as ExpenseStatus;
  return "submitted";
}

export function formatAmount(amount: number, currency: string): string {
  return `${new Intl.NumberFormat("fr-FR").format(amount)} ${currency || "XOF"}`;
}
