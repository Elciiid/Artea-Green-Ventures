"use client";

// /admin gallery: every application, straight through to its detail page.
//
// (The Phase 2 analytics — StatStrip, PipelineFunnel, SectorBars — and the
// sortable ApplicationsTable remain in src/components/admin/ but are no
// longer rendered, in case an opt-in "Insights" view is wanted later.)

import ApplicationGallery from "@/components/ApplicationGallery";
import { useApplications } from "@/lib/applications";

export default function AdminDashboard() {
  const applications = useApplications((s) => s.applications);

  return (
    <ApplicationGallery
      eyebrow="Admin console"
      eyebrowClass="text-signal"
      title="Applications"
      subtitle={`${applications.length} active engagements across AU and PH — open one to review its status, documents and activity.`}
      applications={applications}
      hrefBase="/admin/applications"
    />
  );
}
