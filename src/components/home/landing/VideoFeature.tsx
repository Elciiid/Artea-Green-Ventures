"use client";

// Ported from artea-green-glow's VideoFeature, with one deliberate
// deviation: the reference has no real video, just a "drop the film here"
// placeholder that plays on click — replaced with the real company profile
// video the user placed in public/videos, same click-to-play interaction
// (preload="none" so the 150MB file never loads until someone actually
// wants to watch it).

import { useState } from "react";
import Image from "next/image";
import siteAerial from "../../../../public/images/site/sydney-gateway-hero-1155x360.jpg";

// encodeURI: the file itself has spaces in its name, which aren't valid in
// a literal URL — Next.js serves /public files at their exact path, so the
// URL has to be encoded here rather than the file renamed.
const VIDEO_SRC = encodeURI("/videos/Company Profile Video - Final V5.mov");

export default function VideoFeature() {
  const [playing, setPlaying] = useState(false);

  return (
    <section className="bg-rail py-24 text-rail-ink">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-end">
          <div>
            <p className="eyebrow text-signal-light">Film</p>
            <h2 className="mt-5 text-4xl font-light leading-[1.05] sm:text-5xl">
              How Artea verifies
              <span className="block text-signal-light">every tonne of carbon.</span>
            </h2>
          </div>
          <p className="max-w-md text-base font-light leading-relaxed text-rail-ink/70">
            A short film on the assurance process behind Artea projects — from site
            data capture through independent audit to the reports your board signs
            off on.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-sm border border-rail-ink/12">
          <div className="relative aspect-16/9 w-full">
            {playing ? (
              // No caption/transcript file exists for this video yet — flagging
              // rather than adding a <track> pointing at a file that doesn't
              // exist, which would be worse than the honest gap.
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                src={VIDEO_SRC}
                controls
                autoPlay
                className="h-full w-full bg-black"
              >
                Your browser can&apos;t play this video format.
              </video>
            ) : (
              <>
                <Image
                  src={siteAerial}
                  alt="Aerial view of an Artea Green Ventures project site"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-linear-to-t from-rail/85 via-rail/25 to-transparent" />
                <button
                  type="button"
                  onClick={() => setPlaying(true)}
                  className="group absolute inset-0 flex items-center justify-center"
                  aria-label="Play the Artea Green Ventures company profile film"
                >
                  <span className="flex h-20 w-20 items-center justify-center rounded-full border border-rail-ink/50 bg-rail/30 backdrop-blur-sm transition-transform duration-500 group-hover:scale-110 group-hover:bg-signal">
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="ml-1 h-6 w-6 fill-current text-rail-ink"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                </button>
                <p className="absolute bottom-6 left-6 text-xs font-light tracking-[0.2em] uppercase text-rail-ink/70">
                  Artea in the field
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
