/** The second pass's frames (each a Blender render; see compose.ts and ART-DIRECTION.md). */
import type { V2Frame } from "./compose";

const CHAMPAGNE = "#F3DDA6";

/** Twinkles on the four corner stones (and the crest), sized by the frame's place on the ladder. */
const corners = (r: number, crest?: [number, number]): [number, number, number][] => [
  [8, 8, r],
  [292, 8, r],
  [8, 104, r],
  [292, 104, r],
  ...(crest ? [[crest[0], crest[1], r * 1.2] as [number, number, number]] : []),
];

export const V2_FRAMES: Record<string, V2Frame> = {
  // Prestige: blender/frame_founding.py and blender/frame_set.py, each its own motif; 15 Nov 2026 (Joe): every special
  // frame glows, shines and sparkles (frames.radiate in the render; a glint and twinkles here).
  "frame.founding": { plaque: [["FOUNDER {{founder}}", 150, 104.5, 6.4, CHAMPAGNE]], glint: true, twinkle: corners(6, [161, 0]) },
  "frame.top-500": { plaque: [["TOP 500", 150, 105, 6.6, CHAMPAGNE]], glint: true, twinkle: corners(6, [150, -1]) },
  "frame.championship": { plaque: [["CHAMPION", 150, 105, 6.6, "#EEF2FF"]], glint: true, twinkle: corners(6, [150, -2]) },
  // Season 1: one family, richer tier by tier (the glint from Surge, twinkles on every tier, larger as they rise).
  "frame.s1-top-500": { glint: true, twinkle: corners(5.6, [150, -1]) },
  "frame.s1-lightning": { glint: true, twinkle: corners(5.2, [150, -1]) },
  "frame.s1-storm": { glint: true, twinkle: corners(4.8) },
  "frame.s1-surge": { glint: true, twinkle: corners(4.4) },
  "frame.s1-volt": { twinkle: corners(4) },
  "frame.s1-charge": { twinkle: corners(3.6) },
  "frame.s1-spark": { twinkle: corners(3.2) },
  // Elite, Rare, Common: calm (no change).
  "frame.obsidian": {},
  "frame.silver": {},
  "frame.bronze": {},
};
