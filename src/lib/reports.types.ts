export type ReportImagePayload = {
  id?: string;
  storage_path: string;
  section_id: string | null;
  position: number;
  caption: string;
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
};

export type LoadedImage = {
  id: string;
  storage_path: string;
  section_id: string | null;
  position: number;
  caption: string;
  url: string;
};

export type LoadedSection = {
  id: string;
  title: string;
  description: string;
  position: number;
  bullets: { id: string; content: string; position: number }[];
  images: LoadedImage[];
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
};

export type ReportListItem = {
  id: string;
  author_id: string;
  author_name: string;
  report_date: string;
  title: string;
  intro: string;
  created_at: string;
};
