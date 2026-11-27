/**
 * Orbit's lever picture (D5, 23 Nov 2026; the lever-picture slot, P2's src/lib/levels/leverPicture.tsx, whose worked
 * example is Breaker's): the asteroid belts round the planets. Drawn from the level's own settings (GAME_LEVELS.orbit's
 * `belts`, the display copy of orbitRev 17's courses, scripts/orbit-ladder-lib.ts LADDER_COURSES): the course's 40
 * planets and the sun as a snake of four rows from the first planet (bottom left), each belted planet ringed with rocks.
 * Normal is orbitRev 17 as rooms deal it, mirrored here (belts from planet 31, about every other one) so the Games page
 * never loads the sim.
 */
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import type { Level } from "@/lib/levels/levels";

/** The picture's props (P2's LeverPictureProps; declared here, P2's slot isn't on main yet). */
export interface OrbitPictureProps {
  level: Level;
  size: "l" | "s";
}

/** A course's belt rule: none, or a belt round every `every`-th planet from planet `from` (1-based). */
type Belts = "none" | { from: number; every: number };
/** orbitRev 17's Normal: belts from planet 31 (ORBIT_HAZARD_FROM), about half of them, drawn as every other one. */
const NORMAL_BELTS: Belts = { from: 31, every: 2 };
const PLANETS = 40;
/** The bodies drawn: the 40 planets, then the sun (never belted). */
const BODIES = PLANETS + 1;

function beltsAt(level: Level): Belts {
  if (level === "normal") return NORMAL_BELTS;
  return gameLevelSettings<{ belts: Belts }>("orbit", level)?.belts ?? NORMAL_BELTS;
}
/** Is planet n (1-based) belted under this rule? */
export function orbitPictureBelted(belts: Belts, n: number): boolean {
  if (belts === "none") return false;
  return n >= belts.from && (n - belts.from) % belts.every === 0;
}

export function OrbitPicture({ level, size }: OrbitPictureProps) {
  const belts = beltsAt(level);
  const W = 180;
  const H = size === "l" ? 112 : 80;
  const pad = 10;
  const cols = 11;
  const rows = 4;
  const dx = (W - pad * 2) / (cols - 1);
  const dy = (H - pad * 2) / (rows - 1);
  const r = size === "l" ? 3.5 : 2.6;
  const parts = [];
  // The course as a snake: row 0 at the bottom, left to right, then right to left, and so on.
  const at = (n: number) => {
    const k = n - 1;
    const row = Math.trunc(k / cols);
    const col = row % 2 === 0 ? k % cols : cols - 1 - (k % cols);
    return { x: pad + col * dx, y: H - pad - row * dy };
  };
  for (let n = 1; n <= BODIES; n++) {
    const { x, y } = at(n);
    if (n < BODIES) {
      const b = at(n + 1);
      parts.push(<line key={`hop-${n}`} x1={x} y1={y} x2={b.x} y2={b.y} stroke="var(--jz-line)" strokeWidth={1} />);
    }
  }
  for (let n = 1; n <= BODIES; n++) {
    const { x, y } = at(n);
    const last = n === BODIES;
    parts.push(<circle key={`p-${n}`} cx={x} cy={y} r={last ? r + 1.5 : r} fill={last ? "var(--jz-gold)" : "var(--jz-cyan)"} />);
    if (!last && orbitPictureBelted(belts, n)) parts.push(<circle key={`belt-${n}`} cx={x} cy={y} r={r + 3} fill="none" stroke="var(--jz-text)" strokeWidth={1.4} strokeDasharray="2 1.5" />);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-orbit-picture={level}>
      {parts}
    </svg>
  );
}

/** The lever in a few words, from the same settings. */
export function orbitWords(level: Level): string {
  const belts = beltsAt(level);
  if (belts === "none") return "No asteroid belts";
  if (level === "normal") return "Belts near the sun";
  const nth = belts.every === 2 ? "second" : belts.every === 3 ? "third" : belts.every === 4 ? "fourth" : `${belts.every}th`;
  return belts.every === 1 ? "A belt round every planet" : `A belt round every ${nth} planet`;
}
