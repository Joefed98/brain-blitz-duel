import type { CSSProperties } from "react";

import { CONCEPT_ICONS, ConceptIcon } from "./gameIcons/conceptIcons";
import { puzzleDef } from "@/lib/duel/registry";
import type { PuzzleType } from "@/lib/duel/types";

/** True when a game has its own icon drawing (every game does; app-shell-check proves it for the active ones). */
export function hasGameIcon(type: string): boolean {
  return type in CONCEPT_ICONS;
}

/** The tile's border width (px) at a size: about 4.5 % of the tile, at least 1.5 px. */
export function gameIconBorder(size: number): number {
  return Math.max(1.5, Math.round(size * 0.045 * 2) / 2);
}

/**
 * A game's icon (27 Oct 2026): a small drawing of the game's idea (gameIcons/conceptIcons.tsx, one
 * style for every game, no text) on a black tile with a border in its category's colour
 * (`--category-*` through `data-cat`, polish-layout/theme.css). The same icon is used on Play,
 * Practice, Profile, the results screens and the share card. Decorative: the game's name is always
 * beside it.
 */
export function GameIcon({ type, size = 44 }: { type: PuzzleType; size?: number }) {
  const style = { width: size, height: size, "--gi-border": `${gameIconBorder(size)}px` } as CSSProperties;
  return (
    <span
      aria-hidden="true"
      data-game-icon={type}
      data-icon-art={type in CONCEPT_ICONS ? "svg" : "none"}
      data-cat={puzzleDef(type).category}
      className="game-icon"
      style={style}
    >
      <ConceptIcon type={type} />
    </span>
  );
}
