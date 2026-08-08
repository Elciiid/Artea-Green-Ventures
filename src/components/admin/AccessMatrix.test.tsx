// Access grant/revoke round-trip — the highest-value first test for this
// app per the front-end review: until Task 3 landed, revokeAccess() had no
// server-side guard, and a rejected write here is exactly the class of bug
// (a checkbox that silently "sticks" or "reverts") that survives manual
// click-through QA. `src/lib/supabase/access.ts` is mocked at the module
// boundary — its exported functions are the real dependency surface
// AccessMatrix talks to, not the Supabase client underneath it. Same for
// `src/lib/supabase/companies.ts`, added when the Access tab grew a second
// table (company scope, replacing per-client grants).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccessMatrix from "./AccessMatrix";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  fetchApplicationsForAccess,
  fetchGrantableProfiles,
  fetchLiveGrants,
  grantAccess,
  revokeAccess,
} from "@/lib/supabase/access";
import {
  fetchAllCompanyApplicationGrants,
  fetchClientProfiles,
  fetchCompanies,
  grantCompanyApplication,
  revokeCompanyApplication,
} from "@/lib/supabase/companies";

vi.mock("@/lib/supabase/access", () => ({
  fetchApplicationsForAccess: vi.fn(),
  fetchGrantableProfiles: vi.fn(),
  fetchLiveGrants: vi.fn(),
  grantAccess: vi.fn(),
  revokeAccess: vi.fn(),
}));

vi.mock("@/lib/supabase/companies", () => ({
  fetchAllCompanyApplicationGrants: vi.fn(),
  fetchClientProfiles: vi.fn(),
  fetchCompanies: vi.fn(),
  grantCompanyApplication: vi.fn(),
  revokeCompanyApplication: vi.fn(),
}));

const mockFetchApplicationsForAccess = vi.mocked(fetchApplicationsForAccess);
const mockFetchGrantableProfiles = vi.mocked(fetchGrantableProfiles);
const mockFetchLiveGrants = vi.mocked(fetchLiveGrants);
const mockGrantAccess = vi.mocked(grantAccess);
const mockRevokeAccess = vi.mocked(revokeAccess);

const mockFetchAllCompanyApplicationGrants = vi.mocked(fetchAllCompanyApplicationGrants);
const mockFetchClientProfiles = vi.mocked(fetchClientProfiles);
const mockFetchCompanies = vi.mocked(fetchCompanies);
const mockGrantCompanyApplication = vi.mocked(grantCompanyApplication);
const mockRevokeCompanyApplication = vi.mocked(revokeCompanyApplication);

const app = { id: "app-1", reference: "APP-001", title: "Application One" };
const profile = { id: "profile-1", name: "Jane Doe", role: "staff" } as const;
const liveGrant = { id: "grant-1", application_id: app.id, profile_id: profile.id };

const company = { id: "company-1", name: "Acme Co", created_at: "2026-01-01", created_by: null };
const manager = {
  id: "manager-1",
  name: "Sam Manager",
  company_id: company.id,
  is_company_manager: true,
};
const companyGrant = { id: "cgrant-1", application_id: app.id, company_id: company.id };

// AccessMatrix calls `toast.error` from "sonner", but the DOM nodes that
// render a toast come from the shared <Toaster/> mounted separately in
// src/app/layout.tsx in the real app — so the toast-visibility test needs it
// rendered alongside the component under test, same as production does.
// TooltipProvider is likewise supplied by layout.tsx in production;
// PeopleSectionHeading (rendered inside AccessMatrix) uses a Tooltip and
// throws without one.
function renderMatrix() {
  return render(
    <TooltipProvider>
      <Toaster />
      <AccessMatrix />
    </TooltipProvider>
  );
}

