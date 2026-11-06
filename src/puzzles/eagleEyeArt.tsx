/**
 * Eagle Eye art (Polish, 13 Oct 2026; redrawn 3 Nov 2026 and 4 Nov 2026; drawn again 6 Nov 2026, Joe's review: seen
 * from above it still read as a propeller or a cross at grid size): presentation only. An eagle in flight seen from the
 * side, an original drawing: the near wing raised high in a stroke with five spread primary "fingers", the far wing
 * rising behind the head, a white head with a big hooked gold beak and a dark eye, a dark body and a fanned white tail
 * (the bald eagle's colouring, laid as a shade over the cell's own colour). The beak is the front, so the facing reads
 * at grid size. The art faces east; western facings are its mirror image (so the wings are always raised, never hung
 * upside down) and every facing is the old one's exact direction (EAGLE_ANGLES, the beak pointing the way the bird
 * faces). The take-off effect draws the same outline on the overlay canvas.
 */
import { EAGLE_ANGLES } from "@/components/puzzles/refreshIcons";
import { bump, easeOut, playOverlayFx, relRect, soundCue } from "@/components/puzzles/speedFx";
import type { ArrowDir } from "@/lib/duel/types";
import { useId } from "react";

/** The east-facing eagle silhouette (beak right, wings raised), 32-unit box: near wing, body, tail, head; far wing. */
export const EAGLE_BODY_D =
  "M27.6 13C26.6 12 24.4 11.7 23 12.6 22.2 13.2 21.8 14 21.6 15C21.6 11.4 20.6 8.4 19.2 6.2L17.4.6 16.4 3.4 14.6.4 13.8 3.6 12 1 11.6 4.4 9.6 2.4 9.6 5.6 7.4 4.4 8.2 7.2C10.4 9.6 12.6 12.8 13.8 16.6L10 17.2 3.4 15.2 3.4 16.4 1.6 16.2 2.4 17.8.8 18.6 2.4 19.6 1.4 21 3.2 21.2 2.6 22.8 10.4 20.2C12.6 22 15 22.6 16.8 22.4L16.2 24.4 17.6 24.8 18.8 22.2C21.6 21.8 24.4 20 25.6 17.8L27.4 16.8Z" +
  "M21.4 13.6C22 10 23 7.2 24.6 4.6L26.4 3.2 26 5.4 27.8 4.6 27 6.8 28.6 6.6 27.2 8.6C25.6 9.8 24.2 11.4 23.2 13.2Z";

/** The big hooked beak at the front of the head (gold, a thin dark edge). */
export const EAGLE_BEAK_D = "M27.2 12.9C29.2 12.5 31.2 13.4 31.7 15.2 32 16.3 31.6 17.4 30.9 17.9 31 16.9 30.6 16.3 29.8 16.2 28.8 16.1 27.9 16.5 27.3 16.9Z";

/** The eye, just behind the beak. */
export const EAGLE_EYE = { cx: 25.6, cy: 14.2, r: 0.75 } as const;

/** The dark plumage (wings and body; the head and the tail stay the cell's colour), clipped to the outline. */
const PLUMAGE_D = "M0 0H30L29 8.6 23.4 11.6 22.4 12.6 24.8 19.4V26H11L10.6 19.6 10.2 17.2 0 8Z";

/** A lighter shade on the tail, so the white head alone marks the front. */
const TAIL_D = "M0 13H10.6L11 26H0Z";

/** Covert edges along the near wing. */
const FEATHER_D = "M19.4 7.2Q15.6 6.4 10.2 6.6M18.4 11.4Q16 9.8 12.4 10";

/** How the east-facing art turns for a facing: a rotation, mirrored for the western half. */
export function eagleTurn(dir: ArrowDir): { rotate: number; mirror: boolean } {
  const a = EAGLE_ANGLES[dir];
  return a <= 180 ? { rotate: a - 90, mirror: false } : { rotate: a - 270, mirror: true };
}

/** How far the drawing sits above the box's centre (wing tips at the top, talons at 24.8): moved down by it. */
const EAGLE_DROP = 3.4;

/** The SVG transform for a facing (about the box's centre, the drawing centred in the box). */
function eagleTransform(dir: ArrowDir): string {
  const t = eagleTurn(dir);
  return `rotate(${t.rotate} 16 16)${t.mirror ? " translate(32 0) scale(-1 1)" : ""} translate(0 ${EAGLE_DROP})`;
}

/**
 * An eagle in flight facing `dir`. `currentColor` fills the outline (white / gold / red as the cell state says),
 * exactly as before; the plumage is a shade over it.
 */
export function EagleArt({ dir, size = 28 }: { dir: ArrowDir; size?: number }) {
  const turn = eagleTransform(dir);
  const clip = `eagle-clip-${useId().replace(/[^\w-]/g, "")}`;
  return (
    <svg width={size} height={size} style={{ width: size, height: size }} viewBox="0 0 32 32" aria-hidden="true" className="eye-eagle shrink-0" overflow="visible">
      <defs>
        <clipPath id={clip}>
          <path d={EAGLE_BODY_D} />
        </clipPath>
      </defs>
      {/* Shadow on the sky below: fixed down-right whatever the facing, so light comes from one side. */}
      <g transform="translate(.7 1.1)" opacity=".38">
        <path transform={turn} d={EAGLE_BODY_D} fill="var(--eye-shadow)" />
      </g>
      <g transform={turn}>
        <path fill="currentColor" d={EAGLE_BODY_D} />
        <g clipPath={`url(#${clip})`}>
          <path d={PLUMAGE_D} fill="var(--eye-feather)" opacity=".5" />
          <path d={TAIL_D} fill="var(--eye-feather)" opacity=".18" />
        </g>
        <path d={FEATHER_D} fill="none" stroke="var(--eye-feather)" strokeOpacity=".45" strokeWidth=".55" strokeLinecap="round" />
        <path d={EAGLE_BEAK_D} fill="var(--eagle-eye)" stroke="var(--eagle-beak)" strokeWidth=".8" strokeLinejoin="round" />
        <circle cx={EAGLE_EYE.cx} cy={EAGLE_EYE.cy} r={EAGLE_EYE.r} fill="var(--eagle-beak)" />
      </g>
    </svg>
  );
}

