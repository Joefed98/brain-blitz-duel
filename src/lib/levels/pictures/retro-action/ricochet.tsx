/**
 * Moon Climb's lever picture (D5, 23 Nov 2026; the lever-picture slot, P2's src/lib/levels/leverPicture.tsx, whose
 * worked example is Breaker's): the blades on the walls. Drawn from the level's own settings (GAME_LEVELS.ricochet, the
 * display copy of ricochetNinja.ts MOON_MID_LEVELS: `blades` × Normal's, `ice` the share of the patches that are ice,
 * `lanterns`); Normal is ricoRev 5 as rooms deal it, mirrored here (blades ×1, 40 % ice, six lanterns) so the Games page
 * never loads the sim. Two temple walls, a katana a step up each wall for every share of Normal's blades, the walls'
 * patches of ice, and the sky lanterns over the shaft.
 */
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import type { Level } from "@/lib/levels/levels";

/** The picture's props (P2's LeverPictureProps; declared here, P2's slot isn't on main yet). */
export interface RicochetPictureProps {
  level: Level;
  size: "l" | "s";
}

interface MoonSettings {
  blades: number;
  ice: number;
  lanterns: number;
}
/** ricoRev 5's Normal (MOON_MID_LEVELS has no Normal row: Normal is the stamp's own game). */
const NORMAL: MoonSettings = { blades: 1, ice: 0.4, lanterns: 6 };
/** Katanas a wall the picture draws at Normal's density (the count scales with `blades`). */
const NORMAL_BLADES = 4;

function settingsAt(level: Level): MoonSettings {
  if (level === "normal") return NORMAL;
  const s = gameLevelSettings<MoonSettings>("ricochet", level);
  return s ? { blades: s.blades, ice: s.ice, lanterns: s.lanterns } : NORMAL;
}

export function RicochetPicture({ level, size }: RicochetPictureProps) {
  const lv = settingsAt(level);
  const W = 180;
  const H = size === "l" ? 112 : 80;
  const pad = 6;
  const wallW = size === "l" ? 12 : 10;
  const blade = size === "l" ? 22 : 18;
  const perWall = Math.max(1, Math.round(NORMAL_BLADES * lv.blades));
  const rows = H - pad * 2;
  const parts = [];
  // The walls, then the ice share of their height in three patches each.
  for (const [w, x] of [[0, pad], [1, W - pad - wallW]] as const) {
    parts.push(<rect key={`wall-${w}`} x={x} y={pad} width={wallW} height={rows} rx={2} fill="var(--jz-surface-3)" />);
    const patch = (rows * lv.ice) / 3;
    for (let k = 0; k < 3; k++) {
      const y = pad + ((k + 0.5 + w * 0.35) * rows) / 3 - patch / 2;
      parts.push(<rect key={`ice-${w}-${k}`} x={x} y={Math.max(pad, y)} width={wallW} height={Math.min(patch, rows)} rx={2} fill="var(--jz-cyan)" opacity={0.55} />);
    }
    // The katanas, evenly up the wall (offset between the walls), pointing into the shaft.
    for (let k = 0; k < perWall; k++) {
      const y = pad + ((k + 0.5 + (w ? 0.5 : 0)) * rows) / (perWall + 0.5);
      const x0 = w === 0 ? x + wallW : x - blade;
      parts.push(<rect key={`blade-${w}-${k}`} x={x0} y={y - 1.5} width={blade} height={3} rx={1.5} fill="var(--jz-text)" />);
    }
  }
  // The sky lanterns floating up the middle of the shaft.
  for (let k = 0; k < lv.lanterns; k++) {
    const x = W / 2 + (k % 2 ? 14 : -14);
    const y = pad + 8 + ((rows - 16) * k) / Math.max(1, lv.lanterns - 1);
    parts.push(<circle key={`sky-${k}`} cx={x} cy={y} r={size === "l" ? 4 : 3} fill="var(--jz-gold)" />);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-ricochet-picture={level}>
      {parts}
    </svg>
  );
}

/** The lever in a few words, from the same settings. */
export function ricochetWords(level: Level): string {
  const lv = settingsAt(level);
  if (level === "normal") return "Blades on both walls";
  const share = lv.blades < 1 ? "Half the blades" : lv.blades >= 1.5 ? "Blades everywhere, mostly ice" : "More blades, more ice";
  return lv.lanterns < NORMAL.lanterns ? `${share}, ${lv.lanterns} lanterns` : share;
}
