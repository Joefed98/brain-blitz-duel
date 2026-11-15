/** The second pass's frames (each a Blender render; see compose.ts and ART-DIRECTION.md). */
import type { V2Frame } from "./compose";

const CHAMPAGNE = "#F3DDA6";

export const V2_FRAMES: Record<string, V2Frame> = {
  // Prestige: blender/frame_founding.py and blender/frame_set.py, each its own motif.
  "frame.founding": { plaque: [["FOUNDER {{founder}}", 150, 104.5, 6.4, CHAMPAGNE]], glint: true },
  "frame.top-500": { plaque: [["TOP 500", 150, 105, 6.6, CHAMPAGNE]], glint: true },
  "frame.championship": { plaque: [["CHAMPION", 150, 105, 6.6, "#EEF2FF"]], glint: true },
  // Season 1: one family, richer tier by tier; the animated ones (Storm, Lightning, Top 500) glint.
  "frame.s1-top-500": { glint: true },
  "frame.s1-lightning": { glint: true },
  "frame.s1-storm": { glint: true },
  "frame.s1-surge": {},
  "frame.s1-volt": {},
  "frame.s1-charge": {},
  "frame.s1-spark": {},
  // Elite, Rare, Common.
  "frame.obsidian": {},
  "frame.silver": {},
  "frame.bronze": {},
};
