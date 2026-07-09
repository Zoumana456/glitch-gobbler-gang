import { createFileRoute } from "@tanstack/react-router";
import { ReportForm } from "@/components/ReportForm";

export const Route = createFileRoute("/_authenticated/reports/new")({
  head: () => ({
    meta: [
      { title: "Nouveau rapport — Lovable Rapports" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ReportForm />,
});
