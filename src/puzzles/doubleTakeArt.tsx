/**
 * Double Take art (Polish, 13 Oct 2026): presentation only.
 *
 * Fairness: both pictures are drawn by exactly this code. The shop backdrop takes no
 * input at all, so it is identical in both panels; each sweet keeps the exact silhouette
 * of the shared SweetIcon, and its gloss / shade / detail strokes depend only on the
 * sweet's kind, drawn inside that silhouette and transformed with it. Nothing here
 * reads a difference, so it can never add, alter or hide one, and the tap rectangles
 * (drawn by the Panel) are unchanged.
 */
import { memo } from "react";

import { bump, easeOut, playOverlayFx, soundCue } from "@/components/puzzles/speedFx";
import type { SpotShapeKind } from "@/lib/duel/types";

const DETAIL = "var(--sweet-detail)";
const GLOSS = "var(--dt-gloss)";
const SHADE = "var(--dt-shade)";

/** One sweet in its 40-unit box: shared silhouette, then kind-only gloss and detail. */
export function SweetArt({ kind, fill }: { kind: SpotShapeKind; fill: string }) {
  switch (kind) {
    case "circle": // lollipop
      return (
        <g>
          <rect x="18" y="24" width="4" height="15" rx="1.5" fill={fill} />
          <rect x="18" y="24" width="1.4" height="15" fill={SHADE} opacity=".18" />
          <circle cx="20" cy="14" r="13" fill={fill} />
          <path d="M30.5 15.5a10.6 10.6 0 0 1-13 9" fill="none" stroke={SHADE} strokeOpacity=".2" strokeWidth="3" strokeLinecap="round" />
          <path d="M14 9c6-5 13 4 6 7" fill="none" stroke={DETAIL} strokeWidth="2.6" strokeLinecap="round" />
          <ellipse cx="13.2" cy="8.4" rx="3.4" ry="2" transform="rotate(-35 13.2 8.4)" fill={GLOSS} opacity=".5" />
        </g>
      );
    case "square": // wrapped sweet
      return (
        <g>
          <path d="M1 9l10 7v8L1 31zM39 9l-10 7v8l10 7z" fill={fill} />
          <path d="M3 13.5l7 4.6M3 26.5l7-4.6M37 13.5l-7 4.6M37 26.5l-7-4.6" fill="none" stroke={SHADE} strokeOpacity=".28" strokeWidth="1.3" strokeLinecap="round" />
          <rect x="9" y="8" width="22" height="24" rx="7" fill={fill} />
          <path d="M28.5 13v14" fill="none" stroke={SHADE} strokeOpacity=".2" strokeWidth="3" strokeLinecap="round" />
          <rect x="12.5" y="11.5" width="3.6" height="10" rx="1.8" fill={GLOSS} opacity=".45" />
        </g>
      );
    case "triangle": // ice cream cone, cherry off-centre
      return (
        <g>
          <path d="M8 19h24L20 39z" fill={fill} />
          <path d="M12 23l7 7" stroke={DETAIL} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path d="M27.6 23.4l-6.2 6.2M16.6 22.2l7.6 0" stroke={SHADE} strokeOpacity=".3" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <circle cx="20" cy="15" r="12" fill={fill} />
          <path d="M9.5 19.5c3 3.4 8 4.6 12.6 3.4" fill="none" stroke={SHADE} strokeOpacity=".22" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="29" cy="5" r="4" fill={fill} />
          <ellipse cx="15" cy="9.6" rx="3.2" ry="1.9" transform="rotate(-30 15 9.6)" fill={GLOSS} opacity=".48" />
          <circle cx="27.8" cy="3.8" r="1.1" fill={GLOSS} opacity=".6" />
        </g>
      );
    case "star": // cupcake
      return (
        <g>
          <path d="M6 20h28l-4 18H10z" fill={fill} />
          <path d="M13 23.5l1.2 12M27 23.5l-1.2 12" fill="none" stroke={SHADE} strokeOpacity=".28" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M20 24v11" stroke={DETAIL} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path d="M4 21c-2-7 4-11 8-10-1-8 15-11 17-3 7 0 10 7 7 13z" fill={fill} />
          <path d="M7 18.4c5 1.6 20 1.6 26 0" fill="none" stroke={SHADE} strokeOpacity=".22" strokeWidth="2" strokeLinecap="round" />
          <path d="M14.5 6.6c2.2-2 5.4-2.4 7.6-1.2" fill="none" stroke={GLOSS} strokeOpacity=".55" strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    case "hexagon": // doughnut
      return (
        <g>
          <path fill={fill} fillRule="evenodd" d="M20 1a19 19 0 1 0 0 38 19 19 0 0 0 0-38Zm0 12a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z" />
          <path d="M34.6 24.4a15.4 15.4 0 0 1-19.2 9.6" fill="none" stroke={SHADE} strokeOpacity=".2" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M7.4 15.2a13.6 13.6 0 0 1 8.2-8.4" fill="none" stroke={GLOSS} strokeOpacity=".5" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M29.5 9.5l1.6 1.6M32.4 19.6l2.2-.4M24.6 32.6l1.6 1.4M10.6 29.4l-1.4 1.8M6.4 21.4l-1.2 1.6" fill="none" stroke={GLOSS} strokeOpacity=".7" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );
    case "arrow": // candy cane
      return (
        <g>
          <path fill={fill} d="M1 17h23c3 0 5-2 5-5s-2-5-4-5c-3 0-4 2-4 4h-7c0-7 5-10 11-10 7 0 12 5 12 11 0 7-5 12-13 12H1z" />
          <path d="M6.5 17.6l-2 5.8M12.5 17.6l-2 5.8M18.5 17.6l-2 5.8M29.6 13.2l6.9 1.3M24.8 1.6l.6 5.4" fill="none" stroke={GLOSS} strokeOpacity=".55" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M2 22.6h21" fill="none" stroke={SHADE} strokeOpacity=".2" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
  }
}

/**
 * Sweet-shop backdrop: striped wallpaper and one wooden shelf under each row. It takes
 * no input, so it is the same in both pictures; memoised, it renders once per panel.
 */
export const ShopBackdrop = memo(function ShopBackdrop({ cols, rows, cell }: { cols: number; rows: number; cell: number }) {
  const width = cols * cell;
  const stripes = Array.from({ length: cols * 2 }, (_, i) => i).filter((i) => i % 2 === 1);
  return (
    <g aria-hidden="true" pointerEvents="none">
      <rect x="0" y="0" width={width} height={rows * cell} fill="var(--dt-wall)" />
      {stripes.map((i) => (
        <rect key={i} x={(i * cell) / 2} y="0" width={cell / 2} height={rows * cell} fill="var(--dt-wall-stripe)" />
      ))}
      {/* A glass jar behind every sweet (same for every cell, so it never marks one out). */}
      {Array.from({ length: rows * cols }, (_, i) => {
        const x = (i % cols) * cell;
        const y = Math.floor(i / cols) * cell;
        return (
          <g key={`j${i}`}>
            <rect x={x + 3} y={y + 4} width={cell - 6} height={cell - 10} rx="7" fill="var(--dt-jar)" stroke="var(--dt-jar-edge)" strokeWidth="1" />
            <rect x={x + 10} y={y + 1.5} width={cell - 20} height="3.5" rx="1.5" fill="var(--dt-jar-lid)" />
            <path d={`M${x + 7} ${y + 12}v${cell - 26}`} stroke="var(--dt-jar-shine)" strokeWidth="2" strokeLinecap="round" />
          </g>
        );
      })}
      {Array.from({ length: rows }, (_, row) => {
        const top = row * cell + cell - 6;
        return (
          <g key={row}>
            <rect x="0" y={top + 5} width={width} height="3" fill="var(--dt-shelf-shadow)" />
            <rect x="0" y={top} width={width} height="5" fill="var(--dt-shelf)" />
            <rect x="0" y={top} width={width} height="1.2" fill="var(--dt-shelf-top)" />
            <rect x="0" y={top + 4} width={width} height="1" fill="var(--dt-shelf-edge)" />
          </g>
        );
      })}
    </g>
  );
});

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** Where `cell` sits on screen inside one fitted (xMidYMid meet) panel. */
function cellPoint(svg: Element, cell: number, cols: number, cellW: number, viewW: number, viewH: number) {
  const r = svg.getBoundingClientRect();
  const scale = Math.min(r.width / viewW, r.height / viewH);
  const ox = r.left + (r.width - viewW * scale) / 2;
  const oy = r.top + (r.height - viewH * scale) / 2;
  return {
    x: ox + ((cell % cols) + 0.5) * cellW * scale,
    y: oy + (Math.floor(cell / cols) + 0.5) * cellW * scale,
    r: (cellW / 2) * scale,
  };
}

let glowSprite: HTMLCanvasElement | null = null;
/** A soft gold bloom, rendered once and reused (never rebuilt per frame). */
function bloomSprite(gold: string): HTMLCanvasElement | null {
  if (glowSprite || typeof document === "undefined") return glowSprite;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, gold);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glowSprite = canvas;
  return canvas;
}

/**
 * Finish effect: the six differences glow in both pictures at once — a soft gold bloom
 * and a ring that swells in and settles on each, 0–900 ms, faded by 1.1 s. Reduced
 * motion: the same glows, still, fading out.
 */
export function playDifferenceGlow(arena: Element, cells: number[], grid: { cols: number; cell: number; width: number; height: number }) {
  const panels = Array.from(arena.querySelectorAll("[data-dt-panel]"));
  if (!panels.length || !cells.length) return;
  const rect = arena.getBoundingClientRect();
  const gold = cssVar("--primary", "#F5B82E");
  const sprite = bloomSprite(gold);
  const spots = panels.flatMap((svg) =>
    cells.map((cell) => {
      const p = cellPoint(svg, cell, grid.cols, grid.cell, grid.width, grid.height);
      return { x: p.x - rect.left, y: p.y - rect.top, r: p.r };
    }),
  );
  soundCue("spotdiff.allFound");
  playOverlayFx({
    rect,
    ms: 1100,
    draw: ({ ctx, ms, reduced }) => {
      const alpha = reduced ? Math.max(0, 1 - ms / 1100) : ms < 850 ? 1 : Math.max(0, 1 - (ms - 850) / 250);
      const grow = reduced ? 1 : easeOut(Math.min(1, ms / 450));
      const pulse = reduced ? 0.7 : 0.55 + 0.45 * bump(Math.min(1, ms / 900));
      ctx.save();
      ctx.strokeStyle = gold;
      ctx.lineWidth = 3.5;
      ctx.shadowColor = gold;
      for (const s of spots) {
        if (sprite) {
          const b = s.r * 1.7;
          ctx.shadowBlur = 0;
          ctx.globalAlpha = alpha * pulse;
          ctx.drawImage(sprite, s.x - b, s.y - b, b * 2, b * 2);
        }
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * (1.55 - 0.55 * grow), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    },
  });
}
