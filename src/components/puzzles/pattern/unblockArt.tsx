/**
 * Gridlock (unblock) art, pattern polish 13 Oct 2026, rendered sprites since the Pattern overhaul (15 Nov 2026).
 * Presentation only: the
 * car park, the cars and the exit drive-out. Nothing here reads or changes
 * moves, positions or submission; every car is drawn inside its own vehicle
 * box (the drag target), and the 7 × 7 grid box is exactly what the drag maths
 * measures.
 */
import { memo, useId } from "react";

import { UNBLOCK_COLS as N, UNBLOCK_EXIT_ROW } from "@/lib/duel/types";

/** Kerb thickness around the 7 × 7 bays, as a % of the whole lot. */
export const UNBLOCK_WALL = 4.5;

const V = 1000; // lot art viewBox
const W0 = (UNBLOCK_WALL / 100) * V; // kerb in art units
const CELL = (V - 2 * W0) / N;
const EXIT_Y = W0 + UNBLOCK_EXIT_ROW * CELL;

function cleanId(raw: string) {
  return `ub${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/**
 * Sprite art (the Pattern overhaul, 15 Nov 2026, look A; docs/design/game-art/pattern/source/unblock.py): glossy
 * painted toy cars and the dark lot, rendered in Blender. Each car image is exactly its vehicle box (2 or 3 bays long,
 * one wide), so nothing is drawn outside the box the drag maths uses; vertical cars have their own renders (the light
 * stays at the top left).
 */
export const UNBLOCK_ART_BASE = "/pattern-art/unblock";
/** Muted body colours (none near gold), by vehicle id; the gold car (id 0) is the only gold thing on the lot. */
export const UNBLOCK_BODIES = ["blue", "teal", "red", "violet", "green", "silver"] as const;

/** The sprite a vehicle draws. */
export function unblockCarSprite(id: number, axis: "h" | "v", len: number): string {
  if (id === 0) return `${UNBLOCK_ART_BASE}/gold-2h.webp`;
  const body = UNBLOCK_BODIES[(Math.abs(id) - 1 + UNBLOCK_BODIES.length) % UNBLOCK_BODIES.length]!;
  return `${UNBLOCK_ART_BASE}/${body}-${len >= 3 ? 3 : 2}${axis}.webp`;
}

export const UNBLOCK_LOT_SPRITE = `${UNBLOCK_ART_BASE}/lot.webp`;

/** The static car park: the rendered lot, with the exit's gold markings drawn over it. Rendered once per board. */
const LotArt = memo(function LotArt({ base }: { base: string }) {
  const gapMid = EXIT_Y + CELL / 2;
  return (
    <>
      <img className="unblock-lot-sprite" src={UNBLOCK_LOT_SPRITE} alt="" aria-hidden="true" draggable={false} decoding="async" />
      <svg className="unblock-lot-art" viewBox={`0 0 ${V} ${V}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`${base}-exitglow`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--primary)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--primary)" stopOpacity="0.16" />
          </linearGradient>
        </defs>
        {/* The exit lane: a gold centre dash leading to the gap, chevrons in the gap. */}
        <rect x={V - W0 - CELL * 2} y={EXIT_Y} width={CELL * 2 + W0} height={CELL} fill={`url(#${base}-exitglow)`} />
        <line x1={W0 + 20} y1={gapMid} x2={V - W0 - 10} y2={gapMid} stroke="var(--primary)" strokeOpacity="0.3" strokeWidth="5" strokeDasharray="26 22" />
        <g stroke="var(--primary)" strokeWidth="3" strokeOpacity="0.8">
          <line x1={V - W0 - 8} y1={EXIT_Y + 2} x2={V} y2={EXIT_Y + 2} />
          <line x1={V - W0 - 8} y1={EXIT_Y + CELL - 2} x2={V} y2={EXIT_Y + CELL - 2} />
        </g>
        <g fill="none" stroke="var(--primary)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
          <polyline points={`${V - W0 + 6},${gapMid - 22} ${V - W0 + 20},${gapMid} ${V - W0 + 6},${gapMid + 22}`} />
          <polyline points={`${V - W0 + 22},${gapMid - 22} ${V - W0 + 36},${gapMid} ${V - W0 + 22},${gapMid + 22}`} strokeOpacity="0.55" />
        </g>
      </svg>
    </>
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
  return (
    <div
      className="unblock-lot"
      data-celebrate={celebrate ? "on" : undefined}
      style={size ? { width: size, height: size } : undefined}
    >
      <LotArt base={base} />
      <div ref={gridRef} className="unblock-grid">
        {children}
      </div>
    </div>
  );
}

/** One car (len 2) or van (len 3): its rendered sprite, filling its vehicle box exactly. */
export const UnblockCarArt = memo(function UnblockCarArt({
  id,
  axis,
  len,
}: {
  id: number;
  axis: "h" | "v";
  len: number;
}) {
  return (
    <img
      className="unblock-car-art unblock-car-sprite"
      src={unblockCarSprite(id, axis, len)}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
    />
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
