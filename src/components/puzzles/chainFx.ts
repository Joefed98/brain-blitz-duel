/**
 * Don't Break the Chain (`chain`) presentation effects (Polish, 13 Oct 2026). Display
 * only: draws on its own overlay canvas and is fired synchronously right before the
 * completed chain is submitted (never awaited). Nothing here reads or writes a tap,
 * a replay or a score.
 */
import { bump, easeOut, playOverlayFx, relRect, soundCue } from "./speedFx";

const FX_MS = 1100;
/** The shine runs along the links between these times. */
const SHINE_FROM = 60;
const SHINE_MS = 760;

interface Pt {
  x: number;
  y: number;
}

function polyLength(pts: Pt[]): number[] {
  const acc = [0];
  for (let i = 1; i < pts.length; i += 1) {
    acc.push(acc[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  }
  return acc;
}

function pointAt(pts: Pt[], acc: number[], d: number): Pt {
  for (let i = 1; i < pts.length; i += 1) {
    if (d <= acc[i]! || i === pts.length - 1) {
      const span = acc[i]! - acc[i - 1]! || 1;
      const k = Math.max(0, Math.min(1, (d - acc[i - 1]!) / span));
      return { x: pts[i - 1]!.x + (pts[i]!.x - pts[i - 1]!.x) * k, y: pts[i - 1]!.y + (pts[i]!.y - pts[i - 1]!.y) * k };
    }
  }
  return pts[0] ?? { x: 0, y: 0 };
}

/**
 * Finish effect: the gold chain on the board glows and a bright shine runs along every
 * link (board path and the link strip above it), then everything fades by ~1.1 s.
 * Reduced motion: the glow fades in and out in place, no travelling shine.
 *
 * `path` holds the final board's linked nodes as arena percentages (x, y 0–100);
 * `links` is the strip's link count (the chain length).
 */
export function fireChainFinish(root: Element | null, path: Pt[], links: number): void {
  if (!root) return;
  try {
    const rect = root.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const arenaEl = root.querySelector("[data-play-area]");
    const stripEl = root.querySelector("[data-chain-links]");
    const arena = arenaEl ? relRect(arenaEl, rect) : null;
    const strip = stripEl ? relRect(stripEl, rect) : null;
    const pts: Pt[] = arena ? path.map((p) => ({ x: arena.x + (p.x / 100) * arena.w, y: arena.y + (p.y / 100) * arena.h })) : [];
    const acc = polyLength(pts);
    const total = acc[acc.length - 1] ?? 0;
    soundCue("chain.finishShine");
    playOverlayFx({
      rect,
      ms: FX_MS,
      draw: ({ ctx, ms, reduced }) => {
        const fade = ms < 900 ? 1 : Math.max(0, 1 - (ms - 900) / 200);
        const glow = reduced ? bump(ms / FX_MS) : Math.min(1, ms / 180) * fade;
        const shine = reduced ? -1 : (ms - SHINE_FROM) / SHINE_MS;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Board chain: a gold glow over the linked path and a pulse on each charm.
        if (pts.length >= 2) {
          ctx.save();
          ctx.globalAlpha = 0.85 * glow;
          ctx.shadowColor = "rgba(255, 196, 60, 0.95)";
          ctx.shadowBlur = 16;
          ctx.strokeStyle = "#FFD45C";
          ctx.lineWidth = 5;
          ctx.beginPath();
          pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.stroke();
          ctx.restore();
        }
        pts.forEach((p, i) => {
          const passed = total > 0 ? acc[i]! / total : 0;
          const local = shine < 0 ? glow : bump((shine - passed) * 4 + 0.5);
          if (local <= 0) return;
          ctx.save();
          ctx.globalAlpha = Math.min(1, local) * fade;
          ctx.strokeStyle = "#FFE7A6";
          ctx.lineWidth = 2.5;
          ctx.shadowColor = "rgba(255, 200, 70, 0.9)";
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 19 + (reduced ? 0 : 4 * local), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        });
        if (shine >= 0 && shine <= 1 && pts.length >= 2) {
          const head = pointAt(pts, acc, easeOut(shine) * total);
          const g = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 22);
          g.addColorStop(0, "rgba(255, 255, 255, 0.95)");
          g.addColorStop(0.35, "rgba(255, 236, 170, 0.7)");
          g.addColorStop(1, "rgba(255, 210, 90, 0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(head.x, head.y, 22, 0, Math.PI * 2);
          ctx.fill();
        }

        // Link strip: every link redrawn in glowing gold, with a light band sweeping
        // left to right through them (same geometry as the strip's SVG).
        if (strip && links > 0) {
          const vbW = links * 10 + 4;
          const s = Math.min(strip.w / vbW, strip.h / 14);
          const ox = strip.x + (strip.w - vbW * s) / 2;
          const oy = strip.y + (strip.h - 14 * s) / 2;
          let stroke: string | CanvasGradient = "#FFD45C";
          if (shine >= 0 && shine <= 1) {
            const bx = ox + easeOut(shine) * (vbW * s + 80) - 40;
            const band = ctx.createLinearGradient(bx - 40, 0, bx + 40, 0);
            band.addColorStop(0, "#FFD45C");
            band.addColorStop(0.5, "#FFFBEA");
            band.addColorStop(1, "#FFD45C");
            stroke = band;
          }
          ctx.save();
          ctx.globalAlpha = glow;
          ctx.translate(ox, oy);
          ctx.scale(s, s);
          ctx.shadowColor = "rgba(255, 196, 60, 0.9)";
          ctx.shadowBlur = 8;
          ctx.strokeStyle = stroke;
          ctx.beginPath();
          for (let i = 0; i < links; i += 1) {
            const x = 2 + i * 10;
            if (i % 2 === 0) ctx.roundRect(x, 3, 13, 8, 4);
            else {
              ctx.moveTo(x + 1, 7);
              ctx.lineTo(x + 12, 7);
            }
          }
          ctx.lineWidth = 2.2;
          ctx.stroke();
          ctx.restore();
        }
      },
    });
  } catch {
    // Presentation only: an effect failure must never touch the round.
  }
}
