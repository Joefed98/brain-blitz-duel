/** The second pass's frames (each a Blender render; see compose.ts and ART-DIRECTION.md). */
import type { V2Frame } from "./compose";

export const V2_FRAMES: Record<string, V2Frame> = {
  "frame.founding": { plaque: [["FOUNDER {{founder}}", 150, 104.5, 6.4, "#F3DDA6"]], glint: true },
};
