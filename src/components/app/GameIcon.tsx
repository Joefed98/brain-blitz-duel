import type { CSSProperties } from "react";

import { CONCEPT_ICONS, ConceptIcon } from "./gameIcons/conceptIcons";
import { TILE_SCENES } from "./gameIcons/tileScenes.data";
import { arcadeGroupOf } from "@/lib/duel/arcadeGroups";
import { puzzleDef } from "@/lib/duel/registry";
import type { PuzzleType } from "@/lib/duel/types";

/** True when a game has its own icon (a tile scene or, failing that, a line drawing; app-shell-check proves it for the active ones). */
export function hasGameIcon(type: string): boolean {
  return type in TILE_SCENES || type in CONCEPT_ICONS;
}

/**
 * A game's tile scene image (public/tiles/<type>.webp, 208 px square, made by `bun
 * scripts/shots/tile-scenes.ts` from the game's own art), with its content hash on the URL; null
 * when the game has none (it keeps its line drawing).
 */
export function tileSceneUrl(type: string): string | null {
  const hash = TILE_SCENES[type as PuzzleType];
  return hash ? `/tiles/${type}.webp?v=${hash}` : null;
}

/** The tile's border width (px) at a size: about 4.5 % of the tile, at least 1.5 px. */
export function gameIconBorder(size: number): number {
  return Math.max(1.5, Math.round(size * 0.045 * 2) / 2);
}

/**
 * A game's icon (27 Oct 2026): a small scene of the game drawn with its own art (tileSceneUrl), or
 * for a game without one its line drawing (gameIcons/conceptIcons.tsx), on a black tile with a
 * border in its category's colour (`--category-*` through `data-cat`, polish-layout/theme.css); an
 * arcade game's border is its group's colour (`data-group`, arcadeGroups.ts; Retro's glows).
 * The same icon is used on Play, Practice, Profile, the results screens and the share card.
 * Decorative: the game's name is always beside it.
 */
export function GameIcon({ type, size = 44 }: { type: PuzzleType; size?: number }) {
  const scene = tileSceneUrl(type);
  const style = { width: size, height: size, "--gi-border": `${gameIconBorder(size)}px` } as CSSProperties;
  return (
    <span
      aria-hidden="true"
      data-game-icon={type}
      data-icon-art={scene ? "img" : type in CONCEPT_ICONS ? "svg" : "none"}
      data-cat={puzzleDef(type).category}
      data-group={arcadeGroupOf(type) ?? undefined}
      className="game-icon"
      style={style}
    >
      {scene ? <img src={scene} alt="" draggable={false} decoding="async" className="game-icon-img" /> : <ConceptIcon type={type} />}
    </span>
  );
}
