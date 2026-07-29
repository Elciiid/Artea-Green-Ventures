import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// tailwind-merge doesn't know about this project's custom `text-label` font-size
// token (globals.css's --text-label) and defaults to treating text-{name}
// utilities it doesn't recognize as text-color, not font-size — so text-label
// silently loses to any text-color class (e.g. text-ash) passed alongside it in
// the same className, instead of correctly overriding text-sm/text-base. Extending
// the merge config's font-size group with "label" fixes this for every component
// that uses cn(), not just the one that happened to catch it.
const twMerge = extendTailwindMerge({ extend: { theme: { text: ["label"] } } })

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
