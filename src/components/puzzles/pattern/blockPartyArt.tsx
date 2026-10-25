/**
 * Tessellate (blockparty) art, pattern polish 13 Oct 2026. Presentation only:
 * the pegboard, the bevelled pieces, the placement snap and the completion
 * shine. Every piece is drawn inside its own cells (a small inset), and the
 * board's cell boxes are unchanged, so what you see is what the drop counts.
 */
import { createContext, memo, useContext, useId, useMemo } from "react";

import { BLOCK_COLS as N, type BlockPlacement } from "@/lib/duel/types";

const U = 100; // one cell in art units
const GAP = 5; // inset from the cell edge
const BEVEL = 9; // rim width
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

/** One bevelled piece: a lit rim, a raised face and faint seams between its squares. */
export const PieceArt = memo(function PieceArt({
  cells,
  colour,
}: {
  cells: Pt[];
  colour: string;
}) {
  const ids = useContext(IdsContext);
  const outer = useMemo(() => pieceOutline(cells, GAP), [cells]);
  const face = useMemo(() => pieceOutline(cells, GAP + BEVEL, RADIUS - 3), [cells]);
  const seams = useMemo(() => {
    const has = new Set(cells.map(([r, c]) => `${r},${c}`));
    const out: string[] = [];
    for (const [r, c] of cells) {
      if (has.has(`${r},${c + 1}`)) out.push(`M${(c + 1) * U} ${r * U + GAP + BEVEL + 4}V${(r + 1) * U - GAP - BEVEL - 4}`);
      if (has.has(`${r + 1},${c}`)) out.push(`M${c * U + GAP + BEVEL + 4} ${(r + 1) * U}H${(c + 1) * U - GAP - BEVEL - 4}`);
    }
    return out.join("");
  }, [cells]);
  return (
    <>
      <path d={outer} fill="#000" opacity="0.4" transform="translate(2 5)" className="bp-drop" />
      <path d={outer} style={{ fill: colour }} />
      {ids && <path d={outer} fill={`url(#${ids.rim})`} />}
      <path d={face} style={{ fill: colour }} />
      {ids && <path d={face} fill={`url(#${ids.face})`} />}
      <path d={face} fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="2" />
      {seams && <path d={seams} stroke="#000" strokeOpacity="0.2" strokeWidth="3" strokeLinecap="round" />}
    </>
  );
});

/** Cells of a placement as [row, col]. */
const rowCol = (cell: number): Pt => [Math.floor(cell / N), cell % N];

