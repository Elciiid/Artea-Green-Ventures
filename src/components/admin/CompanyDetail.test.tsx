// Roster reassignment confirm — the one piece of real branching logic this
// task's brief called out explicitly: adding an unassigned client to a
// roster must write straight through, but adding a client who already
// belongs to a DIFFERENT company must stop at an explicit confirm dialog
// first, never silently move them. This is exactly the class of bug that
// "the confirm step is there in the JSX" doesn't prove — only a test that
// asserts the write DIDN'T happen until the dialog's action is clicked does.
// Mocked at the module boundary, same approach as AccessMatrix.test.tsx:
// "@/lib/supabase/companies" and "@/lib/supabase/access" are the real
// dependency surface CompanyDetail talks to, not the Supabase client
// underneath them.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompanyDetail from "./CompanyDetail";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { fetchApplicationsForAccess } from "@/lib/supabase/access";
import {
  fetchClientProfiles,
  fetchCompanies,
  fetchCompany,
  fetchCompanyApplicationGrants,
  setCompanyAssignment,
} from "@/lib/supabase/companies";

vi.mock("@/lib/supabase/access", () => ({
  fetchApplicationsForAccess: vi.fn(),
}));

vi.mock("@/lib/supabase/companies", () => ({
  fetchClientProfiles: vi.fn(),
  fetchCompanies: vi.fn(),
  fetchCompany: vi.fn(),
  fetchCompanyApplicationGrants: vi.fn(),
  grantCompanyApplication: vi.fn(),
  revokeCompanyApplication: vi.fn(),
  setCompanyAssignment: vi.fn(),
}));

const mockFetchApplicationsForAccess = vi.mocked(fetchApplicationsForAccess);
const mockFetchClientProfiles = vi.mocked(fetchClientProfiles);
const mockFetchCompanies = vi.mocked(fetchCompanies);
const mockFetchCompany = vi.mocked(fetchCompany);
const mockFetchCompanyApplicationGrants = vi.mocked(fetchCompanyApplicationGrants);
const mockSetCompanyAssignment = vi.mocked(setCompanyAssignment);

const companyA = { id: "company-a", name: "Company A", created_at: "2026-01-01", created_by: null };
const companyB = { id: "company-b", name: "Company B", created_at: "2026-01-01", created_by: null };

const unassignedClient = {
  id: "client-1",
  name: "Unassigned Client",
  company_id: null,
  is_company_manager: false,
};
const elsewhereClient = {
  id: "client-2",
  name: "Elsewhere Client",
  company_id: "company-b",
  is_company_manager: false,
};

function renderDetail() {
  return render(
    <TooltipProvider>
      <Toaster />
      <CompanyDetail companyId={companyA.id} />
    </TooltipProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchApplicationsForAccess.mockResolvedValue([]);
  mockFetchCompany.mockResolvedValue(companyA);
  mockFetchCompanies.mockResolvedValue([companyA, companyB]);
  mockFetchClientProfiles.mockResolvedValue([unassignedClient, elsewhereClient]);
  mockFetchCompanyApplicationGrants.mockResolvedValue([]);
  mockSetCompanyAssignment.mockResolvedValue(undefined);
});

describe("CompanyDetail — roster reassignment confirm", () => {
  it("adding an unassigned client writes straight through, no confirm dialog", async () => {
    const user = userEvent.setup();
    renderDetail();

    const addButton = await screen.findByRole("button", { name: "Add" });
    await user.click(addButton);

    expect(mockSetCompanyAssignment).toHaveBeenCalledWith("client-1", {
      companyId: "company-a",
      isCompanyManager: false,
    });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("adding a client who belongs to another company opens a confirm dialog and does not write until confirmed", async () => {
    const user = userEvent.setup();
    renderDetail();

    const reassignButton = await screen.findByRole("button", { name: "Reassign…" });
    await user.click(reassignButton);

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Reassign Elsewhere Client?");
    expect(dialog).toHaveTextContent("Company B");
    // No write yet — only the confirm click below should trigger it.
    expect(mockSetCompanyAssignment).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Reassign" }));

    expect(mockSetCompanyAssignment).toHaveBeenCalledWith("client-2", {
      companyId: "company-a",
      isCompanyManager: false,
    });
  });

  it("cancelling the confirm dialog leaves the assignment untouched", async () => {
    const user = userEvent.setup();
    renderDetail();

    const reassignButton = await screen.findByRole("button", { name: "Reassign…" });
    await user.click(reassignButton);
    await screen.findByRole("alertdialog");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mockSetCompanyAssignment).not.toHaveBeenCalled();
  });
});
