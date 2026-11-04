/**
 * Eagle Eye art (Polish, 13 Oct 2026; redrawn 3 Nov 2026, Joe's audit: the old outline read as an aeroplane):
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
  "M16 1.6C17.7 1.6 18.7 3 18.6 4.8 18.5 6.4 17.8 7.4 18 8.4 18.2 9.4 19 10 20.2 9.6 22 8.4 23.6 7.4 25.4 7.4 27.8 7.6 30.2 9.4 31.6 12.6L31.9 14.4 30.3 14.2 31.4 15.9 30.9 16.7 29.4 16 30.3 17.8 29.6 18.5 28.3 17.4 28.7 19.4 27.8 19.8 26.7 18.2C24.8 17.7 22.6 17.6 20.8 17.8 19.4 18 18.7 19 18.6 20.8L22 27.2 21.2 28.8 19.6 28.6 18.4 29.9 16 29.2 13.6 29.9 12.4 28.6 10.8 28.8 10 27.2 13.4 20.8C13.3 19 12.6 18 11.2 17.8 9.4 17.6 7.2 17.7 5.3 18.2L4.2 19.8 3.3 19.4 3.7 17.4 2.4 18.5 1.7 17.8 2.6 16 1.1 16.7.6 15.9 1.7 14.2.1 14.4.4 12.6C1.8 9.4 4.2 7.6 6.6 7.4 8.4 7.4 10 8.4 11.8 9.6 13 10 13.8 9.4 14 8.4 14.2 7.4 13.5 6.4 13.4 4.8 13.3 3 14.3 1.6 16 1.6Z";

/** The hooked beak at the front of the head (drawn over the head in gold, a thin dark edge). */
export const EAGLE_BEAK_D = "M14.8 2.9C15 .3 17 .3 17.2 2.9 16.8 2.4 16.4 3.1 16 4 15.6 3.1 15.2 2.4 14.8 2.9Z";

/** Darker primaries: the spread fingers at each wing tip (inside the outline). */
const FLIGHT_BAND_D =
  "M28.8 9.8 31.6 12.6 31.9 14.4 30.3 14.2 31.4 15.9 30.9 16.7 29.4 16 30.3 17.8 29.6 18.5 28.3 17.4 28.7 19.4 27.8 19.8 26.7 18.2 27.6 13.6Z" +
  "M3.2 9.8.4 12.6.1 14.4 1.7 14.2.6 15.9 1.1 16.7 2.6 16 1.7 17.8 2.4 18.5 3.7 17.4 3.3 19.4 4.2 19.8 5.3 18.2 4.4 13.6Z";

/** Covert edges along both wings and the tail feathers. */
const FEATHER_D =
  // covert edge, both wings
  "M20.4 13.2Q24.6 10.6 29.4 12.6M11.6 13.2Q7.4 10.6 2.6 12.6" +
  // tail fan
  "M16 22.4V28.6M14.7 22.6 13.2 28.2M17.3 22.6 18.8 28.2";

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
        <circle cx="14.9" cy="4.6" r=".75" fill="var(--eagle-beak)" />
        <circle cx="17.1" cy="4.6" r=".75" fill="var(--eagle-beak)" />
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