/** The static pegboard: slab, recessed wells and brass pegs. */
export const BlockBoardArt = memo(function BlockBoardArt({ blockers }: { blockers: number[] }) {
  const base = cleanId(useId());
  const pegs = new Set(blockers);
  const S = N * U;
  return (
    <svg className="bp-board-art" viewBox={`0 0 ${S} ${S}`} aria-hidden="true">
      <defs>
        <linearGradient id={`${base}-slab`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#2b2d3a" />
          <stop offset="1" stopColor="#181921" />
        </linearGradient>
        <linearGradient id={`${base}-well`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.55" />
          <stop offset="0.3" stopColor="#000" stopOpacity="0.1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.06" />
        </linearGradient>
        <radialGradient id={`${base}-brass`} cx="0.36" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#fff2c4" />
          <stop offset="0.35" stopColor="var(--primary)" />
          <stop offset="1" stopColor="#7a510c" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width={S} height={S} rx="22" fill={`url(#${base}-slab)`} />
      <rect x="1.5" y="1.5" width={S - 3} height={S - 3} rx="21" fill="none" stroke="#fff" strokeOpacity="0.07" strokeWidth="3" />
      {Array.from({ length: N * N }, (_, cell) => {
        const [r, c] = rowCol(cell);
        const x = c * U;
        const y = r * U;
        return (
          <g key={cell}>
            <rect x={x + 6} y={y + 6} width={U - 12} height={U - 12} rx="13" fill={pegs.has(cell) ? "#14151b" : "#111219"} />
            <rect x={x + 6} y={y + 6} width={U - 12} height={U - 12} rx="13" fill={`url(#${base}-well)`} />
            {pegs.has(cell) && (
              <>
                <circle cx={x + 50} cy={y + 50} r="31" fill="#2a2416" stroke="#000" strokeOpacity="0.4" strokeWidth="2" />
                <circle cx={x + 52} cy={y + 55} r="25" fill="#000" opacity="0.5" />
                <circle className="bp-peg" cx={x + 50} cy={y + 50} r="25" fill={`url(#${base}-brass)`} />
                <ellipse cx={x + 42} cy={y + 40} rx="9" ry="5" fill="#fff" opacity="0.55" transform={`rotate(-30 ${x + 42} ${y + 40})`} />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
});

/** Placed pieces on the board, with an optional click-in on each new placement. */
export function BlockPiecesArt({
  placements,
  colourFor,
  snap,
  wave,
}: {
  placements: BlockPlacement[];
  colourFor: (piece: number) => string;
  snap?: boolean | undefined;
  /** Completion: delay (ms) per piece for the lock-tight pulse. */
  wave?: Map<number, number> | null | undefined;
}) {
  return (
    <svg className="bp-pieces-art" viewBox={`0 0 ${N * U} ${N * U}`} aria-hidden="true">
      {placements.map((placement) => (
        <PlacedPiece
          key={`${placement.piece}:${placement.cells.join("-")}`}
          placement={placement}
          colour={colourFor(placement.piece)}
          snap={snap}
          delay={wave?.get(placement.piece)}
        />
      ))}
    </svg>
  );
}

function PlacedPiece({
  placement,
  colour,
  snap,
  delay,
}: {
  placement: BlockPlacement;
  colour: string;
  snap?: boolean | undefined;
  delay?: number | undefined;
}) {
  const cells = useMemo(() => placement.cells.map(rowCol), [placement.cells]);
  const outline = useMemo(() => pieceOutline(cells, GAP), [cells]);
  return (
    <g className={snap ? "bp-piece bp-piece--snap" : "bp-piece"}>
      <g
        className={delay !== undefined ? "bp-piece-lock" : undefined}
        style={delay !== undefined ? { animationDelay: `${delay}ms` } : undefined}
      >
        <PieceArt cells={cells} colour={colour} />
        {snap && <path className="bp-snap-ring" d={outline} fill="none" stroke="#fff" strokeWidth="5" />}
      </g>
    </g>
  );
}

/** Steps (Chebyshev) from each cell to its nearest peg. */
export function pegDistances(blockers: number[]): number[] {
  return Array.from({ length: N * N }, (_, cell) => {
    const [r, c] = rowCol(cell);
    let best = N;
    for (const peg of blockers) {
      const [pr, pc] = rowCol(peg);
      best = Math.min(best, Math.max(Math.abs(pr - r), Math.abs(pc - c)));
    }
    return best;
  });
}

/** Ms per step of the shine as it travels out from the pegs. */
export const SHINE_STEP_MS = 120;

/** The completion shine: rings leave every peg, then the cells light up outwards. */
export function BlockSolveFx({ blockers }: { blockers: number[] }) {
  const ids = useContext(IdsContext);
  const distance = useMemo(() => pegDistances(blockers), [blockers]);
  const pegs = new Set(blockers);
  return (
    <svg className="bp-solve-fx" viewBox={`0 0 ${N * U} ${N * U}`} aria-hidden="true">
      {blockers.map((peg) => {
        const [r, c] = rowCol(peg);
        return <circle key={`ring-${peg}`} className="bp-peg-ring" cx={c * U + 50} cy={r * U + 50} r="28" />;
      })}
      {distance.map((steps, cell) => {
        if (pegs.has(cell)) return null;
        const [r, c] = rowCol(cell);
        return (
          <rect
            key={cell}
            className="bp-shine-cell"
            x={c * U + GAP}
            y={r * U + GAP}
            width={U - 2 * GAP}
            height={U - 2 * GAP}
            rx={RADIUS}
            fill={ids ? `url(#${ids.shine})` : "var(--primary)"}
            style={{ animationDelay: `${60 + (steps - 1) * SHINE_STEP_MS}ms` }}
          />
        );
      })}
    </svg>
  );
}
