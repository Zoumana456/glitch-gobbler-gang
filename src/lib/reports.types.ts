export type ReportImagePayload = {
  id?: string;
  storage_path: string;
  section_id: string | null;
  position: number;
  caption: string;
};

export type ReportAttachmentPayload = {
  id?: string;
  storage_path: string;
  section_id: string | null;
  position: number;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

export type ReportBulletPayload = {
  id?: string;
  content: string;
  position: number;
};

export type ReportSectionPayload = {
  id?: string;
  title: string;
  description: string;
  position: number;
  bullets: ReportBulletPayload[];
};

export type ReportPayload = {
  report_date: string;
  title: string;
  intro: string;
  conclusion: string;
  sections: ReportSectionPayload[];
  images: ReportImagePayload[];
  attachments: ReportAttachmentPayload[];
};

export type LoadedImage = {
  id: string;
  storage_path: string;
  section_id: string | null;
  position: number;
  caption: string;
  url: string;
};

export type LoadedAttachment = {
  id: string;
  storage_path: string;
  section_id: string | null;
  position: number;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  url: string;
};

export type LoadedSection = {
  id: string;
  title: string;
  description: string;
  position: number;
  bullets: { id: string; content: string; position: number }[];
  images: LoadedImage[];
  attachments: LoadedAttachment[];
};

export type LoadedReport = {
  id: string;
  author_id: string;
  author_name: string;
  author_email: string;
  report_date: string;
  title: string;
  intro: string;
  conclusion: string;
  created_at: string;
  updated_at: string;
  sections: LoadedSection[];
  general_images: LoadedImage[];
  general_attachments: LoadedAttachment[];
  share_expires_at?: string | null;
  status?: ReportStatus | null;
  kind?: ReportKind | null;
};


export type ReportListItem = {
  id: string;
  author_id: string;
  author_name: string;
  report_date: string;
  title: string;
  intro: string;
  created_at: string;
  status?: ReportStatus;
  kind?: ReportKind;
};

// ============ Hiérarchie & circuit de validation ============

export type ReportStatus = "draft" | "submitted" | "in_review" | "approved" | "rejected";
export type ReportKind = "individual" | "consolidated";

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  draft: "Brouillon",
  submitted: "Soumis",
  in_review: "En revue",
  approved: "Validé",
  rejected: "À corriger",
};

export type HierarchyLevel = 1 | 2 | 3 | 4;

export const HIERARCHY_LEVELS: { level: HierarchyLevel; label: string; short: string }[] = [
  { level: 1, label: "Direction générale (DG / Président)", short: "DG" },
  { level: 2, label: "Direction adjointe (Vice-DG / Vice-président)", short: "Vice-DG" },
  { level: 3, label: "Responsable de service", short: "Responsable" },
  { level: 4, label: "Employé", short: "Employé" },
];

export function levelLabel(level: number): string {
  return HIERARCHY_LEVELS.find((l) => l.level === level)?.short ?? "Employé";
}

export type DailyReportState =
  | "none"
  | "draft"
  | "submitted"
  | "in_review"
  | "approved"
  | "rejected";

export type HierarchyMember = {
  member_id: string;
  user_id: string;
  full_name: string;
  position_title: string;
  department: string;
  hierarchy_level: number;
  manager_id: string | null;
  role: "owner" | "employee";
  today_state: DailyReportState;
  today_report_id: string | null;
  reports_count: number;
};

export type HierarchyOverview = {
  company_id: string;
  company_name: string;
  is_owner: boolean;
  my_member_id: string;
  my_level: number;
  members: HierarchyMember[];
};

export type PendingApproval = {
  report_id: string;
  title: string;
  report_date: string;
  author_id: string;
  author_name: string;
  author_position: string;
  status: ReportStatus;
  kind: ReportKind;
  submitted_at: string | null;
};

export type ApprovalEntry = {
  id: string;
  approver_id: string;
  approver_name: string;
  level: number;
  decision: "submitted" | "approved" | "rejected";
  comment: string | null;
  decided_at: string;
};

export type TeamComplianceRow = {
  user_id: string;
  full_name: string;
  position_title: string;
  hierarchy_level: number;
  department: string;
  today_state: DailyReportState;
  last_report_at: string | null;
  days_since_last_report: number | null;
};

export type DirectionKpis = {
  from: string;
  to: string;
  head_count: number;
  expected: number;
  submitted: number;
  approved: number;
  pending: number;
  rejected: number;
  compliance_rate: number;
  avg_approval_hours: number | null;
  by_department: {
    department: string;
    head_count: number;
    submitted: number;
    approved: number;
    pending: number;
    compliance_rate: number;
  }[];
  by_level: { level: number; head_count: number; submitted: number; approved: number }[];
};


export type RoleAuditPermissions = {
  view_own: boolean;
  view_team: boolean;
  view_company: boolean;
  validate: boolean;
  delete_own: boolean;
  delete_others: boolean;
  manage_hierarchy: boolean;
  direction_kpis: boolean;
};

export type RoleAuditScopeRow = {
  member_id: string;
  user_id: string;
  full_name: string;
  hierarchy_level: number;
  role: string;
  position_title: string;
  department: string;
  expected_visible: boolean;
  observed: "ok" | "mismatch" | "no_data";
  reports_seen: number;
};

export type RoleAuditPolicyRow = {
  table: string;
  policy: string;
  rule: string;
  applies_to: string;
};

export type RoleAudit = {
  company_id: string;
  company_name: string;
  is_owner: boolean;
  my_level: number;
  my_role: string;
  my_role_label: string;
  my_position: string;
  permissions: RoleAuditPermissions;
  scope: RoleAuditScopeRow[];
  policies: RoleAuditPolicyRow[];
  mismatches: number;
};
