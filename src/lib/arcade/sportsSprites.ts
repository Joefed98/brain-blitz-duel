/**
 * The Sports overhaul's rendered sprites (phase 2, step 4): Captain Joulz performing each sport and Apex's race car,
 * rendered in Blender by docs/design/game-art/sports/render_sports.py into public/sports/<game>/ (anchors in
 * sportsSprites.data.ts). Display only: nothing here is read by a sim, a grader or the server.
 *
 * An image is asked for the first time a renderer wants it and drawn once it has arrived; until then `sportsSprite`
 * answers null and the renderer paints its own fallback (where there is no `Image`, a check in Bun, that is always
 * what is drawn). Skins: the Captain's sprites are rendered per skin into public/sports/<game>/<skin>/ under the same
 * names; `setCaptainSkin` picks which set the games ask for ("classic", the approved Captain, by default).
 */
import { SPORTS_SPRITES } from "./sportsSprites.data";

export { SPORTS_SPRITES };

const images = new Map<string, HTMLImageElement | null>();
let version = 0;
let captainSkin = "classic";

/** The Captain skin the sports sprites are drawn in (a later cosmetic sets it; "classic" until then). */
export function setCaptainSkin(skin: string | null | undefined): void {
  const next = skin || "classic";
  if (next !== captainSkin) {
    captainSkin = next;
    version++;
  }
}

export function captainSkinNow(): string {
  return captainSkin;
}

function urlOf(game: string, name: string, skinned: boolean): string {
  return skinned && captainSkin !== "classic" ? `/sports/${game}/${captainSkin}/${name}.webp` : `/sports/${game}/${name}.webp`;
}

/**
 * The sprite `public/sports/<game>/<name>.webp` once loaded, else null (its load started). `captain` sprites follow
 * the Captain skin (falling back to the classic set when a skin has no file).
 */
export function sportsSprite(game: string, name: string, captain = false): HTMLImageElement | null {
  const url = urlOf(game, name, captain);
  const known = images.get(url);
  if (known !== undefined) {
    if (known && known.complete && known.naturalWidth > 0) return known;
    // A skin without its own file draws the classic one.
    if (known === null && captain && captainSkin !== "classic") return sportsSprite(game, name, false);
    return null;
  }
  if (typeof Image === "undefined") {
    images.set(url, null);
    return null;
  }
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    version++;
  };
  img.onerror = () => {
    images.set(url, null);
    version++;
  };
  img.src = url;
  images.set(url, img);
  return null;
}

/** Starts loading a set of sprites ahead of play (an intro), so the first frames already have them. */
export function preloadSportsSprites(game: string, names: readonly string[], captain = false): void {
  for (const n of names) sportsSprite(game, n, captain);
}

/** Changes whenever a sprite arrives (a cached layer keyed on it repaints once). */
export function sportsSpritesVersion(): number {
  return version;
}

/**
 * Scripts only (the gallery's shots and checks in Bun, where there is no browser Image): hand a sprite in directly,
 * e.g. an @napi-rs/canvas Image loaded from public/sports. The app never calls this.
 */
export function setSportsSpriteForShots(game: string, name: string, img: { width: number; height: number }): void {
  const el = img as unknown as HTMLImageElement;
  if (el.naturalWidth === undefined) Object.defineProperty(el, "naturalWidth", { value: img.width });
  if (el.complete === undefined) Object.defineProperty(el, "complete", { value: true });
  images.set(urlOf(game, name, false), el);
  version++;
}

/** Forgets every sprite handed in by a script (checks draw the painted fallback again). */
export function clearSportsSpritesForShots(): void {
  images.clear();
  version++;
}
