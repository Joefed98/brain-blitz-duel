/**
 * Tally (`countup`) presentation effects (Polish, 13 Oct 2026). Display only: draws on
 * its own overlay canvas and is fired synchronously right before the final answers are
 * submitted (never awaited). It shows only the player's own entries, never the truth.
 */
import { bump, easeOut, playOverlayFx, soundCue } from "./speedFx";

const FX_MS = 1100;
const STAGGER_MS = 110;
const TICK_MS = 520;
const LOCK_MS = 140;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/**
 * Finish effect: three tray counters (one per stage, the player's entries) slide in
 * over the tray, tick up from 0 to the entered number in turn, then lock with a gold
 * clasp. Main motion 0–800 ms, faded by 1.1 s. Reduced motion: the final numbers,
 * already locked, fade in and out in place.
 */
export function fireTallyFinish(tray: Element | null, entries: (number | null)[]): void {
  if (!tray) return;
  try {
    const rect = tray.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const n = Math.max(1, entries.length);
    const w = Math.min(86, (rect.width - 32) / n - 10);
    const h = Math.round(w * 0.78);
    const gap = Math.min(18, (rect.width - n * w) / (n + 1));
    const x0 = (rect.width - (n * w + (n - 1) * gap)) / 2;
    const y0 = rect.height / 2 - h / 2;
    const locked = new Set<number>();
    soundCue("countup.countersTick");
    playOverlayFx({
      rect,
      ms: FX_MS,
      draw: ({ ctx, ms, reduced }) => {
        const fade = ms < 880 ? 1 : Math.max(0, 1 - (ms - 880) / 200);
        const appear = reduced ? bump(ms / FX_MS) : Math.min(1, ms / 140) * fade;
        // Soft wash over the tray so the counters read clearly.
        ctx.fillStyle = `rgba(8, 8, 12, ${0.5 * appear})`;
        roundRect(ctx, 0, 0, rect.width, rect.height, 10);
        ctx.fill();
        entries.forEach((entry, i) => {
          const value = entry ?? 0;
          const local = reduced ? 1 : Math.max(0, Math.min(1, (ms - 60 - i * STAGGER_MS) / TICK_MS));
          const lockT = reduced ? 1 : Math.max(0, Math.min(1, (ms - 60 - i * STAGGER_MS - TICK_MS) / LOCK_MS));
          if (lockT >= 1 && !locked.has(i) && !reduced) {
            locked.add(i);
            if (locked.size === entries.length) soundCue("countup.countersLock");
          }
          const slide = reduced ? 0 : (1 - easeOut(Math.min(1, ms / 220))) * 14;
          const x = x0 + i * (w + gap);
          const y = y0 + slide;
          ctx.save();
          ctx.globalAlpha = appear;
          // Counter body: bevelled dark drum with a rim that turns gold as it locks.
          const body = ctx.createLinearGradient(0, y, 0, y + h);
          body.addColorStop(0, "#2A2C34");
          body.addColorStop(0.5, "#15161B");
          body.addColorStop(1, "#24262D");
          ctx.fillStyle = body;
          ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 4;
          roundRect(ctx, x, y, w, h, 10);
          ctx.fill();
          ctx.shadowColor = "transparent";
          ctx.lineWidth = 2 + lockT;
          ctx.strokeStyle = lockT > 0 ? `rgba(245, 184, 46, ${0.45 + 0.55 * lockT})` : "rgba(255, 255, 255, 0.22)";
          if (lockT > 0 && !reduced) {
            ctx.shadowColor = "rgba(245, 184, 46, 0.8)";
            ctx.shadowBlur = 14 * bump(lockT);
          }
          roundRect(ctx, x, y, w, h, 10);
          ctx.stroke();
          ctx.shadowBlur = 0;
          // Window glass line.
          ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
          roundRect(ctx, x + 4, y + 4, w - 8, h * 0.42, 7);
          ctx.fill();
          // Ticking digits: whole steps up to the entry, a slight roll between steps.
          const shown = entry === null ? "–" : String(Math.round(easeOut(local) * value));
          ctx.fillStyle = lockT > 0 ? "#FFD45C" : "#F2F4F7";
          ctx.font = `700 ${Math.round(h * 0.52)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(shown, x + w / 2, y + h / 2 + 1);
          // Clasp: a small gold bar that drops onto the counter top when it locks.
          if (lockT > 0) {
            const cw = w * 0.42;
            const cy = y - 6 - (1 - easeOut(lockT)) * 8;
            ctx.fillStyle = "#F5B82E";
            roundRect(ctx, x + (w - cw) / 2, cy, cw, 6, 3);
            ctx.fill();
            ctx.strokeStyle = "#F5B82E";
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(x + w / 2, cy, cw * 0.28, Math.PI, 0);
            ctx.stroke();
          }
          ctx.restore();
        });
      },
    });
  } catch {
    // Presentation only: an effect failure must never touch the round.
  }
}
