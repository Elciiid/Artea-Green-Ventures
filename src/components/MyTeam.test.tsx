// My Team's grant/revoke round-trip — same highest-value-first case
// AccessMatrix.test.tsx covers for the admin surface, here for the
// client-manager surface: a rejected write must not leave a checkbox
// silently "stuck" in the wrong state. Mocked at the module boundary —
// "@/lib/supabase/team" (the new composed loader) and "@/lib/supabase/access"
// (grantAccess/revokeAccess/fetchLiveGrants, unchanged, imported straight
// from access.ts by MyTeam.tsx) are the real dependency surface, not the
// Supabase client underneath them. "@/lib/session" is mocked too, since
// MyTeam reads companyId/selfId from the signed-in account.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyTeam from "./MyTeam";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { fetchLiveGrants, grantAccess, revokeAccess } from "@/lib/supabase/access";
import { loadTeamData } from "@/lib/supabase/team";
import { useSession } from "@/lib/session";

vi.mock("@/lib/supabase/access", () => ({
  fetchLiveGrants: vi.fn(),
  grantAccess: vi.fn(),
  revokeAccess: vi.fn(),
}));

// Partially mocked: loadTeamData is the network call under test, but
// inScopeGrantCount is real, pure logic (see team.test.ts for its own
// dedicated unit tests) — keeping it real here exercises the actual grant
// count this component renders, not a stand-in.
vi.mock("@/lib/supabase/team", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/team")>();
  return {
    ...actual,
    loadTeamData: vi.fn(),
  };
});

vi.mock("@/lib/session", () => ({
  useSession: vi.fn(),
}));

const mockFetchLiveGrants = vi.mocked(fetchLiveGrants);
const mockGrantAccess = vi.mocked(grantAccess);
const mockRevokeAccess = vi.mocked(revokeAccess);
const mockLoadTeamData = vi.mocked(loadTeamData);
const mockUseSession = vi.mocked(useSession);

const app = { id: "app-1", reference: "APP-001", title: "Application One" };
const teammate = { id: "teammate-1", name: "Jane Doe", company_id: "company-1", is_company_manager: false };
const liveGrant = { id: "grant-1", application_id: app.id, profile_id: teammate.id };

function renderMyTeam() {
  return render(
    <TooltipProvider>
      <Toaster />
      <MyTeam />
    </TooltipProvider>
  );
}

// Table layout (docs/superpowers/plans/2026-08-07-artea-green-glow-reskin.md,
// same table AccessMatrix.tsx uses): every teammate's row and its
// per-application checkboxes render directly, no expand step.
function getCheckbox() {
  return screen.findByRole("checkbox", {
    name: new RegExp(`${teammate.name}'s access to ${app.title}$`),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseSession.mockImplementation((selector) =>
    selector({
      account: { id: "manager-1", companyId: "company-1", isCompanyManager: true } as never,
    } as never)
  );
});

describe("MyTeam", () => {
  it("grant inserts and reflects", async () => {
    const user = userEvent.setup();
    mockLoadTeamData.mockResolvedValue({ roster: [teammate], applications: [app], grants: [] });
    mockFetchLiveGrants.mockResolvedValueOnce([liveGrant]); // refetch after the toggle
    mockGrantAccess.mockResolvedValue(undefined);

    renderMyTeam();
    const checkbox = await getCheckbox();
    expect(checkbox).toHaveAttribute("aria-checked", "false");

    await user.click(checkbox);

    expect(mockGrantAccess).toHaveBeenCalledWith(app.id, teammate.id);
    expect(mockRevokeAccess).not.toHaveBeenCalled();
    await screen.findByRole("checkbox", {
      name: `Revoke ${teammate.name}'s access to ${app.title}`,
    });
  });

  it("revoke updates and reflects", async () => {
    const user = userEvent.setup();
    mockLoadTeamData.mockResolvedValue({ roster: [teammate], applications: [app], grants: [liveGrant] });
    mockFetchLiveGrants.mockResolvedValueOnce([]); // refetch after the toggle
    mockRevokeAccess.mockResolvedValue(undefined);

    renderMyTeam();
    const checkbox = await getCheckbox();
    expect(checkbox).toHaveAttribute("aria-checked", "true");

    await user.click(checkbox);

    expect(mockRevokeAccess).toHaveBeenCalledWith(liveGrant.id);
    expect(mockGrantAccess).not.toHaveBeenCalled();
    await screen.findByRole("checkbox", {
      name: `Grant ${teammate.name}'s access to ${app.title}`,
    });
  });

  it("a rejected write surfaces an error toast and leaves the checkbox unchanged", async () => {
    const user = userEvent.setup();
    mockLoadTeamData.mockResolvedValue({ roster: [teammate], applications: [app], grants: [liveGrant] });
    mockRevokeAccess.mockRejectedValue(new Error("boom"));

    renderMyTeam();
    const checkbox = await getCheckbox();

    await user.click(checkbox);

    const toast = await screen.findByText("Couldn't update access: boom");
    expect(toast).toBeInTheDocument();
    expect(
      within(checkbox.closest("tr")!).getByRole("checkbox")
    ).toHaveAttribute("aria-checked", "true");
  });

  it("does not render a teammate not on the roster", async () => {
    mockLoadTeamData.mockResolvedValue({ roster: [teammate], applications: [app], grants: [] });

    renderMyTeam();

    await screen.findByText(teammate.name);
    expect(screen.queryByText("Someone Else")).not.toBeInTheDocument();
  });
});
