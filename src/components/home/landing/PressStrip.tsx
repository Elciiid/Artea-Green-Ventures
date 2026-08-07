import Image from "next/image";
import gma from "../../../../public/images/SDP n News/GMA NEWS ONLINE.png";
import manila from "../../../../public/images/SDP n News/MANILA BULLETIN.png";
import star from "../../../../public/images/SDP n News/The Philippines Star.png";
import sbs from "../../../../public/images/SDP n News/SBS FILIPINO.png";

const outlets = [
  { name: "The Philippine Star", asset: star },
  { name: "GMA News Online", asset: gma },
  { name: "Manila Bulletin", asset: manila },
  { name: "SBS Filipino", asset: sbs },
];

export default function PressStrip() {
  const loop = [...outlets, ...outlets, ...outlets, ...outlets];

  return (
    <section className="border-y border-ash/15 bg-void py-14">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <p className="eyebrow text-ash">As seen in</p>
      </div>
      <div className="relative mt-8 overflow-hidden">
        <div className="animate-marquee flex w-max items-center gap-20 px-6">
          {loop.map((outlet, index) => (
            <Image
              key={`${outlet.name}-${index}`}
              src={outlet.asset}
              alt={outlet.name}
              className="h-6 w-auto shrink-0 opacity-45 sm:h-7"
            />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-linear-to-r from-void to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-linear-to-l from-void to-transparent" />
      </div>
    </section>
  );
}
