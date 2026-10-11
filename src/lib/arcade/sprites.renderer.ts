/**
 * Arcade art pipeline: sprite images and sprite sheets per arcade world, bundled
 * with the app, drawn at devicePixelRatio ≤ 2, with a clean fallback to the
 * existing code-drawn art.
 *
 *  - Files live in src/assets/arcade/<world>/<file>.png and are bundled by Vite
 *    (hashed URLs, cached with the app). A sprite may instead name an explicit
 *    `url` (for example a Lovable-hosted asset). docs/art-assets.md lists the
 *    pack, licence and exact files for every world.
 *  - `drawArtSprite` returns false, without touching the context, whenever the
 *    image is missing, still loading or failed; callers then draw their
 *    original code art. A missing file therefore changes nothing on screen.
 *  - Each sprite is pre-scaled once per drawn size into a cached canvas at the
 *    context's device scale, capped at 2, so frames draw a single small image
 *    with no per-frame resampling of a large source.
 *  - The bounds rule still applies: callers pass the sim's collision rectangle
 *    and the sprite fills it (packs must be trimmed to their content).
 *
 * Presentation only: never imported by a sim or the server.
 */

export type ArtWorld =
  | "retro"
  | "space"
  | "realworld"
  | "kitchen"
  | "fairground"
  | "underwater"
  | "cavelava"
  | "orchard"
  | "toybox";

/** A rectangle inside a sprite sheet: x, y, width, height in source pixels. */
export type SheetRect = readonly [number, number, number, number];

export interface ArtSpriteDef {
  /** File name under src/assets/arcade/<world>/ (bundled). */
  file?: string;
  /** Or an explicit URL, e.g. a Lovable-hosted asset. */
  url?: string;
  /** One frame of a sprite sheet; omit for a whole image. */
  frame?: SheetRect;
  /** Animation frames of a sprite sheet, picked by `frame` index when drawing. */
  frames?: readonly SheetRect[];
}

export interface ArtWorldManifest {
  /** Pack name, author, page and licence; mirrored in docs/art-assets.md. */
  pack: string;
  author: string;
  page: string;
  licence: string;
  /** Nearest-neighbour scaling for pixel-art worlds. */
  pixelated?: boolean;
  sprites: Readonly<Record<string, ArtSpriteDef>>;
}

const KENNEY = "Kenney (kenney.nl)";
const CC0 = "CC0 1.0 Universal (public domain)";

/**
 * One CC0 pack per world, all from Kenney's flat-vector range so the worlds
 * share one style. Only each world's pilot sprites are listed for now; add
 * names here as more art is applied.
 */
export const ART_WORLDS: Readonly<Record<ArtWorld, ArtWorldManifest>> = {
  retro: {
    pack: "Puzzle Pack",
    author: KENNEY,
    page: "https://kenney.nl/assets/puzzle-pack",
    licence: CC0,
    sprites: { paddle: { file: "paddle.png" } },
  },
  space: {
    pack: "Space Shooter Redux",
    author: KENNEY,
    page: "https://kenney.nl/assets/space-shooter-redux",
    licence: CC0,
    sprites: { player: { file: "player.png" } },
  },
  realworld: {
    pack: "Racing Pack",
    author: KENNEY,
    page: "https://kenney.nl/assets/racing-pack",
    licence: CC0,
    sprites: { car: { file: "car.png" }, lorry: { file: "lorry.png" } },
  },
  kitchen: {
    pack: "Food Kit",
    author: KENNEY,
    page: "https://kenney.nl/assets/food-kit",
    licence: CC0,
    sprites: {
      bagel: { file: "bagel.png" },
      cabbage: { file: "cabbage.png" },
      onion: { file: "onion.png" },
      meat: { file: "meat.png" },
    },
  },
  fairground: {
    pack: "Shooting Gallery",
    author: KENNEY,
    page: "https://kenney.nl/assets/shooting-gallery",
    licence: CC0,
    sprites: { counter: { file: "counter.png" } },
  },
  underwater: {
    pack: "Fish Pack",
    author: KENNEY,
    page: "https://kenney.nl/assets/fish-pack",
    licence: CC0,
    // Only the fish symbol is piloted; the other four creatures keep their code art.
    sprites: { fish: { file: "fish.png" } },
  },
  cavelava: {
    pack: "Platformer Pack Redux",
    author: KENNEY,
    page: "https://kenney.nl/assets/platformer-pack-redux",
    licence: CC0,
    sprites: { anchor: { file: "anchor.png" } },
  },
  orchard: {
    pack: "Foliage Pack",
    author: KENNEY,
    page: "https://kenney.nl/assets/foliage-pack",
    licence: CC0,
    sprites: { leaf: { file: "leaf.png" } },
  },
  toybox: {
    pack: "Rolling Ball Assets",
    author: KENNEY,
    page: "https://kenney.nl/assets/rolling-ball-assets",
    licence: CC0,
    sprites: { marble: { file: "marble.png" } },
  },
};

