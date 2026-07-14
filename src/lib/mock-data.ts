// All portal content is local mock data — no backend, no persistence.

export type Stage =
  | "submitted"
  | "under-review"
  | "site-visit"
  | "report-issued"
  | "closed";

export const PIPELINE: { id: Stage; label: string }[] = [
  { id: "submitted", label: "Submitted" },
  { id: "under-review", label: "Under Review" },
  { id: "site-visit", label: "Site Visit" },
  { id: "report-issued", label: "Report Issued" },
  { id: "closed", label: "Closed" },
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
  name: string;
  kind: string;
  size: string;
  status: "received" | "pending";
  /** ISO date; absent while the document is still pending */
  uploaded?: string;
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
    submitted: "2026-06-18",
    documents: [
      { name: "EIS Addendum — Rev B.pdf", kind: "Assessment", size: "14.2 MB", status: "received", uploaded: "2026-07-02" },
      { name: "Noise & Vibration Monitoring Plan.pdf", kind: "Plan", size: "3.8 MB", status: "received", uploaded: "2026-06-20" },
      { name: "Groundwater Baseline Data.xlsx", kind: "Dataset", size: "—", status: "pending" },
      { name: "Site Access Deed.pdf", kind: "Legal", size: "1.1 MB", status: "received", uploaded: "2026-06-18" },
    ],
    timeline: [
      { at: "2026-06-18", actor: "System", kind: "system", text: "Application received via portal." },
      { at: "2026-06-19", actor: "A. Mercer", kind: "status", text: "Status moved to Under Review." },
      { at: "2026-06-24", actor: "S. Whitfield", kind: "comment", text: "Noise and vibration baseline data requested from the delivery contractor." },
      { at: "2026-07-02", actor: "T. Alvarez", kind: "document", text: "Uploaded EIS Addendum — Rev B." },
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
    submitted: "2026-03-02",
    documents: [
      { name: "ESG Framework Mapping.pdf", kind: "Assessment", size: "8.6 MB", status: "received", uploaded: "2026-03-04" },
      { name: "Spoil Management Records — Q1.zip", kind: "Dataset", size: "112 MB", status: "received", uploaded: "2026-03-15" },
      { name: "Marine Water Quality Logs.xlsx", kind: "Dataset", size: "9.4 MB", status: "received", uploaded: "2026-04-02" },
      { name: "Final ESG Verification Report.pdf", kind: "Report", size: "22.7 MB", status: "received", uploaded: "2026-06-11" },
    ],
    timeline: [
      { at: "2026-03-02", actor: "System", kind: "system", text: "Application received via portal." },
      { at: "2026-03-05", actor: "A. Mercer", kind: "status", text: "Status moved to Under Review." },
      { at: "2026-04-15", actor: "M. Okafor", kind: "status", text: "Site visit completed — Birchgrove and Cammeray compounds." },
      { at: "2026-05-28", actor: "M. Okafor", kind: "comment", text: "Draft findings shared with consortium for factual review." },
      { at: "2026-06-11", actor: "A. Mercer", kind: "status", text: "ESG verification report issued. Conformance rating: A." },
    ],
  },
  {
    id: "AGV-2026-0155",
    title: "Manila Social Housing Program",
    service: "Flood Impact Assessment",
    sector: "Social Infrastructure",
    location: "Manila, PH",
    country: "PH",
    coords: "14.5995 / 120.9842",
    stage: "submitted",
    statusNote: "Pending documents",
    lead: "R. Santiago",
    clientName: "National Housing Authority (PH)",
    submitted: "2026-07-06",
    documents: [
      { name: "Flood Impact Assessment — ToR.pdf", kind: "Scope", size: "2.4 MB", status: "received", uploaded: "2026-07-06" },
      { name: "Flood-plain Survey (2026).pdf", kind: "Survey", size: "—", status: "pending" },
      { name: "Barangay Clearance.pdf", kind: "Legal", size: "—", status: "pending" },
    ],
    timeline: [
      { at: "2026-07-06", actor: "System", kind: "system", text: "Application received via portal." },
      { at: "2026-07-07", actor: "System", kind: "system", text: "Completeness check flagged 2 missing documents." },
      { at: "2026-07-10", actor: "R. Santiago", kind: "comment", text: "Requested updated flood-plain survey and barangay clearance from the authority." },
    ],
  },
];
