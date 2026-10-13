/**
 * Ascend (`numhunt`) presentation effects (Polish, 13 Oct 2026). Display only: draws on
 * its own overlay canvas, never touches the tap log, and is fired synchronously right
 * before the finished log is submitted (never awaited).
 */
import type { HuntSpot } from "@/lib/duel/types";

import { easeOut, playOverlayFx, soundCue } from "./speedFx";

const DISC_PX = 44;
const STAGGER_MS = 26;
const POP_MS = 420;
const RISE_PX = 30;

/**
 * Finish effect: each disc, in the order it was tapped (smallest number first), pops
 * upwards in gold and fades. 24 discs × 26 ms + 420 ms ≈ 1.0 s; reduced motion is a
 * glow in place, no movement.
 */
export function fireAscendFinish(arena: Element | null, spots: HuntSpot[]): void {
  if (!arena || spots.length === 0) return;
  try {
    const rect = arena.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const order = spots
      .map((spot) => ({ x: (spot.x / 100) * rect.width, y: (spot.y / 100) * rect.height, n: spot.n }))
      .sort((a, b) => a.n - b.n);
    const stagger = Math.min(STAGGER_MS, (1050 - POP_MS) / Math.max(1, order.length - 1));
    soundCue("numhunt.discsPop");
    playOverlayFx({
      rect,
      ms: 1100,
      draw: ({ ctx, ms, reduced }) => {
        const r = DISC_PX / 2;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `700 ${Math.round(DISC_PX * 0.46)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        order.forEach((disc, i) => {
          const local = reduced ? ms / 1000 : (ms - i * stagger) / POP_MS;
          if (local <= 0 || local >= 1) return;
          const alpha = reduced ? Math.sin(Math.PI * local) : local < 0.35 ? 1 : 1 - (local - 0.35) / 0.65;
          const lift = reduced ? 0 : RISE_PX * easeOut(local);
          const scale = reduced ? 1 : 1 + 0.18 * Math.sin(Math.PI * Math.min(1, local * 1.6));
          const y = disc.y - lift;
          ctx.save();
          ctx.globalAlpha = Math.max(0, alpha);
          ctx.translate(disc.x, y);
          ctx.scale(scale, scale);
          const g = ctx.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.1, 0, 0, r);
          g.addColorStop(0, "#FFE7A6");
          g.addColorStop(0.55, "#F5B82E");
          g.addColorStop(1, "#C98A12");
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.shadowColor = "rgba(245, 184, 46, 0.7)";
          ctx.shadowBlur = reduced ? 0 : 12;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#1A1305";
          ctx.fillText(String(disc.n), 0, 1);
          ctx.restore();
        });
      },
    });
  } catch {
    // Presentation only: an effect failure must never touch the round.
  }
}