/** Bundled files, keyed "<world>/<file>". Empty under Bun/Node checks, where Vite never runs. */
const BUNDLED: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  try {
    const found = import.meta.glob("/src/assets/arcade/*/*.{png,webp}", {
      eager: true,
      query: "?url",
      import: "default",
    }) as Record<string, string>;
    for (const [path, url] of Object.entries(found)) {
      const match = /\/src\/assets\/arcade\/([^/]+)\/([^/]+)$/.exec(path);
      if (match) out[`${match[1]}/${match[2]}`] = url;
    }
  } catch {
    /* Not running under Vite (scripts/checks): every sprite falls back. */
  }
  return out;
})();

type LoadState = {
  status: "loading" | "ready" | "failed";
  image: CanvasImageSource | null;
  width: number;
  height: number;
};
const images = new Map<string, LoadState>();

function sourceKey(world: ArtWorld, def: ArtSpriteDef): string | null {
  if (def.url) return def.url;
  return def.file ? `${world}/${def.file}` : null;
}

function load(world: ArtWorld, def: ArtSpriteDef): LoadState | null {
  const key = sourceKey(world, def);
  if (!key) return null;
  const known = images.get(key);
  if (known) return known;
  const url = def.url ?? BUNDLED[key];
  if (!url || typeof Image === "undefined") {
    const missing: LoadState = { status: "failed", image: null, width: 0, height: 0 };
    images.set(key, missing);
    return missing;
  }
  const entry: LoadState = { status: "loading", image: null, width: 0, height: 0 };
  images.set(key, entry);
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    entry.status = "ready";
    entry.image = img;
    entry.width = img.naturalWidth;
    entry.height = img.naturalHeight;
  };
  img.onerror = () => {
    entry.status = "failed";
  };
  img.src = url;
  return entry;
}

/** True once a sprite can be drawn (starts loading it otherwise); for callers that cache their own art. */
export function artReady(world: ArtWorld, name: string): boolean {
  const def = ART_WORLDS[world].sprites[name];
  return Boolean(def && load(world, def)?.status === "ready");
}

/** Starts loading a world's sprites (e.g. during the round intro); never blocks. */
export function preloadArtWorld(world: ArtWorld): void {
  for (const def of Object.values(ART_WORLDS[world].sprites)) load(world, def);
}

/** Test/dev hook: supply an already-decoded image for a sprite's source. */
export function registerArtImage(
  world: ArtWorld,
  name: string,
  image: CanvasImageSource,
  width: number,
  height: number,
): void {
  const def = ART_WORLDS[world].sprites[name];
  const key = def ? sourceKey(world, def) : null;
  if (!key) throw new Error(`Unknown sprite ${world}/${name}`);
  images.set(key, { status: "ready", image, width, height });
  scaled.clear();
}

/** Clears loaded and registered images (checks only). */
export function resetArtImages(): void {
  images.clear();
  scaled.clear();
}

/** Where each world's sprites stand: bundled file present, and load status. */
export function artStatus(): { world: ArtWorld; name: string; bundled: boolean; status: string }[] {
  const rows: { world: ArtWorld; name: string; bundled: boolean; status: string }[] = [];
  for (const world of Object.keys(ART_WORLDS) as ArtWorld[]) {
    for (const [name, def] of Object.entries(ART_WORLDS[world].sprites)) {
      const key = sourceKey(world, def);
      rows.push({
        world,
        name,
        bundled: Boolean(def.url || (key && BUNDLED[key])),
        status: (key && images.get(key)?.status) ?? "unloaded",
      });
    }
  }
  return rows;
}

