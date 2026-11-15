/** The second pass's card arts (each a Blender render; see compose.ts and ART-DIRECTION.md). */
import type { V2Art } from "./compose";

export const V2_CARD_ARTS: Record<string, V2Art> = {
  "card-art.galaxy": { shade: 0.5 },
  "card-art.tier.lightning": { shade: 0.55, flash: "#FFE6A0" },
};