// Table layout (docs/superpowers/plans/2026-08-07-artea-green-glow-reskin.md,
// Access tab reskin): every row and its per-application checkboxes render
// directly, no expand step — these just find the one checkbox that matters
// for a given test.
function getStaffCheckbox() {
  return screen.findByRole("checkbox", {
    name: new RegExp(`${profile.name}'s access to ${app.title}$`),
  });
}
function getCompanyCheckbox() {
  return screen.findByRole("checkbox", {
    name: new RegExp(`${app.title} (to|from) ${company.name}'s scope$`),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchApplicationsForAccess.mockResolvedValue([app]);
  mockFetchGrantableProfiles.mockResolvedValue([profile]);
  mockFetchCompanies.mockResolvedValue([company]);
  mockFetchClientProfiles.mockResolvedValue([manager]);
  mockFetchAllCompanyApplicationGrants.mockResolvedValue([]);
});

describe("AccessMatrix — staff table", () => {
  it("grant inserts and reflects", async () => {
    const user = userEvent.setup();
    mockFetchLiveGrants
      .mockResolvedValueOnce([]) // initial load: no live grant yet
      .mockResolvedValueOnce([liveGrant]); // refetch after the toggle
    mockGrantAccess.mockResolvedValue(undefined);

    renderMatrix();
    const checkbox = await getStaffCheckbox();
    expect(checkbox).toHaveAttribute("aria-checked", "false");

    await user.click(checkbox);

    expect(mockGrantAccess).toHaveBeenCalledWith(app.id, profile.id);
    expect(mockRevokeAccess).not.toHaveBeenCalled();
    await screen.findByRole("checkbox", {
      name: `Revoke ${profile.name}'s access to ${app.title}`,
    });
  });

  it("revoke updates and reflects", async () => {
    const user = userEvent.setup();
    mockFetchLiveGrants
      .mockResolvedValueOnce([liveGrant]) // initial load: already granted
      .mockResolvedValueOnce([]); // refetch after the toggle
    mockRevokeAccess.mockResolvedValue(undefined);

    renderMatrix();
    const checkbox = await getStaffCheckbox();
    expect(checkbox).toHaveAttribute("aria-checked", "true");

    await user.click(checkbox);

    expect(mockRevokeAccess).toHaveBeenCalledWith(liveGrant.id);
    expect(mockGrantAccess).not.toHaveBeenCalled();
    await screen.findByRole("checkbox", {
      name: `Grant ${profile.name}'s access to ${app.title}`,
    });
  });

  it("a rejected write surfaces an error toast", async () => {
    const user = userEvent.setup();
    mockFetchLiveGrants.mockResolvedValueOnce([liveGrant]); // only the initial load runs
    mockRevokeAccess.mockRejectedValue(new Error("boom"));

    renderMatrix();
    const checkbox = await getStaffCheckbox();

    await user.click(checkbox);

    const toast = await screen.findByText("Couldn't update access: boom");
    expect(toast).toBeInTheDocument();
    // The write failed, so the checkbox must not have flipped to unchecked.
    expect(
      within(checkbox.closest("tr")!).getByRole("checkbox")
    ).toHaveAttribute("aria-checked", "true");
  });
});

describe("AccessMatrix — company table", () => {
  beforeEach(() => {
    mockFetchLiveGrants.mockResolvedValue([]);
  });

  it("grant adds the company to scope (cascading to the manager is the DB trigger's job, not this component's)", async () => {
    const user = userEvent.setup();
    mockFetchAllCompanyApplicationGrants
      .mockResolvedValueOnce([]) // initial load: not in scope yet
      .mockResolvedValueOnce([companyGrant]); // refetch after the toggle
    mockGrantCompanyApplication.mockResolvedValue(undefined);

    renderMatrix();
    const checkbox = await getCompanyCheckbox();
    expect(checkbox).toHaveAttribute("aria-checked", "false");

    await user.click(checkbox);

    expect(mockGrantCompanyApplication).toHaveBeenCalledWith(company.id, app.id);
    expect(mockRevokeCompanyApplication).not.toHaveBeenCalled();
    await screen.findByRole("checkbox", {
      name: `Remove ${app.title} from ${company.name}'s scope`,
    });
  });

  it("revoke narrows scope and reflects", async () => {
    const user = userEvent.setup();
    mockFetchAllCompanyApplicationGrants
      .mockResolvedValueOnce([companyGrant]) // initial load: already in scope
      .mockResolvedValueOnce([]); // refetch after the toggle
    mockRevokeCompanyApplication.mockResolvedValue(undefined);

    renderMatrix();
    const checkbox = await getCompanyCheckbox();
    expect(checkbox).toHaveAttribute("aria-checked", "true");

    await user.click(checkbox);

    expect(mockRevokeCompanyApplication).toHaveBeenCalledWith(companyGrant.id);
    expect(mockGrantCompanyApplication).not.toHaveBeenCalled();
    await screen.findByRole("checkbox", {
      name: `Add ${app.title} to ${company.name}'s scope`,
    });
  });

  it("a rejected write surfaces an error toast and leaves the checkbox unchanged", async () => {
    const user = userEvent.setup();
    mockFetchAllCompanyApplicationGrants.mockResolvedValueOnce([companyGrant]);
    mockRevokeCompanyApplication.mockRejectedValue(new Error("boom"));

    renderMatrix();
    const checkbox = await getCompanyCheckbox();

    await user.click(checkbox);

    const toast = await screen.findByText("Couldn't update access: boom");
    expect(toast).toBeInTheDocument();
    expect(
      within(checkbox.closest("tr")!).getByRole("checkbox")
    ).toHaveAttribute("aria-checked", "true");
  });

  it("shows an amber warning when a company has no manager assigned", async () => {
    mockFetchClientProfiles.mockResolvedValue([]); // no manager for `company`
    mockFetchAllCompanyApplicationGrants.mockResolvedValue([]);

    renderMatrix();

    await screen.findByText("No manager assigned yet");
  });
});
