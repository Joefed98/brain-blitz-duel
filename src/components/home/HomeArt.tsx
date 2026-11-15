import { HOME_ART, type HomeArtName } from "./homeArt.data";

/**
 * One of Home and Play's 3D art-kit images (scripts/home-art.ts: WebP at 1x, 2x and, where the source allows, 3x).
 * Decorative by default (the card or button it sits in carries the name); `label` gives it its alt text. `width`
 * scales it, keeping its shape.
 */
export function HomeArt({ name, width, label = false, className }: { name: HomeArtName; width?: number; label?: boolean; className?: string }) {
  const art = HOME_ART[name];
  const w = width ?? art.w;
  const h = Math.round((w * art.h) / art.w);
  const srcSet = art.urls.map((url, i) => `${url} ${i + 1}x`).join(", ");
  return (
    <img
      src={art.urls[0]}
      srcSet={srcSet}
      width={w}
      height={h}
      alt={label ? art.alt : ""}
      aria-hidden={label ? undefined : true}
      draggable={false}
      decoding="async"
      data-home-art={name}
      className={className ? `hp-art ${className}` : "hp-art"}
    />
  );
}
