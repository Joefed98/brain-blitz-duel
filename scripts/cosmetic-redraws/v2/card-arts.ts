/** The second pass's card arts (each a Blender render; see compose.ts and ART-DIRECTION.md). */
import type { V2Art } from "./compose";

export const V2_CARD_ARTS: Record<string, V2Art> = {
  "card-art.galaxy": { shade: 0.5 },
  "card-art.tier.lightning": { shade: 0.55, flash: "#FFE6A0" },
  // The tiers (docs/design/cosmetics-redraws/blender/cards_tiers.py): prestige rises Spark → Top 500.
  "card-art.tier.top-500": { shade: 0.55, sweep: true },
  "card-art.tier.storm": { shade: 0.55, flash: "#D9C8FF" },
  "card-art.tier.surge": { shade: 0.5 },
  "card-art.tier.volt": { shade: 0.5 },
  "card-art.tier.charge": { shade: 0.5 },
  "card-art.tier.spark": { shade: 0.5 },
  // The Legendaries and the shop (cards_shop.py).
  "card-art.diamond-plate": { shade: 0.6, sweep: true },
  "card-art.neon-skyline": { shade: 0.55, sweep: true },
  "card-art.frost": { shade: 0.6 },
  "card-art.royal": { shade: 0.55 },
  "card-art.lava": { shade: 0.55 },
  "card-art.crimson": { shade: 0.55 },
  "card-art.emerald": { shade: 0.5 },
  "card-art.sunburst": { shade: 0.6 },
  // The everyday starters and Static (cards_starters.py).
  "card-art.joulz-navy": { shade: 0.45 },
  "card-art.bolt-stripes": { shade: 0.5 },
  "card-art.grid": { shade: 0.5 },
  "card-art.waves": { shade: 0.45 },
  "card-art.hexes": { shade: 0.5 },
  "card-art.dots": { shade: 0.45 },
  "card-art.static": { shade: 0.5 },
};
