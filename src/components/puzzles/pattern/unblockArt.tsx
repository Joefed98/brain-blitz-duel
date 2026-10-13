/**
 * Gridlock (unblock) art, pattern polish 13 Oct 2026. Presentation only: the
 * car park, the cars and the exit drive-out. Nothing here reads or changes
 * moves, positions or submission; every car is drawn inside its own vehicle
 * box (the drag target), and the 7 × 7 grid box is exactly what the drag maths
 * measures.
 */
import { createContext, memo, useContext, useId, useMemo } from "react";

import { UNBLOCK_COLS as N, UNBLOCK_EXIT_ROW } from "@/lib/duel/types";

/** Kerb thickness around the 7 × 7 bays, as a % of the whole lot. */
export const UNBLOCK_WALL = 4.5;

const V = 1000; // lot art viewBox
const W0 = (UNBLOCK_WALL / 100) * V; // kerb in art units
const CELL = (V - 2 * W0) / N;
const EXIT_Y = W0 + UNBLOCK_EXIT_ROW * CELL;

interface ArtIds {
  shade: string;
  glass: string;
  halo: string;
}

const IdsContext = createContext<ArtIds | null>(null);

function cleanId(raw: string) {
  return `ub${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/** The static car park: kerb, tarmac, painted bays and the exit gap. Rendered once per board. */
const LotArt = memo(function LotArt({ base, ids }: { base: string; ids: ArtIds }) {
  const lines: React.ReactNode[] = [];
  for (let k = 1; k < N; k++) {
    const at = W0 + k * CELL;
    lines.push(<line key={`v${k}`} x1={at} y1={W0 + 6} x2={at} y2={V - W0 - 6} />);
    lines.push(<line key={`h${k}`} x1={W0 + 6} y1={at} x2={V - W0 - 6} y2={at} />);
  }
  const ticks: React.ReactNode[] = [];
  for (let r = 1; r < N; r++) {
    for (let c = 1; c < N; c++) {
      const x = W0 + c * CELL;
      const y = W0 + r * CELL;
      ticks.push(<path key={`${r}-${c}`} d={`M${x - 11} ${y}H${x + 11}M${x} ${y - 11}V${y + 11}`} />);
    }
  }
  const gapMid = EXIT_Y + CELL / 2;
  return (
    <svg className="unblock-lot-art" viewBox={`0 0 ${V} ${V}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${base}-kerb`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4c4f58" />
          <stop offset="1" stopColor="#2a2c32" />
        </linearGradient>
        <radialGradient id={`${base}-tarmac`} cx="0.45" cy="0.35" r="0.85">
          <stop offset="0" stopColor="#2c2e34" />
          <stop offset="1" stopColor="#1a1b20" />
        </radialGradient>
        <filter id={`${base}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.09 0" />
        </filter>
        <linearGradient id={`${base}-exitglow`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--primary)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--primary)" stopOpacity="0.28" />
        </linearGradient>
        {/* Shared car shading (light from the top left on every car). */}
        <linearGradient id={ids.shade} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.38" />
          <stop offset="0.22" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.38" />
        </linearGradient>
        <linearGradient id={ids.glass} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9fb4cc" />
          <stop offset="0.35" stopColor="#3a4b60" />
          <stop offset="1" stopColor="#141b26" />
        </linearGradient>
        <radialGradient id={ids.halo} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.55" stopColor="var(--primary)" stopOpacity="0.38" />
          <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Kerb with the exit gap cut through the right side. */}
      <rect x="0" y="0" width={V} height={V} rx="34" fill={`url(#${base}-kerb)`} />
      <rect x="3" y="3" width={V - 6} height={V - 6} rx="31" fill="none" stroke="#fff" strokeOpacity="0.1" strokeWidth="4" />
      <rect x={W0} y={W0} width={V - 2 * W0} height={V - 2 * W0} rx="10" fill={`url(#${base}-tarmac)`} />
      <rect x={V - W0 - 12} y={EXIT_Y} width={W0 + 14} height={CELL} fill="#1f2025" />
      <rect x="0" y="0" width={V} height={V} filter={`url(#${base}-grain)`} />
      <rect x={W0} y={W0} width={V - 2 * W0} height={V - 2 * W0} rx="10" fill="none" stroke="#000" strokeOpacity="0.55" strokeWidth="6" />
      {/* Painted bay lines and corner marks. */}
      <g stroke="#e9e4d2" strokeOpacity="0.11" strokeWidth="3">{lines}</g>
      <g stroke="#e9e4d2" strokeOpacity="0.32" strokeWidth="4" strokeLinecap="round">{ticks}</g>
      {/* The exit lane: a gold centre dash leading to the gap, chevrons in the gap. */}
      <rect x={V - W0 - CELL * 2} y={EXIT_Y} width={CELL * 2 + W0} height={CELL} fill={`url(#${base}-exitglow)`} />
      <line x1={W0 + 20} y1={gapMid} x2={V - W0 - 10} y2={gapMid} stroke="var(--primary)" strokeOpacity="0.22" strokeWidth="5" strokeDasharray="26 22" />
      <g stroke="var(--primary)" strokeWidth="3" strokeOpacity="0.8">
        <line x1={V - W0 - 8} y1={EXIT_Y + 2} x2={V} y2={EXIT_Y + 2} />
        <line x1={V - W0 - 8} y1={EXIT_Y + CELL - 2} x2={V} y2={EXIT_Y + CELL - 2} />
      </g>
      <g fill="none" stroke="var(--primary)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        <polyline points={`${V - W0 + 6},${gapMid - 22} ${V - W0 + 20},${gapMid} ${V - W0 + 6},${gapMid + 22}`} />
        <polyline points={`${V - W0 + 22},${gapMid - 22} ${V - W0 + 36},${gapMid} ${V - W0 + 22},${gapMid + 22}`} strokeOpacity="0.55" />
      </g>
    </svg>
  );
});

