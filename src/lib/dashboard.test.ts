// The one surviving pure computation behind the Dashboard variants
// (src/components/home) — stageCounts/needsAttention/mostRecentlyActive/
// buildActivityDigest and their tests were removed here (2026-08-08) along
// with StaffHomeDashboard.tsx/ClientHomeDashboard.tsx, their only callers.
// See dashboard.ts's own file header for why companiesWithoutManager stays.

import { describe, it, expect } from "vitest";
import { companiesWithoutManager } from "./dashboard";
import type { Company, ClientProfile } from "./supabase/companies";

describe("companiesWithoutManager", () => {
  const acme: Company = { id: "c1", name: "Acme", created_at: "", created_by: null };
  const globex: Company = { id: "c2", name: "Globex", created_at: "", created_by: null };

  function client(overrides: Partial<ClientProfile>): ClientProfile {
    return { id: "u1", name: "Someone", company_id: null, is_company_manager: false, ...overrides };
  }

  it("flags a company whose roster has no manager", () => {
    const clients = [client({ id: "u1", company_id: "c1", is_company_manager: false })];
    expect(companiesWithoutManager([acme], clients)).toEqual([acme]);
  });

  it("excludes a company whose roster has at least one manager", () => {
    const clients = [
      client({ id: "u1", company_id: "c1", is_company_manager: false }),
      client({ id: "u2", company_id: "c1", is_company_manager: true }),
    ];
    expect(companiesWithoutManager([acme], clients)).toEqual([]);
  });

  it("excludes a company with zero roster members entirely (nothing to manage yet)", () => {
    expect(companiesWithoutManager([acme], [])).toEqual([]);
  });

  it("only flags the companies that actually have the gap, out of several", () => {
    const clients = [
      client({ id: "u1", company_id: "c1", is_company_manager: false }),
      client({ id: "u2", company_id: "c2", is_company_manager: true }),
    ];
    expect(companiesWithoutManager([acme, globex], clients).map((c) => c.id)).toEqual(["c1"]);
  });

  it("ignores unassigned clients (company_id null)", () => {
    const clients = [client({ id: "u1", company_id: null, is_company_manager: false })];
    expect(companiesWithoutManager([acme], clients)).toEqual([]);
  });
});
