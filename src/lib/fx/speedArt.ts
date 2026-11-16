/**
 * The Speed overhaul's Blender sprites (15 Nov 2026, docs/design/speed-art/README.md): presentation only.
 *
 * `speedArtImage(name)` hands a canvas renderer the decoded image once it has loaded, else null, so every renderer
 * keeps its own drawn art as the fallback (a check in Node, a slow first load) and switches to the sprite on the next
 * frame. Nothing here touches a sim, a score or a tap: the sprites are drawn inside the shapes the games already
 * draw (each game's renderer says where), so what is drawn is still what the game counts.
 */
import { SPEED_ART, type SpeedArtName } from "./speedArt.data";

export { SPEED_ART, type SpeedArtName };

const images = new Map<SpeedArtName, HTMLImageElement>();

/** The sprite's URL (content-hashed). */
export function speedArtUrl(name: SpeedArtName): string {
  return SPEED_ART[name].url;
}

/** The decoded sprite, or null until it has loaded (or where there is no DOM image, as in a check). */
export function speedArtImage(name: SpeedArtName): HTMLImageElement | null {
  if (typeof Image === "undefined" || typeof document === "undefined") return null;
  let img = images.get(name);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.src = SPEED_ART[name].url;
    images.set(name, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/** Starts loading a game's sprites (its stage calls it on mount, so the first frames of play have them). */
export function preloadSpeedArt(names: readonly SpeedArtName[]): void {
  for (const name of names) speedArtImage(name);
}

/** Calls `done` once the sprite has loaded (at once if it already has); returns a cancel. For a layer painted once
 *  per size, never per frame (an arena scene), so it can repaint when its sprite arrives. */
export function onSpeedArtLoad(name: SpeedArtName, done: () => void): () => void {
  if (speedArtImage(name)) {
    done();
    return () => {};
  }
  const img = images.get(name);
  if (!img) return () => {};
  const loaded = () => done();
  img.addEventListener("load", loaded, { once: true });
  return () => img.removeEventListener("load", loaded);
}

/** True once every named sprite has loaded: a cached layer built from them keys on it, so it is rebuilt once. */
export function speedArtReady(names: readonly SpeedArtName[]): boolean {
  return names.every((name) => speedArtImage(name) !== null);
}

/** A CSS `url(...)` for a sprite (the DOM games' backgrounds). */
export function speedArtCss(name: SpeedArtName): string {
  return `url("${SPEED_ART[name].url}")`;
}

/** Every sprite of one game, by its prefix (flash, ascend, chain, bonk, tenfall, pull). */
export function speedArtFor(prefix: "flash" | "ascend" | "chain" | "bonk" | "tenfall" | "pull"): SpeedArtName[] {
  return (Object.keys(SPEED_ART) as SpeedArtName[]).filter((name) => name.startsWith(`${prefix}-`));
}
