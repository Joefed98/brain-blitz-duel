/**
 * The pieces the Attention overhaul renders in Blender, each drawn by the app's own art code (outlines.tsx).
 * `FILL` marks the part a piece's colour fills: Blender renders that part once per colour of the game's palette.
 */
import React from "react";
import { EAGLE_BEAK_D, EAGLE_BODY_D, EAGLE_EYE } from "../../src/puzzles/eagleEyeArt";
import { SweetArt } from "../../src/puzzles/doubleTakeArt";
import { ReefArt } from "../../src/puzzles/doubleTakeReef";
import { TallyGlyph } from "../../src/puzzles/countUp";
import type { SpotShapeKind } from "../../src/lib/duel/types";

/** The sentinel colour for the part a piece's palette colour fills. */
export const FILL = "#fe01fd";

export interface Piece {
  name: string;
  w: number;
  h: number;
  node: React.ReactNode;
  color?: string;
}

const SPOT_KINDS: SpotShapeKind[] = ["circle", "square", "triangle", "star", "hexagon", "arrow"];
const TALLY_SHAPES = ["circle", "square", "triangle", "star", "hexagon"] as const;

/** Matchmaker's symbols (pairRev 4 adds the hexagon and the diamond); 24-unit box. */
export const PAIR_SYMBOLS: Record<string, React.ReactNode> = {
  circle: <circle cx="12" cy="12" r="10.2" fill={FILL} />,
  square: <rect x="2" y="2" width="20" height="20" rx="2.5" fill={FILL} />,
  triangle: <polygon points="12,1.6 22.8,21.5 1.2,21.5" fill={FILL} />,
  star: <polygon points="12,1.2 15.2,8.7 23.4,9.4 17.1,14.9 19.1,23 12,18.6 4.9,23 6.9,14.9 0.6,9.4 8.8,8.7" fill={FILL} />,
  hexagon: <polygon points="12,1.2 21.4,6.6 21.4,17.4 12,22.8 2.6,17.4 2.6,6.6" fill={FILL} />,
  diamond: <polygon points="12,0.8 20.6,12 12,23.2 3.4,12" fill={FILL} />,
};

export function pieces(): Piece[] {
  const out: Piece[] = [];
  // Eagle Eye: the east-facing eagle; the head and tail masks pick the white parts out of the body (bald colouring).
  out.push({
    name: "eagle",
    w: 32,
    h: 32,
    node: (
      <>
        <path d={EAGLE_BODY_D} fill="#808080" data-role="body" />
        <path d="M22.2 12.2C24.4 11.4 27 11.8 28.2 13.4L27.8 18.4C25.6 19.6 23 19.8 21.6 18.8Z" fill="#ffffff" data-role="head" />
        <path d="M0 13H10.4L10.8 23H0Z" fill="#ffffff" data-role="tail" />
        <path d={EAGLE_BEAK_D} fill="#f5b82e" data-role="beak" />
        <circle cx={EAGLE_EYE.cx} cy={EAGLE_EYE.cy} r={EAGLE_EYE.r * 1.25} fill="#0f1418" data-role="eye" />
      </>
    ),
  });
  for (const kind of SPOT_KINDS) {
    out.push({ name: `sweet-${kind}`, w: 40, h: 40, node: <SweetArt kind={kind} fill={FILL} /> });
    out.push({ name: `reef-${kind}`, w: 40, h: 40, node: <ReefArt kind={kind} fill={FILL} /> });
  }
  for (const shape of TALLY_SHAPES) out.push({ name: `tally-${shape}`, w: 24, h: 24, node: <TallyGlyphFill shape={shape} /> });
  for (const [shape, node] of Object.entries(PAIR_SYMBOLS)) out.push({ name: `pair-${shape}`, w: 24, h: 24, node });
  return out;
}

/** Tally's glyph geometry with the palette sentinel (the outline is the token's rim in Blender). */
function TallyGlyphFill({ shape }: { shape: (typeof TALLY_SHAPES)[number] }) {
  void TallyGlyph;
  const STAR = "12,2 14.9,8.9 22.4,9.5 16.7,14.4 18.5,21.7 12,17.8 5.5,21.7 7.3,14.4 1.6,9.5 9.1,8.9";
  if (shape === "circle") return <circle cx="12" cy="12" r="9.5" fill={FILL} />;
  if (shape === "square") return <rect x="2.5" y="2.5" width="19" height="19" rx="2" fill={FILL} />;
  if (shape === "triangle") return <polygon points="12,2.5 22,21 2,21" fill={FILL} />;
  if (shape === "star") return <polygon points={STAR} fill={FILL} />;
  return <polygon points="12,2 20.7,7 20.7,17 12,22 3.3,17 3.3,7" fill={FILL} />;
}
