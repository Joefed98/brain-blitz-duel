/**
 * Labyrinth finish effect (Polish, 13 Oct 2026): presentation only. Reads the player's
 * finished route (cell indices) and the board's on-screen box; writes nothing.
 */
import { easeOut, playOverlayFx, soundCue } from "@/components/puzzles/speedFx";

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/**
 * A glowing gold line runs along the player's route from start to exit (0–750 ms), a
 * bright spark at its head, then the whole line glows and fades by 1.1 s. Reduced
 * motion: the full route glows at once and fades, nothing travels.
 */
export function playMazeTrace(board: Element, path: number[], cols: number, rows: number): void {
  const svg = board.querySelector("svg") ?? board;
  if (path.length < 2) return;
  const rect = svg.getBoundingClientRect();
  const cw = rect.width / cols;
  const ch = rect.height / rows;
  const pts = path.map((cell) => ({ x: ((cell % cols) + 0.5) * cw, y: (Math.floor(cell / cols) + 0.5) * ch }));
  const gold = cssVar("--primary", "#F5B82E");
  soundCue("maze.trace");
  playOverlayFx({
    rect,
    ms: 1100,
    draw: ({ ctx, ms, reduced }) => {
      const drawn = reduced ? 1 : easeOut(Math.min(1, ms / 750));
      const alpha = reduced ? Math.max(0, 1 - ms / 1100) : ms < 850 ? 1 : Math.max(0, 1 - (ms - 850) / 250);
      const segs = (pts.length - 1) * drawn;
      const whole = Math.floor(segs);
      const frac = segs - whole;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(pts[0]!.x, pts[0]!.y);
      for (let i = 1; i <= whole; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
      let head = pts[whole]!;
      if (whole < pts.length - 1) {
        const a = pts[whole]!;
        const b = pts[whole + 1]!;
        head = { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
        ctx.lineTo(head.x, head.y);
      }
      ctx.strokeStyle = gold;
      ctx.shadowColor = gold;
      ctx.shadowBlur = 14;
      ctx.lineWidth = Math.max(3, cw * 0.36);
      ctx.globalAlpha = alpha * 0.45;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = Math.max(1.5, cw * 0.14);
      ctx.strokeStyle = "#FFF4D6";
      ctx.stroke();
      if (!reduced && drawn < 1) {
        ctx.fillStyle = "#FFFFFF";
        ctx.shadowColor = gold;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(head.x, head.y, Math.max(3, cw * 0.32), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
  });
}
