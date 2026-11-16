/**
 * The Logic overhaul's rendered sprites (scripts/logic-art/render.py → public/logic-art/*.webp) for canvas games
 * (Minefield). Display only: a sprite is used once it has decoded; until then (and wherever there is no `Image`, as in
 * the checks' node canvas) the game's own vector painter draws, so nothing waits on a download.
 */
const cache = new Map<string, HTMLImageElement>();

export function logicSprite(name: string): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  let image = cache.get(name);
  if (!image) {
    image = new Image();
    image.decoding = "async";
    image.src = `/logic-art/${name}.webp`;
    cache.set(name, image);
  }
  return image.complete && image.naturalWidth > 0 ? image : null;
}

/** True once every named sprite has decoded (a cached board layer keys on this, so it repaints when they arrive). */
export function logicSpritesReady(names: readonly string[]): boolean {
  return names.every((name) => logicSprite(name) !== null);
}
