import Image from "next/image";
import auditor from "../../../../public/images/people/Independent Auditor_edited_edited.jpg";

// Ported from artea-green-glow's SdgSection, with one deliberate deviation:
// the reference uses official per-goal UN SDG icon PNGs (sdg-11.png,
// sdg-13.png) that aren't among the asset files the user provided for this
// pass — rather than fetch official UN SDG artwork from an external source
// unasked, each goal gets a plain numbered badge instead.
const goals = [
  {
    number: "11",
    title: "Sustainable cities and communities",
    body: "Embodied-carbon reporting for schools, transport and civic assets across every live Artea project.",
  },
  {
    number: "13",
    title: "Climate action",
    body: "Independently audited emissions baselines and reduction pathways, tracked project by project.",
  },
];

export default function SdgSection() {
  return (
    <section className="bg-pine py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="eyebrow text-signal">Our commitments</p>
            <h2 className="mt-5 text-3xl font-light leading-tight text-bone sm:text-4xl">
              Aligned to the UN Sustainable
              <span className="block text-signal">Development Goals.</span>
            </h2>
            <div className="mt-10 space-y-8">
              {goals.map((goal) => (
                <div key={goal.number} className="flex gap-5">
                  <span
                    aria-hidden
                    className="flex h-20 w-20 shrink-0 items-center justify-center rounded-sm bg-signal text-2xl font-light text-void"
                  >
                    {goal.number}
                  </span>
                  <div>
                    <h3 className="text-lg font-normal text-bone">{goal.title}</h3>
                    <p className="mt-2 max-w-md text-sm font-light leading-relaxed text-ash">
                      {goal.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <figure className="overflow-hidden rounded-sm">
            <Image
              src={auditor}
              alt="Independent auditors reviewing an Artea Green Ventures site in the field"
              className="h-full w-full object-cover"
            />
            <figcaption className="mt-3 text-xs font-light tracking-wide text-ash">
              Independent verification, on site, every reporting cycle.
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
