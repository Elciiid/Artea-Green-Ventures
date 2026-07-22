// All portal content is local mock data — no backend, no persistence.

export type Stage =
  | "submitted"
  | "under-review"
  | "site-visit"
  | "report-issued"
  | "closed";

// Each stage carries a plain-language description so a reader who doesn't
// know the process can tell what the current step actually means.
export const PIPELINE: { id: Stage; label: string; description: string }[] = [
  {
    id: "submitted",
    label: "Submitted",
    description: "We have the application and are checking that nothing is missing.",
  },
  {
    id: "under-review",
    label: "Under Review",
    description: "Our specialists are going through the application in detail.",
  },
  {
    id: "site-visit",
    label: "Site Visit",
    description: "We are visiting the site to check conditions in person.",
  },
  {
    id: "report-issued",
    label: "Report Issued",
    description: "We finished the assessment and sent our report to the client.",
  },
  {
    id: "closed",
    label: "Closed",
    description: "The work is finished and this application is now closed.",
  },
];

// 3-tier status semantics: Ash = neutral (not yet active), Amber = active
// (in motion), Contour = resolved (positive). Signal never marks status —
// it is reserved for interactive elements.
export type Tier = "neutral" | "active" | "resolved";

export const TIER_OF_STAGE: Record<Stage, Tier> = {
  submitted: "neutral",
  "under-review": "active",
  "site-visit": "active",
  "report-issued": "resolved",
  closed: "resolved",
};

export const TIERS: { id: Tier; label: string }[] = [
  { id: "neutral", label: "Neutral" },
  { id: "active", label: "Active" },
  { id: "resolved", label: "Resolved" },
];

export function stageIndex(stage: Stage): number {
  return PIPELINE.findIndex((s) => s.id === stage);
}

export type DocumentItem = {
  /** the document's own row id (Supabase only, absent for mock data) — needed to target an upload */
  id?: string;
  name: string;
  kind: string;
  size: string;
  status: "received" | "pending";
  /** ISO date; absent while the document is still pending */
  uploaded?: string;
  /** Storage object path (Supabase only) — set once a real file is attached */
  storagePath?: string;
};

export type TimelineEntry = {
  at: string; // ISO date
  actor: string;
  kind: "status" | "comment" | "document" | "system";
  text: string;
};

export type Application = {
  id: string; // case id, shown in mono
  title: string;
  service: string;
  sector: "Transportation" | "Social Infrastructure";
  location: string;
  country: "AU" | "PH";
  coords: string;
  stage: Stage;
  statusNote?: string;
  lead: string;
  /** the real-world organization AGV was engaged by (not a portal user) */
  clientName: string;
  /** AGV site photography path (currently unrendered — see Phase 10b) */
  hero: string;
  submitted: string; // ISO date
  documents: DocumentItem[];
  timeline: TimelineEntry[];
};

export const APPLICATIONS: Application[] = [
  {
    id: "AGV-2026-0142",
    title: "Parramatta Light Rail Stage 2",
    service: "Environmental Compliance Audit",
    sector: "Transportation",
    location: "Sydney, AU",
    country: "AU",
    coords: "-33.8150 / 151.0011",
    stage: "under-review",
    lead: "S. Whitfield",
    clientName: "Transport for NSW",
    hero: "/images/site/app-parramatta-hero.avif",
    submitted: "2026-06-18",
    documents: [
      { name: "EIS Addendum — Rev B.pdf", kind: "Assessment", size: "14.2 MB", status: "received", uploaded: "2026-07-02" },
      { name: "Noise & Vibration Monitoring Plan.pdf", kind: "Plan", size: "3.8 MB", status: "received", uploaded: "2026-06-20" },
      { name: "Groundwater Baseline Data.xlsx", kind: "Dataset", size: "—", status: "pending" },
      { name: "Site Access Deed.pdf", kind: "Legal", size: "1.1 MB", status: "received", uploaded: "2026-06-18" },
    ],
    timeline: [
      { at: "2026-06-18", actor: "System", kind: "system", text: "We received this application through the portal." },
      { at: "2026-06-19", actor: "A. Mercer", kind: "status", text: "Status moved to Under Review." },
      { at: "2026-06-24", actor: "S. Whitfield", kind: "comment", text: "We asked the delivery contractor for baseline noise and vibration data." },
      { at: "2026-07-02", actor: "T. Alvarez", kind: "document", text: "Uploaded the EIS Addendum (Rev B)." },
      { at: "2026-07-09", actor: "S. Whitfield", kind: "comment", text: "Section 4 review complete. Groundwater assessment underway." },
    ],
  },
  {
    id: "AGV-2026-0118",
    title: "Western Harbour Tunnel & Warringah Freeway Upgrade",
    service: "ESG Verification",
    sector: "Transportation",
    location: "Sydney, AU",
    country: "AU",
    coords: "-33.8523 / 151.2108",
    stage: "report-issued",
    statusNote: "Approved",
    lead: "M. Okafor",
    clientName: "WHT Delivery Consortium",
    hero: "/images/site/app-western-harbour-hero.avif",
    submitted: "2026-03-02",
    documents: [
      { name: "ESG Framework Mapping.pdf", kind: "Assessment", size: "8.6 MB", status: "received", uploaded: "2026-03-04" },
      { name: "Spoil Management Records — Q1.zip", kind: "Dataset", size: "112 MB", status: "received", uploaded: "2026-03-15" },
      { name: "Marine Water Quality Logs.xlsx", kind: "Dataset", size: "9.4 MB", status: "received", uploaded: "2026-04-02" },
      { name: "Final ESG Verification Report.pdf", kind: "Report", size: "22.7 MB", status: "received", uploaded: "2026-06-11" },
    ],
    timeline: [
      { at: "2026-03-02", actor: "System", kind: "system", text: "We received this application through the portal." },
      { at: "2026-03-05", actor: "A. Mercer", kind: "status", text: "Status moved to Under Review." },
      { at: "2026-04-15", actor: "M. Okafor", kind: "status", text: "Site visit completed — Birchgrove and Cammeray compounds." },
      { at: "2026-05-28", actor: "M. Okafor", kind: "comment", text: "We sent the draft findings to the consortium to check the facts." },
      { at: "2026-06-11", actor: "A. Mercer", kind: "status", text: "ESG verification report issued. Conformance rating: A." },
    ],
  },
  {
    id: "AGV-2026-0161",
    title: "Sydney Gateway",
    service: "Environmental Compliance Audit",
    sector: "Transportation",
    location: "Sydney, AU",
    country: "AU",
    coords: "-33.9268 / 151.1710",
    stage: "submitted",
    statusNote: "Waiting for documents",
    lead: "R. Santiago",
    clientName: "Transport for NSW",
    hero: "/images/site/app-sydney-gateway-hero.avif",
    submitted: "2026-07-08",
    documents: [
      { name: "Environmental Impact Statement — Rev A.pdf", kind: "Assessment", size: "18.4 MB", status: "received", uploaded: "2026-07-08" },
      { name: "Air Quality & Noise Assessment.pdf", kind: "Assessment", size: "—", status: "pending" },
      { name: "Contaminated Land Survey — St Peters.pdf", kind: "Survey", size: "—", status: "pending" },
    ],
    timeline: [
      { at: "2026-07-08", actor: "System", kind: "system", text: "We received this application through the portal." },
      { at: "2026-07-09", actor: "System", kind: "system", text: "An automatic check found 2 missing documents." },
      { at: "2026-07-13", actor: "R. Santiago", kind: "comment", text: "We asked Transport for NSW for the air quality and noise assessment and the St Peters contaminated land survey." },
    ],
  },
];
