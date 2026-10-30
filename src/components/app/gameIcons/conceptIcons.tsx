/**
 * Game tile icons (27 Oct 2026, presentation only): a small drawing of each game's general idea
 * (Slider's rows of letter tiles and a padlock, Hanoi's three posts and rings, Pinball's flippers
 * and ball), all in one style so a shelf of them reads as one set:
 *
 * - a 64 × 64 box on the tile's black, art kept inside 7…57;
 * - lines 3 units wide, round caps and joins, in INK (#F3F1EC) for the main shapes, DIM for the
 *   secondary ones, and the category colour (`currentColor`: the tile sets `color: var(--cat)`,
 *   the category's own `--category-*` token) for the one thing that matters;
 * - no <text> (an icon has no words): letters and digits are drawn as strokes (`Glyph`).
 *
 * GameIcon draws every game from here; the share card rasterises the same SVG (gameIconImages.tsx).
 */
import type { ReactElement, ReactNode } from "react";

import type { PuzzleType } from "@/lib/duel/types";

const INK = "#F3F1EC";
const DIM = "#6F6F7D";
const BG = "#000";
const A = "currentColor";
const SW = 3;

type Pt = readonly [number, number];

const pts = (list: readonly Pt[]) => list.map(([x, y]) => `${round(x)},${round(y)}`).join(" ");
const round = (n: number) => Math.round(n * 100) / 100;

/** Stroke letters and digits in a 1 × 1 box (drawn 0.62 as wide as tall). */
const GLYPHS: Record<string, readonly (readonly Pt[])[]> = {
  A: [[[0, 1], [0.5, 0], [1, 1]], [[0.22, 0.6], [0.78, 0.6]]],
  B: [[[0, 0.5], [0, 0], [0.7, 0], [0.95, 0.24], [0.7, 0.5], [0, 0.5], [0, 1], [0.75, 1], [1, 0.75], [0.75, 0.5]]],
  C: [[[1, 0.14], [0.78, 0], [0.24, 0], [0, 0.24], [0, 0.76], [0.24, 1], [0.78, 1], [1, 0.86]]],
  D: [[[0, 0], [0, 1], [0.6, 1], [1, 0.68], [1, 0.32], [0.6, 0], [0, 0]]],
  E: [[[1, 0], [0, 0], [0, 1], [1, 1]], [[0, 0.5], [0.75, 0.5]]],
  F: [[[1, 0], [0, 0], [0, 1]], [[0, 0.5], [0.75, 0.5]]],
  G: [[[1, 0.14], [0.78, 0], [0.24, 0], [0, 0.24], [0, 0.76], [0.24, 1], [0.78, 1], [1, 0.8], [1, 0.55], [0.55, 0.55]]],
  H: [[[0, 0], [0, 1]], [[1, 0], [1, 1]], [[0, 0.5], [1, 0.5]]],
  I: [[[0.5, 0], [0.5, 1]], [[0.15, 0], [0.85, 0]], [[0.15, 1], [0.85, 1]]],
  K: [[[0, 0], [0, 1]], [[1, 0], [0, 0.6]], [[0.3, 0.42], [1, 1]]],
  L: [[[0, 0], [0, 1], [1, 1]]],
  M: [[[0, 1], [0, 0], [0.5, 0.55], [1, 0], [1, 1]]],
  N: [[[0, 1], [0, 0], [1, 1], [1, 0]]],
  O: [[[0.3, 0], [0.7, 0], [1, 0.3], [1, 0.7], [0.7, 1], [0.3, 1], [0, 0.7], [0, 0.3], [0.3, 0]]],
  P: [[[0, 1], [0, 0], [0.72, 0], [1, 0.26], [0.72, 0.52], [0, 0.52]]],
  R: [[[0, 1], [0, 0], [0.72, 0], [1, 0.26], [0.72, 0.52], [0, 0.52]], [[0.45, 0.52], [1, 1]]],
  S: [[[1, 0.12], [0.8, 0], [0.2, 0], [0, 0.2], [0.15, 0.44], [0.85, 0.56], [1, 0.8], [0.8, 1], [0.2, 1], [0, 0.88]]],
  T: [[[0, 0], [1, 0]], [[0.5, 0], [0.5, 1]]],
  U: [[[0, 0], [0, 0.75], [0.25, 1], [0.75, 1], [1, 0.75], [1, 0]]],
  W: [[[0, 0], [0.22, 1], [0.5, 0.42], [0.78, 1], [1, 0]]],
  X: [[[0, 0], [1, 1]], [[1, 0], [0, 1]]],
  Y: [[[0, 0], [0.5, 0.5], [1, 0]], [[0.5, 0.5], [0.5, 1]]],
  "0": [[[0.3, 0], [0.7, 0], [1, 0.25], [1, 0.75], [0.7, 1], [0.3, 1], [0, 0.75], [0, 0.25], [0.3, 0]]],
  "1": [[[0.2, 0.22], [0.58, 0], [0.58, 1]], [[0.2, 1], [0.95, 1]]],
  "2": [[[0, 0.2], [0.25, 0], [0.75, 0], [1, 0.22], [1, 0.4], [0, 1], [1, 1]]],
  "3": [[[0, 0.1], [0.2, 0], [0.8, 0], [1, 0.2], [0.8, 0.47], [0.35, 0.47]], [[0.8, 0.47], [1, 0.74], [0.8, 1], [0.2, 1], [0, 0.9]]],
  "4": [[[0.75, 1], [0.75, 0], [0, 0.68], [1, 0.68]]],
  "5": [[[1, 0], [0.12, 0], [0.04, 0.44], [0.72, 0.4], [1, 0.64], [0.8, 1], [0.15, 1], [0, 0.88]]],
  "6": [[[0.9, 0], [0.42, 0], [0, 0.48], [0, 0.8], [0.24, 1], [0.76, 1], [1, 0.8], [1, 0.62], [0.76, 0.44], [0.24, 0.44], [0, 0.6]]],
  "7": [[[0, 0], [1, 0], [0.38, 1]]],
  "8": [[[0.5, 0.46], [0.15, 0.36], [0.08, 0.14], [0.3, 0], [0.7, 0], [0.92, 0.14], [0.85, 0.36], [0.5, 0.46], [0.08, 0.62], [0.02, 0.84], [0.25, 1], [0.75, 1], [0.98, 0.84], [0.92, 0.62], [0.5, 0.46]]],
  "9": [[[0.1, 1], [0.58, 1], [1, 0.52], [1, 0.2], [0.76, 0], [0.24, 0], [0, 0.2], [0, 0.38], [0.24, 0.56], [0.76, 0.56], [1, 0.4]]],
  "?": [[[0, 0.22], [0.2, 0], [0.8, 0], [1, 0.2], [1, 0.36], [0.5, 0.56], [0.5, 0.72]], [[0.5, 0.98], [0.5, 1]]],
  "+": [[[0.5, 0.15], [0.5, 0.85]], [[0, 0.5], [1, 0.5]]],
  "=": [[[0, 0.32], [1, 0.32]], [[0, 0.68], [1, 0.68]]],
};

/** A letter or digit `h` tall with its top-left at (x, y). */
function Glyph({ ch, x, y, h, color, w }: { ch: string; x: number; y: number; h: number; color?: string | undefined; w?: number | undefined }) {
  const lines = GLYPHS[ch];
  if (!lines) return null;
  const gw = h * 0.62;
  color ??= INK;
  w ??= 2.4;
  const d = lines.map((line) => `M${line.map(([px, py]) => `${round(x + px * gw)} ${round(y + py * h)}`).join("L")}`).join("");
  return <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;
}

/** A glyph centred on (cx, cy). */
function CGlyph({ ch, cx, cy, h, color, w }: { ch: string; cx: number; cy: number; h: number; color?: string | undefined; w?: number | undefined }) {
  return <Glyph ch={ch} x={cx - (h * 0.62) / 2} y={cy - h / 2} h={h} color={color} w={w} />;
}

/** The set's line style. */
function Ink({ children, color = INK, w = SW }: { children: ReactNode; color?: string; w?: number }) {
  return (
    <g fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </g>
  );
}

/** A letter tile: a rounded square, optionally filled, with a stroke letter. */
function Tile({ x, y, s, ch, fill, line = INK }: { x: number; y: number; s: number; ch?: string | undefined; fill?: string | undefined; line?: string }) {
  const filled = Boolean(fill);
  return (
    <g>
      <rect x={x} y={y} width={s} height={s} rx={s * 0.2} fill={fill ?? "none"} stroke={filled ? fill : line} strokeWidth={2.4} />
      {ch ? <CGlyph ch={ch} cx={x + s / 2} cy={y + s / 2} h={s * 0.5} color={filled ? BG : INK} w={Math.max(1.8, s * 0.13)} /> : null}
    </g>
  );
}

