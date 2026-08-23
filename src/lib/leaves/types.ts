/** Types et utilitaires partagés du module Congés (client-safe). */

export type LeaveStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "cancelled";

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  draft: "Brouillon",
  submitted: "En attente",
  approved: "Validée",
  rejected: "Refusée",
  cancelled: "Annulée",
};

export const LEAVE_STATUS_TONE: Record<LeaveStatus, string> = {
  draft: "bg-muted text-foreground",
  submitted: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

export type LeaveType = {
  id: string;
  code: string;
  name: string;
  is_paid: boolean;
  requires_proof: boolean;
  default_days: number;
};

export type LeaveRequest = {
  id: string;
  user_id: string;
  user_name: string | null;
  type_id: string;
  type_name: string;
  start_date: string;
  end_date: string;
  half_start: boolean;
  half_end: boolean;
  days_count: number;
  /** null lorsque le motif ne doit pas être révélé (collègue) */
  reason: string | null;
  has_proof: boolean;
  status: LeaveStatus;
  current_approver_id: string | null;
  approver_name: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  created_at: string;
  /** dernier commentaire de décision */
  decision_comment: string | null;
  /** l'utilisateur courant peut décider de cette demande */
  can_decide: boolean;
  /** l'utilisateur courant est l'auteur */
  is_mine: boolean;
};

export type LeaveBalance = {
  type_id: string;
  type_name: string;
  year: number;
  allocated_days: number;
  used_days: number;
};

/** Nombre de jours ouvrés (lun-ven) entre deux dates, demi-journées incluses. */
export function countLeaveDays(
  start: string,
  end: string,
  halfStart = false,
  halfEnd = false,
): number {
  if (!start || !end) return 0;
  const from = new Date(`${start}T00:00:00`);
  const to = new Date(`${end}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  if (to < from) return 0;

  let days = 0;
  const cursor = new Date(from);
  while (cursor <= to) {
    const d = cursor.getDay();
    if (d !== 0 && d !== 6) days += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  if (days === 0) return 0;
  if (halfStart) days -= 0.5;
  if (halfEnd && end !== start) days -= 0.5;
  return Math.max(0.5, Math.round(days * 2) / 2);
}

export function formatLeaveRange(start: string, end: string): string {
  const fmt = (v: string) => new Date(`${v}T00:00:00`).toLocaleDateString("fr-FR");
  return start === end ? fmt(start) : `${fmt(start)} → ${fmt(end)}`;
}
