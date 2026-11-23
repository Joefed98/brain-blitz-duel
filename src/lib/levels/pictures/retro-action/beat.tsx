/**
 * Tempo's lever picture (D5's ladder, 23 Nov 2026; docs/arcade-standard/beat.md "Levels (D5, 23 Nov 2026)"): the lanes,
 * the level's headline lever. Drawn from the level's own row of BEAT_LEVELS_V13 (src/lib/arcade/retroLevels.ts, the
 * table the sim reads): one column a lane with its button on the hit line, and falling notes, more of them the busier the
 * level's chart (its off-beat and chord shares), spaced by its fall time; chords drawn as notes side by side. Normal is
 * beatRev 13 as rooms deal it: four lanes and a fifth from 40 s (drawn dashed), Normal's chart and a 90-tick fall,
 * mirrored here so the Games page never loads the sim. Colours only through the design tokens.
 */
import { BEAT_LEVELS_V13 } from "@/lib/arcade/retroLevels";
import type { Level } from "@/lib/levels/levels";

/** The lever picture's props (P2's slot, src/lib/levels/leverPicture.tsx, declares the same shape). */
export interface BeatPictureProps {
  level: Level;
  size: "l" | "s";
}

/** beatRev 13's Normal (beat.ts BEAT_LANES, BEAT_V9_LANES, BEAT_FALL_TICKS): four lanes, five from 40 s. */
const NORMAL = { lanes: 4, later: 5, eighthPct: 100, chordPct: 100, fall: 90 };

/** The lanes' colours (the game's teal, gold, violet, blue, pink and orange lanes), from the player palette's tokens. */
const LANE_COLOURS = ["--jz-player-26", "--jz-player-19", "--jz-player-4", "--jz-player-6", "--jz-player-14", "--jz-player-1"];

/** The level's lanes and chart, Normal's when the table has none. */
function settingsAt(level: Level): { lanes: number; later: number; eighthPct: number; chordPct: number; fall: number } {
  if (level === "normal") return NORMAL;
  const lv = BEAT_LEVELS_V13[level];
  return { lanes: lv.lanes, later: lv.lanes, eighthPct: lv.eighthPct, chordPct: lv.chordPct, fall: lv.fall };
}

export function BeatPicture({ level, size }: BeatPictureProps) {
  const s = settingsAt(level);
  const W = 180;
  const H = size === "l" ? 112 : 80;
  const pad = 8;
  const gap = 3;
  const slots = s.later;
  const laneW = (W - pad * 2 - gap * (slots - 1)) / slots;
  const hitY = H - 14;
  const noteH = size === "l" ? 5 : 4;
  // The busier the chart, the more notes in view; the shorter the fall, the closer they come (Normal 90 ticks).
  const perLane = Math.max(1, Math.min(6, Math.round((3 * (s.eighthPct + s.chordPct)) / 200)));
  const spacing = ((hitY - pad - 8) / (perLane + 0.5)) * Math.min(1.2, s.fall / NORMAL.fall);
  const chords = s.chordPct >= 100;
  const parts = [];
  for (let lane = 0; lane < slots; lane++) {
    const x = pad + lane * (laneW + gap);
    const colour = `var(${LANE_COLOURS[lane % LANE_COLOURS.length]})`;
    const later = lane >= s.lanes;
    parts.push(
      <rect key={`lane-${lane}`} x={x} y={pad} width={laneW} height={hitY - pad + 6} rx={2} fill={later ? "none" : colour} fillOpacity={later ? undefined : 0.16} stroke={later ? colour : undefined} strokeDasharray={later ? "3 3" : undefined} strokeOpacity={later ? 0.6 : undefined} />,
    );
    if (later) continue;
    for (let k = 0; k < perLane; k++) {
      // Staggered by lane (a chord's partner sits level with its neighbour's note).
      const step = chords && lane % 2 === 1 ? k : k + (lane % 3) * 0.33;
      const y = hitY - 10 - step * spacing;
      if (y < pad + 2) continue;
      parts.push(<rect key={`note-${lane}-${k}`} x={x + 2} y={y - noteH / 2} width={laneW - 4} height={noteH} rx={1} fill={colour} />);
    }
    parts.push(<circle key={`button-${lane}`} cx={x + laneW / 2} cy={hitY} r={Math.min(6, laneW * 0.26)} fill="var(--jz-surface)" stroke={colour} strokeWidth={2} />);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-beat-picture={level} data-lanes={s.lanes}>
      {parts}
      <rect x={pad} y={hitY - 1} width={W - pad * 2} height={2} fill="var(--jz-gold)" opacity={0.85} />
    </svg>
  );
}

/** The lever in a few words, from the same settings. */
export function beatWords(level: Level): string {
  const s = settingsAt(level);
  const names = ["", "One", "Two", "Three", "Four", "Five", "Six"];
  if (level === "normal") return `${names[s.lanes]} lanes, a fifth at 40 s`;
  if (level === "easy") return `${names[s.lanes]} lanes, the whole song`;
  return `${names[s.lanes]} lanes from the first note`;
}
