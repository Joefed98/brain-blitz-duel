/**
 * Eagle Eye art (Polish, 13 Oct 2026; redrawn 3 Nov 2026, Joe's audit: the old outline read as an aeroplane; drawn
 * again 4 Nov 2026, Joe's review: it still read as a plane or a cross at grid size, so the wings are now a soaring bird's,
 * raised at the wrist and swept back to fingered tips, under a bigger round head and beak and over a narrower fanned tail):
 * presentation only. A north-facing eagle seen from above in a glide, an original drawing: a round head with a
 * hooked gold beak at the front, broad wings arched forward at the wrists with five spread primary "fingers" swept
 * back at each tip, and a scalloped, fanned tail. The head and beak are the narrow front and the fanned tail the
 * wide back, and the arched wings point the same way, so the facing reads at grid size. Same 32-unit box and the
 * same rotations (EAGLE_ANGLES) as before, so every direction is exactly the one the old art encoded. The take-off
 * effect draws the same outline on the overlay canvas.
 */
import { EAGLE_ANGLES } from "@/components/puzzles/refreshIcons";
import { bump, easeOut, playOverlayFx, relRect, soundCue } from "@/components/puzzles/speedFx";
import type { ArrowDir } from "@/lib/duel/types";

/** The north-facing eagle silhouette (head up, tail down), 32-unit box. */
export const EAGLE_BODY_D =
  "M16 2.4 17.2 2.6 18.2 3.2 18.8 4 19.1 5 19 6.2 18.6 7.2 18.3 8.2 18.2 9.2 19.1 8.8 20.2 8.2 21.3 7.4 22.5 6.6 23.8 5.9 25.2 5.4 26.7 5.4 28.2 6 29.4 7.1 30.4 8.7 31.3 10.7 31.8 13 30.4 12.4 31 15 29.3 13.6 29.5 16.2 27.8 14.2 27.4 16.4 26 13.6 25 12.6 23.6 12.1 22.2 12.1 20.7 12.7 19.4 13.8 18.6 15.5 18.1 17.3 17.8 19 18.9 20.8 19.9 22.8 20.6 24.9 21 27 19.8 26.8 19.2 29.2 17.8 28 16 30 14.2 28 12.8 29.2 12.2 26.8 11 27 11.4 24.9 12.1 22.8 13.1 20.8 14.2 19 13.9 17.3 13.4 15.5 12.6 13.8 11.3 12.7 9.8 12.1 8.4 12.1 7 12.6 6 13.6 4.6 16.4 4.2 14.2 2.5 16.2 2.7 13.6 1 15 1.6 12.4 0.2 13 0.7 10.7 1.6 8.7 2.6 7.1 3.8 6 5.3 5.4 6.8 5.4 8.2 5.9 9.5 6.6 10.7 7.4 11.8 8.2 12.9 8.8 13.8 9.2 13.7 8.2 13.4 7.2 13 6.2 12.9 5 13.2 4 13.8 3.2 14.8 2.6Z";

/** The hooked beak at the front of the head (drawn over the head in gold, a thin dark edge). */
export const EAGLE_BEAK_D = "M14.7 3.4C14.8-.2 17.2-.2 17.3 3.4 16.8 2.8 16.4 3.6 16 4.8 15.6 3.6 15.2 2.8 14.7 3.4Z";

/** Darker primaries: the spread fingers at each wing tip (inside the outline). */
const FLIGHT_BAND_D =
  "M29.4 7.1 31.3 10.7 31.8 13 30.4 12.4 31 15 29.3 13.6 29.5 16.2 27.8 14.2 27.4 16.4 26 13.6 27.6 9.6Z" +
  "M2.6 7.1.7 10.7.2 13 1.6 12.4 1 15 2.7 13.6 2.5 16.2 4.2 14.2 4.6 16.4 6 13.6 4.4 9.6Z";

/** Covert edges along both wings and the tail feathers. */
const FEATHER_D =
  // covert edge, both wings
  "M20.4 10.6Q24.6 8 29.4 9.8M11.6 10.6Q7.4 8 2.6 9.8" +
  // tail fan
  "M16 21V28.6M14.8 21.4 13.4 27.4M17.2 21.4 18.6 27.4";

/**
 * A north-facing eagle seen from above, rotated to `dir`. `currentColor` fills the
 * outline (white / gold / red as the cell state says), exactly as before.
 */
export function EagleArt({ dir, size = 28 }: { dir: ArrowDir; size?: number }) {
  const turn = `rotate(${EAGLE_ANGLES[dir]} 16 16)`;
  return (
    <svg width={size} height={size} style={{ width: size, height: size }} viewBox="0 0 32 32" aria-hidden="true" className="eye-eagle shrink-0" overflow="visible">
      {/* Shadow on the sky below: fixed down-right whatever the facing, so light comes from one side. */}
      <g transform="translate(.7 1.1)" opacity=".38">
        <path transform={turn} d={EAGLE_BODY_D} fill="var(--eye-shadow)" />
      </g>
      <g transform={turn}>
        <path fill="currentColor" d={EAGLE_BODY_D} />
        <path d={FLIGHT_BAND_D} fill="var(--eye-feather)" opacity=".22" />
        <path d={FEATHER_D} fill="none" stroke="var(--eye-feather)" strokeOpacity=".4" strokeWidth=".55" strokeLinecap="round" />
        <path d={EAGLE_BEAK_D} fill="var(--eagle-eye)" stroke="var(--eagle-beak)" strokeWidth=".45" strokeLinejoin="round" />
        <circle cx="14.9" cy="5.2" r=".8" fill="var(--eagle-beak)" />
        <circle cx="17.1" cy="5.2" r=".8" fill="var(--eagle-beak)" />
      </g>
    </svg>
  );
}

let paths: { body: Path2D; band: Path2D; feathers: Path2D; beak: Path2D } | null = null;
function eaglePaths() {
  if (!paths && typeof Path2D !== "undefined") {
    paths = { body: new Path2D(EAGLE_BODY_D), band: new Path2D(FLIGHT_BAND_D), feathers: new Path2D(FEATHER_D), beak: new Path2D(EAGLE_BEAK_D) };
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
    return { x: r.cx, y: r.cy, size: Math.min(r.w, r.h) * 0.66, angle, delay: i * 45 };
  });
  soundCue("symscan.takeoff");
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
        // Wing beat: the span narrows and opens three times as it climbs.
        const beat = 1 - 0.32 * bump(((lift + local * 3) % 1));
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(bird.x + dx, bird.y + dy);
        ctx.rotate(bird.angle);
        ctx.scale(scale * beat, scale);
        ctx.translate(-16, -16);
        ctx.shadowColor = gold;
        ctx.shadowBlur = 10;
        ctx.fillStyle = gold;
        ctx.fill(shapes.body);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = fade * 0.22;
        ctx.fillStyle = ink;
        ctx.fill(shapes.band);
        ctx.globalAlpha = fade * 0.42;
        ctx.strokeStyle = ink;
        ctx.lineWidth = 0.55;
        ctx.lineCap = "round";
        ctx.stroke(shapes.feathers);
        ctx.globalAlpha = fade;
        ctx.fillStyle = ink;
        ctx.fill(shapes.beak);
        ctx.beginPath();
        ctx.arc(14.9, 4.6, 0.75, 0, Math.PI * 2);
        ctx.moveTo(17.85, 4.6);
        ctx.arc(17.1, 4.6, 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    },
  });
}
