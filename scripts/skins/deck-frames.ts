/**
 * Full House's face-down deck (the card back's one place; Joe, 11 Nov 2026): the deck's strip behind Next card and the
 * whole back while the next card is dragged, on both stamps, at 1× and 2×, drawn through the art game the stage uses.
 * `look` undefined calls it exactly as main does (recorded on main into scripts/fixtures/skins-deck-frames.json by
 * scripts/skins/record-deck.ts, run in a checkout of main af70c5f).
 */
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";
import { createHash } from "node:crypto";

(globalThis as unknown as { Path2D: unknown }).Path2D = NapiPath2D;
(globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = class {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, w), Math.max(1, h));
  }
};

type Look = { skin: string | null; world: string | null; back?: string | null } | undefined;

export async function deckFrames(root: string, look: Look): Promise<{ name: string; digest: string; data: Uint8ClampedArray; w: number; h: number }[]> {
  const R = await import(`${root}/src/lib/arcade/cards/pokerSquares.renderer`);
  const out: { name: string; digest: string; data: Uint8ClampedArray; w: number; h: number }[] = [];
  for (const rev of [1, 2]) {
    for (const drag of [false, true]) {
      const view = R.psNewView();
      if (drag) view.drag = { x: 120, y: 330 };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const art: any = look === undefined ? R.pokerSquaresArtGame(view, rev) : R.pokerSquaresArtGame(view, rev, look);
      for (const seed of [0, 21]) {
        const s = art.init(seed);
        for (const scale of [1, 2]) {
          const c = createCanvas(Math.round(R.PS_WORLD_W * scale), Math.round(R.PS_WORLD_H * scale));
          const ctx = c.getContext("2d");
          ctx.scale(scale, scale);
          art.draw(ctx, s, { width: R.PS_WORLD_W, height: R.PS_WORLD_H });
          const data = ctx.getImageData(0, 0, c.width, c.height).data as unknown as Uint8ClampedArray;
          out.push({ name: `r${rev}-s${seed}${drag ? "-drag" : ""}@${scale}`, digest: createHash("sha256").update(data).digest("hex").slice(0, 24), data, w: c.width, h: c.height });
        }
      }
    }
  }
  return out;
}
