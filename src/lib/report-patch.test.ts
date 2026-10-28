import { describe, it, expect } from "vitest";
import { applyPatch } from "./report-patch";

const base = {
  title: "Rapport",
  intro: "Intro.",
  conclusion: "Fin.",
  sections: [
    { title: "A", description: "Texte A", bullets: ["a1"] },
    { title: "B", description: "Texte B", bullets: [] },
  ],
};

describe("applyPatch", () => {
  it("an addition keeps every existing section intact", () => {
    const r = applyPatch(base, [{ op: "add_section", title: "Réunion 14h", description: "Point" }]);
    expect(r.draft.sections.slice(0, 2)).toEqual(base.sections);
    expect(r.draft.sections[2].title).toBe("Réunion 14h");
  });

  it("a targeted edit changes only the targeted section", () => {
    const r = applyPatch(base, [{ op: "update_section", index: 1, description: "Nouveau B" }]);
    expect(r.draft.sections[0]).toEqual(base.sections[0]);
    expect(r.draft.sections[1].description).toBe("Nouveau B");
    expect(r.draft.intro).toBe("Intro.");
  });

  it("no operations means nothing changes", () => {
    expect(applyPatch(base, []).draft).toEqual(base);
  });

  it("removals use the original indexes", () => {
    const r = applyPatch(base, [{ op: "remove_section", index: 0 }, { op: "append_to_section", index: 1, text: "plus" }]);
    expect(r.draft.sections).toHaveLength(1);
    expect(r.draft.sections[0].description).toBe("Texte B\n\nplus");
  });

  it("invalid indexes are skipped, not applied", () => {
    const r = applyPatch(base, [{ op: "update_section", index: 9, title: "x" }]);
    expect(r.skipped).toEqual(["update_section"]);
    expect(r.draft).toEqual(base);
  });
});
