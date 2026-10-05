import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { ARCADE_REVEAL_RENDERERS } from "@/lib/arcade/revealRenderers";
import { DEMO_LENGTH_TICKS, demoTouches, placeholderRun, runAtTick as runFrame } from "@/lib/arcade/introDemo";
import { TICKS_PER_SECOND } from "@/lib/arcade/engine";
import { getIntroDemoFn } from "@/lib/duel/introDemo.functions";
import type { PuzzleData, PuzzleType } from "@/lib/duel/types";

const RING_TICKS = 18; // 300 ms at 60 ticks a second

/** True when this type has an engine renderer, so its intro shows a demo. */
export function hasIntroDemo(type: PuzzleType): boolean {
  return Boolean(ARCADE_REVEAL_RENDERERS[type]);
}

/**
 * Looping intro demo: the saved run replayed from its seed on the sim clock,
 * ticks 1–480, drawn with the game's own renderer. Visual only, silent.
 */
export function IntroDemo({ type, puzzle }: { type: PuzzleType; puzzle: PuzzleData | null }) {
  const renderer = ARCADE_REVEAL_RENDERERS[type];
  const fetchDemo = useServerFn(getIntroDemoFn);
  const { data: demo } = useQuery({
    queryKey: ["intro-demo", type],
    queryFn: () => fetchDemo({ data: { type } }),
    staleTime: 5 * 60_000,
  });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const source = useMemo(() => {
    if (demo && demo.puzzle?.type === type && demo.input_log?.run) {
      return { puzzle: demo.puzzle, run: demo.input_log.run, live: true };
    }
    if (puzzle && puzzle.type === type) {
      const seed = "seed" in puzzle ? Number(puzzle.seed) : 1;
      return { puzzle, run: placeholderRun(seed), live: false };
    }
    return null;
  }, [demo, puzzle, type]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!renderer || !canvas || !source) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const scale = canvas.clientWidth / renderer.worldW;
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    const touches = source.live ? demoTouches(source.run, renderer.worldW, renderer.worldH) : [];

    const drawTick = (tick: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      ctx.save();
      try {
        renderer.drawFinal(ctx, source.puzzle, source.live ? runFrame(source.run, tick) : source.run);
      } catch (error) {
        console.error("[intro demo] draw failed", error);
      }
      ctx.restore();
      for (const touch of touches) {
        const age = tick - touch.t;
        if (age < 0 || age >= RING_TICKS) continue;
        const fade = 1 - age / RING_TICKS;
        ctx.strokeStyle = `rgba(255,255,255,${0.9 * fade})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        const x = touch.x ?? renderer.worldW / 2;
        const y = touch.y ?? renderer.worldH - 40;
        ctx.arc(x, y, 14 + age, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    if (!source.live) {
      drawTick(1);
      return;
    }
    let frame = 0;
    let lastTick = -1;
    const started = performance.now();
    const loop = (now: number) => {
      const tick = (Math.floor(((now - started) * TICKS_PER_SECOND) / 1000) % DEMO_LENGTH_TICKS) + 1;
      // Two sim ticks per drawn frame keeps the replay-to-tick cost low.
      if (tick !== lastTick && (tick - lastTick >= 2 || tick < lastTick)) {
        lastTick = tick;
        drawTick(tick);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [renderer, source]);

  if (!renderer) return null;
  return (
    <div
      className="intro-demo relative overflow-hidden rounded-lg border border-border bg-background"
      style={{ aspectRatio: `${renderer.worldW} / ${renderer.worldH}` }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" aria-label="Demo of the game being played" />
      <span className="absolute right-1.5 top-1 font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
        Demo
      </span>
    </div>
  );
}
