/**
 * The art each cosmetic draws today: the approved sources' art (playerCardArt.data.ts, cosmeticsArt.data.ts) with each
 * redrawn item's new art (redrawnArt.data.ts, docs/design/cosmetics-redraws/) in its place only where its switch in
 * src/config/cosmeticRedraws.ts is on. With every switch off (15 Nov 2026) every map here is the approved map itself,
 * so every drawing is exactly as before. Presentation only: ownership, the catalogue and withdrawals never read this.
 */
import { redrawnArtOn } from "@/config/cosmeticRedraws";

import * as approved from "./cosmeticsArt.data";
import * as card from "./playerCardArt.data";
import * as redrawn from "./redrawnArt.data";

/** The approved map, or a copy with the switched-on redraws in place (`on`: the switch; cosmetic-redraws-check). */
export function liveMap<T>(base: Record<string, T>, redraws: Record<string, T>, on: (id: string) => boolean = redrawnArtOn): Record<string, T> {
  const ids = Object.keys(redraws).filter((id) => on(id));
  if (!ids.length) return base;
  const out = { ...base };
  for (const id of ids) out[id] = redraws[id]!;
  return out;
}
export const liveCss = (base: string, css: Record<string, string>, on: (id: string) => boolean = redrawnArtOn): string => {
  const ids = Object.keys(css).filter((id) => on(id));
  return ids.length ? [base, ...ids.map((id) => css[id]!)].join("\n") : base;
};

export const CARD_ARTS = liveMap(card.CARD_ARTS, redrawn.REDRAWN_CARD_ARTS);
export const FRAMES = liveMap(card.FRAMES, redrawn.REDRAWN_FRAMES);
export const NAME_COLOURS = liveMap(card.NAME_COLOURS, redrawn.REDRAWN_NAME_COLOURS);
export const CARD_CHROME_CSS = card.CARD_CHROME_CSS;
export const CARD_MOTION_CSS = liveCss(card.CARD_MOTION_CSS, redrawn.REDRAWN_CARD_CSS);

export const FINISHES = liveMap(approved.FINISHES, redrawn.REDRAWN_FINISHES);
export const ACCESSORIES = liveMap(approved.ACCESSORIES, redrawn.REDRAWN_ACCESSORIES);
export const SPECIAL_EDITIONS = approved.SPECIAL_EDITIONS;
export const REACTIONS = liveMap(approved.REACTIONS, redrawn.REDRAWN_REACTIONS);
export const CELEBRATIONS = liveMap(approved.CELEBRATIONS, redrawn.REDRAWN_CELEBRATIONS);
export const TILE_STYLES = liveMap(approved.TILE_STYLES, redrawn.REDRAWN_TILE_STYLES);
export const COSMETICS_MOTION_CSS = liveCss(approved.COSMETICS_MOTION_CSS, redrawn.REDRAWN_COSMETICS_CSS);
export const PODIUM_ENTRANCES = approved.PODIUM_ENTRANCES;
export type { FinishArt } from "./cosmeticsArt.data";

/**
 * Checks only (identity-motion-check proves the approved sources' cut against their approved stills): every item draws
 * its approved art again, whatever its switch, in this process. The app never calls this.
 */
export function showApprovedArtForChecks(): void {
  const pairs: [Record<string, unknown>, Record<string, unknown>, Record<string, unknown>][] = [
    [CARD_ARTS, card.CARD_ARTS, redrawn.REDRAWN_CARD_ARTS],
    [FRAMES, card.FRAMES, redrawn.REDRAWN_FRAMES],
    [NAME_COLOURS, card.NAME_COLOURS, redrawn.REDRAWN_NAME_COLOURS],
    [FINISHES, approved.FINISHES, redrawn.REDRAWN_FINISHES],
    [ACCESSORIES, approved.ACCESSORIES, redrawn.REDRAWN_ACCESSORIES],
    [REACTIONS, approved.REACTIONS, redrawn.REDRAWN_REACTIONS],
    [CELEBRATIONS, approved.CELEBRATIONS, redrawn.REDRAWN_CELEBRATIONS],
    [TILE_STYLES, approved.TILE_STYLES, redrawn.REDRAWN_TILE_STYLES],
  ];
  for (const [live, base, redraws] of pairs) {
    if (live === base) continue;
    for (const id of Object.keys(redraws)) {
      if (id in base) live[id] = base[id];
      else delete live[id];
    }
  }
}
