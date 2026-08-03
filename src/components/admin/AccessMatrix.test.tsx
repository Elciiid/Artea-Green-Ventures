// Access grant/revoke round-trip — the highest-value first test for this
// app per the front-end review: until Task 3 landed, revokeAccess() had no
// server-side guard, and a rejected write here is exactly the class of bug
// (a checkbox that silently "sticks" or "reverts") that survives manual
// click-through QA. `src/lib/supabase/access.ts` is mocked at the module
// boundary — its exported functions are the real dependency surface
// AccessMatrix talks to, not the Supabase client underneath it.

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

vi.mock("@/lib/supabase/access", () => ({
  fetchApplicationsForAccess: vi.fn(),
  fetchGrantableProfiles: vi.fn(),
  fetchLiveGrants: vi.fn(),
  grantAccess: vi.fn(),
  revokeAccess: vi.fn(),
}));

const mockFetchApplicationsForAccess = vi.mocked(fetchApplicationsForAccess);
const mockFetchGrantableProfiles = vi.mocked(fetchGrantableProfiles);
const mockFetchLiveGrants = vi.mocked(fetchLiveGrants);
const mockGrantAccess = vi.mocked(grantAccess);
const mockRevokeAccess = vi.mocked(revokeAccess);

const app = { id: "app-1", reference: "APP-001", title: "Application One" };
const profile = { id: "profile-1", name: "Jane Doe", role: "staff" } as const;
const liveGrant = { id: "grant-1", application_id: app.id, profile_id: profile.id };

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

// Expands the person's row so their per-application checkboxes render, then
// returns the checkbox for the given application.
async function openRowAndGetCheckbox(user: ReturnType<typeof userEvent.setup>) {
  const trigger = await screen.findByRole("button", {
    name: new RegExp(`^${profile.name}, ${profile.role}, \\d+ of 1 applications$`),
  });
  await user.click(trigger);
  return screen.findByRole("checkbox", {
    name: new RegExp(`${profile.name}'s access to ${app.title}$`),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchApplicationsForAccess.mockResolvedValue([app]);
  mockFetchGrantableProfiles.mockResolvedValue([profile]);
});

describe("AccessMatrix", () => {
  it("grant inserts and reflects", async () => {
    const user = userEvent.setup();
    mockFetchLiveGrants
      .mockResolvedValueOnce([]) // initial load: no live grant yet
      .mockResolvedValueOnce([liveGrant]); // refetch after the toggle
    mockGrantAccess.mockResolvedValue(undefined);

    renderMatrix();
    const checkbox = await openRowAndGetCheckbox(user);
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
    const checkbox = await openRowAndGetCheckbox(user);
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
    const checkbox = await openRowAndGetCheckbox(user);

    await user.click(checkbox);

    const toast = await screen.findByText("Couldn't update access: boom");
    expect(toast).toBeInTheDocument();
    // The write failed, so the checkbox must not have flipped to unchecked.
    expect(
      within(checkbox.closest("li")!).getByRole("checkbox")
    ).toHaveAttribute("aria-checked", "true");
  });
});
