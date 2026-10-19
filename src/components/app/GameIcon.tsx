import { useEffect, useLayoutEffect, useRef } from "react";

import { ARCADE_ICON_PAINTERS, type IconPainter } from "./gameIcons/arcadeIcons.renderer";
import { PUZZLE_ICON_ART } from "./gameIcons/puzzleIcons";
import { preloadGameArt } from "@/lib/arcade/gameArt.renderer";
import { puzzleDef } from "@/lib/duel/registry";
import type { PuzzleType } from "@/lib/duel/types";

/** True when a game has its own icon art (every active game does; app-shell-check proves it). */
export function hasGameIcon(type: string): boolean {
  return type in ARCADE_ICON_PAINTERS || type in PUZZLE_ICON_ART;
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** An arcade icon: the game's renderer painting a canvas at the screen's pixel ratio (crisp at any size). */
function CanvasIcon({ type, painter, size }: { type: string; painter: IconPainter; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useIsoLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let live = true;
    const paint = () => {
      const ratio = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
      const px = Math.round(size * ratio);
      if (canvas.width !== px) canvas.width = px;
      if (canvas.height !== px) canvas.height = px;
      const c = canvas.getContext("2d");
      if (!c) return;
      const k = px / 64;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, px, px);
      c.setTransform(k, 0, 0, k, 0, 0);
      c.imageSmoothingEnabled = true;
      try {
        painter(c, k);
      } catch {
        /* an icon never breaks a screen */
      }
      c.setTransform(1, 0, 0, 1, 0, 0);
    };
    paint();
    // Games whose sprite is a bundled picture (Wavefront's fighter, Tilt's marble, Grappler's anchor) repaint once it loads.
    void preloadGameArt(type).then(() => {
      if (live) paint();
    });
    return () => {
      live = false;
    };
  }, [type, painter, size]);
  return <canvas ref={ref} width={size} height={size} />;
}

/**
 * A game's icon: its own in-game art (no text) on a glossy tile in its category's colour
 * (polish-layout/theme.css). The same
 * icon is used on Play, Practice and Profile. Decorative: the game's name is always beside it.
 */
export function GameIcon({ type, size = 44 }: { type: PuzzleType; size?: number }) {
  const painter = ARCADE_ICON_PAINTERS[type];
  const art = PUZZLE_ICON_ART[type];
  return (
    <span
      aria-hidden="true"
      data-game-icon={type}
      data-icon-art={painter ? "canvas" : art ? "svg" : "none"}
      data-cat={puzzleDef(type).category}
      className="game-icon"
      style={{ width: size, height: size }}
    >
      {painter ? (
        <CanvasIcon type={type} painter={painter} size={size} />
      ) : art ? (
        art()
      ) : (
        <FallbackIcon type={type} />
      )}
    </span>
  );
}

/** Practice-only (retired) games without their own art: the category's colour and the app's bolt. */
function FallbackIcon({ type }: { type: PuzzleType }) {
  const accent = `var(--category-${puzzleDef(type).category})`;
  return (
    <svg viewBox="0 0 64 64" className="game-icon-art" aria-hidden="true">
      <circle cx="32" cy="32" r="18" fill={accent} opacity="0.25" />
      <path d="M36 14 22 36h9l-3 14 14-22h-9l3-14Z" fill={accent} />
    </svg>
  );
}
