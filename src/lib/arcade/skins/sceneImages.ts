/**
 * Pre-rendered scenery images for in-game looks (docs/design/cosmetics-redraws/ART-DIRECTION.md, "In-game looks"):
 * Blender renders in public/cosmetics/redrawn/ that a renderer paints into its cached layers.
 *
 * Display only, and only behind a look's switch (src/config/cosmeticRedraws.ts). Nothing here is read by a sim, a
 * grader or the server. An image is asked for the first time a layer wants it and drawn once it has arrived: until
 * then `sceneImage` answers null and the renderer paints its own fallback, and `sceneImagesVersion()` changes when an
 * image arrives, so a renderer that keys its layer cache on it repaints the layer once. Where there is no `Image` (a
 * check in Bun, a worker) every image is null, so the fallback is always what is drawn there.
 */

const images = new Map<string, HTMLImageElement | null>();
let version = 0;

/** The image at `/cosmetics/redrawn/<name>.webp` once loaded, else null (and its load is started). */
export function sceneImage(name: string): HTMLImageElement | null {
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
  img.src = `/cosmetics/redrawn/${name}.webp`;
  images.set(name, img);
  return null;
}

/** Asks for each image and resolves once every one has arrived or failed (a round's art before its first frame). */
export function preloadSceneImages(names: readonly string[]): Promise<void> {
  if (typeof Image === "undefined") return Promise.resolve();
  return Promise.all(
    names.map(
      (name) =>
        new Promise<void>((done) => {
          if (sceneImage(name)) return done();
          const img = images.get(name);
          if (!img) return done();
          img.addEventListener("load", () => done(), { once: true });
          img.addEventListener("error", () => done(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

/** Changes each time a scene image arrives (a layer cache keyed on it repaints once with the image). */
export function sceneImagesVersion(): number {
  return version;
}

/**
 * Scripts only (the gallery's shots in Bun, where there is no browser Image): hand a scene image in directly, e.g. an
 * @napi-rs/canvas Image loaded from public/cosmetics/redrawn. The app never calls this.
 */
export function setSceneImageForShots(name: string, img: { width: number; height: number }): void {
  const el = img as unknown as HTMLImageElement;
  if (el.naturalWidth === undefined) Object.defineProperty(el, "naturalWidth", { value: img.width });
  if (el.complete === undefined) Object.defineProperty(el, "complete", { value: true });
  images.set(name, el);
  version++;
}
