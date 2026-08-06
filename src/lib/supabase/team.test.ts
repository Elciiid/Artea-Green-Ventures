// applicationsInScope is the one piece of real filtering logic in
// team.ts — everything else is a network call. Covers the case that matters
// most for My Team specifically: an application that's readable (e.g. the
// manager holds a personal grant to it) but NOT in this company's scope must
// not leak into the "which applications can I grant" ceiling.

import { describe, it, expect } from "vitest";
import { applicationsInScope } from "./team";
import type { AccessApplication } from "./access";
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