/** A plain figure (head and stick limbs) with a short cape in the category colour; `dir` -1 faces left. */
function Figure({ x, y, s = 1, dir = 1, pose = "run", flipY = false }: { x: number; y: number; s?: number; dir?: 1 | -1; pose?: "run" | "stand" | "reach"; flipY?: boolean }) {
  // Drawn feet at (x, y), 20 units tall at s = 1.
  const body =
    pose === "reach"
      ? { arms: [[-1, -10], [0, -16], [1, -22]] as Pt[], arm2: [[0, -15], [4, -11]] as Pt[], legs: [[-3, 0], [0, -7], [3, -1]] as Pt[] }
      : pose === "stand"
        ? { arms: [[-5, -9], [0, -14], [5, -9]] as Pt[], arm2: null, legs: [[-3, 0], [0, -7], [3, 0]] as Pt[] }
        : { arms: [[-5, -9], [0, -14], [5, -11]] as Pt[], arm2: null, legs: [[-5, 0], [0, -7], [4, -1]] as Pt[] };
  const t = (p: Pt): Pt => [p[0] * dir * s, p[1] * s];
  return (
    <g transform={`translate(${x} ${y})${flipY ? " scale(1 -1)" : ""}`}>
      <path d={`M${0} ${-14 * s}L${-6 * dir * s} ${-6 * s}L${-2 * dir * s} ${-5 * s}Z`} fill={A} />
      <Ink w={2.6 * Math.min(1, s + 0.15)}>
        <polyline points={pts([[0, -7 * s], [0, -14 * s]])} />
        <polyline points={pts(body.arms.map(t))} />
        {body.arm2 ? <polyline points={pts(body.arm2.map(t))} /> : null}
        <polyline points={pts(body.legs.map(t))} />
      </Ink>
      <circle cx={dir * s} cy={-18 * s} r={3.2 * s} fill={INK} />
    </g>
  );
}

function hexPts(cx: number, cy: number, r: number): string {
  return pts(Array.from({ length: 6 }, (_, i) => [cx + r * Math.cos((Math.PI / 3) * i + Math.PI / 6), cy + r * Math.sin((Math.PI / 3) * i + Math.PI / 6)] as Pt));
}

function star(cx: number, cy: number, r: number, inner = 0.45): string {
  return pts(Array.from({ length: 10 }, (_, i) => {
    const rr = i % 2 ? r * inner : r;
    const a = -Math.PI / 2 + (Math.PI / 5) * i;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as Pt;
  }));
}

const gem = (cx: number, cy: number, r: number) => pts([[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]]);

/* ------------------------------------------------------------------ the icons */

type Art = () => ReactElement;

const WORD: Partial<Record<PuzzleType, Art>> = {
  wordsmith: () => (
    <>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (Math.PI / 3) * i;
        return <polygon key={i} points={hexPts(32 + 15.6 * Math.cos(a), 32 + 15.6 * Math.sin(a), 8)} fill="none" stroke={DIM} strokeWidth={2.4} strokeLinejoin="round" />;
      })}
      <polygon points={hexPts(32, 32, 8.6)} fill={A} />
      <CGlyph ch="A" cx={32} cy={32} h={8} color={BG} w={2.4} />
      <CGlyph ch="R" cx={47.6} cy={32} h={6.4} w={2} />
      <CGlyph ch="T" cx={16.4} cy={32} h={6.4} w={2} />
    </>
  ),
  tilegrid: () => (
    <>
      <Tile x={9} y={25} s={14} ch="C" />
      <Tile x={25} y={25} s={14} ch="A" fill={A} />
      <Tile x={41} y={25} s={14} ch="T" />
      <Tile x={25} y={9} s={14} ch="H" />
      <Tile x={25} y={41} s={14} ch="T" />
    </>
  ),
  wordslide: () => (
    <>
      {[0, 1, 2].map((c) => <Tile key={`a${c}`} x={7 + c * 13} y={10} s={11} fill={A} ch={["W", "O", "N"][c]} />)}
      {[0, 1, 2].map((c) => <Tile key={`b${c}`} x={7 + c * 13} y={26} s={11} ch={["T", "E", "A"][c]} />)}
      {[0, 1, 2].map((c) => <Tile key={`c${c}`} x={7 + c * 13} y={42} s={11} ch={["S", "K", "Y"][c]} />)}
      <rect x={47} y={14} width={11} height={9} rx={2} fill={A} />
      <path d="M49.5 14v-2.5a3 3 0 0 1 6 0V14" fill="none" stroke={A} strokeWidth={2.2} />
      <Ink color={DIM} w={2.2}>
        <polyline points={pts([[47, 31.5], [57, 31.5]])} />
        <polyline points={pts([[54, 28.5], [57, 31.5], [54, 34.5]])} />
      </Ink>
    </>
  ),
  letterwheel: () => (
    <>
      <circle cx={32} cy={32} r={22} fill="none" stroke={DIM} strokeWidth={2.4} />
      <Ink color={A} w={3.4}>
        <polyline points={pts([[32, 17], [46, 37], [20, 40]])} />
      </Ink>
      <CGlyph ch="R" cx={32} cy={17} h={7} />
      <CGlyph ch="O" cx={46} cy={37} h={7} />
      <CGlyph ch="T" cx={20} cy={40} h={7} />
      <CGlyph ch="E" cx={46.5} cy={22} h={6} color={DIM} w={2} />
      <CGlyph ch="S" cx={17.5} cy={23} h={6} color={DIM} w={2} />
      <CGlyph ch="N" cx={33} cy={47} h={6} color={DIM} w={2} />
    </>
  ),
  strikeout: () => (
    <>
      <Ink color={A} w={2.8}>
        {[0, 1, 2].map((i) => <g key={i}><polyline points={pts([[12 + i * 9, 10], [18 + i * 9, 16]])} /><polyline points={pts([[18 + i * 9, 10], [12 + i * 9, 16]])} /></g>)}
      </Ink>
      <Ink color={DIM} w={2.4}><polyline points={pts([[39, 10], [45, 16]])} /><polyline points={pts([[45, 10], [39, 16]])} /></Ink>
      <Ink>
        {[0, 1, 2, 3, 4].map((i) => <polyline key={i} points={pts([[8 + i * 10, 48], [15 + i * 10, 48]])} />)}
      </Ink>
      <CGlyph ch="W" cx={11.5} cy={38} h={9} />
      <CGlyph ch="R" cx={31.5} cy={38} h={9} />
      <CGlyph ch="S" cx={51.5} cy={38} h={9} />
    </>
  ),
  codeword: () => (
    <>
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2].map((c) => {
          const blocked = (r === 0 && c === 2) || (r === 2 && c === 0);
          return <rect key={`${r}${c}`} x={9 + c * 16} y={9 + r * 16} width={15} height={15} fill={blocked ? DIM : "none"} stroke={INK} strokeWidth={2} />;
        }),
      )}
      <Glyph ch="3" x={11.5} y={11.5} h={5} w={1.4} color={DIM} />
      <Glyph ch="7" x={27.5} y={27.5} h={5} w={1.4} color={DIM} />
      <Glyph ch="1" x={43.5} y={43.5} h={5} w={1.4} color={DIM} />
      <rect x={25} y={9} width={15} height={15} fill={A} />
      <CGlyph ch="E" cx={32.5} cy={17} h={8} color={BG} w={2.2} />
      <CGlyph ch="A" cx={18} cy={34} h={7} />
    </>
  ),
  swapword: () => (
    <>
      <Tile x={9} y={23} s={18} ch="A" />
      <Tile x={37} y={23} s={18} ch="B" fill={A} />
      <Ink color={A} w={2.6}>
        <path d="M18 19Q32 6 46 19" />
        <polyline points={pts([[41, 18], [46, 19], [46, 14]])} />
      </Ink>
      <Ink color={DIM} w={2.6}>
        <path d="M46 45Q32 58 18 45" />
        <polyline points={pts([[23, 46], [18, 45], [18, 50]])} />
      </Ink>
    </>
  ),
  wordsearch: () => (
    <>
      {[12, 52].flatMap((y) => [12, 22, 32, 42, 52].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.8} fill={DIM} />))}
      {[22, 42].flatMap((y) => [12, 52].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.8} fill={DIM} />))}
      <rect x={7} y={25} width={50} height={14} rx={7} fill="none" stroke={A} strokeWidth={2.8} />
      {["F", "I", "N", "D"].map((ch, i) => <CGlyph key={i} ch={ch} cx={15.5 + i * 11} cy={32} h={7.5} />)}
    </>
  ),
  wordhunt: () => (
    <>
      {[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].map((c) => <circle key={`${r}${c}`} cx={13 + c * 12.7} cy={13 + r * 12.7} r={4.6} fill="none" stroke={DIM} strokeWidth={2} />))}
      <Ink color={A} w={4}>
        <polyline points={pts([[13, 25.7], [25.7, 38.4], [38.4, 38.4], [51.1, 25.7]])} />
      </Ink>
      {([[13, 25.7], [25.7, 38.4], [38.4, 38.4], [51.1, 25.7]] as Pt[]).map(([x, y], i) => <circle key={i} cx={x} cy={y} r={5} fill={A} />)}
    </>
  ),
  wordfall: () => (
    <>
      <Tile x={12} y={7} s={12} ch="W" />
      <Tile x={36} y={18} s={12} ch="O" />
      <Ink color={DIM} w={2}>
        <polyline points={pts([[18, 22], [18, 25]])} />
        <polyline points={pts([[42, 33], [42, 36]])} />
      </Ink>
      {[0, 1, 2, 3].map((c) => <Tile key={c} x={8 + c * 12.5} y={45} s={11} fill={c === 1 || c === 2 ? A : undefined} ch={["R", "D", "S", "A"][c]} />)}
    </>
  ),
};

