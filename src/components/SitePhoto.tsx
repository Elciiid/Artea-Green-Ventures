import Image from "next/image";

// Treatment for real AGV site photography (daylight photos of trams, bridges,
// harbours) so it sits inside the near-black/mint palette instead of fighting
// it: strip the colour and darken, tint the remaining luminance toward
// Contour, then deepen toward Void.
//
// This is NOT used on the login hero — that image is generated to the palette
// already and running it through this pipeline would over-process it.
//
// `isolate` keeps the blend modes inside this box; the source photos are
// ~420px wide, so they're used as masked accent panels rather than full-bleed
// banners (no upscaling artefacts at these render sizes).

export default function SitePhoto({
  src,
  className = "",
  sizes = "(max-width: 640px) 60vw, 420px",
  priority = false,
}: {
  src: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div aria-hidden className={`pointer-events-none isolate overflow-hidden ${className}`}>
      <Image
        src={src}
        alt=""
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover grayscale contrast-125 brightness-[0.42]"
      />
      {/* duotone: Contour hue over the photo's luminance */}
      <div className="absolute inset-0 bg-contour opacity-60 mix-blend-color" />
      {/* settle it into the page surface */}
      <div className="absolute inset-0 bg-void/45" />
    </div>
  );
}
