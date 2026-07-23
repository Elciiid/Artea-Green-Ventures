import type { ReactNode } from "react";
import TopoField from "@/components/TopoField";
import type { Peak } from "@/lib/topo";

// The contour motif as a BOUNDED figure — a framed plate with a hairline
// border and a caption, read like a survey inset or map stamp on a document,
// rather than ambient wallpaper. The seed still derives from the case id
// upstream, so each application keeps its own terrain; only the framing here
// is new (Phase 16 institutional register).

export default function TopoPlate({
  seed,
  caption,
  peaks,
  parallax = false,
  draw = false,
  className = "",
  fieldClassName = "opacity-70",
}: {
  seed: number;
  caption: ReactNode;
  peaks?: Peak[];
  parallax?: boolean;
  draw?: boolean;
  className?: string;
  fieldClassName?: string;
}) {
  return (
    <figure
      className={`relative overflow-hidden rounded-md border border-ash/30 bg-pine/50 ${className}`}
    >
      <TopoField
        seed={seed}
        peaks={peaks}
        parallax={parallax}
        draw={draw}
        className={fieldClassName}
      />
      <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 border-t border-ash/20 bg-void/70 px-3 py-1.5 font-mono text-label text-ash backdrop-blur-sm">
        {caption}
      </figcaption>
    </figure>
  );
}