let paths: { body: Path2D; band: Path2D; feathers: Path2D; beak: Path2D } | null = null;
function eaglePaths() {
  if (!paths && typeof Path2D !== "undefined") {
    paths = { body: new Path2D(EAGLE_BODY_D), band: new Path2D(PLUMAGE_D), feathers: new Path2D(FEATHER_D), beak: new Path2D(EAGLE_BEAK_D) };
  }
  return paths;
}

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/**
 * Finish effect: every eagle facing the target lifts off its cell and flies away the way
 * it faces, wings beating, rising (growing) and fading by 1.1 s. Reduced motion: the same
 * eagles glow gold in place and fade, nothing moves.
 */
export function playEagleTakeoff(area: Element, birds: { cell: Element; dir: ArrowDir }[]): void {
  const shapes = eaglePaths();
  if (!shapes || birds.length === 0) return;
  const rect = area.getBoundingClientRect();
  const gold = cssVar("--primary", "#F5B82E");
  const ink = cssVar("--eagle-beak", "#0F1418");
  const flock = birds.map(({ cell, dir }, i) => {
    const r = relRect(cell, rect);
    const angle = (EAGLE_ANGLES[dir] * Math.PI) / 180;
    return { x: r.cx, y: r.cy, size: Math.min(r.w, r.h) * 0.66, angle, turn: eagleTurn(dir), delay: i * 45 };
  });
  soundCue("symscan.takeoff");
  // Joe's eagle cry (6 Nov 2026) over the wingbeats as the flock lifts off.
  soundCue("symscan.eagle");
  playOverlayFx({
    rect,
    ms: 1100,
    draw: ({ ctx, ms, reduced, width, height }) => {
      const reach = Math.hypot(width, height) * 0.5;
      for (const bird of flock) {
        // 0–260 ms: the bird lifts in place (grows); then it flies the way it faces.
        const t = ms - bird.delay;
        const lift = easeOut(Math.max(0, Math.min(1, t / 260)));
        const local = Math.max(0, Math.min(1, (t - 260) / 700));
        const fade = ms < 760 ? 1 : Math.max(0, 1 - (ms - 760) / 320);
        if (reduced) {
          const a = Math.max(0, 1 - ms / 1100);
          ctx.save();
          ctx.globalAlpha = a * 0.55;
          ctx.fillStyle = gold;
          ctx.beginPath();
          ctx.arc(bird.x, bird.y, bird.size * 0.75, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          continue;
        }
        // Lift-off ring on the cell it leaves.
        const ring = Math.min(1, ms / 380);
        if (ring < 1) {
          ctx.save();
          ctx.globalAlpha = (1 - ring) * 0.8;
          ctx.strokeStyle = gold;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(bird.x, bird.y, bird.size * (0.45 + ring * 0.6), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        const travel = local * local * reach;
        const dx = Math.sin(bird.angle) * travel;
        const dy = -Math.cos(bird.angle) * travel;
        // Faint gold slipstream behind the bird.
        if (local > 0.05) {
          ctx.save();
          ctx.globalAlpha = 0.35 * fade * (1 - local * 0.6);
          ctx.strokeStyle = gold;
          ctx.lineWidth = Math.max(1.5, bird.size * 0.08);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(bird.x + dx * 0.35, bird.y + dy * 0.35);
          ctx.lineTo(bird.x + dx * 0.9, bird.y + dy * 0.9);
          ctx.stroke();
          ctx.restore();
        }
        const scale = (bird.size / 32) * (1 + 0.3 * lift + 0.25 * local);
        // Wing beat: the raised wings fold down and lift again three times as it climbs.
        const beat = 1 - 0.32 * bump(((lift + local * 3) % 1));
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(bird.x + dx, bird.y + dy);
        ctx.rotate((bird.turn.rotate * Math.PI) / 180);
        ctx.scale(bird.turn.mirror ? -scale : scale, scale * beat);
        ctx.translate(-16, -16 + EAGLE_DROP);
        ctx.shadowColor = gold;
        ctx.shadowBlur = 10;
        ctx.fillStyle = gold;
        ctx.fill(shapes.body);
        ctx.shadowBlur = 0;
        ctx.save();
        ctx.clip(shapes.body);
        ctx.globalAlpha = fade * 0.45;
        ctx.fillStyle = ink;
        ctx.fill(shapes.band);
        ctx.restore();
        ctx.globalAlpha = fade * 0.42;
        ctx.strokeStyle = ink;
        ctx.lineWidth = 0.55;
        ctx.lineCap = "round";
        ctx.stroke(shapes.feathers);
        ctx.globalAlpha = fade;
        ctx.fillStyle = ink;
        ctx.fill(shapes.beak);
        ctx.beginPath();
        ctx.arc(EAGLE_EYE.cx, EAGLE_EYE.cy, EAGLE_EYE.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    },
  });
}
