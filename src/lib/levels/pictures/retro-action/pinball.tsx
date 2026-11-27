/**
 * Pinball's lever picture (D5's ladder, 23 Nov 2026; docs/arcade-standard/pinball.md "Levels (D5, 23 Nov 2026)"): the
 * two flippers at rest at the level's own length (PINBALL_LEVELS' `flipLen`, the table the sim reads), the drain between
 * their tips, and the balls the level gives. Normal is pinRev 9 as rooms deal it: 56 px flippers (PIN_FLIP_LEN) on pivots
 * 136 px apart, resting 30° down (P4_FLIP_PIVOTS, PIN_FLIP_REST), a 16 px ball (PIN_BALL_R) and 3 balls (PIN_BALLS),
 * mirrored here so the Games page never loads the sim. Colours through design tokens only.
 */
import { PINBALL_LEVELS } from "@/lib/arcade/retroLevels";
import type { Level } from "@/lib/levels/levels";

/** The props a lever picture takes (P2's slot, `src/lib/levels/leverPicture.tsx`, declared here until it lands on main). */
export interface PinballPictureProps {
  level: Level;
  size: "l" | "s";
}

/** pinRev 9's Normal (pinball.ts PIN_FLIP_LEN, PIN_FLIP_R, PIN_BALL_R, PIN_BALLS; pinball4.ts P4_FLIP_PIVOTS' spacing). */
const NORMAL_FLIP_LEN = 56;
const NORMAL_BALLS = 3;
const FLIP_R = 6;
const BALL_R = 8;
const PIVOT_GAP = 136;
/** The flippers rest 30° below level. */
const REST_COS = Math.cos(Math.PI / 6);
const REST_SIN = Math.sin(Math.PI / 6);

/** The level's flipper length and balls, Normal's when the table has none. */
function settingsAt(level: Level): { flipLen: number; balls: number } {
  if (level === "normal") return { flipLen: NORMAL_FLIP_LEN, balls: NORMAL_BALLS };
  const lv = PINBALL_LEVELS[level];
  return { flipLen: lv.flipLen ?? NORMAL_FLIP_LEN, balls: lv.balls };
}

/** The drain between the flippers' tips at rest, px (the bats' own round tips taken off). */
export function pinballDrainPx(level: Level): number {
  const { flipLen } = settingsAt(level);
  return Math.round(PIVOT_GAP - 2 * flipLen * REST_COS - 2 * FLIP_R);
}

export function PinballPicture({ level, size }: PinballPictureProps) {
  const { flipLen, balls } = settingsAt(level);
  const W = 180;
  const H = size === "l" ? 112 : 80;
  // The table's pivots 136 px apart drawn 120 px apart, centred; the flippers' rest line a little above the bottom.
  const scale = 120 / PIVOT_GAP;
  const cx = W / 2;
  const py = H * 0.42;
  const left = cx - (PIVOT_GAP / 2) * scale;
  const right = cx + (PIVOT_GAP / 2) * scale;
  const reach = flipLen * scale;
  const tipLX = left + reach * REST_COS;
  const tipRX = right - reach * REST_COS;
  const tipY = py + reach * REST_SIN;
  const bat = FLIP_R * 2 * scale;
  const ballR = Math.max(2.5, BALL_R * scale * (size === "l" ? 0.75 : 0.6));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-pinball-picture={level}>
      {/* The drain between the tips. */}
      <line x1={tipLX + bat / 2} y1={tipY + bat / 2} x2={tipRX - bat / 2} y2={tipY + bat / 2} stroke="var(--jz-loss)" strokeWidth={2} strokeLinecap="round" strokeDasharray="3 3" />
      {/* The two flippers at rest, at the level's length. */}
      <line x1={left} y1={py} x2={tipLX} y2={tipY} stroke="var(--jz-gold)" strokeWidth={bat} strokeLinecap="round" />
      <line x1={right} y1={py} x2={tipRX} y2={tipY} stroke="var(--jz-gold)" strokeWidth={bat} strokeLinecap="round" />
      <circle cx={left} cy={py} r={bat / 3} fill="var(--jz-text)" />
      <circle cx={right} cy={py} r={bat / 3} fill="var(--jz-text)" />
      {/* The balls the level gives, along the top. */}
      {Array.from({ length: balls }, (_, i) => (
        <circle key={i} cx={cx - ((balls - 1) * (ballR * 2.6)) / 2 + i * ballR * 2.6} cy={ballR + 6} r={ballR} fill="var(--jz-silver)" />
      ))}
    </svg>
  );
}

/** The lever in a few words, from the same settings. */
export function pinballWords(level: Level): string {
  const { flipLen, balls } = settingsAt(level);
  if (level === "normal") return `${flipLen} px flippers, ${balls} balls`;
  const len = flipLen > NORMAL_FLIP_LEN ? "Longer flippers" : flipLen < NORMAL_FLIP_LEN ? "Shorter flippers" : "Normal's flippers";
  return `${len}, ${balls} ball${balls === 1 ? "" : "s"}`;
}
