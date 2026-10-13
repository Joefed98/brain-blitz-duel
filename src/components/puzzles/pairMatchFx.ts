/**
 * Matchmaker (`pairmatch`) presentation effects (Polish, 13 Oct 2026). Display only:
 * draws on its own overlay canvas and is fired synchronously right before the solved
 * flip list is submitted (never awaited). Nothing here reads or writes a flip or a score.
 */
import { bump, playOverlayFx, relRect, soundCue } from "./speedFx";

const FX_MS = 1100;
const WAVE_STEP_MS = 45;
const FLIP_MS = 440;

/**
 * Finish effect: a gold card face sweeps over every card in a diagonal wave (top-left
 * first), each one turning over once (horizontal squash through edge-on, with shading)
 * and fading. 9 diagonals × 45 ms + 440 ms ≈ 0.85 s, faded by 1.1 s. Reduced motion:
 * a gold tint fades in and out on every card at once, no turning.
 */
export function firePairWave(board: Element | null, cols: number): void {
  if (!board) return;
  try {
    const rect = board.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const cards = Array.from(board.querySelectorAll("[data-pair-card]")).map((el, i) => ({
      ...relRect(el, rect),
      diag: (i % cols) + Math.floor(i / cols),
    }));
    if (cards.length === 0) return;
    soundCue("pairmatch.cardWave");
    playOverlayFx({
      rect,
      ms: FX_MS,
      draw: ({ ctx, ms, reduced }) => {
        const fade = ms < 900 ? 1 : Math.max(0, 1 - (ms - 900) / 200);
        for (const c of cards) {
          const local = reduced ? ms / FX_MS : (ms - 40 - c.diag * WAVE_STEP_MS) / FLIP_MS;
          if (local <= 0 || local >= 1) continue;
          const alpha = (reduced ? 0.55 * bump(local) : 0.9 * bump(local)) * fade;
          const turn = reduced ? 1 : Math.cos(Math.PI * local); // 1 → -1: one full turn over
          const sx = Math.max(0.04, Math.abs(turn));
          const lit = turn >= 0; // front half: bright face; back half: shaded face
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(c.cx, c.cy);
          ctx.scale(sx, 1 + (reduced ? 0 : 0.06 * (1 - sx)));
          const w = c.w;
          const h = c.h;
          const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
          g.addColorStop(0, lit ? "#FFF0BF" : "#E8A92A");
          g.addColorStop(0.5, lit ? "#F5B82E" : "#B57C14");
          g.addColorStop(1, lit ? "#D9971C" : "#8A5E0E");
          ctx.fillStyle = g;
          ctx.shadowColor = "rgba(245, 184, 46, 0.65)";
          ctx.shadowBlur = reduced ? 0 : 10;
          ctx.beginPath();
          ctx.roundRect(-w / 2, -h / 2, w, h, 8);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = "rgba(255, 248, 220, 0.85)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          // Edge-on shading: darker as the card turns side-on.
          ctx.fillStyle = `rgba(0, 0, 0, ${0.35 * (1 - sx)})`;
          ctx.fill();
          ctx.restore();
        }
      },
    });
  } catch {
    // Presentation only: an effect failure must never touch the round.
  }
}
