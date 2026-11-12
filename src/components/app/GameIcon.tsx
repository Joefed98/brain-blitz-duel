import { useId, useMemo, type CSSProperties } from "react";

import { ensureCosmeticStyles, tileStyleArt } from "@/design/identity/cosmetics";

import { CONCEPT_ICONS, ConceptIcon } from "./gameIcons/conceptIcons";
import { TILE_SCENES } from "./gameIcons/tileScenes.data";
import { arcadeGroupOf } from "@/lib/duel/arcadeGroups";
import { puzzleDef } from "@/lib/duel/catalogue";
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
export function GameIcon({ type, size = 44, tileStyle = null }: { type: PuzzleType; size?: number; tileStyle?: string | null }) {
  const scene = tileSceneUrl(type);
  // Wave 2 E2: the player's own tile style (Practice only): the style's tile, the game's scene where its sample was.
  if (tileStyle && scene && tileStyleArt(tileStyle, "")) return <StyledGameIcon type={type} size={size} scene={scene} tileStyle={tileStyle} />;
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

/**
 * A game's icon in the player's equipped tile style (wave 2 E2; docs/art/wave-2/items/tile-style): the style's own
 * 90 × 90 tile (its background, border and decoration, from the approved source), the game's tile scene where the
 * board drew its sample glyph (a rounded square inset 12 of 90), then anything the style draws on top. Only on the
 * player's own tiles in Practice; never in rooms, results or the share card.
 */
function StyledGameIcon({ type, size, scene, tileStyle }: { type: PuzzleType; size: number; scene: string; tileStyle: string }) {
  const prefix = `ts${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-`;
  // One { __html } per layer (CLAUDE.md working rule 6).
  const art = useMemo(() => {
    const a = tileStyleArt(tileStyle, prefix)!;
    return {
      back: { __html: `<svg viewBox="0 0 90 90" width="100%" height="100%" style="overflow: visible" aria-hidden="true">${a.back}</svg>` },
      front: a.front ? { __html: `<svg viewBox="0 0 90 90" width="100%" height="100%" style="overflow: visible" aria-hidden="true">${a.front}</svg>` } : null,
    };
  }, [tileStyle, prefix]);
  ensureCosmeticStyles();
  return (
    <span
      aria-hidden="true"
      data-game-icon={type}
      data-icon-art="img"
      data-tile-style={tileStyle}
      className="game-icon game-icon-styled jzc"
      style={{ width: size, height: size }}
    >
      <span className="game-icon-style-layer" dangerouslySetInnerHTML={art.back} />
      <img src={scene} alt="" draggable={false} decoding="async" className="game-icon-style-scene" />
      {art.front ? <span className="game-icon-style-layer" dangerouslySetInnerHTML={art.front} /> : null}
    </span>
  );
}
