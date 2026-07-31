"use client";

// Minimal Previous/Next pagination, shared by AccessMatrix and ActivityLog
// (both sub-tabs) — no page-count-with-numbered-links pattern exists
// elsewhere in this app to follow, so this picks the simplest thing that
// works: a page indicator plus two buttons, matching the app's plain,
// functional register/list conventions rather than a decorative widget.

import { Button } from "@/components/ui/button";

export default function SimplePagination({
  page,
  totalPages,
  onPageChange,
  label,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Distinguishes this control's buttons when more than one pagination
   * control exists on the same page (e.g. Activity's two sub-tabs). */
  label: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-3">
      <span className="text-xs text-ash" aria-live="polite">
        Page {page} of {totalPages}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label={`Previous page of ${label}`}
      >
        Previous
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label={`Next page of ${label}`}
      >
        Next
      </Button>
    </div>
  );
}
