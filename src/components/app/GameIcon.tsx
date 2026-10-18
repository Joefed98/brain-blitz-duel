import { useEffect, useLayoutEffect, useRef } from "react";

import { ARCADE_ICON_PAINTERS, type IconPainter } from "./gameIcons/arcadeIcons.renderer";
import { PUZZLE_ICON_ART } from "./gameIcons/puzzleIcons";
import { preloadGameArt } from "@/lib/arcade/gameArt.renderer";
import { puzzleDef } from "@/lib/duel/registry";
import type { PuzzleType } from "@/lib/duel/types";

/**
 * Each game's tile colour: its own world's or board's colour (the arcade worlds' skies and floors,
 * the puzzle boards' panels), so the icon reads as a small piece of the game's screen.
 */
export const GAME_ICON_TILES: Record<string, string> = {
  // Arcade (their worlds' backgrounds, from each renderer's palette).
  hover: "#14121E",
  skyline: "#090F20",
  bintoss: "#3B2C63",
  bullseye: "#0D1838",
  matchup: "#1A1530",
  breaker: "#0A0A12",
  pinball: "#0B0620",
  rally: "#06141A",
  slice: "#648985",
  bubble: "#0C3561",
  beat: "#0B0A10",
  snake: "#0A0A0E",
  cross: "#555B64",
  wavefront: "#07070C",
  flip: "#1E1E24",
  inkbridge: "#89CEF2",
  burst: "#07070D",
  orbit: "#06060F",
  swing: "#08060A",
  snip: "#89CEF2",
  tilt: "#2A1C14",
  balltrack: "#C99A62",
  stroop: "#07070D",
  whack: "#36552A",
  tendrop: "#2A1C14",
  wordfall: "#2A1C14",
  clayshoot: "#3A78AE",
  // Word (the word accent's board blues).
  wordsmith: "#141B2E",
  tilegrid: "#172038",
  wordslide: "#172038",
  wordhunt: "#172038",
  wordsearch: "#172038",
  letterwheel: "#141B2E",
  strikeout: "#172038",
  codeword: "#1F2C4A",
  swapword: "#172038",
  // Number.
  balance: "#1D1812",
  target: "#17171F",
  equation: "#13261C",
  numpyramid: "#2A251F",
  trail: "#263322",
  measure: "#10243A",
  checkout: "#1D1310",
  numline: "#1A2A22",
  // Speed.
  reaction: "#0B0B0F",
  numhunt: "#1C1A16",
  stopwatch: "#1F1712",
  chain: "#2A1B10",
  // Attention.
  symscan: "#22374A",
  spotdiff: "#1E1A24",
  countup: "#1B1D24",
  maze: "#141920",
  pairmatch: "#2A1426",
  // Pattern.
  unblock: "#2C2E34",
  blockparty: "#2B2D3A",
  pipes: "#2A3038",
  flow: "#15171E",
  iceslide: "#BFD9E7",
  push: "#24201C",
  laser: "#1E1A30",
  gravity: "#161922",
  tiles: "#1F1B30",
  rings: "#17181C",
  // Logic.
  lightsout: "#17181E",
  sudoku: "#132A27",
  tower: "#1C2826",
  tubes: "#152320",
  safe: "#1D1E25",
  bomb: "#121318",
  nonogram: "#132A27",
  flood: "#152320",
  tents: "#2C4A2E",
  shikaku: "#132A27",
  lightup: "#110F0B",
};

const CATEGORY_TILE: Record<string, string> = {
  word: "#172038",
  number: "#13261C",
  speed: "#2A1B10",
  attention: "#2A1426",
  pattern: "#1F1B30",
  logic: "#132A27",
  arcade: "#1A0F12",
};

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
 * A game's icon: a rounded tile in the game's colour with its own in-game art (no text). The same
 * icon is used on Play, Practice and Profile. Decorative: the game's name is always beside it.
 */
export function GameIcon({ type, size = 44 }: { type: PuzzleType; size?: number }) {
  const painter = ARCADE_ICON_PAINTERS[type];
  const art = PUZZLE_ICON_ART[type];
  const tile = GAME_ICON_TILES[type] ?? CATEGORY_TILE[puzzleDef(type).category] ?? "#1A1B22";
  return (
    <span
      aria-hidden="true"
      data-game-icon={type}
      data-icon-art={painter ? "canvas" : art ? "svg" : "none"}
      className="game-icon"
      style={{ width: size, height: size, background: tile }}
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
