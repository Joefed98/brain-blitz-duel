/**
 * Eagle Eye art (Polish, 13 Oct 2026): presentation only. The eagle keeps the exact
 * silhouette of the shared EagleIcon (same path, same 32-unit box, same rotation), so
 * its facing stays the dominant cue; feather strokes, a darker flight-feather band and a
 * soft screen-fixed shadow are drawn inside / under that outline. The take-off effect
 * draws the same outline on the overlay canvas.
 */
import { EAGLE_ANGLES } from "@/components/puzzles/refreshIcons";
import { bump, easeOut, playOverlayFx, relRect, soundCue } from "@/components/puzzles/speedFx";
import type { ArrowDir } from "@/lib/duel/types";

/** The shared north-facing silhouette (identical to EagleIcon's outline). */
export const EAGLE_BODY_D =
  "M16 .8 18.9 4.6 18.7 9.2 21.4 11.4 30.6 20.2 31.4 21.8 30 21.6 30.4 23.2 29 22.6 29.4 23.8 27.8 22.6 19.9 17.6 18.4 22.4 21.2 29.4 19.6 29.2 18.8 30.8 17.4 29.8 16 31 14.6 29.8 13.2 30.8 12.4 29.2 10.8 29.4 13.6 22.4 12.1 17.6 4.2 22.6 2.6 23.8 3 22.6 1.6 23.2 2 21.6 .6 21.8 1.4 20.2 10.6 11.4 13.3 9.2 13.1 4.6Z";

/** Darker flight feathers along each wing's trailing edge (inside the outline). */
const FLIGHT_BAND_D =
  "M20.5 15.1 29.3 20.5 30 21.6 30.4 23.2 29 22.6 29.4 23.8 27.8 22.6 19.9 17.6Z" +
  "M11.5 15.1 2.7 20.5 2 21.6 1.6 23.2 3 22.6 2.6 23.8 4.2 22.6 12.1 17.6Z";

/** Covert edges, primary fingers, secondaries, tail feathers and the white-head line. */
const FEATHER_D =
  // covert edge, both wings
  "M19.6 12.7Q24 15.1 28.9 19.4M12.4 12.7Q8 15.1 3.1 19.4" +
  // primary fingers
  "M25.4 18.2 29.4 21.8M24.2 18.7 28.2 22.4M6.6 18.2 2.6 21.8M7.8 18.7 3.8 22.4" +
  // secondaries
  "M22.2 16.3 21.7 18.4M24.2 17.4 23.7 19.6M9.8 16.3 10.3 18.4M7.8 17.4 8.3 19.6" +
  // tail fan
  "M16 23.4V29.8M14.8 23.4 13.6 29.4M17.2 23.4 18.4 29.4" +
  // white head meets the body
  "M13.7 9.7Q16 11 18.3 9.7";

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
        <path d={FLIGHT_BAND_D} fill="var(--eye-feather)" opacity=".16" />
        <ellipse cx="16" cy="15.6" rx="2.1" ry="4.4" fill="var(--eye-feather)" opacity=".1" />
        <path d={FEATHER_D} fill="none" stroke="var(--eye-feather)" strokeOpacity=".42" strokeWidth=".55" strokeLinecap="round" />
        <path d="M16 1 17.4 3.2 16 4" fill="none" stroke="var(--eagle-beak)" strokeWidth="1.1" strokeLinejoin="round" />
        <circle cx="16" cy="5.4" r="1.3" fill="var(--eagle-eye)" />
      </g>
    </svg>
  );
}

let paths: { body: Path2D; band: Path2D; feathers: Path2D } | null = null;
function eaglePaths() {
  if (!paths && typeof Path2D !== "undefined") {
    paths = { body: new Path2D(EAGLE_BODY_D), band: new Path2D(FLIGHT_BAND_D), feathers: new Path2D(FEATHER_D) };
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
        ctx.globalAlpha = fade * 0.16;
        ctx.fillStyle = ink;
        ctx.fill(shapes.band);
        ctx.globalAlpha = fade * 0.42;
        ctx.strokeStyle = ink;
        ctx.lineWidth = 0.55;
        ctx.lineCap = "round";
        ctx.stroke(shapes.feathers);
        ctx.globalAlpha = fade;
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.arc(16, 5.4, 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    },
  });
}
