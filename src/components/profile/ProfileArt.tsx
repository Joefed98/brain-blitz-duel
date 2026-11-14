import { PROFILE_ART, type ProfileArtName } from "./profileArt.data";

/**
 * One of Profile's 3D art-kit images (scripts/profile-art.ts: WebP at 1x, 2x and 3x). Decorative: the tile or row it
 * sits in carries the name.
 */
export function ProfileArt({ name, size }: { name: ProfileArtName; size?: number }) {
  const art = PROFILE_ART[name];
  const px = size ?? art.px;
  return (
    <img
      src={art.urls[0]}
      srcSet={art.urls.map((url, i) => `${url} ${i + 1}x`).join(", ")}
      width={px}
      height={px}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
      data-profile-art={name}
      className="pf-art"
    />
  );
}
