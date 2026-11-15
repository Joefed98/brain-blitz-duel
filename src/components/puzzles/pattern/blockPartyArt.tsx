/**
 * Tessellate (blockparty) art, pattern polish 13 Oct 2026; the Pattern overhaul's look A (15 Nov 2026): Blender
 * sprites (public/pattern-art/blockparty/, docs/design/game-art/pattern/source/blockparty.py), one image per board
 * cell: brass studs for the pegs, satin recesses for the free squares and a glossy lacquered block per piece square.
 * Presentation only: every image is exactly its cell's box, so what you see is what the drop counts. Stage 2 (the
 * effects): the drop's flash on the covered squares and the completion shine across the board; the pieces' own
 * movement (pick-up, drop, a refused move) goes through the effects kit (src/lib/fx/kit.ts) in BlockPartyPuzzle.
 */
import { createContext, memo, useContext, useId, useMemo } from "react";

import { BLOCK_COLS as N, type BlockPlacement } from "@/lib/duel/types";

const U = 100; // one cell in art units
const GAP = 5; // inset from the cell edge
const RADIUS = 11;

interface ArtIds {
  rim: string;
  face: string;
  shine: string;
}
const IdsContext = createContext<ArtIds | null>(null);

const cleanId = (raw: string) => `bp${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;

type Pt = [number, number];

/**
 * The outline of a set of [row, col] cells, shrunk inward by `inset` and with
 * rounded corners, as an SVG path in art units.
 */
export function pieceOutline(cells: Pt[], inset: number, radius = RADIUS): string {
  const has = new Set(cells.map(([r, c]) => `${r},${c}`));
  const edges = new Map<string, Pt>();
  const add = (from: Pt, to: Pt) => edges.set(`${from[0]},${from[1]}`, to);
  // Clockwise on screen (interior on the right of each edge), in [x, y] cell units.
  for (const [r, c] of cells) {
    if (!has.has(`${r - 1},${c}`)) add([c, r], [c + 1, r]);
    if (!has.has(`${r},${c + 1}`)) add([c + 1, r], [c + 1, r + 1]);
    if (!has.has(`${r + 1},${c}`)) add([c + 1, r + 1], [c, r + 1]);
    if (!has.has(`${r},${c - 1}`)) add([c, r + 1], [c, r]);
  }
  const first = edges.keys().next().value;
  if (!first) return "";
  const loop: Pt[] = [];
  let key: string = first;
  for (let guard = 0; guard < 64; guard++) {
    const [x, y] = key.split(",").map(Number) as Pt;
    loop.push([x, y]);
    const next = edges.get(key);
    if (!next) break;
    key = `${next[0]},${next[1]}`;
    if (key === first) break;
  }
  // Keep only the corners (where the direction turns).
  const corners = loop.filter((p, i) => {
    const a = loop[(i - 1 + loop.length) % loop.length]!;
    const b = loop[(i + 1) % loop.length]!;
    return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
  });
  const unit = (from: Pt, to: Pt): Pt => {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
    return [(to[0] - from[0]) / len, (to[1] - from[1]) / len];
  };
  // Offset each corner by the inward normals of its two edges.
  const shrunk = corners.map((p, i) => {
    const a = corners[(i - 1 + corners.length) % corners.length]!;
    const b = corners[(i + 1) % corners.length]!;
    const d1 = unit(a, p);
    const d2 = unit(p, b);
    return [p[0] * U + inset * (-d1[1] - d2[1]), p[1] * U + inset * (d1[0] + d2[0])] as Pt;
  });
  let d = "";
  shrunk.forEach((p, i) => {
    const a = shrunk[(i - 1 + shrunk.length) % shrunk.length]!;
    const b = shrunk[(i + 1) % shrunk.length]!;
    const toA = unit(p, a);
    const toB = unit(p, b);
    const start: Pt = [p[0] + toA[0] * radius, p[1] + toA[1] * radius];
    const end: Pt = [p[0] + toB[0] * radius, p[1] + toB[1] * radius];
    d += `${i === 0 ? "M" : "L"}${start[0].toFixed(1)} ${start[1].toFixed(1)}Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${end[0].toFixed(1)} ${end[1].toFixed(1)}`;
  });
  return `${d}Z`;
}

/** Shared gradients for one board or tray; ids are unique per render. */
export function BlockArtDefs({ children }: { children: React.ReactNode }) {
  const base = cleanId(useId());
  const ids = useMemo(() => ({ rim: `${base}-rim`, face: `${base}-face`, shine: `${base}-shine` }), [base]);
  return (
    <IdsContext.Provider value={ids}>
      <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={ids.rim} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" className="bp-rim-top" />
            <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.55" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.5" className="bp-rim-bottom" />
          </linearGradient>
          <linearGradient id={ids.face} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.2" className="bp-face-top" />
            <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.16" className="bp-face-bottom" />
          </linearGradient>
          <radialGradient id={ids.shine} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
            <stop offset="0.5" stopColor="var(--primary)" stopOpacity="0.55" />
            <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
      {children}
    </IdsContext.Provider>
  );
}

/** The Blender sprites (docs/design/game-art/pattern/source/blockparty.py): one image per board cell. */
export const BLOCK_ART_DIR = "/pattern-art/blockparty";
/** Each piece's sprite colour, index for index today's piece colours (BlockPartyPuzzle PIECE_COLOURS). */
export const BLOCK_SPRITE_COLOURS = ["red", "blue", "green", "purple", "pink", "orange", "brown", "yellow", "white"] as const;
export const blockSprite = (piece: number) =>
  `${BLOCK_ART_DIR}/block-${BLOCK_SPRITE_COLOURS[piece] ?? BLOCK_SPRITE_COLOURS[BLOCK_SPRITE_COLOURS.length - 1]}.webp`;
/**
 * The tray's own render of the same lacquered block (stage 2, Joe: the tray read flatter than the board): a rounder,
 * deeper bevel so the gloss and its highlight still read at the tray's third-size cells.
 */
export const trayBlockSprite = (piece: number) =>
  `${BLOCK_ART_DIR}/tray-${BLOCK_SPRITE_COLOURS[piece] ?? BLOCK_SPRITE_COLOURS[BLOCK_SPRITE_COLOURS.length - 1]}.webp`;
export const BLOCK_WELL_SPRITE = `${BLOCK_ART_DIR}/well.webp`;
export const BLOCK_PEG_SPRITE = `${BLOCK_ART_DIR}/peg.webp`;

/**
 * One piece (the Pattern overhaul, 15 Nov 2026; look A): a glossy lacquered block in each of its squares, drawn
 * exactly inside that square's box (the sprite is the cell; its block and shadow sit within it).
 */
export const PieceArt = memo(function PieceArt({
  cells,
  piece,
  tray,
}: {
  cells: Pt[];
  /** The piece's index (its colour). */
  piece: number;
  /** Drawn in the tray: the tray's render of the same block (stage 2). */
  tray?: boolean | undefined;
}) {
  const href = tray ? trayBlockSprite(piece) : blockSprite(piece);
  return (
    <>
      {cells.map(([r, c]) => (
        <image key={`${r},${c}`} className="bp-block" href={href} x={c * U} y={r * U} width={U} height={U} preserveAspectRatio="none" />
      ))}
    </>
  );
});

/** The board's width in cells: 6, or 7 on blockRev 1 (depth batch 4); BlockBoard provides it. */
export const BlockColsContext = createContext(N);

/** Cells of a placement as [row, col]. */
const rowCol = (cell: number, n: number = N): Pt => [Math.floor(cell / n), cell % n];

/** The static pegboard (look A): the dark slab, a satin recess in every square and a brass stud on each peg. */
export const BlockBoardArt = memo(function BlockBoardArt({ blockers }: { blockers: number[] }) {
  const n = useContext(BlockColsContext);
  const pegs = new Set(blockers);
  const S = n * U;
  return (
    <svg className="bp-board-art" viewBox={`0 0 ${S} ${S}`} aria-hidden="true">
      <rect className="bp-slab" x="0" y="0" width={S} height={S} rx="22" />
      {Array.from({ length: n * n }, (_, cell) => {
        const [r, c] = rowCol(cell, n);
        return (
          <image
            key={cell}
            className={pegs.has(cell) ? "bp-peg" : "bp-well"}
            href={pegs.has(cell) ? BLOCK_PEG_SPRITE : BLOCK_WELL_SPRITE}
            x={c * U}
            y={r * U}
            width={U}
            height={U}
            preserveAspectRatio="none"
          />
        );
      })}
    </svg>
  );
});

/** Placed pieces on the board, with the lock-tight pulse on each piece when the board is solved. */
export function BlockPiecesArt({
  placements,
  colourFor,
  wave,
}: {
  placements: BlockPlacement[];
  colourFor: (piece: number) => string;
  /** Completion: delay (ms) per piece for the lock-tight pulse, timed to the shine passing over it. */
  wave?: Map<number, number> | null | undefined;
}) {
  const n = useContext(BlockColsContext);
  return (
    <svg className="bp-pieces-art" viewBox={`0 0 ${n * U} ${n * U}`} aria-hidden="true">
      {placements.map((placement) => (
        <PlacedPiece
          key={`${placement.piece}:${placement.cells.join("-")}`}
          placement={placement}
          colour={colourFor(placement.piece)}
          delay={wave?.get(placement.piece)}
        />
      ))}
    </svg>
  );
}

function PlacedPiece({
  placement,
  delay,
}: {
  placement: BlockPlacement;
  /** The piece's colour (the sprite carries it; kept for callers). */
  colour?: string | undefined;
  delay?: number | undefined;
}) {
  const n = useContext(BlockColsContext);
  const cells = useMemo(() => placement.cells.map((cell) => rowCol(cell, n)), [placement.cells, n]);
  // The outer group is the piece's own element for the effects kit (pick-up, drop, a refused move: stage 2); the
  // inner one carries the completion pulse, so the two never fight over one transform.
  return (
    <g className="bp-piece" data-bp-piece={placement.piece}>
      <g
        className={delay !== undefined ? "bp-piece-lock" : undefined}
        style={delay !== undefined ? { animationDelay: `${delay}ms` } : undefined}
      >
        <PieceArt cells={cells} piece={placement.piece} />
      </g>
    </g>
  );
}

/**
 * The drop's flash (stage 2): the squares the piece just covered light once, as one shape inside the piece's outline,
 * so it sits on the piece itself and nowhere else. Opacity only; keyed by the drop, so each drop flashes once.
 */
export function BlockDropFlash({ cells }: { cells: number[] }) {
  const n = useContext(BlockColsContext);
  const outline = useMemo(() => pieceOutline(cells.map((cell) => rowCol(cell, n)), GAP), [cells, n]);
  return (
    <svg className="bp-drop-flash" viewBox={`0 0 ${n * U} ${n * U}`} aria-hidden="true" data-bp-flash={cells.join(",")}>
      <path d={outline} />
    </svg>
  );
}

/** How long the completion shine takes to cross the board (ms): quick, since practice can open its reveal within a
 * quarter of a second of the solving drop (the stage locks in 200 ms after it; the shine never delays that). */
export const SWEEP_MS = 480;
/** The shine's start after the solve moment (ms). */
export const SWEEP_DELAY_MS = 0;

/** When the shine passes a piece: its leftmost column's share of the crossing, so the pulse rides the light. */
export function sweepDelay(cells: readonly number[], n: number = N): number {
  const left = Math.min(...cells.map((cell) => cell % n));
  return Math.round(SWEEP_DELAY_MS + (left / n) * SWEEP_MS * 0.8);
}

/**
 * The completion shine (stage 2, Joe's spec: "last gap filled: a shine across the board"): one soft diagonal band
 * of light sweeping left to right across the board, clipped to it. Transform and opacity only; drawn only for the
 * solve moment (useSolveMoment), when the stage has stopped taking moves.
 */
export function BlockSweepFx({ blockers }: { blockers: number[] }) {
  const n = useContext(BlockColsContext);
  const step = 100 / n;
  return (
    <div className="bp-sweep" aria-hidden="true" data-bp-sweep="">
      <span className="bp-sweep-band" />
      {/* Each stud glints as the light reaches it (its column's share of the crossing, as the pieces' pulse). */}
      {blockers.map((peg) => (
        <span
          key={peg}
          className="bp-peg-glint"
          data-bp-glint={peg}
          style={{
            left: `${(peg % n) * step + step * 0.2}%`,
            top: `${Math.floor(peg / n) * step + step * 0.2}%`,
            width: `${step * 0.6}%`,
            height: `${step * 0.6}%`,
            animationDelay: `${sweepDelay([peg], n)}ms`,
          }}
        />
      ))}
    </div>
  );
}
