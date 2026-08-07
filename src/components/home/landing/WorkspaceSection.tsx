import Image from "next/image";
import projectRender from "../../../../public/images/site/Project 5_edited.jpg";
import people from "../../../../public/images/people/Headline Photo-V2.jpg";
import companyRender from "../../../../public/images/site/10-External-Render-Trinity-Grammar-School-The-Renewal-Project-Taylor-Construction-Education-scaled_edited.jpg";

const cards = [
  {
    asset: projectRender,
    eyebrow: "Applications",
    title: "Every submission, one queue",
    body: "Track applications from intake to approval with status, owner and audit trail on a single record.",
  },
  {
    asset: people,
    eyebrow: "People",
    title: "Know who is accountable",
    body: "Roles, certifications and application access for everyone in the Artea network.",
  },
  {
    asset: companyRender,
    eyebrow: "Companies",
    title: "Partner performance at a glance",
    body: "Company rosters, managers and application scope, kept in one place per partner.",
  },
];

export default function WorkspaceSection() {
  return (
    <section id="workspace" className="bg-void py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="max-w-2xl">
          <p className="eyebrow text-signal">The workspace</p>
          <h2 className="mt-5 text-3xl font-light leading-tight text-bone sm:text-4xl">
            Three surfaces, one source of truth
            <span className="block text-signal">for the whole programme.</span>
          </h2>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {cards.map((card) => (
            <article
              key={card.title}
              className="group overflow-hidden rounded-sm border border-ash/20 bg-pine transition-colors hover:border-signal"
            >
              <div className="aspect-4/3 overflow-hidden">
                <Image
                  src={card.asset}
                  alt={card.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="p-7">
                <p className="eyebrow text-signal">{card.eyebrow}</p>
                <h3 className="mt-4 text-xl font-normal text-bone">{card.title}</h3>
                <p className="mt-3 text-sm font-light leading-relaxed text-ash">{card.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
