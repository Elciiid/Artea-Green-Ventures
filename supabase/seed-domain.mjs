// Seed the real domain data (Phase 10b-1): the three demo applications, their
// documents + activity timelines, and the access grants that replace the old
// visibleApplicationIds map. Ported from src/lib/mock-data.ts.
//
// Run it yourself — the service_role key bypasses RLS (that's why it can seed
// across every table) and must never touch the repo, .env.local, or the bundle:
//
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<your service_role key> \
//   node supabase/seed-domain.mjs
//
// Idempotent: every row uses a deterministic UUID (uuid v5), so re-running
// upserts in place rather than duplicating. Access grants are inserted once and
// never overwritten on re-run, honoring the grant/revoke lifecycle (a grant an
// admin later revokes is NOT resurrected by re-seeding).
//
// Prerequisite: apply 20260722120000_agv_domain.sql first (the tables must
// exist). Run AFTER seed-users.mjs (grants reference the seeded user profiles).

import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}

const db = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ORG_ID = "00000000-0000-0000-0000-0000000a6700";

// Deterministic UUID v5 (name-based, SHA-1) so re-runs upsert instead of dup.
const NS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"; // a fixed namespace UUID
function uuid5(name) {
  const ns = Buffer.from(NS.replace(/-/g, ""), "hex");
  const h = createHash("sha1").update(ns).update(name).digest();
  const b = h.subarray(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50; // version 5
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const s = b.toString("hex");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

const noon = (date) => `${date}T12:00:00Z`; // stable date portion regardless of TZ

// ——— the three applications, straight from mock-data.ts ———
const APPS = [
  {
    reference: "AGV-2026-0142",
    title: "Parramatta Light Rail Stage 2",
    service: "Environmental Compliance Audit",
    sector: "Transportation",
    location: "Sydney, AU",
    country: "AU",
    coords: "-33.8150 / 151.0011",
    stage: "under-review",
    status_note: null,
    lead: "S. Whitfield",
    client_name: "Transport for NSW",
    hero: "/images/site/app-parramatta-hero.avif",
    submitted_at: "2026-06-18",
    documents: [
      { name: "EIS Addendum — Rev B.pdf", kind: "Assessment", size_label: "14.2 MB", status: "received", uploaded: "2026-07-02" },
      { name: "Noise & Vibration Monitoring Plan.pdf", kind: "Plan", size_label: "3.8 MB", status: "received", uploaded: "2026-06-20" },
      { name: "Groundwater Baseline Data.xlsx", kind: "Dataset", size_label: "—", status: "pending", uploaded: null },
      { name: "Site Access Deed.pdf", kind: "Legal", size_label: "1.1 MB", status: "received", uploaded: "2026-06-18" },
    ],
    timeline: [
      { at: "2026-06-18", actor: "System", kind: "system", body: "We received this application through the portal.", visibleToClient: true },
      { at: "2026-06-19", actor: "A. Mercer", kind: "status", body: "Status moved to Under Review." },
      { at: "2026-06-24", actor: "S. Whitfield", kind: "comment", body: "We asked the delivery contractor for baseline noise and vibration data." },
      { at: "2026-07-02", actor: "T. Alvarez", kind: "document", body: "Uploaded the EIS Addendum (Rev B)." },
      { at: "2026-07-09", actor: "S. Whitfield", kind: "comment", body: "Section 4 review complete. Groundwater assessment underway." },
    ],
  },
  {
    reference: "AGV-2026-0118",
    title: "Western Harbour Tunnel & Warringah Freeway Upgrade",
    service: "ESG Verification",
    sector: "Transportation",
    location: "Sydney, AU",
    country: "AU",
    coords: "-33.8523 / 151.2108",
    stage: "report-issued",
    status_note: "Approved",
    lead: "M. Okafor",
    client_name: "WHT Delivery Consortium",
    hero: "/images/site/app-western-harbour-hero.avif",
    submitted_at: "2026-03-02",
    documents: [
      { name: "ESG Framework Mapping.pdf", kind: "Assessment", size_label: "8.6 MB", status: "received", uploaded: "2026-03-04" },
      { name: "Spoil Management Records — Q1.zip", kind: "Dataset", size_label: "112 MB", status: "received", uploaded: "2026-03-15" },
      { name: "Marine Water Quality Logs.xlsx", kind: "Dataset", size_label: "9.4 MB", status: "received", uploaded: "2026-04-02" },
      { name: "Final ESG Verification Report.pdf", kind: "Report", size_label: "22.7 MB", status: "received", uploaded: "2026-06-11" },
    ],
    timeline: [
      { at: "2026-03-02", actor: "System", kind: "system", body: "We received this application through the portal." },
      { at: "2026-03-05", actor: "A. Mercer", kind: "status", body: "Status moved to Under Review." },
      { at: "2026-04-15", actor: "M. Okafor", kind: "status", body: "Site visit completed — Birchgrove and Cammeray compounds." },
      { at: "2026-05-28", actor: "M. Okafor", kind: "comment", body: "We sent the draft findings to the consortium to check the facts." },
      { at: "2026-06-11", actor: "A. Mercer", kind: "status", body: "ESG verification report issued. Conformance rating: A." },
    ],
  },
  {
    reference: "AGV-2026-0161",
    title: "Sydney Gateway",
    service: "Environmental Compliance Audit",
    sector: "Transportation",
    location: "Sydney, AU",
    country: "AU",
    coords: "-33.9268 / 151.1710",
    stage: "submitted",
    status_note: "Waiting for documents",
    lead: "R. Santiago",
    client_name: "Transport for NSW",
    hero: "/images/site/app-sydney-gateway-hero.avif",
    submitted_at: "2026-07-08",
    documents: [
      { name: "Environmental Impact Statement — Rev A.pdf", kind: "Assessment", size_label: "18.4 MB", status: "received", uploaded: "2026-07-08" },
      { name: "Air Quality & Noise Assessment.pdf", kind: "Assessment", size_label: "—", status: "pending", uploaded: null },
      { name: "Contaminated Land Survey — St Peters.pdf", kind: "Survey", size_label: "—", status: "pending", uploaded: null },
    ],
    timeline: [
      { at: "2026-07-08", actor: "System", kind: "system", body: "We received this application through the portal." },
      { at: "2026-07-09", actor: "System", kind: "system", body: "An automatic check found 2 missing documents." },
      { at: "2026-07-13", actor: "R. Santiago", kind: "comment", body: "We asked Transport for NSW for the air quality and noise assessment and the St Peters contaminated land survey." },
    ],
  },
];

// Access grants that replace visibleApplicationIds (admins see all regardless).
const GRANTS = [
  { email: "user1@agv-demo.com", references: ["AGV-2026-0142", "AGV-2026-0118"] },
  { email: "user2@agv-demo.com", references: ["AGV-2026-0161"] },
  { email: "client1@agv-demo.com", references: ["AGV-2026-0142"] },
];

async function must(label, promise) {
  const { error } = await promise;
  if (error) {
    console.error(`✗ ${label}:`, error.message);
    process.exit(1);
  }
}

async function main() {
  // 0) org (the migration inserts this too; upsert for safety)
  await must(
    "organization",
    db.from("agv_organizations").upsert({ id: ORG_ID, name: "Artea Green Ventures" }, { onConflict: "id" })
  );

  // 1) applications, documents, activity
  for (const app of APPS) {
    const appId = uuid5(app.reference);
    const { documents, timeline, ...appRow } = app;

    await must(
      `application ${app.reference}`,
      db.from("agv_applications").upsert({ id: appId, organization_id: ORG_ID, ...appRow }, { onConflict: "id" })
    );

    const docRows = documents.map((d, i) => ({
      id: uuid5(`${app.reference}:doc:${d.name}`),
      application_id: appId,
      name: d.name,
      kind: d.kind,
      storage_path: null, // real files land in slice 10b-3
      size_label: d.size_label,
      status: d.status,
      uploaded_by: null,
      uploaded_at: d.uploaded ? noon(d.uploaded) : null,
      // Documents aren't chronological in this list (grouped by category, not
      // upload date), and every row in one upsert batch gets the same
      // default now() — stagger created_at by index so ORDER BY created_at
      // reproduces this exact array order. Phase 10b-2.
      created_at: new Date(Date.parse(noon(app.submitted_at)) + i * 1000).toISOString(),
    }));
    await must(`documents ${app.reference}`, db.from("agv_documents").upsert(docRows, { onConflict: "id" }));

    const actRows = timeline.map((t, i) => ({
      id: uuid5(`${app.reference}:act:${i}`),
      application_id: appId,
      occurred_at: noon(t.at),
      actor: t.actor,
      kind: t.kind,
      body: t.body,
      visible_to_client: t.visibleToClient ?? false,
    }));
    await must(`activity ${app.reference}`, db.from("agv_activity_entries").upsert(actRows, { onConflict: "id" }));

    console.log(`✓ ${app.reference} — ${docRows.length} docs, ${actRows.length} activity`);
  }

  // 2) access grants — resolve emails → profile ids, insert live grants once
  const { data: usersData, error: listErr } = await db.auth.admin.listUsers({ perPage: 200 });
  if (listErr) {
    console.error("✗ listUsers:", listErr.message);
    process.exit(1);
  }
  const idByEmail = new Map(usersData.users.map((u) => [u.email, u.id]));

  for (const grant of GRANTS) {
    const profileId = idByEmail.get(grant.email);
    if (!profileId) {
      console.error(`✗ no seeded user for ${grant.email} — run seed-users.mjs first`);
      process.exit(1);
    }
    for (const reference of grant.references) {
      const appId = uuid5(reference);
      const row = {
        id: uuid5(`grant:${reference}:${profileId}`),
        application_id: appId,
        profile_id: profileId,
      };
      // ignoreDuplicates: a grant an admin later revoked is NOT resurrected.
      await must(
        `grant ${grant.email} → ${reference}`,
        db.from("agv_application_access").upsert(row, { onConflict: "id", ignoreDuplicates: true })
      );
    }
    console.log(`✓ grants for ${grant.email}: ${grant.references.join(", ")}`);
  }

  console.log("\nDone. Domain data seeded (applications, documents, activity, access grants).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