const NUMBER: Partial<Record<PuzzleType, Art>> = {
  balance: () => (
    <>
      <Ink>
        <polyline points={pts([[32, 18], [32, 52]])} />
        <polyline points={pts([[22, 53], [42, 53]])} />
        <polyline points={pts([[10, 22], [54, 14]])} />
        <polyline points={pts([[10, 22], [6, 34], [18, 34], [12, 22]])} />
        <polyline points={pts([[52, 14], [46, 26], [58, 26], [54, 14]])} />
      </Ink>
      <rect x={7.5} y={36} width={9} height={8} rx={1.5} fill={A} />
      <rect x={47.5} y={28} width={9} height={6} rx={1.5} fill={A} />
      <circle cx={32} cy={18} r={3} fill={INK} />
    </>
  ),
  trail: () => (
    <>
      {[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].map((c) => <circle key={`${r}${c}`} cx={12 + c * 13.3} cy={12 + r * 13.3} r={1.8} fill={DIM} />))}
      <Ink color={A} w={3.6}>
        <polyline points={pts([[12, 12], [12, 25.3], [25.3, 25.3], [25.3, 12], [51.9, 12], [51.9, 38.6], [38.6, 38.6], [38.6, 51.9], [12, 51.9]])} />
      </Ink>
      <circle cx={12} cy={12} r={5.4} fill={A} />
      <CGlyph ch="1" cx={12} cy={12} h={6} color={BG} w={1.8} />
      <circle cx={12} cy={51.9} r={4} fill={INK} />
    </>
  ),
  numpyramid: () => (
    <>
      <rect x={24} y={9} width={16} height={13} rx={2} fill={A} />
      <CGlyph ch="9" cx={32} cy={15.5} h={7.5} color={BG} w={2.1} />
      <Ink w={2.4}>
        <rect x={16} y={25} width={16} height={13} rx={2} />
        <rect x={32} y={25} width={16} height={13} rx={2} />
        <rect x={8} y={41} width={16} height={13} rx={2} />
        <rect x={24} y={41} width={16} height={13} rx={2} />
        <rect x={40} y={41} width={16} height={13} rx={2} />
      </Ink>
      <CGlyph ch="4" cx={24} cy={31.5} h={7} color={DIM} w={2} />
      <CGlyph ch="5" cx={40} cy={31.5} h={7} color={DIM} w={2} />
      <CGlyph ch="1" cx={16} cy={47.5} h={7} w={2} />
      <CGlyph ch="3" cx={32} cy={47.5} h={7} w={2} />
      <CGlyph ch="2" cx={48} cy={47.5} h={7} w={2} />
    </>
  ),
  equation: () => (
    <>
      <CGlyph ch="3" cx={10} cy={32} h={11} />
      <CGlyph ch="+" cx={20.5} cy={32} h={8} color={DIM} />
      <rect x={26} y={24} width={14} height={16} rx={3} fill={A} />
      <CGlyph ch="?" cx={33} cy={32} h={9} color={BG} w={2.4} />
      <CGlyph ch="=" cx={45} cy={32} h={8} color={DIM} />
      <CGlyph ch="7" cx={54.5} cy={32} h={11} />
    </>
  ),
  tendrop: () => (
    <>
      <rect x={36} y={7} width={20} height={14} rx={3} fill={A} />
      <CGlyph ch="1" cx={42} cy={14} h={8} color={BG} w={2.2} />
      <CGlyph ch="0" cx={50} cy={14} h={8} color={BG} w={2.2} />
      <Tile x={14} y={14} s={13} />
      <CGlyph ch="4" cx={20.5} cy={20.5} h={7} />
      <Ink color={DIM} w={2.2}>
        <polyline points={pts([[20.5, 31], [20.5, 38]])} />
        <polyline points={pts([[17.5, 35], [20.5, 38], [23.5, 35]])} />
      </Ink>
      <Ink w={2.4}>
        <polyline points={pts([[10, 42], [10, 56], [54, 56], [54, 42]])} />
      </Ink>
      <rect x={14} y={45} width={11} height={8} rx={1.5} fill={DIM} />
      <rect x={27} y={45} width={11} height={8} rx={1.5} fill={DIM} />
    </>
  ),
  measure: () => (
    <>
      <path d="M12 34h16v14a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4Z" fill={A} />
      <path d="M38 40h14v10a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3Z" fill={DIM} />
      <Ink>
        <path d="M12 16v32a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4V16" />
        <path d="M38 26v24a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V26" />
      </Ink>
      <Ink color={DIM} w={2}>
        <polyline points={pts([[28, 24], [24, 24]])} />
        <polyline points={pts([[52, 33], [48, 33]])} />
      </Ink>
      <Ink color={A} w={2.6}>
        <path d="M24 11Q34 4 44 16" />
        <polyline points={pts([[39, 16], [44, 16], [44, 11]])} />
      </Ink>
    </>
  ),
  numline: () => (
    <>
      <Ink>
        <polyline points={pts([[8, 40], [56, 40]])} />
      </Ink>
      <Ink color={DIM} w={2.2}>
        {[8, 20, 32, 44, 56].map((x) => <polyline key={x} points={pts([[x, 35], [x, 45]])} />)}
      </Ink>
      <path d="M38 33l-6-9a7 7 0 1 1 12 0Z" fill={A} />
      <circle cx={38} cy={20} r={2.6} fill={BG} />
      <CGlyph ch="0" cx={8} cy={53} h={7} color={DIM} w={2} />
      <CGlyph ch="9" cx={56} cy={53} h={7} color={DIM} w={2} />
    </>
  ),
  checkout: () => (
    <>
      <circle cx={30} cy={34} r={21} fill="none" stroke={INK} strokeWidth={2.6} />
      <circle cx={30} cy={34} r={13} fill="none" stroke={DIM} strokeWidth={2.4} />
      <circle cx={30} cy={34} r={5} fill={A} />
      <Ink color={DIM} w={1.6}>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (Math.PI / 6) * i * 2 + Math.PI / 12;
          return <polyline key={i} points={pts([[30 + 6 * Math.cos(a), 34 + 6 * Math.sin(a)], [30 + 20 * Math.cos(a), 34 + 20 * Math.sin(a)]])} />;
        })}
      </Ink>
      <Ink color={A} w={3}>
        <polyline points={pts([[33, 31], [54, 10]])} />
        <polyline points={pts([[49, 10], [54, 10], [54, 15]])} />
      </Ink>
    </>
  ),
  target: () => (
    <>
      <rect x={18} y={7} width={28} height={15} rx={4} fill={A} />
      <CGlyph ch="2" cx={25} cy={14.5} h={8} color={BG} w={2.2} />
      <CGlyph ch="4" cx={32} cy={14.5} h={8} color={BG} w={2.2} />
      <CGlyph ch="7" cx={39} cy={14.5} h={8} color={BG} w={2.2} />
      {["5", "8", "3", "1", "6", "9"].map((d, i) => {
        const x = 9 + (i % 3) * 16;
        const y = 29 + Math.floor(i / 3) * 14;
        return (
          <g key={i}>
            <rect x={x} y={y} width={14} height={12} rx={2.4} fill="none" stroke={i === 1 || i === 3 ? INK : DIM} strokeWidth={2.2} />
            <CGlyph ch={d} cx={x + 7} cy={y + 6} h={6.4} color={i === 1 || i === 3 ? INK : DIM} w={1.9} />
          </g>
        );
      })}
    </>
  ),
};

