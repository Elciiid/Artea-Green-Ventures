// applicationsInScope is the one piece of real filtering logic in
// team.ts — everything else is a network call. Covers the case that matters
// most for My Team specifically: an application that's readable (e.g. the
// manager holds a personal grant to it) but NOT in this company's scope must
// not leak into the "which applications can I grant" ceiling.

import { describe, it, expect } from "vitest";
import { applicationsInScope, inScopeGrantCount } from "./team";
import type { AccessApplication, LiveGrant } from "./access";
import type { CompanyApplicationGrant } from "./companies";

const appA: AccessApplication = { id: "app-a", reference: "APP-A", title: "Application A" };
const appB: AccessApplication = { id: "app-b", reference: "APP-B", title: "Application B" };
const appC: AccessApplication = { id: "app-c", reference: "APP-C", title: "Application C" };

describe("applicationsInScope", () => {
  it("keeps only applications with a live company scope grant", () => {
    const grants: CompanyApplicationGrant[] = [{ id: "g1", application_id: appA.id }];
    expect(applicationsInScope([appA, appB, appC], grants)).toEqual([appA]);
  });

  it("excludes a readable application that isn't in this company's scope", () => {
    // appB is readable (e.g. the manager holds a personal grant), but only
    // appA is actually within the company's scope — appB must not appear.
    const grants: CompanyApplicationGrant[] = [{ id: "g1", application_id: appA.id }];
    const result = applicationsInScope([appA, appB], grants);
    expect(result).not.toContainEqual(appB);
  });

  it("returns an empty list when the company has no scope grants", () => {
    expect(applicationsInScope([appA, appB], [])).toEqual([]);
  });

  it("returns an empty list when no applications are readable", () => {
    const grants: CompanyApplicationGrant[] = [{ id: "g1", application_id: appA.id }];
    expect(applicationsInScope([], grants)).toEqual([]);
  });
});

// Regression coverage for a review-reported bug: the rendered "N of M apps"
// count previously counted every live grant a teammate held, unscoped —
// disagreeing with the checklist (already narrowed to company scope) shown
// directly beneath it whenever a teammate also held a grant an admin issued
// outside this company's scope.
describe("inScopeGrantCount", () => {
  const grant = (overrides: Partial<LiveGrant>): LiveGrant => ({
    id: "g1",
    application_id: appA.id,
    profile_id: "teammate-1",
    ...overrides,
  });

  it("counts only this profile's grants that fall within the given applications", () => {
    const grants = [
      grant({ id: "g1", application_id: appA.id, profile_id: "teammate-1" }),
      grant({ id: "g2", application_id: appB.id, profile_id: "teammate-1" }),
    ];
    expect(inScopeGrantCount(grants, "teammate-1", [appA, appB])).toBe(2);
  });

  it("excludes a grant on an application outside the given (company-scope) set", () => {
    // appC is a real, live grant for teammate-1, but not part of this
    // company's scope (e.g. an admin granted it directly) — the count must
    // not include it, so it can never exceed applications.length.
    const grants = [
      grant({ id: "g1", application_id: appA.id, profile_id: "teammate-1" }),
      grant({ id: "g2", application_id: appC.id, profile_id: "teammate-1" }),
    ];
    expect(inScopeGrantCount(grants, "teammate-1", [appA, appB])).toBe(1);
  });

  it("excludes another teammate's grants", () => {
    const grants = [
      grant({ id: "g1", application_id: appA.id, profile_id: "teammate-1" }),
      grant({ id: "g2", application_id: appB.id, profile_id: "teammate-2" }),
    ];
    expect(inScopeGrantCount(grants, "teammate-1", [appA, appB])).toBe(1);
  });

  it("returns 0 for a teammate with no in-scope grants", () => {
    expect(inScopeGrantCount([], "teammate-1", [appA, appB])).toBe(0);
  });
});
