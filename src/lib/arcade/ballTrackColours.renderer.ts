/**
 * Ball Tracker's fifth colour (D6, 27 Nov 2026: Hard and Expert's level courses, btRev 9): a purple star, a shape no other
 * colour has, so the five cups and marbles read by shape as well as colour. Kept apart from ballTrackArt.renderer.ts's
 * carved symbols for A3 to restyle; its `symbol` calls it for the fifth colour (BT_COLOUR_FIVE) only. Draws the path
 * only (the caller has begun it and fills or strokes it), inside the same radius as the other symbols.
 */
export function btStarPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 === 0 ? r : r * 0.46;
    if (k === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}
