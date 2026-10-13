/**
 * Flash (`reaction`) presentation effects (Polish, 13 Oct 2026). Display only: reads the
 * phone's own replay results, never writes a tap, a time or a score, and never delays
 * a submission.
 */
import { scoreReaction } from "@/lib/duel/scoring";
import { REACTION_MISS_MS } from "@/lib/duel/types";

import { END_OF_RUN_FX_SCORE, bump, easeOut, playOverlayFx, soundCue } from "./speedFx";

/** The phone's local Flash score (read-only), as the server would compute it from the same replay. */
export function localFlashScore(times: (number | null)[], falseStarts: number, flashCount: number): number {
  const count = Math.max(1, flashCount);
  let total = 0;
  for (let i = 0; i < count; i++) total += Math.min(REACTION_MISS_MS, Math.max(1, times[i] ?? REACTION_MISS_MS));
  return scoreReaction(Math.round(total / count), falseStarts);
}

export function flashEarnsGoldPulse(score: number): boolean {
  return score >= END_OF_RUN_FX_SCORE;
}

const GOLD = "245, 184, 46";

/** End-of-run gold pulse from the arena's centre: a soft gold bloom and one ring, gone by 1.1 s. */
export function fireFlashGoldPulse(arena: Element | null): void {
  if (!arena) return;
  try {
    const rect = arena.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    soundCue("reaction.goldPulse");
    playOverlayFx({
      rect,
      ms: 1100,
      draw: ({ ctx, ms, width, height, reduced }) => {
        const cx = width / 2;
        const cy = height / 2;
        const reach = Math.hypot(width, height) / 2;
        if (reduced) {
          // Still bloom, plain fade.
          const a = 0.32 * bump(ms / 1000);
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
          g.addColorStop(0, `rgba(${GOLD}, ${a})`);
          g.addColorStop(1, `rgba(${GOLD}, 0)`);
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, width, height);
          return;
        }
        // Bloom: grows 0–700 ms, fades by 1000 ms.
        const p = Math.min(1, ms / 700);
        const fade = ms < 450 ? 1 : Math.max(0, 1 - (ms - 450) / 550);
        const radius = Math.max(1, reach * (0.15 + 0.95 * easeOut(p)));
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        g.addColorStop(0, `rgba(${GOLD}, ${0.42 * fade})`);
        g.addColorStop(0.55, `rgba(${GOLD}, ${0.18 * fade})`);
        g.addColorStop(1, `rgba(${GOLD}, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
        // Ring: 0–900 ms.
        const rp = Math.min(1, ms / 900);
        const ringA = 0.85 * (1 - rp);
        if (ringA > 0.01) {
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(1, reach * easeOut(rp)), 0, Math.PI * 2);
          ctx.lineWidth = 6 * (1 - rp) + 1.5;
          ctx.strokeStyle = `rgba(255, 214, 120, ${ringA})`;
          ctx.shadowColor = `rgba(${GOLD}, ${ringA})`;
          ctx.shadowBlur = 16;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      },
    });
  } catch {
    // Presentation only: an effect failure must never touch the round.
  }
}
