/**
 * Keys for the two games whose stage alone knows what a key should press (Joe, 21 Nov 2026; plan section 7): Tenfall
 * (a column key taps that column's lowest tile, which only the run's state knows) and Cue Ball (the aim, power and spin
 * live in its stage). Each stage passes its own refs here from one line (its `keys` prop, or one useGameKeys call), so
 * a key feeds the stage's own queue or `send`, exactly as its pointer handlers do: input mapping only, the same ticks,
 * the same payloads, the same score (desktop-fairness-check). Never imported by a sim, a replay or a grader.
 */
import { POOL_SPIN_SAFE, poolSpinClamp } from "@/lib/arcade/pool";
import { TD_CONFIG, TD_INPUT_TAP } from "@/lib/arcade/tenDrop";
import type { ArcadeInputEvent } from "@/lib/arcade/engine";

/** Tenfall's column keys, left to right. */
export const TENDROP_KEYS = ["1", "2", "3", "4"] as const;

/**
 * Tenfall: the tap a column key makes, the same event a finger on that column's lowest tile queues (the tile's
 * middle, in world px), or null when the key isn't a column key or the column is empty (a finger there taps nothing).
 */
export function tenDropKeyTap(key: string, tiles: readonly { col: number; y: number }[]): ArcadeInputEvent | null {
  const col = (TENDROP_KEYS as readonly string[]).indexOf(key);
  if (col < 0) return null;
  let low: { y: number } | null = null;
  for (const t of tiles) if (t.col === col && (!low || t.y > low.y)) low = t;
  if (!low) return null;
  const y = Math.max(0, Math.min(TD_CONFIG.worldH, Math.round(low.y / 256 + TD_CONFIG.tileH / 2)));
  return { t: 0, k: TD_INPUT_TAP, a: col, b: y, c: 0, d: 0 };
}

/** Cue Ball's key steps: the aim a degree a press (a tenth with Shift), the power a twentieth, the spin an eighth. */
const AIM_STEP = Math.PI / 180;
const POWER_STEP = 0.05;
const SPIN_STEP = POOL_SPIN_SAFE / 4;

export interface PoolKeyRefs {
  /** The cue's angle this shot (the stage's currentAngle), null when no shot can be lined up. */
  angle: () => number | null;
  setAngle: (angle: number) => void;
  /** The power bar's pull, 0–1 (the stage's pull ref, drawn on its panel). */
  pull: { current: number };
  repaint: () => void;
  spin: () => { x: number; y: number };
  setSpin: (spin: { x: number; y: number }) => void;
  /** The shot on the stage's own payload, as letting go of the power bar sends it. */
  shoot: (angle: number, power: number) => void;
  minPull: number;
}

/** Cue Ball: ← → turn the aim (Shift: finer), ↑ ↓ set the power, W A S D move the spin dot, Space shoots. */
export function poolKey(kind: "down" | "up", key: string, shift: boolean, refs: PoolKeyRefs): boolean {
  const turn = key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : 0;
  const power = key === "ArrowUp" ? 1 : key === "ArrowDown" ? -1 : 0;
  const spin = { w: [0, 1], s: [0, -1], a: [-1, 0], d: [1, 0] }[key] as [number, number] | undefined;
  if (!turn && !power && !spin && key !== " ") return false;
  if (kind === "up") return true;
  if (turn) {
    const a = refs.angle();
    if (a !== null) refs.setAngle(a + turn * (shift ? AIM_STEP / 10 : AIM_STEP));
  } else if (power) {
    refs.pull.current = Math.max(0, Math.min(1, Math.round((refs.pull.current + power * POWER_STEP) * 100) / 100));
    refs.repaint();
  } else if (spin) {
    const s = refs.spin();
    refs.setSpin(poolSpinClamp(s.x + spin[0] * SPIN_STEP, s.y + spin[1] * SPIN_STEP));
  } else {
    const a = refs.angle();
    const p = refs.pull.current;
    if (a === null || p < refs.minPull) return true;
    refs.pull.current = 0;
    refs.repaint();
    refs.shoot(a, p);
  }
  return true;
}
