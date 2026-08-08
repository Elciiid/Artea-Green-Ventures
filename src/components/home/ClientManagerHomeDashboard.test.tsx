// Client-manager Dashboard — no real client-manager account's credentials
// were available to click through this live (Azure SSO for the only real
// manager account on hand; see STATUS.md), so this test file is the actual
// verification that the tile numbers, the status donut's per-tier counts,
// and the "teammates without access" name list are all correct — not just
// that the page renders. `@/lib/supabase/team` is intentionally NOT
// mocked: applicationsInScope()/inScopeGrantCount() are real, already-
// tested pure logic (see team.test.ts), and exercising them for real here
// is exactly what proves the reference/uuid crosswalk in this component's
// own loader is wired correctly — the same class of bug tsc already caught
// once while building this file (Application.id is a reference string, not
// the uuid agv_company_applications/agv_application_access key on).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ClientManagerHomeDashboard from "./ClientManagerHomeDashboard";
import { fetchApplications } from "@/lib/supabase/applications";
import {
  fetchApplicationsForAccess,
  fetchLiveGrants,
} from "@/lib/supabase/access";
import { fetchClientProfiles, fetchCompanyApplicationGrants } from "@/lib/supabase/companies";
import { useSession } from "@/lib/session";

vi.mock("@/lib/supabase/applications", () => ({
  fetchApplications: vi.fn(),
}));

vi.mock("@/lib/supabase/access", () => ({
  fetchApplicationsForAccess: vi.fn(),
  fetchLiveGrants: vi.fn(),
}));

vi.mock("@/lib/supabase/companies", () => ({
  fetchClientProfiles: vi.fn(),
  fetchCompanyApplicationGrants: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  useSession: vi.fn(),
}));

const mockFetchApplications = vi.mocked(fetchApplications);
const mockFetchApplicationsForAccess = vi.mocked(fetchApplicationsForAccess);
const mockFetchLiveGrants = vi.mocked(fetchLiveGrants);
const mockFetchClientProfiles = vi.mocked(fetchClientProfiles);
const mockFetchCompanyApplicationGrants = vi.mocked(fetchCompanyApplicationGrants);
const mockUseSession = vi.mocked(useSession);

const COMPANY_ID = "company-1";
const SELF_ID = "manager-1";

// Three real applications in scope (AGV-001/002/003 — one per status tier)
// plus a fourth (AGV-004) that exists in the wider account-visible set but
// is NOT in this company's scope — present specifically to prove the scope
// filter actually excludes it, not just that it happens to be absent.
const accessApps = [
  { id: "app-1", reference: "AGV-001", title: "App One" },
  { id: "app-2", reference: "AGV-002", title: "App Two" },
  { id: "app-3", reference: "AGV-003", title: "App Three" },
  { id: "app-4", reference: "AGV-004", title: "App Four (out of scope)" },
];

function app(overrides: { id: string; stage: "submitted" | "under-review" | "closed" }) {
  return {
    id: overrides.id,
    title: "x",
    service: "x",
    sector: "Transportation" as const,
    location: "x",
    country: "AU" as const,
    coords: "",
    stage: overrides.stage,
    lead: "x",
    clientName: "x",
    hero: "",
    submitted: "2026-01-01",
    documents: [],
    timeline: [],
  };
}

const applications = [
  app({ id: "AGV-001", stage: "submitted" }), // neutral
  app({ id: "AGV-002", stage: "under-review" }), // active
  app({ id: "AGV-003", stage: "closed" }), // resolved
  app({ id: "AGV-004", stage: "submitted" }), // out of scope — must not count
];

const manager = { id: SELF_ID, name: "Manager Self", company_id: COMPANY_ID, is_company_manager: true };
const teammateWithAccess = {
  id: "teammate-a",
  name: "Teammate Has Access",
  company_id: COMPANY_ID,
  is_company_manager: false,
};
const teammateWithoutAccess = {
  id: "teammate-b",
  name: "Teammate Zero Access",
  company_id: COMPANY_ID,
  is_company_manager: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseSession.mockImplementation((selector) =>
    selector({
      account: { id: SELF_ID, role: "client", companyId: COMPANY_ID, isCompanyManager: true },
    } as never)
  );
  mockFetchCompanyApplicationGrants.mockResolvedValue([
    { id: "scope-1", application_id: "app-1" },
    { id: "scope-2", application_id: "app-2" },
    { id: "scope-3", application_id: "app-3" },
  ]);
  mockFetchApplicationsForAccess.mockResolvedValue(accessApps);
  mockFetchApplications.mockResolvedValue(applications);
  mockFetchClientProfiles.mockResolvedValue([manager, teammateWithAccess, teammateWithoutAccess]);
  mockFetchLiveGrants.mockResolvedValue([
    { id: "grant-1", application_id: "app-1", profile_id: "teammate-a" },
  ]);
});

describe("ClientManagerHomeDashboard", () => {
  it("shows the four stat tiles with real, correctly-scoped numbers", async () => {
    render(<ClientManagerHomeDashboard />);

    await screen.findByText("Applications by status"); // panel loaded

    // Not 4 — AGV-004 is outside this company's scope and must be excluded.
    const scopeTile = screen.getByText("Applications in scope").closest("div")!;
    expect(scopeTile.textContent).toContain("3");
    expect(scopeTile.textContent).not.toContain("4");

    const rosterTile = screen.getByText("Team roster").closest("div")!;
    expect(rosterTile.textContent).toContain("3"); // manager + 2 teammates

    const accessTile = screen.getByText("Teammates with access").closest("div")!;
    expect(accessTile.textContent).toContain("1");

    const zeroAccessTile = screen.getByText("Teammates with zero access").closest("div")!;
    expect(zeroAccessTile.textContent).toContain("1");
  });

  it("tallies the status donut by tier, scoped to the company's 3 applications only", async () => {
    render(<ClientManagerHomeDashboard />);

    await screen.findByText("Applications by status");

    // One application per tier (Pending/In progress/Completed) — the
    // out-of-scope 4th application (also "submitted") must NOT double the
    // Pending count to 2.
    expect(screen.getByText("Pending").nextSibling?.textContent).toBe("1");
    expect(screen.getByText("In progress").nextSibling?.textContent).toBe("1");
    expect(screen.getByText("Completed").nextSibling?.textContent).toBe("1");
    expect(screen.getByText("total").previousSibling?.textContent).toBe("3"); // donut center total
  });

  it("lists teammates without access by name, not just a count", async () => {
    render(<ClientManagerHomeDashboard />);

    await screen.findByText("Teammates without access");

    expect(await screen.findByText("Teammate Zero Access")).toBeInTheDocument();
    expect(screen.queryByText("Teammate Has Access")).not.toBeInTheDocument();
    expect(screen.queryByText("Manager Self")).not.toBeInTheDocument(); // self excluded from "teammates"
  });

  it("shows an empty state instead of a broken chart when nothing is in scope", async () => {
    mockFetchCompanyApplicationGrants.mockResolvedValue([]);

    render(<ClientManagerHomeDashboard />);

    expect(await screen.findByText("No applications in scope yet.")).toBeInTheDocument();
  });
});
