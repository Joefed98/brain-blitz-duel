import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { ARCADE_REVEAL_RENDERERS, revealWorldH } from "@/lib/arcade/revealRenderers";
import { DEMO_LENGTH_TICKS, demoTouches, runAtTick as runFrame } from "@/lib/arcade/introDemo";
import { TICKS_PER_SECOND } from "@/lib/arcade/engine";
import { preloadGameArt } from "@/lib/arcade/gameArt.renderer";
import { preloadGameData } from "@/lib/duel/gamePreload";
import { getIntroDemoFn } from "@/lib/duel/introDemo.functions";
import type { PuzzleData, PuzzleType } from "@/lib/duel/types";
import { gameDisplayName } from "@/lib/duel/gameNames";

const RING_TICKS = 18; // 300 ms at 60 ticks a second
// Display-only switch for the white touch rings in demo playback.
const DEMO_SHOW_TOUCHES = false;

/** True when this type has an engine renderer, so its intro shows a demo. */
export function hasIntroDemo(type: PuzzleType): boolean {
  return Boolean(ARCADE_REVEAL_RENDERERS[type]);
}

/** A recorded demo the intro can play: its stored puzzle and run. */
export interface ArcadeIntroDemo {
  puzzle: PuzzleData;
  run: string;
}

/**
 * The saved engine demo for this type: "pending" while it loads, null when there is none to play
 * (never recorded, unreachable, or stopped by revision in getIntroDemoFn until it is re-recorded).
 */
export function useArcadeIntroDemo(type: PuzzleType): ArcadeIntroDemo | "pending" | null {
  const fetchDemo = useServerFn(getIntroDemoFn);
  const { data: demo, isPending } = useQuery({
    queryKey: ["intro-demo", type],
    queryFn: () => fetchDemo({ data: { type } }),
    staleTime: 5 * 60_000,
  });
  return useMemo(() => {
    if (demo && demo.puzzle?.type === type && demo.input_log?.run) return { puzzle: demo.puzzle, run: demo.input_log.run };
    return isPending ? "pending" : null;
  }, [demo, isPending, type]);
}

/** The demo's world shape (width / height), so the intro can reserve its box before it draws. */
export function introDemoAspect(type: PuzzleType, demo: ArcadeIntroDemo): number | null {
  const renderer = ARCADE_REVEAL_RENDERERS[type];
  if (!renderer) return null;
  const h = revealWorldH(renderer, demo.puzzle);
  return h > 0 ? renderer.worldW / h : null;
}

/**
 * Looping intro demo: the saved run replayed from its seed on the sim clock,
 * ticks 1–480, drawn with the game's own renderer. Visual only, silent.
 * Inside the intro's fixed box (IntroStage): the game's still shows until this
 * has drawn its first frame (onReady), never a blank canvas with a DEMO tag.
 */
export function IntroDemo({ type, demo, onReady }: { type: PuzzleType; demo: ArcadeIntroDemo; onReady?: () => void }) {
  const renderer = ARCADE_REVEAL_RENDERERS[type];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const worldH = renderer ? revealWorldH(renderer, demo.puzzle) : 0;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!renderer || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const scale = canvas.clientWidth / renderer.worldW;
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    const touches = demoTouches(demo.run, renderer.worldW, worldH);

    const drawTick = (tick: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      ctx.save();
      try {
        renderer.drawFinal(ctx, demo.puzzle, runFrame(demo.run, tick), "demo");
      } catch (error) {
        console.error("[intro demo] draw failed", error);
      }
      ctx.restore();
      if (!DEMO_SHOW_TOUCHES) return;
      for (const touch of touches) {
        const age = tick - touch.t;
        if (age < 0 || age >= RING_TICKS) continue;
        const fade = 1 - age / RING_TICKS;
        ctx.strokeStyle = `rgba(255,255,255,${0.9 * fade})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        const x = touch.x ?? renderer.worldW / 2;
        const y = touch.y ?? worldH - 40;
        ctx.arc(x, y, 14 + age, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    // No demo frame is drawn until the game's world art has loaded (or failed),
    // so a frame never shows code art that the art is about to replace.
    let cancelled = false;
    let frame = 0;
    // Letterfall's demo replays words, so it also waits for its dictionary.
    void Promise.all([preloadGameArt(type), preloadGameData(type)]).then(() => {
      if (cancelled) return;
      let lastTick = -1;
      const started = performance.now();
      const loop = (now: number) => {
        const tick = (Math.floor(((now - started) * TICKS_PER_SECOND) / 1000) % DEMO_LENGTH_TICKS) + 1;
        // Two sim ticks per drawn frame keeps the replay-to-tick cost low.
        if (tick !== lastTick && (tick - lastTick >= 2 || tick < lastTick)) {
          const first = lastTick < 0;
          lastTick = tick;
          drawTick(tick);
          if (first) readyRef.current?.();
        }
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [renderer, demo, type, worldH]);

  if (!renderer) return null;
  return (
    <div
      className="intro-demo relative overflow-hidden rounded-lg border border-border bg-background"
      style={{ aspectRatio: `${renderer.worldW} / ${worldH}` }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" aria-label={`${gameDisplayName(type)} demo`} />
      <span className="absolute right-1.5 top-1 font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
        Demo
      </span>
    </div>
  );
}
