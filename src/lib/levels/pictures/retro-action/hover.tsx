/**
 * Hover's lever picture (D5, 23 Nov 2026; the lever-picture slot of the polish plan's section 6.1, Breaker's picture the
 * worked example): the height of the barrier gaps. Drawn from the level's own settings, HOVER_LEVELS_V12 (the table the
 * hoverRev 12 sim reads): two barriers whose gaps are the course's first gap (150 px, hover.ts HOVER_GAP_START) scaled by
 * the level's gapPct in the 727 px world (HOVER_EXPAND_H), the second one's slide shown by its arrows when the level's
 * gaps slide, and the saucer ringed once a shield it starts with. Normal is hoverRev 12's Normal: today's gaps, sliding,
 * one shield. The numbers are mirrored here so the Games page never loads the sim.
 */
import { HOVER_LEVELS_V12, type HoverLvV12 } from "@/lib/arcade/retroLevels";
import type { Level } from "@/lib/levels/levels";

/** The props the lever-picture slot passes (declared here: P2's slot is not on this branch yet). */
export interface HoverPictureProps {
  level: Level;
  size: "l" | "s";
}

/** hover.ts: the first gap (HOVER_GAP_START 150 px), the world's height (HOVER_EXPAND_H 727 px), Normal's one shield. */
const GAP_PX = 150;
const WORLD_H = 727;

function settingsAt(level: Level): Pick<HoverLvV12, "shield" | "gapPct" | "slide"> {
  if (level === "normal") return { shield: 1, gapPct: 100, slide: 1 };
  return HOVER_LEVELS_V12[level];
}

export function HoverPicture({ level, size }: HoverPictureProps) {
  const lv = settingsAt(level);
  const W = 180;
  const H = size === "l" ? 112 : 80;
  const pad = 6;
  const scale = (H - pad * 2) / WORLD_H;
  // The gap at 2.2× the world's scale, so a level's step reads at the row's small size too; capped inside the column.
  const gap = Math.min(H - pad * 4, GAP_PX * scale * 2.2 * (lv.gapPct / 100));
  const colW = size === "l" ? 16 : 12;
  const xs = [W * 0.48, W * 0.8];
  const centres = [H * 0.46, H * 0.56];
  const disc = size === "l" ? 6 : 5;
  const discX = W * 0.2;
  const discY = centres[0]!;
  const bars = xs.map((x, i) => {
    const c = centres[i]!;
    const top = c - gap / 2;
    const bottom = c + gap / 2;
    return (
      <g key={i}>
        <rect x={x - colW / 2} y={pad} width={colW} height={Math.max(0, top - pad)} rx={2} fill="var(--jz-cyan)" />
        <rect x={x - colW / 2} y={bottom} width={colW} height={Math.max(0, H - pad - bottom)} rx={2} fill="var(--jz-cyan)" />
        {i === 1 && lv.slide ? (
          <g stroke="var(--jz-text)" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={`M ${x + colW / 2 + 6} ${c - 6} l 4 -5 l 4 5`} />
            <path d={`M ${x + colW / 2 + 6} ${c + 6} l 4 5 l 4 -5`} />
          </g>
        ) : null}
      </g>
    );
  });
  const rings = Array.from({ length: lv.shield }, (_, k) => (
    <circle key={k} cx={discX} cy={discY} r={disc + 3 + k * 3} fill="none" stroke="var(--jz-cyan)" strokeWidth={1.25} opacity={1 - k * 0.25} />
  ));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-hover-picture={level}>
      {bars}
      {rings}
      <circle cx={discX} cy={discY} r={disc} fill="var(--jz-gold)" />
    </svg>
  );
}

/** The lever in a few words, from the same settings. */
export function hoverWords(level: Level): string {
  const lv = settingsAt(level);
  if (level === "normal") return "Today’s gaps, one shield";
  const gaps = lv.gapPct > 100 ? "Wider gaps" : lv.gapPct < 100 ? "Narrower gaps" : "Today’s gaps";
  const still = lv.slide ? "" : ", none sliding";
  const shields = lv.shield === 0 ? ", no shield" : lv.shield === 1 ? ", one shield" : `, ${lv.shield} shields`;
  return `${gaps}${still}${shields}`;
}