const SPEED: Partial<Record<PuzzleType, Art>> = {
  whack: () => (
    <>
      <ellipse cx={30} cy={51} rx={19} ry={5} fill={DIM} />
      <path d="M17 51V40a13 13 0 0 1 26 0v11" fill={BG} stroke={INK} strokeWidth={2.8} />
      <path d="M18 31h24l-4-9H22Z" fill={A} />
      <rect x={15} y={30} width={30} height={3.5} rx={1.75} fill={A} />
      <circle cx={25} cy={40} r={2} fill={INK} />
      <circle cx={35} cy={40} r={2} fill={INK} />
      <g transform="rotate(-30 49 15)">
        <rect x={40} y={8} width={18} height={10} rx={2.5} fill={INK} />
        <Ink w={3}><polyline points={pts([[49, 18], [49, 31]])} /></Ink>
      </g>
    </>
  ),
  clayshoot: () => (
    <>
      <Ink color={DIM} w={2.2}>
        <polyline points={pts([[8, 46], [18, 40]])} />
        <polyline points={pts([[10, 54], [22, 47]])} />
      </Ink>
      <ellipse cx={34} cy={36} rx={10} ry={4.5} fill={A} transform="rotate(-24 34 36)" />
      <Ink w={2.6}>
        <circle cx={34} cy={34} r={14} />
        <polyline points={pts([[34, 13], [34, 21]])} />
        <polyline points={pts([[34, 47], [34, 55]])} />
        <polyline points={pts([[13, 34], [21, 34]])} />
        <polyline points={pts([[47, 34], [55, 34]])} />
      </Ink>
    </>
  ),
  stopwatch: () => (
    <>
      <path d={`M32 35L${32 + 19 * Math.cos(-0.95)} ${35 + 19 * Math.sin(-0.95)}A19 19 0 0 1 ${32 + 19 * Math.cos(-0.25)} ${35 + 19 * Math.sin(-0.25)}Z`} fill={A} />
      <Ink>
        <circle cx={32} cy={35} r={19} />
        <polyline points={pts([[28, 10], [36, 10]])} />
        <polyline points={pts([[32, 10], [32, 16]])} />
        <polyline points={pts([[47, 17], [50, 14]])} />
      </Ink>
      <Ink w={3.2}>
        <polyline points={pts([[32, 35], [32 + 15 * Math.cos(-0.6), 35 + 15 * Math.sin(-0.6)]])} />
      </Ink>
      <circle cx={32} cy={35} r={3} fill={INK} />
    </>
  ),
  chain: () => (
    <>
      <Ink color={DIM} w={3.4}>
        <rect x={6} y={26} width={20} height={12} rx={6} />
      </Ink>
      <Ink color={A} w={3.6}>
        <rect x={22} y={26} width={20} height={12} rx={6} />
      </Ink>
      <Ink w={3.4}>
        <rect x={38} y={26} width={20} height={12} rx={6} />
      </Ink>
      <polygon points={star(32, 14, 6)} fill={A} />
      <circle cx={16} cy={50} r={4} fill={DIM} />
      <circle cx={48} cy={50} r={4} fill={INK} />
    </>
  ),
  numhunt: () => (
    <>
      <circle cx={14} cy={47} r={8} fill={A} />
      <CGlyph ch="1" cx={14} cy={47} h={8} color={BG} w={2.2} />
      <circle cx={32} cy={34} r={8} fill="none" stroke={INK} strokeWidth={2.4} />
      <CGlyph ch="2" cx={32} cy={34} h={8} w={2.2} />
      <circle cx={50} cy={21} r={8} fill="none" stroke={DIM} strokeWidth={2.4} />
      <CGlyph ch="3" cx={50} cy={21} h={8} color={DIM} w={2.2} />
    </>
  ),
  reaction: () => (
    <>
      <rect x={10} y={8} width={44} height={48} rx={8} fill={A} />
      <Ink color={BG} w={2.6}>
        <circle cx={32} cy={34} r={5} />
        <circle cx={32} cy={34} r={11} />
      </Ink>
      <circle cx={32} cy={34} r={14.5} fill="none" stroke={BG} strokeWidth={1.6} strokeDasharray="2.5 3.5" />
    </>
  ),
};

const ATTENTION: Partial<Record<PuzzleType, Art>> = {
  countup: () => (
    <>
      <polygon points={pts([[14, 8], [21, 20], [7, 20]])} fill={A} />
      <circle cx={32} cy={14} r={6} fill="none" stroke={INK} strokeWidth={2.4} />
      <rect x={44} y={8} width={12} height={12} rx={1.5} fill="none" stroke={DIM} strokeWidth={2.4} />
      <polygon points={pts([[46, 24], [53, 36], [39, 36]])} fill={A} />
      <circle cx={18} cy={31} r={5} fill="none" stroke={DIM} strokeWidth={2.4} />
      <Ink>
        {[0, 1, 2, 3].map((i) => <polyline key={i} points={pts([[16 + i * 7, 43], [16 + i * 7, 56]])} />)}
      </Ink>
      <Ink color={A} w={3}>
        <polyline points={pts([[11, 54], [45, 45]])} />
      </Ink>
    </>
  ),
  maze: () => (
    <>
      <Ink w={2.8}>
        <polyline points={pts([[20, 8], [56, 8], [56, 56], [44, 56]])} />
        <polyline points={pts([[8, 8], [8, 56], [32, 56]])} />
        <polyline points={pts([[20, 8], [20, 44]])} />
        <polyline points={pts([[20, 20], [44, 20]])} />
        <polyline points={pts([[32, 20], [32, 44]])} />
        <polyline points={pts([[44, 32], [56, 32]])} />
        <polyline points={pts([[44, 44], [44, 56]])} />
      </Ink>
      <Ink color={A} w={3.2}>
        <polyline points={pts([[14, 3], [14, 50], [38, 50], [38, 38], [50, 38], [50, 61]])} />
      </Ink>
    </>
  ),
  pairmatch: () => (
    <>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const x = 8 + (i % 3) * 17;
        const y = 12 + Math.floor(i / 3) * 21;
        const up = i === 0 || i === 4;
        return (
          <g key={i}>
            <rect x={x} y={y} width={14} height={18} rx={3} fill={up ? "none" : DIM} stroke={up ? INK : DIM} strokeWidth={2.2} />
            {up ? <polygon points={star(x + 7, y + 9.5, 5.4)} fill={A} /> : null}
          </g>
        );
      })}
    </>
  ),
  symscan: () => {
    const bird = (x: number, y: number, s: number) => `M${x - 6 * s} ${y - 2 * s}Q${x - 3 * s} ${y - 4 * s} ${x} ${y}Q${x + 3 * s} ${y - 4 * s} ${x + 6 * s} ${y - 2 * s}`;
    return (
      <>
        <Ink color={DIM} w={2.2}>
          <path d={bird(13, 14, 0.9)} />
          <path d={bird(48, 12, 0.9)} />
          <path d={bird(14, 50, 0.9)} />
        </Ink>
        <Ink color={A} w={3}>
          <path d={bird(30, 32, 1.3)} />
        </Ink>
        <Ink>
          <circle cx={30} cy={30} r={13} />
          <polyline points={pts([[39.5, 39.5], [53, 53]])} />
        </Ink>
      </>
    );
  },
  spotdiff: () => (
    <>
      <rect x={6} y={14} width={24} height={34} rx={3} fill="none" stroke={INK} strokeWidth={2.4} />
      <rect x={34} y={14} width={24} height={34} rx={3} fill="none" stroke={INK} strokeWidth={2.4} />
      <circle cx={18} cy={24} r={4} fill={DIM} />
      <circle cx={46} cy={24} r={4} fill={DIM} />
      <polygon points={pts([[13, 42], [18, 32], [23, 42]])} fill={DIM} />
      <rect x={42} y={34} width={8} height={8} fill={DIM} />
      <circle cx={46} cy={38} r={8.5} fill="none" stroke={A} strokeWidth={2.8} />
    </>
  ),
  stroop: () => (
    <>
      <rect x={14} y={7} width={36} height={14} rx={4} fill="none" stroke={INK} strokeWidth={2.4} />
      <CGlyph ch="R" cx={22} cy={14} h={7.5} color={A} w={2.1} />
      <CGlyph ch="E" cx={32} cy={14} h={7.5} color={A} w={2.1} />
      <CGlyph ch="D" cx={42} cy={14} h={7.5} color={A} w={2.1} />
      <Ink color={DIM} w={2.2}>
        <polyline points={pts([[32, 25], [32, 33]])} />
        <polyline points={pts([[29, 30], [32, 33], [35, 30]])} />
      </Ink>
      <rect x={7} y={42} width={22} height={13} rx={3} fill={DIM} />
      <rect x={35} y={42} width={22} height={13} rx={3} fill={A} />
    </>
  ),
};