/** The board frame: kerb and tarmac around the measured 7 × 7 grid. */
export function UnblockLot({
  size,
  gridRef,
  celebrate,
  children,
}: {
  size?: number | undefined;
  gridRef?: React.Ref<HTMLDivElement> | undefined;
  celebrate?: boolean | undefined;
  children?: React.ReactNode;
}) {
  const base = cleanId(useId());
  const ids = useMemo(() => ({ shade: `${base}-shade`, glass: `${base}-glass`, halo: `${base}-halo` }), [base]);
  return (
    <IdsContext.Provider value={ids}>
      <div
        className="unblock-lot"
        data-celebrate={celebrate ? "on" : undefined}
        style={size ? { width: size, height: size } : undefined}
      >
        <LotArt base={base} ids={ids} />
        <div ref={gridRef} className="unblock-grid">
          {children}
        </div>
      </div>
    </IdsContext.Provider>
  );
}

/** Muted body colours: none of them near the gold block's. */
const BODY = ["#5b80b2", "#3f8d87", "#a9505c", "#7a6cb2", "#5d8a52", "#8b919c", "#46689c", "#9c6a55"];

/** One car (len 2) or van (len 3), drawn top-down to fill its vehicle box. */
export const UnblockCarArt = memo(function UnblockCarArt({
  id,
  axis,
  len,
}: {
  id: number;
  axis: "h" | "v";
  len: number;
}) {
  const ids = useContext(IdsContext);
  const gold = id === 0;
  const colour = gold ? "var(--primary)" : BODY[id % BODY.length]!;
  const W = len * 100;
  const shade = ids ? `url(#${ids.shade})` : "none";
  const glass = ids ? `url(#${ids.glass})` : "#2a3546";
  // The gold car always faces the exit; the others face either way.
  const flipped = !gold && id % 2 === 1;
  const van = len >= 3;
  const front = W - 7;
  const wheels = van ? [W * 0.17, W * 0.5, W * 0.84] : [W * 0.22, W * 0.76];
  const body = (
    <g transform={flipped ? `translate(${W} 0) scale(-1 1)` : undefined}>
      {gold && ids && <rect x="-6" y="-2" width={W + 12} height="104" rx="40" fill={`url(#${ids.halo})`} />}
      <rect className="unblock-car-lift" x="10" y="20" width={W - 16} height="78" rx="22" fill="#000" />
      <rect x="9" y="17" width={W - 16} height="76" rx="20" fill="#000" opacity="0.42" />
      <g fill="#0c0d10">
        {wheels.map((x) => (
          <g key={x}>
            <rect x={x - 12} y="7" width="24" height="12" rx="4" />
            <rect x={x - 12} y="81" width="24" height="12" rx="4" />
          </g>
        ))}
      </g>
      {van ? (
        <>
          {/* Cargo box, then the cab at the front. */}
          <rect x="7" y="12" width={W - 108} height="76" rx="9" fill={colour} />
          <rect x="7" y="12" width={W - 108} height="76" rx="9" fill="#fff" opacity="0.14" />
          <rect x="7" y="12" width={W - 108} height="76" rx="9" fill={shade} />
          <g stroke="#000" strokeOpacity="0.2" strokeWidth="3">
            {Array.from({ length: Math.floor((W - 130) / 30) }, (_, k) => (
              <line key={k} x1={30 + k * 30} y1="18" x2={30 + k * 30} y2="82" />
            ))}
          </g>
          <rect x={W - 97} y="14" width="90" height="72" rx="18" fill={colour} />
          <rect x={W - 97} y="14" width="90" height="72" rx="18" fill={shade} />
          <rect x={W - 93} y="23" width="34" height="54" rx="7" fill="#fff" opacity="0.1" />
          <path d={`M${W - 58} 23 L${W - 36} 19 L${W - 36} 81 L${W - 58} 77 Z`} fill={glass} stroke={glass} strokeWidth="3" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <rect x="7" y="12" width={W - 14} height="76" rx="22" fill={colour} />
          <rect x="7" y="12" width={W - 14} height="76" rx="22" fill={shade} />
          {/* Roof (lighter), with the rear window and windscreen. */}
          <rect x="44" y="22" width={W - 121} height="56" rx="11" fill="#fff" opacity="0.11" />
          {gold && (
            <g fill="#1b1406" opacity="0.5">
              <rect x="12" y="41" width={W - 24} height="6" rx="2" />
              <rect x="12" y="53" width={W - 24} height="6" rx="2" />
            </g>
          )}
          <path d="M24 26 L42 22 L42 78 L24 74 Z" fill={glass} stroke={glass} strokeWidth="3" strokeLinejoin="round" />
          <path d={`M${W - 77} 22 L${W - 50} 18 L${W - 50} 82 L${W - 77} 78 Z`} fill={glass} stroke={glass} strokeWidth="3" strokeLinejoin="round" />
          <g fill={colour}>
            <rect x={W - 80} y="8" width="9" height="7" rx="2" />
            <rect x={W - 80} y="85" width="9" height="7" rx="2" />
          </g>
        </>
      )}
      {/* Headlights at the front, tail lights at the back. */}
      <g fill="#fff4c8">
        <rect x={front - 7} y="19" width="6" height="14" rx="2.5" />
        <rect x={front - 7} y="67" width="6" height="14" rx="2.5" />
      </g>
      <g fill="#ff3d3d" opacity="0.9">
        <rect x="8" y="19" width="5" height="13" rx="2" />
        <rect x="8" y="68" width="5" height="13" rx="2" />
      </g>
      {gold && <rect x="7" y="12" width={W - 14} height="76" rx="22" fill="none" stroke="#fff3c2" strokeOpacity="0.55" strokeWidth="2.5" />}
    </g>
  );
  return (
    <svg
      className="unblock-car-art"
      viewBox={axis === "h" ? `0 0 ${W} 100` : `0 0 100 ${W}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* Vertical cars are the same drawing transposed, so the light stays top-left. */}
      {axis === "h" ? body : <g transform="matrix(0 1 1 0 0 0)">{body}</g>}
    </svg>
  );
});

/** Speed streaks and an exit burst along the exit lane while the gold car drives out. */
export function UnblockExitFx({ fromCol }: { fromCol: number }) {
  // The kerb, measured in grid widths, so the lane runs out through the gap.
  const wall = (UNBLOCK_WALL / (100 - 2 * UNBLOCK_WALL)) * 100;
  return (
    <div
      className="unblock-exit-fx"
      aria-hidden="true"
      style={{
        top: `${(UNBLOCK_EXIT_ROW * 100) / N}%`,
        height: `${100 / N}%`,
        left: 0,
        right: `-${wall}%`,
        ["--lane-from" as string]: `${(fromCol * 100) / (N + (wall * N) / 100)}%`,
      }}
    >
      <span className="unblock-streak" style={{ top: "22%", animationDelay: "150ms" }} />
      <span className="unblock-streak" style={{ top: "42%", animationDelay: "90ms" }} />
      <span className="unblock-streak" style={{ top: "60%", animationDelay: "190ms" }} />
      <span className="unblock-streak" style={{ top: "78%", animationDelay: "120ms" }} />
      <span className="unblock-exit-burst" />
    </div>
  );
}
