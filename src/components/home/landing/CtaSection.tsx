import Image from "next/image";
import Link from "next/link";
import sydney from "../../../../public/images/site/whtbl-hero-1155x360_edited.jpg";

export default function CtaSection() {
  return (
    <section className="relative isolate overflow-hidden bg-rail text-rail-ink">
      <Image
        src={sydney}
        alt="Aerial view of Sydney Harbour at sunset"
        fill
        className="object-cover"
      />
      <div className="absolute inset-0 bg-linear-to-r from-rail/92 via-signal-deep/70 to-rail/60" />
      <div className="relative mx-auto max-w-7xl px-6 py-28 lg:px-10">
        <h2 className="max-w-2xl text-4xl font-light leading-[1.05] sm:text-5xl">
          Ready to open your
          <span className="block text-signal-light">next reporting cycle?</span>
        </h2>
        <p className="mt-6 max-w-lg text-base font-light leading-relaxed text-rail-ink/75">
          Sign in to submit an application, invite your team or pull the latest
          verified figures for your board pack.
        </p>
        <Link
          href="#applications"
          className="mt-9 inline-flex rounded-full bg-signal px-7 py-3.5 text-sm font-medium text-void transition-colors hover:bg-signal-light hover:text-rail"
        >
          Enter the portal
        </Link>
      </div>
    </section>
  );
}