const PATTERN: Partial<Record<PuzzleType, Art>> = {
  pipes: () => (
    <>
      <Ink color={DIM} w={6}>
        <polyline points={pts([[36, 22], [50, 22], [50, 50]])} />
        <polyline points={pts([[22, 36], [22, 50], [38, 50]])} />
      </Ink>
      <Ink color={A} w={6}>
        <polyline points={pts([[14, 14], [36, 14], [36, 22]])} />
        <polyline points={pts([[14, 14], [14, 36], [22, 36]])} />
      </Ink>
      <circle cx={14} cy={14} r={7} fill={A} />
      <circle cx={14} cy={14} r={2.6} fill={BG} />
    </>
  ),
  blockparty: () => (
    <>
      <Ink color={DIM} w={2}>
        {[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={12 + c * 10} y={18 + r * 10} width={10} height={10} />))}
      </Ink>
      <path d="M12 18h10v20h10v10H12Z" fill={A} />
      <path d="M32 18h20v10H42v10H32Z" fill="none" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
      <Ink color={INK} w={2.6}>
        <path d="M42 4h10v10H42Z" />
      </Ink>
      <Ink color={DIM} w={2}>
        <polyline points={pts([[40, 10], [34, 14]])} />
      </Ink>
    </>
  ),
  flow: () => (
    <>
      <Ink color={A} w={4}>
        <polyline points={pts([[12, 12], [12, 30], [30, 30]])} />
      </Ink>
      <Ink color={INK} w={4}>
        <polyline points={pts([[30, 12], [52, 12], [52, 52], [40, 52]])} />
      </Ink>
      <Ink color={DIM} w={4}>
        <polyline points={pts([[12, 42], [12, 52], [26, 52], [26, 42], [40, 42]])} />
      </Ink>
      <circle cx={12} cy={12} r={5.5} fill={A} />
      <circle cx={30} cy={30} r={5.5} fill={A} />
      <circle cx={30} cy={12} r={5.5} fill={INK} />
      <circle cx={40} cy={52} r={5.5} fill={INK} />
      <circle cx={12} cy={42} r={5.5} fill={DIM} />
      <circle cx={40} cy={42} r={5.5} fill={DIM} />
    </>
  ),
  laser: () => (
    <>
      <Ink color={A} w={2.8}>
        <polyline points={pts([[6, 46], [22, 46], [22, 18], [48, 18], [48, 42]])} />
      </Ink>
      <Ink w={3.4}>
        <polyline points={pts([[17, 41], [27, 51]])} />
        <polyline points={pts([[17, 23], [27, 13]])} />
        <polyline points={pts([[43, 13], [53, 23]])} />
      </Ink>
      <polygon points={gem(35, 18, 5.5)} fill={A} />
      <polygon points={gem(48, 50, 6)} fill={A} />
      <rect x={4} y={42} width={6} height={8} rx={1.5} fill={INK} />
    </>
  ),
  push: () => (
    <>
      <rect x={10} y={18} width={22} height={22} rx={2} fill="none" stroke={INK} strokeWidth={2.8} />
      <Ink w={2.2}>
        <polyline points={pts([[10, 18], [32, 40]])} />
        <polyline points={pts([[32, 18], [10, 40]])} />
      </Ink>
      <rect x={38} y={18} width={20} height={22} rx={2} fill="none" stroke={A} strokeWidth={2.8} strokeDasharray="4 3" />
      <circle cx={48} cy={29} r={3.5} fill={A} />
      <Ink color={DIM} w={2.4}>
        <polyline points={pts([[12, 50], [30, 50]])} />
        <polyline points={pts([[26, 46], [30, 50], [26, 54]])} />
      </Ink>
    </>
  ),
  tiles: () => (
    <>
      {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={10 + c * 15} y={10 + r * 15} width={13} height={13} rx={2.5} fill={A} opacity={0.25 + 0.75 * ((r + c) / 4)} />))}
      <Ink color={INK} w={2.4}>
        <polyline points={pts([[10, 56], [52, 56]])} />
        <polyline points={pts([[48, 52], [52, 56], [48, 60]])} />
      </Ink>
    </>
  ),
  iceslide: () => (
    <>
      <Ink color={DIM} w={2}>
        <rect x={8} y={8} width={48} height={48} rx={3} />
        <polyline points={pts([[8, 32], [28, 32]])} />
      </Ink>
      <rect x={44} y={40} width={12} height={12} rx={2} fill={A} />
      <Ink w={2.4}>
        <polyline points={pts([[12, 46], [22, 46]])} />
        <polyline points={pts([[14, 52], [26, 52]])} />
      </Ink>
      <circle cx={34} cy={48} r={6.5} fill={INK} />
    </>
  ),
  unblock: () => (
    <>
      <Ink w={2.6}>
        <polyline points={pts([[56, 26], [56, 8], [8, 8], [8, 56], [56, 56], [56, 38]])} />
      </Ink>
      <rect x={12} y={27} width={24} height={10} rx={3} fill={A} />
      <rect x={40} y={12} width={10} height={22} rx={3} fill="none" stroke={DIM} strokeWidth={2.4} />
      <rect x={14} y={42} width={26} height={9} rx={3} fill="none" stroke={DIM} strokeWidth={2.4} />
      <Ink color={A} w={2.2}>
        <polyline points={pts([[52, 32], [62, 32]])} />
        <polyline points={pts([[58, 28], [62, 32], [58, 36]])} />
      </Ink>
    </>
  ),
  gravity: () => (
    <>
      <g transform="rotate(14 32 34)">
        <rect x={12} y={14} width={40} height={40} rx={4} fill="none" stroke={INK} strokeWidth={2.6} />
        <circle cx={22} cy={44} r={5} fill={BG} stroke={DIM} strokeWidth={2.2} />
        <circle cx={42} cy={44} r={5} fill={BG} stroke={A} strokeWidth={2.2} />
        <circle cx={24} cy={24} r={4} fill={DIM} />
        <circle cx={40} cy={26} r={4} fill={A} />
      </g>
      <Ink color={DIM} w={2.2}>
        <path d="M10 10Q20 2 32 5" />
        <polyline points={pts([[28, 2], [32, 5], [28, 8.5]])} />
      </Ink>
    </>
  ),
  rings: () => (
    <>
      <circle cx={32} cy={32} r={22} fill="none" stroke={DIM} strokeWidth={2.6} />
      <circle cx={32} cy={32} r={14} fill="none" stroke={INK} strokeWidth={2.6} />
      <circle cx={32} cy={32} r={6} fill={INK} />
      <Ink color={A} w={3.6}>
        <polyline points={pts([[32, 26], [32, 10]])} />
      </Ink>
      <Ink color={DIM} w={2.6}>
        <polyline points={pts([[37.2, 35], [51, 43]])} />
        <polyline points={pts([[26.8, 35], [13, 43]])} />
      </Ink>
      <circle cx={32} cy={10} r={3.5} fill={A} />
      <circle cx={32} cy={18} r={3.5} fill={A} />
    </>
  ),
};

