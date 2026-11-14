import { NAV_ART, type NavArtName } from "./navArt.data";

/**
 * One of the navigation's 3D art-kit images (scripts/nav-art.ts: WebP at 1x, 2x and, where the source allows, 3x).
 * Decorative by default (the tab or row it sits in carries the name); `label` gives it its alt text instead.
 */
export function NavArt({ name, size, label = false, className }: { name: NavArtName; size?: number; label?: boolean; className?: string }) {
  const art = NAV_ART[name];
  const px = size ?? art.px;
  const srcSet = art.urls.map((url, i) => `${url} ${i + 1}x`).join(", ");
  return (
    <img
      src={art.urls[0]}
      srcSet={srcSet}
      width={px}
      height={px}
      alt={label ? art.alt : ""}
      aria-hidden={label ? undefined : true}
      draggable={false}
      decoding="async"
      data-nav-art={name}
      className={className ? `jz-nav-art ${className}` : "jz-nav-art"}
    />
  );
}
