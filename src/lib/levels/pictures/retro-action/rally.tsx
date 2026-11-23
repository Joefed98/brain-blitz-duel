/**
 * Rally's lever pictures (D5's ladder, 23 Nov 2026; the lever is the paddle's width): drawn from the level's own settings
 * (RALLY_LEVELS_V14 in src/lib/arcade/retroLevels.ts, the table the sim reads): the court (420 × 784 on rallyRev 14), the
 * paddle at its starting width and, inside it, the narrowest it shrinks to, both bumpers when they are on court from the
 * first serve (faint when they arrive later, none when the level has none) and the lives as small balls. Normal is
 * rallyRev 14 as rooms deal it (rally.ts: a 120 px paddle shrinking to 40, two lives, bumpers at 30 s and 45 s); its
 * numbers are mirrored here so the Games page never loads the sim.
 */
import { RALLY_LEVELS_V14, type RallyLv14 } from "@/lib/arcade/retroLevels";
import type { Level } from "@/lib/levels/levels";

/** The picture slot's props (P2's LeverPictureProps, declared here until that slot is on main). */
interface LeverPictureProps {
  level: Level;
  size: "l" | "s";
}

/** rallyRev 14's Normal (rally.ts RALLY_PADDLE_START_W, RALLY_PADDLE_MIN_W, RALLY_V13_LIVES, RALLY_BUMPER_FROM / 2_FROM, RALLY_V10_W). */
const NORMAL: RallyLv14 = { lives: 2, fullAt: 23, paddleStart: 120, paddleMin: 40, capPct: 100, bumper1S: 30, bumper2S: 45, padsFull: 0, targetsFull: 0, spinFull: 0 };
const COURT_W = 420;
const RUN_S = 60;

function settingsAt(level: Level): RallyLv14 {
  return level === "normal" ? NORMAL : RALLY_LEVELS_V14[level];
}

export function RallyPicture({ level, size }: LeverPictureProps) {
  const lv = settingsAt(level);
  const W = 180;
  const H = size === "l" ? 112 : 80;
  const pad = 6;
  const courtW = W - pad * 2;
  const scale = courtW / COURT_W;
  const start = lv.paddleStart * scale;
  const min = lv.paddleMin * scale;
  const py = H - 12;
  const bumper = (s: number, x: number, y: number, key: string) =>
    s >= RUN_S ? null : <circle key={key} cx={x} cy={y} r={5} fill={s === 0 ? "var(--jz-cyan)" : "none"} stroke="var(--jz-cyan)" strokeWidth={1} strokeDasharray={s === 0 ? undefined : "2 2"} />;
  const lives = Array.from({ length: lv.lives }, (_, i) => <circle key={`l${i}`} cx={pad + 6 + i * 9} cy={pad + 6} r={3} fill="var(--jz-player-4)" />);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-rally-picture={level}>
      <rect x={pad} y={pad} width={courtW} height={H - pad * 2} rx={3} fill="var(--jz-well)" stroke="var(--jz-line)" strokeWidth={1} />
      {lives}
      {bumper(lv.bumper1S, W * 0.38, H * 0.42, "b1")}
      {bumper(lv.bumper2S, W * 0.64, H * 0.36, "b2")}
      <circle cx={W * 0.55} cy={H * 0.58} r={3.5} fill="var(--jz-gold)" />
      <rect x={(W - start) / 2} y={py} width={start} height={5} rx={2.5} fill="var(--jz-text-3)" />
      <rect x={(W - min) / 2} y={py} width={min} height={5} rx={2.5} fill="var(--jz-white)" />
    </svg>
  );
}

/** The lever in a few words, from the same settings. */
export function rallyWords(level: Level): string {
  const lv = settingsAt(level);
  const share = Math.round((100 * lv.paddleStart) / COURT_W);
  if (level === "normal") return `A paddle ${share} % of the court`;
  const bumpers = lv.bumper1S >= RUN_S ? "no bumpers" : lv.bumper1S === 0 ? "bumpers from the start" : "bumpers later";
  return `A ${share} % paddle, ${bumpers}`;
}
