/**
 * Gemstone's eighth gem (D6, 26 Nov 2026): the white pearl's cut, a teardrop no other gem has, so Expert's eight
 * colours read by shape as well as colour (MATCHUP_SHAPE8 in matchup.ts). Kept apart from matchup.renderer.ts's cuts
 * for A3 to restyle in the flat-cut set; matchup.renderer.ts's cutPoints calls it for the shape "pearl" only.
 */

/** The teardrop's outline inside the symbol's square (radius r about cx, cy): a round base and a point at the top. */
export function pearlCutPoints(cx: number, cy: number, r: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const n = 18;
  for (let k = 0; k < n; k++) {
    const t = (k / n) * Math.PI * 2;
    // A drop curve: x = sin t · sin²(t/2)-weighted width, y = −cos t, the point where t = 0.
    const x = Math.sin(t) * Math.sin(t / 2) * 0.95;
    const y = -Math.cos(t);
    pts.push([cx + x * r, cy + (y * 0.95 + 0.05) * r]);
  }
  return pts;
}
