/**
 * Spacewalk's lever picture (D5, 23 Nov 2026; the lever-picture slot of the polish plan's section 6.1, Breaker's picture
 * the worked example): the traffic on the first crossing. Drawn from the level's own settings, CROSS_LEVELS_V14 (the
 * table the crossRev 14 sim reads): lanes whose ships come as often as the first crossing's density says (twelfths of
 * crossRev 9's full traffic; crossRev 13's Normal starts at 6, cross.ts CROSS_V13_DENSITY_12), and the walker's lives
 * as dots. The numbers are mirrored here so the Games page never loads the sim.
 */
import { CROSS_LEVELS_V14, type CrossLvV14 } from "@/lib/arcade/retroLevels";
import type { Level } from "@/lib/levels/levels";

/** The props the lever-picture slot passes (declared here: P2's slot is not on this branch yet). */
export interface CrossPictureProps {
  level: Level;
  size: "l" | "s";
}

/** cross.ts: Normal's first crossing (CROSS_V13_DENSITY_12[0], 6 twelfths) and lives (CROSS_LIVES, 3). */
const NORMAL_FIRST = 6;
const NORMAL_LIVES = 3;
/** Lanes drawn, and the ships a lane shows at full (12 twelfths) traffic. */
const LANES = 5;
const SHIPS_AT_FULL = 6;

function settingsAt(level: Level): Pick<CrossLvV14, "lives"> & { first: number } {
  if (level === "normal") return { first: NORMAL_FIRST, lives: NORMAL_LIVES };
  const lv = CROSS_LEVELS_V14[level];
  return { first: lv.density[0]!, lives: lv.lives };
}

export function CrossPicture({ level, size }: CrossPictureProps) {
  const lv = settingsAt(level);
  const W = 180;
  const H = size === "l" ? 112 : 80;
  const pad = 6;
  const laneH = (H - pad * 2 - 12) / LANES;
  const usable = W - pad * 2 - 22;
  const ships = [];
  for (let lane = 0; lane < LANES; lane++) {
    const y = pad + lane * laneH + laneH * 0.2;
    // Ships a lane: the first crossing's density as a share of full traffic, on SHIPS_AT_FULL at full.
    const count = Math.max(1, Math.round((SHIPS_AT_FULL * lv.first) / 12));
    const step = usable / count;
    const shipW = Math.min(step * 0.7, size === "l" ? 18 : 14);
    const offset = ((lane * 37) % 100) / 100;
    for (let k = 0; k < count; k++) {
      const x = pad + ((k + offset) % count) * step;
      ships.push(<rect key={`${lane}-${k}`} x={x} y={y} width={shipW} height={laneH * 0.6} rx={2} fill={lane % 2 ? "var(--jz-cyan)" : "var(--jz-text-2)"} />);
    }
  }
  const lives = Array.from({ length: lv.lives }, (_, k) => <circle key={k} cx={W - pad - 5} cy={pad + 6 + k * 9} r={3} fill="var(--jz-loss)" />);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-cross-picture={level}>
      {ships}
      {lives}
      <circle cx={pad + usable / 2} cy={H - pad - 4} r={size === "l" ? 5 : 4} fill="var(--jz-gold)" />
    </svg>
  );
}

/** The lever in a few words, from the same settings. */
export function crossWords(level: Level): string {
  const lv = settingsAt(level);
  const lives = `${lv.lives} ${lv.lives === 1 ? "life" : "lives"}`;
  if (level === "normal") return `Today’s traffic, ${lives}`;
  const traffic = lv.first < NORMAL_FIRST ? (lv.first * 2 <= NORMAL_FIRST ? "Half the ships" : "Fewer ships") : lv.first >= NORMAL_FIRST * 2 ? "Over twice the ships" : "More ships";
  return `${traffic} from the start, ${lives}`;
}
