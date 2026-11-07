import { describe, expect, it } from "vitest";
import { combinedReportRange } from "./combined-report-range";

describe("combined report dates", () => {
  it.each([["", "2026-11-07"], ["2026-11-01", ""], ["2026-11", "2026-11-07"], ["2026-02-30", "2026-11-07"]])("rejects incomplete or invalid dates %s / %s without throwing", (start, end) => {
    expect(combinedReportRange(start, end)).toBeNull();
  });
  it("includes all seven days and normalizes reversed dates", () => {
    expect(combinedReportRange("2026-11-07", "2026-11-01")).toMatchObject({ start: "2026-11-01", end: "2026-11-07", days: 7 });
  });
});