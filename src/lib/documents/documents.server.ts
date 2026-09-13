export type DocumentVisibility = "private" | "department" | "company";

export const DOCUMENT_CATEGORIES = [
  "procedure",
  "contrat",
  "rh",
  "note",
  "finance",
  "autre",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  procedure: "Procédure",
  contrat: "Contrat",
  rh: "RH",
  note: "Note interne",
  finance: "Finance",
  autre: "Autre",
};

export const DOCUMENT_VISIBILITY_LABELS: Record<string, string> = {
  private: "Privé",
  department: "Service",
  company: "Entreprise",
};

export type DocumentFolder = {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
};

export type DocumentRow = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  visibility: string;
  version: number;
  size_bytes: number;
  mime_type: string | null;
  folder_id: string | null;
  author_id: string | null;
  author_name: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentVersion = {
  id: string;
  version: number;
  file_name: string;
  size_bytes: number;
  created_at: string;
  created_by: string | null;
  author_name: string | null;
};

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 Ko";
  const units = ["o", "Ko", "Mo", "Go"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export async function nameMap(
  supabase: any,
  ids: (string | null)[],
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean) as string[]));
  if (unique.length === 0) return {};
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", unique);
  const map: Record<string, string> = {};
  for (const p of data ?? []) map[p.id] = p.full_name ?? "Sans nom";
  return map;
}
