/**
 * Iron Wall's lever picture (D5's ladder, 23 Nov 2026; docs/arcade-standard/bastion.md "bastionRev 5: the ladder"): one
 * wave rolling down the road, drawn from the level's own settings (GAME_LEVELS.bastion, the display copy of the sim's
 * BT5_LEVELS that bastion-ladder-check mirrors): the road's lanes (three, or four from Hard), the tanks in each wave (the
 * lever) and the heavies' share of them, drawn bigger. Normal is bastionRev 5's Normal as rooms deal it, bastionRev 4's
 * Normal game: three lanes, 30 tanks in five waves (6 a wave), 5 of them heavies, mirrored here so the Games page never
 * loads the sim. Colours only through design tokens.
 */
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import type { Level } from "@/lib/levels/levels";

/** The lever picture slot's props (P2's LeverPictureProps, declared here until that slot is on main). */
export interface BastionPictureProps {
  level: Level;
  size: "l" | "s";
}

interface BastionLevelView {
  lanes: 3 | 4;
  tanksAWave: number;
  tanks: number;
  heavies: number;
}

/** bastionRev 5's Normal: bastionRev 4's Normal game (bastionTank.ts BT5_LEVELS.normal, the plan's 30 tanks, 5 heavies). */
const NORMAL: BastionLevelView = { lanes: 3, tanksAWave: 6, tanks: 30, heavies: 5 };
/** The sim's lanes at the wall (bastionTank.ts BT2_LANE_X and BT5_LANE_X) over the road's 192 px half width. */
const LANES: Record<3 | 4, readonly number[]> = { 3: [-128, 0, 128], 4: [-144, -48, 48, 144] };
const ROAD_HALF = 192;

/** The level's settings, Normal's when the registry has none. */
export function bastionLevelView(level: Level): BastionLevelView {
  if (level === "normal") return NORMAL;
  const s = gameLevelSettings<Partial<BastionLevelView>>("bastion", level);
  return { lanes: s?.lanes === 4 ? 4 : 3, tanksAWave: s?.tanksAWave ?? NORMAL.tanksAWave, tanks: s?.tanks ?? NORMAL.tanks, heavies: s?.heavies ?? NORMAL.heavies };
}

export function BastionPicture({ level, size }: BastionPictureProps) {
  const lv = bastionLevelView(level);
  const W = 180;
  const H = size === "l" ? 112 : 80;
  const top = 10;
  const bottom = H - 6;
  const vx = W / 2;
  const half = W / 2 - 10;
  // Perspective: a depth t in 0 (horizon) … 1 (the wall) sits at y and scales lateral offsets by s.
  const at = (t: number) => ({ y: top + (bottom - top) * t, s: 0.12 + 0.88 * t });
  const lanes = LANES[lv.lanes];
  const dividers = lanes.slice(1).map((x, i) => (lanes[i]! + x) / 2);
  const heavies = Math.round((lv.tanksAWave * lv.heavies) / lv.tanks);
  // The wave's tanks: lanes in turn (never the same twice running), alternate depths, the heavies nearest.
  const tanks = Array.from({ length: lv.tanksAWave }, (_, i) => {
    const lane = (i * (lv.lanes === 4 ? 3 : 2)) % lv.lanes;
    const t = 0.3 + 0.6 * ((lv.tanksAWave - 1 - i) / Math.max(1, lv.tanksAWave - 1));
    return { lane, t, heavy: i >= lv.tanksAWave - heavies };
  });
  const edge = (side: -1 | 1) => `${vx + side * half * at(0).s},${at(0).y} ${vx + side * half},${at(1).y}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-bastion-picture={level} data-lanes={lv.lanes} data-tanks={lv.tanksAWave}>
      <polygon points={`${edge(-1)} ${edge(1).split(" ").reverse().join(" ")}`} fill="var(--jz-surface-2)" stroke="var(--jz-text-3)" strokeWidth={1} />
      {dividers.map((d) => (
        <line key={d} x1={vx + (d / ROAD_HALF) * half * at(0).s} y1={at(0).y} x2={vx + (d / ROAD_HALF) * half} y2={at(1).y} stroke="var(--jz-text-3)" strokeWidth={1} strokeDasharray="4 4" />
      ))}
      {tanks.map((tank, i) => {
        const { y, s } = at(tank.t);
        const x = vx + (lanes[tank.lane]! / ROAD_HALF) * half * s;
        const w = (tank.heavy ? 30 : 22) * s;
        const h = (tank.heavy ? 14 : 10) * s;
        return <rect key={i} x={x - w / 2} y={y - h} width={w} height={h} rx={1.5} fill={tank.heavy ? "var(--jz-red)" : "var(--jz-gold)"} />;
      })}
      <rect x={vx - half} y={bottom} width={half * 2} height={3} fill="var(--jz-text-2)" />
    </svg>
  );
}

/** The lever in a few words, from the same settings. */
export function bastionWords(level: Level): string {
  const lv = bastionLevelView(level);
  return `${lv.tanksAWave} tanks a wave on ${lv.lanes} lanes`;
}
