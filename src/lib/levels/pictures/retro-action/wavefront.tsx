/**
 * Wavefront's lever picture (D5, 23 Nov 2026; the lever-picture slot P2 builds, src/lib/levels/leverPicture.tsx, whose
 * worked example is Breaker's): the enemy bolts in the air. Drawn from the level's own settings (WAVEFRONT_LEVELS_WIDE in
 * src/lib/arcade/retroLevels.ts, the table the sim reads on wavRev 16): the bolts each volley carries from wave 1, a ship
 * diving when the divers start in the first waves, and the lives. Normal is wavRev 16 as rooms deal it (one bolt a volley,
 * divers from wave 3, three lives; the sim's own constants, mirrored here so the Games page never loads the sim).
 */
import { WAVEFRONT_LEVELS_WIDE } from "@/lib/arcade/retroLevels";
import type { Level } from "@/lib/levels/levels";

/** The slot's props (P2's LeverPictureProps, declared here until the slot is on main). */
export interface WavefrontPictureProps {
  level: Level;
  size: "l" | "s";
}

/** What the picture draws, from the level's settings (Normal: wavefront.ts's one bolt, divers from wave 3, WAV_LIVES 3). */
function settingsAt(level: Level): { volley: number; diveFrom: number; lives: number } {
  if (level === "normal") return { volley: 1, diveFrom: 3, lives: 3 };
  const lv = WAVEFRONT_LEVELS_WIDE[level];
  return { volley: lv.volley, diveFrom: lv.diveFrom, lives: lv.lives };
}

/** A small enemy ship (an arrowhead) centred on (x, y). */
function shipPath(x: number, y: number, w: number): string {
  const h = w * 0.7;
  return `M ${x} ${y + h / 2} L ${x - w / 2} ${y - h / 2} L ${x} ${y - h / 6} L ${x + w / 2} ${y - h / 2} Z`;
}

export function WavefrontPicture({ level, size }: WavefrontPictureProps) {
  const lv = settingsAt(level);
  const W = 180;
  const H = size === "l" ? 112 : 80;
  const cols = 7;
  const shipW = 14;
  const pitch = (W - 24) / (cols - 1);
  const rowY = 14;
  const xs = Array.from({ length: cols }, (_, i) => 12 + i * pitch);
  // The first volley's bolts, from columns spread across the row (the sim never fires two from one column).
  const firing = Array.from({ length: lv.volley }, (_, k) => Math.round(((k + 0.5) * cols) / lv.volley - 0.5));
  const boltH = size === "l" ? 9 : 7;
  const shipY = H - 12;
  const diving = lv.diveFrom > 0 && lv.diveFrom <= 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-wavefront-picture={level}>
      {xs.map((x, i) => (diving && i === cols - 2 ? null : <path key={i} d={shipPath(x, rowY, shipW)} fill="var(--jz-cyan)" opacity={0.85} />))}
      {diving ? <path d={shipPath(xs[cols - 2]! - 10, rowY + (H - rowY) * 0.42, shipW)} fill="var(--jz-cyan)" transform={`rotate(-25 ${xs[cols - 2]! - 10} ${rowY + (H - rowY) * 0.42})`} /> : null}
      {firing.map((c, k) => {
        const x = xs[c]!;
        // Staggered heights, as a volley's bolts leave their ships one after another.
        const y = rowY + 12 + ((k % 3) * (H - rowY - 40)) / 4;
        return <rect key={`b${k}`} x={x - 1.5} y={y} width={3} height={boltH} rx={1.5} fill="var(--jz-red)" />;
      })}
      <path d={`M ${W / 2} ${shipY - 7} L ${W / 2 - 10} ${shipY + 5} L ${W / 2 + 10} ${shipY + 5} Z`} fill="var(--jz-gold)" />
      {Array.from({ length: lv.lives }, (_, i) => (
        <circle key={`l${i}`} cx={W - 10 - i * 8} cy={H - 6} r={2.5} fill="var(--jz-gold)" />
      ))}
    </svg>
  );
}

/** The lever in a few words, from the same settings. */
export function wavefrontWords(level: Level): string {
  const lv = settingsAt(level);
  const bolts = lv.volley === 1 ? "One bolt at a time" : lv.volley === 2 ? "Bolts in pairs" : `Bolts in ${lv.volley === 3 ? "threes" : `${lv.volley}s`}`;
  const lives = lv.lives === 3 ? "" : `, ${lv.lives} lives`;
  const divers = lv.diveFrom === 0 ? ", no divers" : lv.diveFrom === 1 ? ", divers at once" : "";
  return `${bolts}${divers}${lives}`;
}
