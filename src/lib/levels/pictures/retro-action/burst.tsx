/**
 * Fission's lever picture (D5, 23 Nov 2026; the lever-picture slot P2 builds, src/lib/levels/leverPicture.tsx, whose
 * worked example is Breaker's): the atoms in each wave. Drawn from the level's own settings (BURST_LEVELS_SMALL in
 * src/lib/arcade/retroLevels.ts, the table the sim reads on burstRev 14): the opening wave's atoms at their sizes (Easy's a
 * quarter bigger), the five waves' atom counts as a strip of bars, and the lives. Normal is burstRev 14 as rooms deal it
 * (M; L; M M; L S S; L L, three lives; the sim's own buildWaves and BURST_LIVES, mirrored here so the Games page never
 * loads the sim).
 */
import { BURST_LEVELS_SMALL } from "@/lib/arcade/retroLevels";
import type { Level } from "@/lib/levels/levels";

/** The slot's props (P2's LeverPictureProps, declared here until the slot is on main). */
export interface BurstPictureProps {
  level: Level;
  size: "l" | "s";
}

/** burstRev 14's atom radii, px (burst.ts BURST_RADIUS_SMALL: L, M, S, XS), and the atoms a spawn becomes (L 15 … XS 1). */
const RADIUS = [35, 24, 15, 9];
const ATOMS = [15, 7, 3, 1];
/** Normal's waves (burst.ts buildWaves: M; L; M M; L S S; L L) and lives. */
const NORMAL = { waves: [[1], [0], [1, 1], [0, 2, 2], [0, 0]] as readonly (readonly number[])[], lives: 3, sizePct: 100 };
/** The colours of the sizes, from the player palette's tokens (L, M, S, XS). */
const SIZE_COLOURS = ["--jz-player-2", "--jz-player-1", "--jz-player-0", "--jz-player-8"];

function settingsAt(level: Level): { waves: readonly (readonly number[])[]; lives: number; sizePct: number } {
  if (level === "normal") return NORMAL;
  const lv = BURST_LEVELS_SMALL[level];
  return { waves: lv.waves, lives: lv.lives, sizePct: lv.sizePct };
}

export function BurstPicture({ level, size }: BurstPictureProps) {
  const lv = settingsAt(level);
  const W = 180;
  const H = size === "l" ? 112 : 80;
  // The opening wave, scaled from the world's 390 px to the picture's width.
  const scale = (W / 390) * (lv.sizePct / 100) * (size === "l" ? 1.25 : 1);
  const first = lv.waves[0] ?? [];
  const gap = W / (first.length + 1);
  const atomY = size === "l" ? 34 : 26;
  // The five waves' atoms as bars along the bottom (every split piece counted), on one scale for every level (Expert's 30).
  const counts = lv.waves.map((w) => w.reduce((n, s) => n + ATOMS[s]!, 0));
  const barW = 22;
  const barMax = H - atomY - 28;
  const lane = (W - 20 - barW * 5) / 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-burst-picture={level}>
      {first.map((s, k) => (
        <circle key={`a${k}`} cx={gap * (k + 1)} cy={atomY} r={Math.max(3, RADIUS[s]! * scale)} fill={`var(${SIZE_COLOURS[s]})`} />
      ))}
      {counts.map((n, w) => {
        const h = Math.max(2, (barMax * n) / 30);
        return <rect key={`w${w}`} x={10 + w * (barW + lane)} y={H - 12 - h} width={barW} height={h} rx={2} fill="var(--jz-text-3)" opacity={0.85} />;
      })}
      {Array.from({ length: lv.lives }, (_, i) => (
        <circle key={`l${i}`} cx={W - 10 - i * 8} cy={6} r={2.5} fill="var(--jz-gold)" />
      ))}
    </svg>
  );
}

/** The lever in a few words, from the same settings. */
export function burstWords(level: Level): string {
  const lv = settingsAt(level);
  const total = lv.waves.reduce((n, w) => n + w.reduce((m, s) => m + ATOMS[s]!, 0), 0);
  const opening = lv.waves[0]?.length ?? 1;
  const first = opening === 1 ? "One atom to start" : `${opening === 2 ? "Two" : "Three"} atoms at once`;
  const lives = lv.lives === 3 ? "" : `, ${lv.lives} lives`;
  return `${first}, ${total} in all${lives}`;
}