const LOGIC: Partial<Record<PuzzleType, Art>> = {
  shikaku: () => (
    <>
      <Ink color={DIM} w={1.6}>
        {[1, 2, 3].map((i) => <polyline key={`v${i}`} points={pts([[8 + i * 12, 8], [8 + i * 12, 56]])} />)}
        {[1, 2, 3].map((i) => <polyline key={`h${i}`} points={pts([[8, 8 + i * 12], [56, 8 + i * 12]])} />)}
      </Ink>
      <rect x={8} y={8} width={24} height={24} rx={2} fill={A} opacity={0.3} stroke={A} strokeWidth={2.8} />
      <rect x={32} y={8} width={24} height={12} rx={2} fill="none" stroke={INK} strokeWidth={2.6} />
      <rect x={8} y={32} width={12} height={24} rx={2} fill="none" stroke={INK} strokeWidth={2.6} />
      <CGlyph ch="4" cx={20} cy={20} h={9} />
      <CGlyph ch="2" cx={44} cy={14} h={7} w={2} />
      <CGlyph ch="2" cx={14} cy={44} h={7} w={2} />
    </>
  ),
  bomb: () => (
    <>
      <circle cx={28} cy={38} r={17} fill={INK} />
      <rect x={34} y={18} width={9} height={7} rx={1.5} fill={INK} transform="rotate(40 38.5 21.5)" />
      <Ink color={DIM} w={2.4}>
        <path d="M41 17Q46 9 52 12" />
      </Ink>
      <polygon points={star(53, 11, 6, 0.4)} fill={A} />
      <path d="M17 36a12 12 0 0 1 9-11" fill="none" stroke={BG} strokeWidth={2.4} strokeLinecap="round" opacity={0.35} />
    </>
  ),
  nonogram: () => {
    const on = ["01110", "11011", "11111", "01110", "00100"];
    return (
      <>
        {on.flatMap((row, r) =>
          row.split("").map((v, c) => <rect key={`${r}${c}`} x={18 + c * 8} y={18 + r * 8} width={7} height={7} rx={1} fill={v === "1" ? A : "none"} stroke={v === "1" ? "none" : DIM} strokeWidth={1.2} />),
        )}
        <Ink w={2.4}>
          {[0, 1, 2, 3, 4].map((r) => <polyline key={`r${r}`} points={pts([[8, 21.5 + r * 8], [12, 21.5 + r * 8]])} />)}
          {[0, 1, 2, 3, 4].map((c) => <polyline key={`c${c}`} points={pts([[21.5 + c * 8, 8], [21.5 + c * 8, 12]])} />)}
        </Ink>
      </>
    );
  },
  sudoku: () => (
    <>
      <Ink color={DIM} w={1.4}>
        {[1, 2, 4, 5].map((i) => <polyline key={`v${i}`} points={pts([[8 + i * 8, 8], [8 + i * 8, 56]])} />)}
        {[1, 3, 5].map((i) => <polyline key={`h${i}`} points={pts([[8, 8 + i * 8], [56, 8 + i * 8]])} />)}
      </Ink>
      <Ink w={2.6}>
        <rect x={8} y={8} width={48} height={48} rx={2} />
        <polyline points={pts([[32, 8], [32, 56]])} />
        <polyline points={pts([[8, 24], [56, 24]])} />
        <polyline points={pts([[8, 40], [56, 40]])} />
      </Ink>
      <rect x={32} y={24} width={8} height={8} fill={A} />
      <CGlyph ch="6" cx={36} cy={28} h={5.6} color={BG} w={1.6} />
      <CGlyph ch="3" cx={12} cy={12} h={5.6} w={1.6} />
      <CGlyph ch="1" cx={52} cy={44} h={5.6} w={1.6} />
      <CGlyph ch="5" cx={20} cy={52} h={5.6} w={1.6} />
    </>
  ),
  safe: () => (
    <>
      <rect x={8} y={9} width={48} height={44} rx={5} fill="none" stroke={INK} strokeWidth={2.8} />
      <rect x={13} y={53} width={8} height={4} rx={1} fill={DIM} />
      <rect x={43} y={53} width={8} height={4} rx={1} fill={DIM} />
      <circle cx={30} cy={31} r={12} fill={A} />
      <circle cx={30} cy={31} r={4} fill={BG} />
      <Ink color={BG} w={2}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const a = (Math.PI / 4) * i;
          return <polyline key={i} points={pts([[30 + 8 * Math.cos(a), 31 + 8 * Math.sin(a)], [30 + 11 * Math.cos(a), 31 + 11 * Math.sin(a)]])} />;
        })}
      </Ink>
      <Ink w={3}>
        <polyline points={pts([[49, 22], [49, 40]])} />
      </Ink>
    </>
  ),
  flood: () => {
    const grid = ["AAAD", "AAID", "AIDD", "DDID"];
    return (
      <>
        {grid.flatMap((row, r) =>
          row.split("").map((v, c) => <rect key={`${r}${c}`} x={9 + c * 12} y={9 + r * 12} width={10.5} height={10.5} rx={2} fill={v === "A" ? A : v === "I" ? INK : DIM} />),
        )}
        <path d="M54 44c0 0-5 6-5 9a5 5 0 0 0 10 0c0-3-5-9-5-9Z" fill={A} stroke={BG} strokeWidth={2} />
      </>
    );
  },
  tower: () => (
    <>
      <Ink w={3}>
        <polyline points={pts([[6, 54], [58, 54]])} />
        <polyline points={pts([[14, 54], [14, 20]])} />
        <polyline points={pts([[32, 54], [32, 20]])} />
      </Ink>
      <Ink color={A} w={3}>
        <polyline points={pts([[50, 54], [50, 20]])} />
      </Ink>
      <rect x={4} y={44} width={20} height={7} rx={3.5} fill={INK} />
      <rect x={6.5} y={36} width={15} height={7} rx={3.5} fill={DIM} />
      <rect x={9} y={28} width={10} height={7} rx={3.5} fill={INK} />
      <rect x={44} y={44} width={12} height={7} rx={3.5} fill={A} />
    </>
  ),
  tents: () => (
    <>
      <Ink color={DIM} w={1.6}>
        <rect x={8} y={14} width={48} height={36} rx={2} />
        <polyline points={pts([[32, 14], [32, 50]])} />
      </Ink>
      <circle cx={20} cy={27} r={8} fill={INK} />
      <rect x={18.5} y={33} width={3} height={11} fill={INK} />
      <polygon points={pts([[44, 22], [54, 44], [34, 44]])} fill={A} />
      <polygon points={pts([[44, 32], [48, 44], [40, 44]])} fill={BG} />
    </>
  ),
  lightup: () => (
    <>
      <Ink color={DIM} w={1.6}>
        <rect x={8} y={8} width={48} height={48} rx={2} />
        <polyline points={pts([[24, 8], [24, 56]])} />
        <polyline points={pts([[40, 8], [40, 56]])} />
        <polyline points={pts([[8, 24], [56, 24]])} />
        <polyline points={pts([[8, 40], [56, 40]])} />
      </Ink>
      <rect x={40} y={8} width={16} height={16} fill={DIM} />
      <rect x={8} y={40} width={16} height={16} fill={DIM} />
      <rect x={8} y={24} width={48} height={16} fill={A} opacity={0.22} />
      <rect x={24} y={8} width={16} height={48} fill={A} opacity={0.22} />
      <circle cx={32} cy={30} r={6} fill={A} />
      <rect x={29} y={35.5} width={6} height={4.5} rx={1} fill={INK} />
    </>
  ),
  tubes: () => (
    <>
      {[0, 1, 2].map((i) => {
        const x = 9 + i * 17;
        const layers = [[A, A, A], [INK, DIM, A], [DIM, INK, null]][i]!;
        return (
          <g key={i}>
            {layers.map((c, k) => (c ? <rect key={k} x={x + 2} y={44 - k * 10} width={10} height={10} fill={c} /> : null))}
            <path d={`M${x} 10V48a7 7 0 0 0 14 0V10`} fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
          </g>
        );
      })}
    </>
  ),
  lightsout: () => (
    <>
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2].map((c) => {
          const lit = (r === 0 && c === 1) || (r === 1 && c === 0) || (r === 1 && c === 1) || (r === 2 && c === 2);
          return lit ? (
            <g key={`${r}${c}`}>
              <circle cx={14 + c * 18} cy={14 + r * 18} r={8} fill={A} opacity={0.25} />
              <circle cx={14 + c * 18} cy={14 + r * 18} r={5.5} fill={A} />
            </g>
          ) : (
            <circle key={`${r}${c}`} cx={14 + c * 18} cy={14 + r * 18} r={5.5} fill="none" stroke={DIM} strokeWidth={2.2} />
          );
        }),
      )}
    </>
  ),
  dig: () => (
    <>
      <rect x={8} y={20} width={48} height={36} rx={3} fill={DIM} />
      <path d="M14 20v14h20v14h16v8h6V42H40V28H20v-8Z" fill={BG} />
      <path d="M17 22v15h20v14h16" fill="none" stroke={A} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 6c0 0-5 6-5 9a5 5 0 0 0 10 0c0-3-5-9-5-9Z" fill={A} />
      <Ink w={2.6}>
        <polyline points={pts([[46, 4], [40, 16]])} />
      </Ink>
      <path d="M36 14l8 4-3 5-7-3Z" fill={INK} />
    </>
  ),
};

