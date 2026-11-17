/**
 * The Strategy overhaul's rendered materials (stage 2, 15 Nov 2026): Cycles renders in public/strategy/ (built by
 * docs/design/cosmetics-redraws/blender/strategy_art.py) that Tilt, Gemstone, Coral Pop, Rainbow Bridge and Ball Tracker
 * draw over (or in place of) their code-drawn pieces.
 *
 * Display only. Nothing here is read by a sim, a grader or the server. An image is asked for the first time a renderer
 * wants it and drawn once it has arrived: until then `strategyImage` answers null and the renderer draws its own
 * code art, and `strategyArtVersion()` changes when an image arrives, so a renderer that caches a layer keys it on the
 * version and repaints once. Where there is no `Image` (a check in Bun, a worker) every image is null, so the code art
 * is always what is drawn there and pixel digests recorded before this are unchanged.
 */
import { STRATEGY_ART } from "./strategyArt.data";

export type StrategyArtName = keyof typeof STRATEGY_ART;

const images = new Map<string, HTMLImageElement | null>();
let version = 0;

/** The image `/strategy/<name>.webp` once loaded, else null (and its load is started). */
export function strategyImage(name: StrategyArtName): HTMLImageElement | null {
  const known = images.get(name);
  if (known !== undefined) return known && known.complete && known.naturalWidth > 0 ? known : null;
  if (typeof Image === "undefined") {
    images.set(name, null);
    return null;
  }
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    version++;
  };
  img.onerror = () => {
    images.set(name, null);
  };
  img.src = `/strategy/${name}.webp?v=${STRATEGY_ART[name]}`;
  images.set(name, img);
  return null;
}

/** Changes each time an image arrives (a cached layer keyed on it repaints once with the image). */
export function strategyArtVersion(): number {
  return version;
}

/** Starts loading every image a game draws (its stage calls this once), so they are there by the first frames. */
export function preloadStrategyArt(prefixes: readonly string[]): void {
  for (const name of Object.keys(STRATEGY_ART) as StrategyArtName[]) {
    if (prefixes.some((p) => name.startsWith(p))) strategyImage(name);
  }
}

/** Scripts only (stills and shots in Bun): hand an image in directly. The app never calls this. */
export function setStrategyImageForShots(name: StrategyArtName, img: { width: number; height: number }): void {
  const el = img as unknown as HTMLImageElement;
  if (el.naturalWidth === undefined) Object.defineProperty(el, "naturalWidth", { value: img.width });
  if (el.complete === undefined) Object.defineProperty(el, "complete", { value: true });
  images.set(name, el);
  version++;
}

/** The URL of a rendered piece for DOM use (the redesigned answer reveals draw these as <img>). */
export function strategyArtUrl(name: StrategyArtName): string {
  return `/strategy/${name}.webp?v=${STRATEGY_ART[name]}`;
}
