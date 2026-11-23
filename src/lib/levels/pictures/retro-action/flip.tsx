/**
 * Roofbound's lever picture (D5, 23 Nov 2026; docs/arcade-standard/flip.md "Levels (D5, 23 Nov 2026)"): the lever is the
 * running speed. Drawn from the level's own settings (GAME_LEVELS.flip, the display copy of the sim's
 * FLIP_V14_LEVEL_RULES): the cave's floor and roof with the runner, and speed streaks behind it as long as the level's
 * start speed (the dashed streak beyond them its top speed), a moving spike's arrows where spikes move sooner than
 * Normal's 12 s, and the sweet spots' gold strips as wide as the level's. Normal is flipRev 13 as rooms deal it: 4 px a tick
 * rising to 10, moving spikes from 12 s, one-tick sweet spots (flip.ts SPEED_START, V8_SPEED_CAP, V8_MOVERS_FROM),
 * mirrored here so the Games page never loads the sim. Colours through the design tokens only.
 */
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import type { Level } from "@/lib/levels/levels";

/** The props of the lever-picture slot (declared here: P2's slot isn't on main yet). */
export interface FlipPictureProps {
  level: Level;
  size: "l" | "s";
}

interface FlipLook {
  speedStart: number;
  speedCap: number;
  moversFrom: number | null;
  sweetTicks: number;
}

/** flipRev 13's Normal (flip.ts): 1,024 → 2,560 (1/256 px a tick), moving spikes from 12 s, one-tick sweet spots. */
const NORMAL: FlipLook = { speedStart: 1024, speedCap: 2560, moversFrom: 720, sweetTicks: 1 };

function settingsAt(level: Level): FlipLook {
  const s = gameLevelSettings<FlipLook>("flip", level);
  return s ? { speedStart: s.speedStart, speedCap: s.speedCap, moversFrom: s.moversFrom, sweetTicks: s.sweetTicks } : NORMAL;
}

export function FlipPicture({ level, size }: FlipPictureProps) {
  const lv = settingsAt(level);
  const W = 180;
  const H = size === "l" ? 112 : 80;
  const roof = 12;
  const floor = H - 12;
  const runnerX = 52;
  const runnerH = size === "l" ? 20 : 14;
  // Streaks: 6 px of picture a px a tick of start speed; the top speed dashed beyond.
  const unit = 6 / 256;
  const start = lv.speedStart * unit;
  const top = lv.speedCap * unit;
  const ys = [floor - runnerH * 0.8, floor - runnerH * 0.5, floor - runnerH * 0.2];
  // Moving spikes from the first seconds (earlier than Normal's 12 s) show their arrows.
  const moving = lv.moversFrom !== null && lv.moversFrom < NORMAL.moversFrom!;
  const sweetW = Math.max(3, Math.min(30, lv.sweetTicks * 3));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-flip-picture={level}>
      <rect x={4} y={roof - 3} width={W - 8} height={3} fill="var(--jz-text-3)" />
      <rect x={4} y={floor} width={W - 8} height={3} fill="var(--jz-text-3)" />
      {ys.map((y, i) => (
        <g key={i}>
          <line x1={runnerX - 4 - start} y1={y} x2={runnerX - 4} y2={y} stroke="var(--jz-cyan)" strokeWidth={2} strokeLinecap="round" />
          <line x1={runnerX - 4 - top} y1={y} x2={runnerX - 4 - start - 2} y2={y} stroke="var(--jz-cyan)" strokeWidth={1} strokeDasharray="2 3" opacity={0.6} />
        </g>
      ))}
      <rect x={runnerX - 5} y={floor - runnerH} width={10} height={runnerH} rx={3} fill="var(--jz-gold)" />
      <rect x={W - 56} y={floor - 2} width={sweetW} height={2} fill="var(--jz-gold)" data-flip-sweet="" />
      <path d={`M ${W - 30} ${floor} l 6 -12 l 6 12 z`} fill="var(--jz-red)" />
      <path d={`M ${W - 82} ${roof} l 6 12 l 6 -12 z`} fill="var(--jz-red)" />
      {moving ? (
        <g data-flip-moving="">
          <path d={`M ${W - 38} ${floor - 18} l -5 3 l 5 3 z`} fill="var(--jz-text-2)" />
          <path d={`M ${W - 16} ${floor - 18} l 5 3 l -5 3 z`} fill="var(--jz-text-2)" />
        </g>
      ) : null}
    </svg>
  );
}

/** The lever in a few words, from the same settings. */
export function flipWords(level: Level): string {
  const lv = settingsAt(level);
  const px = (v: number) => {
    const p = v / 256;
    return Number.isInteger(p) ? `${p}` : p.toFixed(1);
  };
  const pace = `${px(lv.speedStart)} to ${px(lv.speedCap)} px a tick`;
  if (level === "normal") return `Runs ${pace}`;
  const spikes = lv.moversFrom === null ? ", no moving spikes" : lv.moversFrom < NORMAL.moversFrom! ? `, moving spikes from ${lv.moversFrom / 60} s` : "";
  return `Runs ${pace}${spikes}`;
}
