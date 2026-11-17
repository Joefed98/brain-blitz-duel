/**
 * The Attention overhaul's art (15 Nov 2026, phase 2 step 4; docs/design/attention-overhaul.md): presentation only.
 *
 * Every piece is rendered in Blender from the app's own outlines (scripts/attention-art/outlines.tsx, then
 * docs/design/attention-overhaul/source/pieces.py), so a sprite has exactly the silhouette, turn and facing the old
 * vector art had; only the material is new. Files live in public/attention/<game>/<name>.webp.
 */
import type { ArrowDir, GlyphColour, StroopColour } from "@/lib/duel/types";
import "@/polish-attention/attention-overhaul.css";

export const ATTENTION_ART_GAMES = ["symscan", "spotdiff", "countup", "maze", "bomb", "pairmatch"] as const;
export type AttentionArtGame = (typeof ATTENTION_ART_GAMES)[number];

/** A rendered piece's URL. */
export function attentionArt(game: AttentionArtGame, name: string): string {
  return `/attention/${game}/${name}.webp`;
}

/** Eagle Eye: the eagle facing `dir`, pewter or (marked) gold. */
export const eagleSprite = (dir: ArrowDir, gold: boolean) => attentionArt("symscan", `eagle-${gold ? "gold" : "plain"}-${dir}`);

/** Double Take: a sweet (picture 1) or a sea creature (picture 2) in its enamel colour. */
export const spotSprite = (theme: "shop" | "reef", kind: string, colour: StroopColour) =>
  attentionArt("spotdiff", `${theme === "reef" ? "reef" : "sweet"}-${kind}-${colour.toLowerCase()}`);

/** Tally: a token. */
export const tallySprite = (shape: string, colour: GlyphColour) => attentionArt("countup", `token-${shape}-${colour.toLowerCase()}`);

/** Matchmaker pairRev 4: a card's symbol. */
export const pairSprite = (shape: string, colour: StroopColour) => attentionArt("pairmatch", `symbol-${shape}-${colour.toLowerCase()}`);

/** Bomb Defusal: a wire's braided sleeve and a cap, by the wire colour. */
export const wireSprite = (colour: string) => attentionArt("bomb", `wire-${colour.toLowerCase()}`);
export const capSprite = (colour: string) => attentionArt("bomb", `cap-${colour.toLowerCase()}`);
