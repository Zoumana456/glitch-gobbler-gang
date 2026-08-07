import { describe, expect, it } from "vitest";
import {
  descendantIds,
  findTopMember,
  isShareLinkUsable,
  nextApproverOf,
  visibleMembers,
  type MemberRow,
} from "./hierarchy-tree";

function m(
  id: string,
  level: number,
  managerId: string | null,
  role: "owner" | "employee" = "employee",
): MemberRow {
  return {
    id,
    company_id: "c1",
    user_id: `u-${id}`,
    role,
    hierarchy_level: level,
    manager_id: managerId,
    position_title: null,
    department: null,
    joined_at: "2026-01-01T00:00:00Z",
  };
}

// DG > Vice DG > responsable > employé
const dg = m("dg", 1, null, "owner");
const vice = m("vice", 2, "dg");
const resp = m("resp", 3, "vice");
const emp = m("emp", 4, "resp");
const otherResp = m("resp2", 3, "vice");
const members = [dg, vice, resp, emp, otherResp];

describe("findTopMember", () => {
  it("retourne le membre de niveau 1", () => {
    expect(findTopMember(members)?.id).toBe("dg");
  });
  it("retourne le plus haut niveau disponible sans niveau 1", () => {
    expect(findTopMember([resp, emp])?.id).toBe("resp");
  });
  it("retourne null sans membre", () => {
    expect(findTopMember([])).toBeNull();
  });
});

describe("nextApproverOf", () => {
  it("remonte au supérieur direct", () => {
    expect(nextApproverOf(members, emp)?.id).toBe("resp");
    expect(nextApproverOf(members, resp)?.id).toBe("vice");
    expect(nextApproverOf(members, vice)?.id).toBe("dg");
  });
  it("retourne null pour le DG", () => {
    expect(nextApproverOf(members, dg)).toBeNull();
  });
  it("bascule sur le niveau supérieur le plus proche sans manager défini", () => {
    const orphan = m("orphan", 4, null);
    expect(nextApproverOf([...members, orphan], orphan)?.id).toBe("resp");
  });
  it("ignore un manager de niveau inférieur ou égal", () => {
    const bad = m("bad", 3, "resp2");
    expect(nextApproverOf([...members, bad], bad)?.id).toBe("vice");
  });
});

describe("descendantIds", () => {
  it("inclut les subordonnés indirects", () => {
    expect([...descendantIds(members, "vice")].sort()).toEqual([
      "emp",
      "resp",
      "resp2",
    ]);
  });
  it("est vide pour une feuille", () => {
    expect(descendantIds(members, "emp").size).toBe(0);
  });
  it("ne boucle pas sur un cycle", () => {
    const a = m("a", 2, "b");
    const b = m("b", 3, "a");
    expect(descendantIds([a, b], "a").size).toBeLessThanOrEqual(2);
  });
});

describe("visibleMembers", () => {
  it("le DG voit toute l'entreprise sauf lui-même", () => {
    expect(visibleMembers(members, dg).map((x) => x.id).sort()).toEqual([
      "emp",
      "resp",
      "resp2",
      "vice",
    ]);
  });
  it("un responsable ne voit que sa branche", () => {
    expect(visibleMembers(members, resp).map((x) => x.id)).toEqual(["emp"]);
  });
  it("un employé ne voit personne", () => {
    expect(visibleMembers(members, emp)).toEqual([]);
  });
  it("ne fait pas fuiter une branche sœur", () => {
    expect(visibleMembers(members, resp).map((x) => x.id)).not.toContain("resp2");
  });
});

describe("isShareLinkUsable", () => {
  const now = new Date("2026-08-07T12:00:00Z");
  it("refuse un rapport sans jeton", () => {
    expect(isShareLinkUsable({ share_token: null, share_expires_at: null }, now)).toBe(false);
    expect(isShareLinkUsable(null, now)).toBe(false);
  });
  it("accepte un jeton sans expiration", () => {
    expect(isShareLinkUsable({ share_token: "t", share_expires_at: null }, now)).toBe(true);
  });
  it("accepte un jeton non expiré", () => {
    expect(
      isShareLinkUsable({ share_token: "t", share_expires_at: "2026-08-08T12:00:00Z" }, now),
    ).toBe(true);
  });
  it("refuse un jeton expiré", () => {
    expect(
      isShareLinkUsable({ share_token: "t", share_expires_at: "2026-08-06T12:00:00Z" }, now),
    ).toBe(false);
  });
  it("refuse une date d'expiration invalide", () => {
    expect(isShareLinkUsable({ share_token: "t", share_expires_at: "n'importe quoi" }, now)).toBe(
      false,
    );
  });
});
