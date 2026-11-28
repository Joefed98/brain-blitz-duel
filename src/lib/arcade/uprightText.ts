/**
 * Upright text on a turned world (P4, desktop size PR 2, 28 Nov 2026; lib/gameFrame/landscape.ts): while a world is drawn
 * turned (the landscape board's rotor, a quarter turn clockwise), every text the draw makes on its canvas, by any painter
 * (the Retro HUD and pops, the polish pops, the success layer's pops and banners), is turned back by `turn` radians about
 * the centre of its own ink, so it reads upright on screen and stays where it was. Display only: a wrapper on this one
 * draw's context, removed after it; nothing else is drawn differently and nothing reaches a sim.
 *
 * Painters that turn their own text (the success layer's `setArcadeTextTurn`, Cue Ball's ball numbers) must not also be
 * drawn inside this wrapper: a text would turn twice.
 */
type Ctx = CanvasRenderingContext2D;

export function withUprightText<T>(ctx: Ctx, turn: number, draw: () => T): T {
  if (!turn) return draw();
  const target = ctx as unknown as Record<string, unknown>;
  const fill = ctx.fillText;
  const stroke = ctx.strokeText;
  const upright =
    (original: typeof fill) =>
    (text: string, x: number, y: number, maxWidth?: number): void => {
      const m = ctx.measureText(text);
      const cx = x + (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
      const cy = y + (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(turn);
      ctx.translate(-cx, -cy);
      if (maxWidth === undefined) original.call(ctx, text, x, y);
      else original.call(ctx, text, x, y, maxWidth);
      ctx.restore();
    };
  const had = { fill: Object.getOwnPropertyDescriptor(target, "fillText"), stroke: Object.getOwnPropertyDescriptor(target, "strokeText") };
  Object.defineProperty(target, "fillText", { configurable: true, writable: true, value: upright(fill) });
  Object.defineProperty(target, "strokeText", { configurable: true, writable: true, value: upright(stroke) });
  try {
    return draw();
  } finally {
    if (had.fill) Object.defineProperty(target, "fillText", had.fill);
    else delete target["fillText"];
    if (had.stroke) Object.defineProperty(target, "strokeText", had.stroke);
    else delete target["strokeText"];
  }
}

/** The turn that sets a quarter-turned world's text upright again (the rotor turns the world a quarter clockwise). */
export const UPRIGHT_ON_TURNED = -Math.PI / 2;
