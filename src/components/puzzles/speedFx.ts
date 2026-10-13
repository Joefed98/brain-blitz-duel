/**
 * Speed & Attention presentation helpers (Polish, 13 Oct 2026): named sound cues and
 * short completion effects. Presentation only: nothing here reads or writes a sim,
 * a tap log, an answer or a score, and nothing delays a submission or a reveal.
 */
import { prefersReducedMotion } from "@/lib/motion";
import { demoHushed } from "@/lib/sound";
import { soundCue as dispatchSoundCue } from "@/lib/fx/soundCues";

/** Named cue for a future sound pass (shared "duelz-sound" event), silent while an intro demo is hushed. No audio is played. */
export function soundCue(cue: string): void {
  if (demoHushed()) return;
  dispatchSoundCue(cue);
}

/** The completion effect never runs longer than this. */
export const COMPLETION_FX_MAX_MS = 1200;

export interface OverlayFrame {
  ctx: CanvasRenderingContext2D;
  /** 0 → 1 over the effect. */
  t: number;
  /** Milliseconds since the effect started. */
  ms: number;
  width: number;
  height: number;
  /** prefers-reduced-motion: draw a still or a plain fade, no movement. */
  reduced: boolean;
}

export interface OverlayFx {
  /** Fixed-position box the effect is drawn in (page CSS px), e.g. the board's rect. */
  rect: DOMRect;
  /** Effect length, capped at COMPLETION_FX_MAX_MS. */
  ms: number;
  draw: (frame: OverlayFrame) => void;
}

/**
 * Draws a short effect on its own canvas, fixed above the page over `rect`, pointer
 * events off. It lives on document.body, so it outlives the stage (a room locks and
 * dims the board, practice swaps in the reveal) and is removed when it ends. The
 * rect is clipped to start below the round's timer, so it never covers it.
 */
export function playOverlayFx({ rect, ms, draw }: OverlayFx): () => void {
  if (typeof document === "undefined" || demoHushed()) return () => undefined;
  const duration = Math.min(COMPLETION_FX_MAX_MS, Math.max(1, ms));
  let top = rect.top;
  const timer = document.querySelector("[data-game-region]")?.getBoundingClientRect();
  if (timer && top < timer.top) top = timer.top;
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.bottom - top));
  const canvas = document.createElement("canvas");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset["completionFx"] = "";
  Object.assign(canvas.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
    pointerEvents: "none",
    zIndex: "60",
  });
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => undefined;
  document.body.appendChild(canvas);
  const reduced = prefersReducedMotion();
  const offsetY = top - rect.top;
  const start = performance.now();
  let frame = 0;
  const stop = () => {
    cancelAnimationFrame(frame);
    canvas.remove();
  };
  const tick = (now: number) => {
    const elapsed = now - start;
    if (elapsed >= duration) return stop();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.translate(0, -offsetY);
    draw({ ctx, t: elapsed / duration, ms: elapsed, width, height: rect.height, reduced });
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return stop;
}

/** Rect of `el` relative to `box` (both page rects), for drawing board parts in an overlay. */
export function relRect(el: Element, box: DOMRect): { x: number; y: number; w: number; h: number; cx: number; cy: number } {
  const r = el.getBoundingClientRect();
  const x = r.left - box.left;
  const y = r.top - box.top;
  return { x, y, w: r.width, h: r.height, cx: x + r.width / 2, cy: y + r.height / 2 };
}

/** Ease helpers for effects. */
export const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
export const bump = (t: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, t)));

/** Phone-side threshold for the end-of-run effect in Flash, Bang On, Bonk and Pull!. */
export const END_OF_RUN_FX_SCORE = 120;

type PreviewMap = Record<string, () => void>;

/**
 * Dev server only: lets the screenshot tool fire a game's completion effect on the
 * live board (`window.__duelzFxPreview.<gameId>()`). Never present in a production build.
 */
export function registerFxPreview(game: string, fire: () => void): () => void {
  const env = (import.meta as { env?: { DEV?: boolean } }).env;
  if (!env?.DEV || typeof window === "undefined") return () => undefined;
  const w = window as unknown as { __duelzFxPreview?: PreviewMap };
  const map = (w.__duelzFxPreview ??= {});
  map[game] = fire;
  return () => {
    if (map[game] === fire) delete map[game];
  };
}
