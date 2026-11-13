import { tileSceneUrl } from "@/components/app/GameIcon";
import { LOOK_PREVIEWS } from "@/lib/skins/lookPreviews.data";

/**
 * A game look's picture on Customise's Games tab (12 Nov 2026): the item's approved still (public/looks/<id>.webp,
 * scripts/look-previews.ts), or, for the default (id null), the game's own tile scene, which is drawn in its default
 * look. Decorative: the choice names the item.
 */
export function LookPreview({ id, game }: { id: string | null; game: string }) {
  const hash = id ? LOOK_PREVIEWS[id] : undefined;
  const src = id ? (hash ? `/looks/${id}.webp?v=${hash}` : null) : tileSceneUrl(game);
  return (
    <span className="cz-look-art" data-look-preview={id ?? "default"} aria-hidden="true">
      {src ? <img src={src} alt="" loading="lazy" decoding="async" draggable={false} /> : null}
    </span>
  );
}
