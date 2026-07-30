"use client";

// Small label + info tooltip, replacing the old H2 + permanent two-line
// instructional paragraph pattern that RoleAssignment/AccessMatrix/ActivityLog
// each repeated. The instructions only matter the first time someone opens a
// tab, not on every visit, so they live behind an info icon instead of
// permanent page real estate.

import { InfoIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function PeopleSectionHeading({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-label font-semibold uppercase tracking-[0.14em] text-ash">
        {label}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`About ${label.toLowerCase()}`}
            className="text-ash/70 transition hover:text-ash"
          >
            <InfoIcon className="h-3.5 w-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent>{description}</TooltipContent>
      </Tooltip>
    </div>
  );
}
