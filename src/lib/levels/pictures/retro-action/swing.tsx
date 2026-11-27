/**
 * Grappler's lever picture (D5, 23 Nov 2026; the lever-picture slot of P2's Breaker example): the pterodactyl's chase,
 * drawn from the level's own settings. A strip of the course (vines hanging from the canopy, the hero on one), with the
 * part of the course the pterodactyl flies over shaded and its pace as the length of its arrow. The settings are the
 * registry's display copy of the sim's ladder table (GAME_LEVELS.swing, mirroring SWING_V19_LEVELS in
 * src/lib/arcade/swing.ts; swing-ladder-check proves the two agree), so the Games page never loads the sim. Normal is
 * swingRev 19 as rooms deal it: the pterodactyl over the last quarter at 2.4 px a tick.
 */
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import type { Level } from "@/lib/levels/levels";

/** The slot's props (P2's LeverPictureProps, declared here until the slot lands on main). */
export interface SwingPictureProps {
  level: Level;
  size: "l" | "s";
}

/** What the picture reads: where the pterodactyl starts and how fast it flies. */
export interface SwingChase {
  /** "none", "last quarter" or "first vine". */
  chase: string;
  /** Its pace, px a tick (0: none). */
  chasePx: number;
}
/** Normal (swingRev 19's Normal, as today's): the last quarter at 2.4 px a tick (SWING_V14_CHASE_PACE). */
const NORMAL: SwingChase = { chase: "last quarter", chasePx: 2.4 };
/** The fastest pace drawn the whole arrow's length. */
const MAX_PX = 4.5;

export function swingChaseAt(level: Level): SwingChase {
  if (level === "normal") return NORMAL;
  const s = gameLevelSettings<SwingChase>("swing", level);
  return s ? { chase: s.chase, chasePx: s.chasePx } : NORMAL;
}

export function SwingPicture({ level, size }: SwingPictureProps) {
  const c = swingChaseAt(level);
  const W = 180;
  const H = size === "l" ? 112 : 80;
  const pad = 8;
  const canopy = pad + 4;
  const vines = 7;
  const span = (W - pad * 2) / (vines - 1);
  const ropeLen = size === "l" ? 34 : 22;
  const groundY = H - pad - 6;
  const from = c.chase === "first vine" ? 0 : c.chase === "last quarter" ? 0.75 : 1;
  const shadeX = pad + (W - pad * 2) * from;
  const heroX = pad + span * 2;
  const heroY = canopy + ropeLen;
  const arrow = (Math.min(MAX_PX, c.chasePx) / MAX_PX) * (W * 0.32);
  const birdX = c.chase === "first vine" ? heroX - 34 : shadeX + 10;
  const birdY = heroY + 16;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-swing-picture={level}>
      <rect x={pad} y={canopy - 4} width={W - pad * 2} height={3} rx={1.5} fill="var(--jz-win)" opacity={0.7} />
      {c.chase !== "none" && <rect x={shadeX} y={canopy} width={W - pad - shadeX} height={groundY - canopy} fill="var(--jz-red)" opacity={0.16} />}
      {Array.from({ length: vines }, (_, i) => {
        const x = pad + i * span;
        return (
          <g key={i}>
            <line x1={x} y1={canopy} x2={x} y2={canopy + (i === 2 ? ropeLen : ropeLen * 0.55)} stroke="var(--jz-win)" strokeWidth={1.5} opacity={0.85} />
            <circle cx={x} cy={canopy} r={2.5} fill="var(--jz-gold)" />
          </g>
        );
      })}
      <circle cx={heroX} cy={heroY} r={5} fill="var(--jz-gold)" />
      {c.chase !== "none" && (
        <g data-swing-pterodactyl={c.chase}>
          <path d={`M ${birdX - 9} ${birdY - 4} L ${birdX} ${birdY + 2} L ${birdX + 9} ${birdY - 4} L ${birdX} ${birdY - 1} Z`} fill="var(--jz-red)" />
          <line x1={birdX + 11} y1={birdY} x2={birdX + 11 + arrow} y2={birdY} stroke="var(--jz-red)" strokeWidth={2} />
          <path d={`M ${birdX + 11 + arrow} ${birdY - 3} L ${birdX + 15 + arrow} ${birdY} L ${birdX + 11 + arrow} ${birdY + 3} Z`} fill="var(--jz-red)" />
        </g>
      )}
      <rect x={pad} y={groundY} width={W - pad * 2} height={3} rx={1.5} fill="var(--jz-text-3)" opacity={0.5} />
    </svg>
  );
}

/** The lever in a few words, from the same settings. */
export function swingWords(level: Level): string {
  const c = swingChaseAt(level);
  if (c.chase === "none") return "No pterodactyl";
  if (c.chase === "last quarter") return "A pterodactyl over the last quarter";
  return c.chasePx > swingChaseAt("hard").chasePx ? "A faster pterodactyl from the first vine" : "A pterodactyl from the first vine";
}