/* Pre-scaled cache: one small canvas per sprite, frame and device size. */
const MAX_SCALED = 96;
const scaled = new Map<string, CanvasImageSource | null>();

function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas | null {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  if (typeof document !== "undefined")
    return Object.assign(document.createElement("canvas"), { width: w, height: h });
  return null;
}

/**
 * Backing pixels per drawn unit at the current transform. Every arcade canvas
 * already caps its backing store at devicePixelRatio 2, so this follows the
 * same cap; the clamp only guards against degenerate transforms.
 */
function deviceScale(ctx: CanvasRenderingContext2D): number {
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  const s = t ? Math.hypot(t.a, t.b) : 1;
  return Number.isFinite(s) ? Math.min(Math.max(s, 0.25), 8) : 1;
}

function scaledSprite(
  key: string,
  entry: LoadState,
  rect: SheetRect,
  pw: number,
  ph: number,
  pixelated: boolean,
): CanvasImageSource | null {
  const id = `${key}#${rect.join(",")}@${pw}x${ph}`;
  if (scaled.has(id)) return scaled.get(id) ?? null;
  let out: CanvasImageSource | null = null;
  const canvas = makeCanvas(pw, ph);
  const g = canvas?.getContext("2d") as CanvasRenderingContext2D | null | undefined;
  if (canvas && g && entry.image) {
    g.imageSmoothingEnabled = !pixelated;
    if (!pixelated) g.imageSmoothingQuality = "high";
    g.drawImage(entry.image, rect[0], rect[1], rect[2], rect[3], 0, 0, pw, ph);
    out = canvas;
  }
  if (scaled.size >= MAX_SCALED) scaled.delete(scaled.keys().next().value as string);
  scaled.set(id, out);
  return out;
}

export interface DrawArtOptions {
  /** Index into a sheet sprite's `frames`. */
  frame?: number;
  /** Rotation in radians about the rectangle's centre. */
  angle?: number;
  /** Mirror horizontally (e.g. traffic driving left). */
  flipX?: boolean;
  alpha?: number;
}

/**
 * Draws a world sprite filling (x, y, w, h). Returns false, leaving the context
 * untouched, when the sprite is not available, so the caller draws its code art.
 */
export function drawArtSprite(
  ctx: CanvasRenderingContext2D,
  world: ArtWorld,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  options: DrawArtOptions = {},
): boolean {
  const manifest = ART_WORLDS[world];
  const def = manifest.sprites[name];
  if (!def || w <= 0 || h <= 0) return false;
  const entry = load(world, def);
  if (!entry || entry.status !== "ready" || !entry.image) return false;
  const rect: SheetRect = def.frames?.length
    ? def.frames[Math.abs(Math.trunc(options.frame ?? 0)) % def.frames.length]!
    : (def.frame ?? [0, 0, entry.width, entry.height]);
  const s = deviceScale(ctx);
  const pw = Math.max(1, Math.round(w * s));
  const ph = Math.max(1, Math.round(h * s));
  const key = sourceKey(world, def)!;
  const image = scaledSprite(key, entry, rect, pw, ph, manifest.pixelated === true);
  ctx.save();
  if (options.alpha !== undefined) ctx.globalAlpha *= options.alpha;
  ctx.imageSmoothingEnabled = manifest.pixelated !== true;
  if (options.angle || options.flipX) {
    ctx.translate(x + w / 2, y + h / 2);
    if (options.angle) ctx.rotate(options.angle);
    if (options.flipX) ctx.scale(-1, 1);
    ctx.translate(-w / 2, -h / 2);
    if (image) ctx.drawImage(image, 0, 0, w, h);
    else ctx.drawImage(entry.image, rect[0], rect[1], rect[2], rect[3], 0, 0, w, h);
  } else if (image) ctx.drawImage(image, x, y, w, h);
  else ctx.drawImage(entry.image, rect[0], rect[1], rect[2], rect[3], x, y, w, h);
  ctx.restore();
  return true;
}
