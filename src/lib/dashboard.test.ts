// Pure computations behind the four Dashboard variants (src/components/home).
// Everything else in those components is either JSX or a network call —
// these are the genuinely testable pieces: status counts, the "needs
// attention" queue, recency ordering, the client-activity digest merge, and
// the admin "company with clients but no manager" grouping.

import { describe, it, expect } from "vitest";
import {
  stageCounts,
  needsAttention,
  mostRecentlyActive,
  buildActivityDigest,
  companiesWithoutManager,
} from "./dashboard";
import type { Application, TimelineEntry } from "./mock-data";
import type { Company, ClientProfile } from "./supabase/companies";

function app(overrides: Partial<Application> = {}): Application {
  return {
    id: "AGV-0001",
    title: "Test application",
    service: "Service",
    sector: "Transportation",
    location: "Sydney, AU",
    country: "AU",
    coords: "",
    stage: "submitted",
    lead: "Lead",
    clientName: "Client",
    hero: "",
    submitted: "2026-01-01",
    documents: [],
    timeline: [],
    ...overrides,
  };
}

describe("stageCounts", () => {
  it("counts applications per stage", () => {
    const apps = [
      app({ stage: "submitted" }),
      app({ stage: "submitted" }),
      app({ stage: "closed" }),
    ];
    expect(stageCounts(apps)).toEqual({
      submitted: 2,
      "under-review": 0,
      "site-visit": 0,
      "report-issued": 0,
      closed: 1,
    });
  });

  it("returns every stage at zero for an empty list, not a sparse object", () => {
    expect(stageCounts([])).toEqual({
      submitted: 0,
      "under-review": 0,
      "site-visit": 0,
      "report-issued": 0,
      closed: 0,
    });
  });
});

describe("needsAttention", () => {
  it("keeps only the pre-report stages (submitted, under-review, site-visit)", () => {
    const apps = [
      app({ id: "A", stage: "submitted" }),
      app({ id: "B", stage: "report-issued" }),
      app({ id: "C", stage: "closed" }),
      app({ id: "D", stage: "under-review" }),
      app({ id: "E", stage: "site-visit" }),
    ];
    expect(needsAttention(apps).map((a) => a.id)).toEqual(["A", "D", "E"]);
  });

  it("orders the longest-waiting application first", () => {
    const apps = [
      app({ id: "newer", stage: "submitted", submitted: "2026-07-01" }),
      app({ id: "older", stage: "under-review", submitted: "2026-01-01" }),
    ];
    expect(needsAttention(apps).map((a) => a.id)).toEqual(["older", "newer"]);
  });

  it("returns an empty list when nothing is action-pending", () => {
    expect(needsAttention([app({ stage: "closed" }), app({ stage: "report-issued" })])).toEqual([]);
  });
});

describe("mostRecentlyActive", () => {
  it("sorts by submitted date, most recent first", () => {
    const apps = [
      app({ id: "old", submitted: "2026-01-01" }),
      app({ id: "new", submitted: "2026-07-01" }),
      app({ id: "mid", submitted: "2026-04-01" }),
    ];
    expect(mostRecentlyActive(apps, 3).map((a) => a.id)).toEqual(["new", "mid", "old"]);
  });

  it("respects the limit", () => {
    const apps = [app({ id: "a" }), app({ id: "b" }), app({ id: "c" })];
    expect(mostRecentlyActive(apps, 2)).toHaveLength(2);
  });

  it("returns an empty list unchanged", () => {
    expect(mostRecentlyActive([], 5)).toEqual([]);
  });
});

describe("buildActivityDigest", () => {
  const t = (overrides: Partial<TimelineEntry>): TimelineEntry => ({
    at: "2026-01-01",
    actor: "A. Mercer",
    kind: "status",
    text: "Status moved.",
    ...overrides,
  });

  it("flattens timelines from multiple applications and tags each entry with its application", () => {
    const result = buildActivityDigest(
      [
        { application: { id: "AGV-1", title: "App One" }, timeline: [t({ at: "2026-01-01" })] },
        { application: { id: "AGV-2", title: "App Two" }, timeline: [t({ at: "2026-01-02" })] },
      ],
      10
    );
    expect(result).toHaveLength(2);
    expect(result.find((e) => e.applicationId === "AGV-1")?.applicationTitle).toBe("App One");
  });

  it("sorts entries across applications by date, most recent first", () => {
    const result = buildActivityDigest(
      [
        {
          application: { id: "AGV-1", title: "App One" },
          timeline: [t({ at: "2026-01-01" }), t({ at: "2026-06-01" })],
        },
        { application: { id: "AGV-2", title: "App Two" }, timeline: [t({ at: "2026-03-01" })] },
      ],
      10
    );
    expect(result.map((e) => e.at)).toEqual(["2026-06-01", "2026-03-01", "2026-01-01"]);
  });

  it("respects the limit across the merged, not per-application, list", () => {
    const result = buildActivityDigest(
      [
        {
          application: { id: "AGV-1", title: "App One" },
          timeline: [t({ at: "2026-01-01" }), t({ at: "2026-02-01" }), t({ at: "2026-03-01" })],
        },
      ],
      2
    );
    expect(result).toHaveLength(2);
  });

  it("returns an empty list when there are no applications", () => {
    expect(buildActivityDigest([], 5)).toEqual([]);
  });
});

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