const ARCADE: Partial<Record<PuzzleType, Art>> = {
  breaker: () => (
    <>
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={7 + c * 13} y={8 + r * 7} width={11.5} height={5.5} rx={1.2} fill={r === 1 && c === 2 ? A : r === 0 ? INK : DIM} />),
      )}
      <circle cx={36} cy={40} r={3.6} fill={INK} />
      <Ink color={DIM} w={1.6}>
        <polyline points={pts([[33, 43], [26, 50]])} />
      </Ink>
      <rect x={16} y={51} width={20} height={5} rx={2.5} fill={A} />
    </>
  ),
  snake: () => (
    <>
      {([[10, 46], [18, 46], [26, 46], [26, 38], [26, 30], [34, 30]] as Pt[]).map(([x, y], i) => (
        <rect key={i} x={x - 3.5} y={y - 3.5} width={7} height={7} rx={1.5} fill={A} opacity={0.45 + i * 0.11} />
      ))}
      <rect x={38.5} y={26.5} width={7} height={7} rx={1.5} fill={A} />
      <polygon points={star(50, 16, 6.5)} fill={INK} />
      <Ink color={DIM} w={1.6}>
        <rect x={6} y={6} width={52} height={52} />
      </Ink>
    </>
  ),
  snip: () => (
    <>
      <circle cx={14} cy={8} r={3} fill={INK} />
      <Ink w={2.2}>
        <polyline points={pts([[14, 8], [22, 18]])} />
        <polyline points={pts([[25, 22], [30, 28]])} />
      </Ink>
      <Ink color={A} w={2}>
        <polyline points={pts([[20, 23], [27, 16]])} />
      </Ink>
      <circle cx={33} cy={32} r={6} fill={A} />
      <Ink color={INK} w={2}>
        <polyline points={pts([[33, 26], [35, 22]])} />
      </Ink>
      <Ink color={DIM} w={2}>
        <polyline points={pts([[37, 41], [40, 45]])} />
      </Ink>
      <path d="M30 46h24l-3 10H33Z" fill="none" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
      <Ink color={DIM} w={1.6}>
        <polyline points={pts([[34, 51], [50, 51]])} />
      </Ink>
    </>
  ),
  wavefront: () => (
    <>
      {[12, 32, 52].map((x, i) => (
        <g key={x}>
          <rect x={x - 6} y={10 + (i % 2) * 4} width={12} height={7} rx={2} fill={i === 1 ? A : DIM} />
          <rect x={x - 6} y={17 + (i % 2) * 4} width={3} height={3} fill={i === 1 ? A : DIM} />
          <rect x={x + 3} y={17 + (i % 2) * 4} width={3} height={3} fill={i === 1 ? A : DIM} />
        </g>
      ))}
      <Ink color={A} w={2.6}>
        <polyline points={pts([[32, 30], [32, 37]])} />
      </Ink>
      <polygon points={pts([[32, 42], [42, 56], [32, 52], [22, 56]])} fill={INK} />
    </>
  ),
  orbit: () => (
    <>
      <circle cx={46} cy={16} r={9} fill={A} />
      <circle cx={16} cy={46} r={7} fill={DIM} />
      <circle cx={16} cy={46} r={13} fill="none" stroke={DIM} strokeWidth={1.8} strokeDasharray="3 3.5" />
      <Ink color={INK} w={2} >
        <path d="M27 40Q34 30 37 23" strokeDasharray="3 3.5" />
      </Ink>
      <g transform="rotate(40 27 40)">
        <path d="M27 33l4 8h-8Z" fill={INK} />
        <rect x={24.5} y={40} width={5} height={3} fill={INK} />
      </g>
    </>
  ),
  hover: () => (
    <>
      <rect x={20} y={6} width={8} height={18} rx={1.5} fill={DIM} />
      <rect x={20} y={38} width={8} height={20} rx={1.5} fill={DIM} />
      <rect x={42} y={6} width={8} height={28} rx={1.5} fill={DIM} />
      <rect x={42} y={48} width={8} height={10} rx={1.5} fill={DIM} />
      <path d="M8 31h14l4 4-4 4H8l-2-4Z" fill={A} />
      <Ink color={INK} w={2}>
        <polyline points={pts([[10, 43], [20, 43]])} />
      </Ink>
      <Ink color={DIM} w={1.6}>
        <path d="M27 35Q36 35 46 41" strokeDasharray="2.5 3" />
      </Ink>
    </>
  ),
  cross: () => (
    <>
      <rect x={4} y={18} width={56} height={28} fill={DIM} opacity={0.35} />
      <Ink color={INK} w={2}>
        <polyline points={pts([[6, 32], [14, 32]])} />
        <polyline points={pts([[24, 32], [32, 32]])} />
        <polyline points={pts([[42, 32], [50, 32]])} />
      </Ink>
      <rect x={36} y={21} width={18} height={9} rx={2.5} fill={A} />
      <rect x={10} y={35} width={14} height={8} rx={2.5} fill={INK} />
      <Figure x={33} y={60} s={0.62} pose="run" />
    </>
  ),
  bullseye: () => (
    <>
      <circle cx={46} cy={30} r={12} fill="none" stroke={INK} strokeWidth={2.6} />
      <circle cx={46} cy={30} r={6} fill="none" stroke={DIM} strokeWidth={2.4} />
      <circle cx={46} cy={30} r={2.6} fill={A} />
      <Ink color={DIM} w={1.8}>
        <path d="M8 52Q20 18 42 28" strokeDasharray="3 3.5" />
      </Ink>
      <Ink color={A} w={2.8}>
        <polyline points={pts([[34, 26], [44, 29]])} />
        <polyline points={pts([[33, 22], [36, 26.5], [32, 30]])} />
      </Ink>
    </>
  ),
  pinball: () => (
    <>
      <Ink color={DIM} w={2.4}>
        <polyline points={pts([[8, 8], [8, 40], [20, 50]])} />
        <polyline points={pts([[56, 8], [56, 40], [44, 50]])} />
      </Ink>
      <Ink w={5}>
        <polyline points={pts([[20, 50], [29, 54]])} />
        <polyline points={pts([[44, 50], [35, 54]])} />
      </Ink>
      <circle cx={32} cy={16} r={6} fill="none" stroke={INK} strokeWidth={2.4} />
      <circle cx={20} cy={24} r={3.5} fill={DIM} />
      <circle cx={44} cy={24} r={3.5} fill={DIM} />
      <circle cx={34} cy={38} r={4.6} fill={A} />
    </>
  ),
  // Cards & Board (30 Oct 2026): line drawings behind the tile scenes.
  minesweeper: () => (
    <>
      <rect x={8} y={8} width={48} height={48} rx={3} fill="none" stroke={DIM} strokeWidth={2} />
      <Ink color={DIM} w={1.6}>
        <polyline points={pts([[24, 8], [24, 56]])} />
        <polyline points={pts([[40, 8], [40, 56]])} />
        <polyline points={pts([[8, 24], [56, 24]])} />
        <polyline points={pts([[8, 40], [56, 40]])} />
      </Ink>
      <Ink w={2.6}>
        <polyline points={pts([[29, 44], [29, 52]])} />
        <polyline points={pts([[13, 34], [19, 30]])} />
      </Ink>
      <polygon points={pts([[44, 28], [52, 31.5], [44, 35]])} fill={A} />
      <polyline points={pts([[44, 28], [44, 38]])} fill="none" stroke={INK} strokeWidth={2} />
      <circle cx={16} cy={16} r={4} fill={INK} />
    </>
  ),
  mahjong: () => (
    <>
      <rect x={10} y={16} width={22} height={30} rx={3} fill="none" stroke={DIM} strokeWidth={2.4} />
      <rect x={32} y={16} width={22} height={30} rx={3} fill="none" stroke={DIM} strokeWidth={2.4} />
      <rect x={20} y={10} width={22} height={30} rx={3} fill={BG} stroke={A} strokeWidth={2.8} />
      <circle cx={31} cy={20} r={3.4} fill="none" stroke={INK} strokeWidth={2} />
      <circle cx={31} cy={30} r={3.4} fill="none" stroke={INK} strokeWidth={2} />
      <Ink color={DIM} w={2}>
        <polyline points={pts([[14, 52], [50, 52]])} />
      </Ink>
    </>
  ),
  rally: () => (
    <>
      <rect x={22} y={7} width={20} height={5} rx={2.5} fill={DIM} />
      <rect x={18} y={52} width={20} height={5} rx={2.5} fill={A} />
      <Ink color={DIM} w={1.8}>
        <polyline points={pts([[30, 50], [48, 32], [36, 14]])} strokeDasharray="3 3.5" />
        <polyline points={pts([[6, 32], [12, 32]])} />
        <polyline points={pts([[52, 32], [58, 32]])} />
      </Ink>
      <circle cx={46} cy={30} r={4.4} fill={INK} />
    </>
  ),
  matchup: () => (
    <>
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2].map((c) => {
          const hit = r === 1;
          const shape = (r * 2 + c) % 3;
          const cx = 14 + c * 18;
          const cy = 14 + r * 18;
          return shape === 0 || hit ? (
            <polygon key={`${r}${c}`} points={gem(cx, cy, 7)} fill={hit ? A : INK} />
          ) : shape === 1 ? (
            <circle key={`${r}${c}`} cx={cx} cy={cy} r={6} fill={DIM} />
          ) : (
            <rect key={`${r}${c}`} x={cx - 5.5} y={cy - 5.5} width={11} height={11} rx={2} fill="none" stroke={INK} strokeWidth={2.2} />
          );
        }),
      )}
    </>
  ),
  bubble: () => (
    <>
      {[0, 1, 2, 3, 4].map((c) => <circle key={`a${c}`} cx={12 + c * 10} cy={11} r={4.6} fill={c >= 1 && c <= 3 ? A : DIM} />)}
      {[0, 1, 2, 3].map((c) => <circle key={`b${c}`} cx={17 + c * 10} cy={20} r={4.6} fill={c === 0 ? INK : DIM} />)}
      <circle cx={32} cy={52} r={4.6} fill={A} />
      <Ink color={INK} w={2}>
        <polyline points={pts([[32, 46], [38, 34]])} strokeDasharray="2.5 3" />
      </Ink>
      <Ink color={DIM} w={2.4}>
        <path d="M22 58a10 10 0 0 1 20 0" />
      </Ink>
    </>
  ),
  tilt: () => (
    <>
      <g transform="rotate(-10 32 34)">
        <rect x={8} y={14} width={48} height={40} rx={4} fill="none" stroke={INK} strokeWidth={2.6} />
        <circle cx={44} cy={42} r={6.5} fill={BG} stroke={A} strokeWidth={2.6} />
        <circle cx={20} cy={26} r={4.5} fill={A} />
        <Ink color={DIM} w={1.8}>
          <path d="M24 29Q34 34 39 39" strokeDasharray="2.5 3" />
        </Ink>
      </g>
    </>
  ),
  inkbridge: () => (
    <>
      <Ink color={A} w={3.2}>
        <path d="M8 40Q30 10 50 38" />
      </Ink>
      <Ink color={DIM} w={2.4}>
        <path d="M11 44Q30 18 47 42" />
      </Ink>
      <circle cx={14} cy={30} r={5} fill={INK} />
      <path d="M44 46h14l-2 10H46Z" fill={INK} />
      <rect x={42} y={43} width={18} height={4} rx={2} fill={INK} />
    </>
  ),
  flip: () => (
    <>
      <rect x={4} y={6} width={56} height={5} fill={DIM} />
      <rect x={4} y={53} width={56} height={5} fill={DIM} />
      <Figure x={20} y={53} s={0.75} />
      <Figure x={44} y={11} s={0.75} flipY />
      <Ink color={A} w={2}>
        <path d="M28 44Q36 32 38 22" strokeDasharray="2.5 3" />
        <polyline points={pts([[34, 24], [38, 21], [40, 26]])} />
      </Ink>
    </>
  ),
  slice: () => (
    <>
      <path d="M12 38a13 13 0 0 1 22-9Z" fill={A} />
      <path d="M22 44a13 13 0 0 0 19-14Z" fill={A} opacity={0.75} />
      <path d="M46 12c4 2 6 7 4 13-1 3-4 4-6 2" fill={DIM} />
      <rect x={47} y={8} width={3} height={4} rx={1} fill={INK} />
      <Ink w={3.4}>
        <path d="M6 52Q30 34 58 20" />
      </Ink>
    </>
  ),
  burst: () => (
    <>
      <circle cx={32} cy={22} r={5} fill={A} />
      <Ink color={INK} w={1.8}>
        <ellipse cx={32} cy={22} rx={14} ry={6} />
        <ellipse cx={32} cy={22} rx={14} ry={6} transform="rotate(60 32 22)" />
        <ellipse cx={32} cy={22} rx={14} ry={6} transform="rotate(-60 32 22)" />
      </Ink>
      <Ink color={A} w={2.4}>
        <polyline points={pts([[32, 46], [32, 37]])} />
      </Ink>
      <path d="M24 56l8-10 8 10Z" fill={INK} />
    </>
  ),
  skyline: () => (
    <>
      <Ink color={DIM} w={2}>
        <polyline points={pts([[38, 4], [38, 10]])} />
      </Ink>
      <rect x={30} y={10} width={18} height={9} rx={1.5} fill={A} />
      <rect x={18} y={26} width={24} height={9} rx={1.5} fill={INK} />
      <rect x={16} y={36} width={26} height={9} rx={1.5} fill={DIM} />
      <rect x={14} y={46} width={30} height={9} rx={1.5} fill={INK} />
      <Ink color={DIM} w={2}>
        <polyline points={pts([[8, 57], [56, 57]])} />
      </Ink>
    </>
  ),
  balltrack: () => (
    <>
      <Ink color={INK} w={3}>
        <polyline points={pts([[32, 8], [32, 26]])} />
        <polyline points={pts([[32, 26], [16, 42]])} />
      </Ink>
      <Ink color={DIM} w={3}>
        <polyline points={pts([[32, 26], [48, 42]])} />
      </Ink>
      <circle cx={32} cy={14} r={5} fill={A} />
      <path d="M8 46h16l-3 10H11Z" fill={A} />
      <path d="M40 46h16l-3 10H43Z" fill={DIM} />
    </>
  ),
  swing: () => (
    <>
      <circle cx={34} cy={8} r={3.6} fill={A} />
      <Ink color={INK} w={2.2}>
        <polyline points={pts([[34, 8], [22, 34]])} />
      </Ink>
      <Ink color={DIM} w={1.8}>
        <path d="M10 26Q22 50 46 30" strokeDasharray="2.5 3" />
      </Ink>
      <Figure x={20} y={56} s={0.95} pose="reach" />
    </>
  ),
  beat: () => (
    <>
      <Ink color={DIM} w={1.6}>
        <polyline points={pts([[16, 6], [16, 58]])} />
        <polyline points={pts([[32, 6], [32, 58]])} />
        <polyline points={pts([[48, 6], [48, 58]])} />
      </Ink>
      <rect x={6} y={44} width={52} height={4} rx={2} fill={INK} />
      <circle cx={32} cy={46} r={6.5} fill={A} />
      <circle cx={16} cy={20} r={5} fill={DIM} />
      <circle cx={48} cy={28} r={5} fill={INK} />
      <Ink w={2.2}>
        <polyline points={pts([[52.5, 28], [52.5, 12], [56, 15]])} />
      </Ink>
    </>
  ),
  bintoss: () => (
    <>
      <Ink color={DIM} w={1.8}>
        <path d="M12 50Q24 4 44 32" strokeDasharray="3 3.5" />
      </Ink>
      <circle cx={12} cy={50} r={5} fill={INK} />
      <circle cx={44} cy={30} r={4.6} fill={A} />
      <path d="M34 38h20l-3 18H37Z" fill="none" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
      <Ink color={DIM} w={1.6}>
        <polyline points={pts([[37, 46], [51, 46]])} />
      </Ink>
    </>
  ),
  ricochet: () => (
    <>
      <rect x={6} y={4} width={6} height={56} fill={DIM} />
      <rect x={52} y={4} width={6} height={56} fill={DIM} />
      <Ink color={A} w={2}>
        <polyline points={pts([[14, 56], [50, 40], [14, 26]])} strokeDasharray="2.5 3" />
      </Ink>
      <Figure x={40} y={22} s={0.62} dir={-1} />
    </>
  ),
  swerve: () => (
    <>
      <Ink color={DIM} w={1.6}>
        <polyline points={pts([[22, 4], [22, 60]])} strokeDasharray="4 4" />
        <polyline points={pts([[42, 4], [42, 60]])} strokeDasharray="4 4" />
      </Ink>
      <rect x={8} y={14} width={12} height={10} rx={2} fill={DIM} />
      <rect x={44} y={26} width={12} height={10} rx={2} fill={DIM} />
      <circle cx={32} cy={16} r={4.6} fill={A} />
      <path d="M27 54V44l5-6 5 6v10Z" fill={INK} />
    </>
  ),
  bastion: () => (
    <>
      <path d="M16 56V28h6v-6h6v6h8v-6h6v6h6v28Z" fill={INK} />
      <path d="M28 56v-9a4 4 0 0 1 8 0v9Z" fill={BG} />
      <Ink color={A} w={2.6}>
        <polyline points={pts([[6, 10], [14, 18]])} />
        <polyline points={pts([[58, 12], [50, 20]])} />
      </Ink>
      <polygon points={pts([[16, 20], [10, 18], [14, 14]])} fill={A} />
      <polygon points={pts([[48, 22], [54, 20], [50, 16]])} fill={A} />
    </>
  ),
  dual: () => (
    <>
      <Ink color={DIM} w={2}>
        <polyline points={pts([[32, 4], [32, 60]])} />
        <polyline points={pts([[4, 54], [28, 54]])} />
        <polyline points={pts([[36, 54], [60, 54]])} />
      </Ink>
      <Figure x={16} y={54} s={0.7} />
      <Figure x={48} y={54} s={0.7} />
      <rect x={20} y={12} width={6} height={10} rx={1.5} fill={DIM} />
      <rect x={42} y={18} width={6} height={10} rx={1.5} fill={DIM} />
    </>
  ),
  junction: () => (
    <>
      <rect x={24} y={4} width={16} height={56} fill={DIM} opacity={0.35} />
      <rect x={4} y={24} width={56} height={16} fill={DIM} opacity={0.35} />
      <rect x={27} y={8} width={10} height={14} rx={2.5} fill={INK} />
      <rect x={42} y={27} width={14} height={10} rx={2.5} fill={A} />
      <circle cx={14} cy={14} r={4} fill={A} />
      <Ink color={INK} w={1.6}>
        <polyline points={pts([[14, 18], [14, 22]])} />
      </Ink>
    </>
  ),
  hotfloor: () => (
    <>
      {[0, 1, 2, 3].flatMap((r) =>
        [0, 1, 2, 3].map((c) => {
          const gone = (r + c * 3) % 4 === 0;
          return <rect key={`${r}${c}`} x={9 + c * 12} y={9 + r * 12} width={10} height={10} rx={1.6} fill={gone ? "none" : DIM} stroke={gone ? DIM : "none"} strokeWidth={1.2} strokeDasharray="2 2" />;
        }),
      )}
      <rect x={45} y={45} width={10} height={10} rx={1.6} fill={A} />
      <Ink color={INK} w={2.6}>
        <polyline points={pts([[14, 26], [26, 26], [26, 38], [38, 38], [38, 50], [45, 50]])} />
      </Ink>
    </>
  ),
  steady: () => (
    <>
      <Ink color={DIM} w={10}>
        <path d="M6 44Q20 14 32 32T58 20" />
      </Ink>
      <Ink color={BG} w={5}>
        <path d="M6 44Q20 14 32 32T58 20" />
      </Ink>
      <circle cx={32} cy={32} r={4} fill={A} />
    </>
  ),
  rooftop: () => (
    <>
      <rect x={4} y={40} width={22} height={20} fill={DIM} />
      <rect x={36} y={32} width={24} height={28} fill={DIM} />
      <rect x={40} y={38} width={5} height={5} fill={BG} />
      <rect x={50} y={38} width={5} height={5} fill={BG} />
      <Ink color={A} w={2}>
        <path d="M18 34Q28 14 40 26" strokeDasharray="2.5 3" />
      </Ink>
      <Figure x={16} y={40} s={0.62} />
    </>
  ),
};

/** Every game's concept drawing (src/lib/duel/gameNames.ts holds the full list of ids). */
export const CONCEPT_ICONS: Record<PuzzleType, Art> = {
  ...WORD,
  ...NUMBER,
  ...SPEED,
  ...ATTENTION,
  ...PATTERN,
  ...LOGIC,
  ...ARCADE,
} as Record<PuzzleType, Art>;

/** A game's concept drawing as one SVG (decorative: its name is always beside it). */
export function ConceptIcon({ type }: { type: PuzzleType }) {
  const art = CONCEPT_ICONS[type];
  if (!art) return null;
  return (
    <svg viewBox="0 0 64 64" className="game-icon-art" aria-hidden="true" data-concept-icon={type}>
      {art()}
    </svg>
  );
}
