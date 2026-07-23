// Phase 18 — curated resources list for the Home hub. Static, not a table
// (see STATUS.md for why): "a simple curated list, not a CMS," and a table
// would add a fifth RLS surface plus admin-write UI under this phase's
// deadline for something that changes rarely. Admin updates this by editing
// the array below; move it to a table later if self-serve editing turns out
// to be worth it.
//
// hrefs are placeholders ("#") pending real destinations — this is demo
// content illustrating the shape of the feature, not real internal links.

export type Resource = {
  title: string;
  description: string;
  href: string;
};

export const RESOURCES: Resource[] = [
  {
    title: "Field Safety Handbook",
    description: "Site visit protocols, PPE requirements, and incident reporting.",
    href: "#",
  },
  {
    title: "Compliance Checklist Templates",
    description: "Standard templates for lodging and reviewing new applications.",
    href: "#",
  },
  {
    title: "Brand & Style Guide",
    description: "Logo usage, color palette, and document templates.",
    href: "#",
  },
  {
    title: "IT Support",
    description: "Password resets, hardware requests, and access issues.",
    href: "#",
  },
  {
    title: "HR & Benefits Portal",
    description: "Leave requests, payroll, and policy documents.",
    href: "#",
  },
];
