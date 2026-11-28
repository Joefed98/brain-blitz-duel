/**
 * Shared by identity-art-check and identity-art-record (S5 PR A): the reference's colours and blocks, and the
 * tinted composite worked out from the three files exactly as the browser composes the app's markup
 * (avatars.ts layeredMarkup: the base, the player's colour multiplied inside the mask's luminance, the gloss
 * screened on top, in one isolated group on black).
 */
import { createCanvas, loadImage } from "@napi-rs/canvas";

export const REFERENCE_PATH = "scripts/fixtures/identity-art-reference.json.gz";
/** Player colours the reference holds: none set (the slot colour), the first, one in the middle and the last. */
export const REFERENCE_COLOURS = [-1, 0, 13, 31];
export const PX = 280;
export const BLOCK = 10;

async function pixels(src: string | Buffer): Promise<Uint8ClampedArray> {
  const im = await loadImage(src);
  const c = createCanvas(PX, PX);
  const g = c.getContext("2d");
  g.drawImage(im, 0, 0, PX, PX);
  return g.getImageData(0, 0, PX, PX).data;
}

/** A 280 px picture averaged into 10 × 10 px blocks of RGB (28 × 28 × 3 bytes). */
export async function blocksOf(src: string | Buffer | Uint8ClampedArray): Promise<Uint8Array> {
  const d = src instanceof Uint8ClampedArray ? src : await pixels(src);
  const n = PX / BLOCK;
  const out = new Uint8Array(n * n * 3);
  for (let by = 0; by < n; by++)
    for (let bx = 0; bx < n; bx++)
      for (let ch = 0; ch < 3; ch++) {
        let s = 0;
        for (let y = 0; y < BLOCK; y++) for (let x = 0; x < BLOCK; x++) s += d[((by * BLOCK + y) * PX + bx * BLOCK + x) * 4 + ch];
        out[(by * n + bx) * 3 + ch] = Math.round(s / (BLOCK * BLOCK));
      }
  return out;
}

function hex(c: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) throw new Error(`not a #rrggbb colour: ${c}`);
  const v = parseInt(m[1], 16);
  return [(v >> 16) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

/** The tinted composite on black (W3C compositing: separable blend, then source-over, in sRGB). */
export async function composite(base: string, mask: string, gloss: string, colour: string): Promise<Uint8ClampedArray> {
  const [b, m, g] = await Promise.all([pixels(base), pixels(mask), pixels(gloss)]);
  const col = hex(colour);
  const out = new Uint8ClampedArray(PX * PX * 4);
  for (let i = 0; i < out.length; i += 4) {
    // Premultiplied backdrop inside the isolated group: the base.
    let ab = b[i + 3] / 255;
    let cb = [b[i] / 255, b[i + 1] / 255, b[i + 2] / 255];
    const layer = (cs: number[], as: number, blend: (cb: number, cs: number) => number) => {
      if (as <= 0) return;
      const mixed = cs.map((c, k) => (1 - ab) * c + ab * blend(cb[k], c));
      const ao = as + ab * (1 - as);
      cb = mixed.map((c, k) => (as * c + ab * cb[k] * (1 - as)) / ao);
      ab = ao;
    };
    // The colour rect inside the mask (luminance of a greyscale mask = its grey, times its alpha).
    const lum = (0.2125 * m[i] + 0.7154 * m[i + 1] + 0.0721 * m[i + 2]) / 255 * (m[i + 3] / 255);
    layer(col, lum, (x, y) => x * y);
    layer([g[i] / 255, g[i + 1] / 255, g[i + 2] / 255], g[i + 3] / 255, (x, y) => x + y - x * y);
    // The group onto black.
    for (let k = 0; k < 3; k++) out[i + k] = Math.round(cb[k] * ab * 255);
    out[i + 3] = 255;
  }
  return out;
}
