// src/app/dev/kokonut-proof/page.tsx
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function KokonutProofPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <main className="flex min-h-screen flex-col items-start gap-4 p-10">
      <h1 className="font-display text-2xl font-bold text-bone">Kokonut foundation proof</h1>
      <p className="max-w-md text-sm text-ash">
        Dev-only page. Confirms shadcn/Kokonut components render on AGV&apos;s existing tokens
        (Signal green primary, Bone text, Void/Pine surfaces) — no new colors, no Geist.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
      </div>
    </main>
  );
}
