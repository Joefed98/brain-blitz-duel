/**
 * Bang On (`stopwatch`) presentation effects (Polish, 13 Oct 2026). Display only: reads
 * the phone's own distances, never writes a tap, a distance or a score, and never
 * delays a submission.
 */
import { scoreStopWatch } from "@/lib/duel/scoring";
import { STOPWATCH_MISS_MS } from "@/lib/duel/types";

import { END_OF_RUN_FX_SCORE, bump, playOverlayFx, relRect, soundCue } from "./speedFx";

/** The phone's local Bang On score (read-only) from its distances, as the server averages them. */
export function localBangOnScore(distances: number[], watchCount: number): number {
  const count = Math.max(1, watchCount);
  let total = 0;
  for (let i = 0; i < count; i++) total += Math.min(STOPWATCH_MISS_MS, distances[i] ?? STOPWATCH_MISS_MS);
  return scoreStopWatch(Math.round(total / count));
}

export function bangOnEarnsGoldFaces(score: number): boolean {
  return score >= END_OF_RUN_FX_SCORE;
}

const STAGGER_MS = 140;
const FLASH_MS = 420;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * End-of-run effect: every watch face on screen (`[data-bangon-face]` inside `root`,
 * the big face first, then the result cards in order) flashes gold in turn, each a
 * short fill and rim glint. Main motion done by ~900 ms, faded by 1100 ms.
 */
export function fireBangOnGoldFaces(root: Element | null): void {
  if (!root) return;
  try {
    const box = root.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return;
    const faces = Array.from(root.querySelectorAll("[data-bangon-face]")).map((el) => {
      const r = relRect(el, box);
      const radius = Number.parseFloat(getComputedStyle(el).borderTopLeftRadius) || 8;
      return { ...r, radius };
    });
    if (faces.length === 0) return;
    soundCue("stopwatch.goldFaces");
    const stagger = Math.min(STAGGER_MS, (900 - FLASH_MS) / Math.max(1, faces.length - 1));
    playOverlayFx({
      rect: box,
      ms: 1100,
      draw: ({ ctx, ms, reduced }) => {
        faces.forEach((face, i) => {
          const local = reduced ? ms / 1000 : (ms - i * stagger) / FLASH_MS;
          if (local <= 0 || local >= 1) return;
          const a = bump(local);
          roundRect(ctx, face.x, face.y, face.w, face.h, face.radius);
          ctx.fillStyle = `rgba(245, 184, 46, ${0.34 * a})`;
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = `rgba(255, 220, 130, ${0.95 * a})`;
          ctx.shadowColor = `rgba(245, 184, 46, ${0.9 * a})`;
          ctx.shadowBlur = reduced ? 0 : 14;
          ctx.stroke();
          ctx.shadowBlur = 0;
          if (!reduced) {
            // A glint crossing the crystal, left to right.
            ctx.save();
            roundRect(ctx, face.x, face.y, face.w, face.h, face.radius);
            ctx.clip();
            const gx = face.x - face.w * 0.3 + face.w * 1.6 * local;
            const g = ctx.createLinearGradient(gx - 30, 0, gx + 30, 0);
            g.addColorStop(0, "rgba(255, 240, 200, 0)");
            g.addColorStop(0.5, `rgba(255, 240, 200, ${0.55 * a})`);
            g.addColorStop(1, "rgba(255, 240, 200, 0)");
            ctx.fillStyle = g;
            ctx.fillRect(face.x, face.y, face.w, face.h);
            ctx.restore();
          }
        });
      },
    });
  } catch {
    // Presentation only: an effect failure must never touch the round.
  }
}
