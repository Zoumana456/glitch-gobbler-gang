import { describe, expect, it, vi } from "vitest";
import { executeStep, type RunRow } from "./pipeline.server";

vi.mock("../ai-gateway.server", () => ({ callAI: vi.fn(), parseJsonLoose: vi.fn() }));

const run: RunRow = { id: "run", requested_by: "owner", company_id: null, report_type: "synthese", title: "Combined", instructions: "", period_start: "2026-10-01", period_end: "2026-11-30", sources: ["reports"], state: {} };

function database() {
  const rows = [
    { id: "daily", title: "Daily", intro: "Original work", period_start: null, period_end: null },
    { id: "monthly", title: "Monthly", intro: "Repeated work", period_start: "2026-10-01", period_end: "2026-10-31" },
    { id: "previous-combined", title: "Combined", period_start: "2026-10-01", period_end: "2026-11-30" },
  ];
  const filters: string[] = [];
  const query: any = {
    select: () => query, eq: () => query, gte: () => query, lte: () => query,
    is: (key: string) => { filters.push(key); return query; },
    order: () => Promise.resolve({ data: rows.filter(r => filters.every(key => r[key as keyof typeof r] === null)), error: null }),
  };
  return { from: () => query } as any;
}

describe("consolidated report sources", () => {
  it("keeps daily work but excludes earlier monthly and combined reports", async () => {
    const { output } = await executeStep("collect", run, database());
    expect(output.reports.map((r: any) => r.id)).toEqual(["daily"]);
    expect(output.provenance[0].count).toBe(1);
  });
  it("excludes previous summaries when running the same month again", async () => {
    const { output } = await executeStep("collect", { ...run, period_end: "2026-10-31" }, database());
    expect(output.reports.map((r: any) => r.id)).toEqual(["daily"]);
  });
});