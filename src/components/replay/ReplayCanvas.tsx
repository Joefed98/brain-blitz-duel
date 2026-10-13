import { useEffect, useRef } from "react";

import { TICKS_PER_SECOND } from "@/lib/arcade/engine";
import { soundCue, SHARED_CUES } from "@/lib/replay/cues";
import type { HighlightClip } from "@/lib/replay/pick";
import { SLOW_SPEED } from "@/lib/replay/pick";
import type { PlaybackDrawer } from "@/lib/replay/playback.renderer";
import type { ReplayTimeline } from "@/lib/replay/timeline";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type PlaybackPlan = { kind: "clips"; clips: HighlightClip[] } | { kind: "full" };

/** A frame that takes longer than this on average (ms, sim + draw) can't hold playback: go lighter. */
export const SLOW_FRAME_MS = 28;
const MEASURE_FRAMES = 40;

export interface ReplayCanvasControls {
  playing: boolean;
  /** Base speed: 1 = real time, 0.5 = slow motion, 2 = double. */
  speed: number;
  /** A requested jump (tick), applied once per change of `seekId`. */
  seekTo?: number;
  seekId?: number;
}

/**
 * Plays a replay timeline on a canvas with the game's own renderer: a list of
 * highlight clips (slowed to half speed around each moment) or the full run
 * with play / speed / seek. Display only: it reads states from the timeline
 * and never writes to a sim. Calls `onSlow` when the device can't hold the
 * frame rate, so the caller can switch to a still.
 */
export function ReplayCanvas({
  timeline,
  drawer,
  plan,
  controls,
  onClip,
  onTick,
  onEnd,
  onSlow,
  label,
}: {
  timeline: ReplayTimeline<any>;
  drawer: PlaybackDrawer;
  plan: PlaybackPlan;
  controls: ReplayCanvasControls;
  onClip?: (index: number) => void;
  onTick?: (tick: number) => void;
  onEnd?: () => void;
  onSlow?: () => void;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  const callbacks = useRef({ onClip, onTick, onEnd, onSlow });
  callbacks.current = { onClip, onTick, onEnd, onSlow };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const fit = () => {
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    };
    fit();

    const clips = plan.kind === "clips" ? plan.clips : null;
    let clipIndex = 0;
    let sim = clips ? (clips[0]?.start ?? 0) : 0;
    let jumped = true;
    let ended = false;
    let slowNow = false;
    let lastWall = performance.now();
    let lastSeekId = controlsRef.current.seekId;
    let lastDrawn = -1;
    const firedMoments = new Set<string>();
    let frames = 0;
    let cost = 0;
    let frame = 0;

    if (clips && clips.length) {
      soundCue(SHARED_CUES.highlightClip);
      callbacks.current.onClip?.(0);
    }

    const draw = (tick: number) => {
      const started = performance.now();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = canvas.width / dpr / drawer.worldW;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      ctx.save();
      try {
        drawer.draw(ctx, timeline.stateAt(tick), jumped);
      } catch (error) {
        console.error("[replay] draw failed", error);
      }
      ctx.restore();
      jumped = false;
      lastDrawn = tick;
      // Frame budget: sim stepping plus drawing, averaged over the first frames.
      if (frames < MEASURE_FRAMES) {
        frames += 1;
        cost += performance.now() - started;
        if (frames === MEASURE_FRAMES && cost / frames > SLOW_FRAME_MS)
          callbacks.current.onSlow?.();
      }
    };

    const loop = (now: number) => {
      const c = controlsRef.current;
      const wall = Math.min(100, now - lastWall);
      lastWall = now;
      if (c.seekId !== lastSeekId) {
        lastSeekId = c.seekId;
        if (c.seekTo !== undefined) {
          sim = Math.max(0, Math.min(timeline.endTick, c.seekTo));
          jumped = true;
          ended = false;
          soundCue(SHARED_CUES.replaySeek);
        }
      }
      if (c.playing && !ended) {
        let rate = c.speed;
        const clip = clips?.[clipIndex];
        if (clip) {
          const inSlow = sim >= clip.slowFrom && sim < clip.slowTo;
          if (inSlow !== slowNow) {
            slowNow = inSlow;
            soundCue(inSlow ? SHARED_CUES.slowmo : SHARED_CUES.slowmoEnd);
          }
          if (inSlow) rate *= SLOW_SPEED;
        }
        sim += (wall * TICKS_PER_SECOND * rate) / 1000;
        if (clip) {
          const key = `${clipIndex}`;
          if (!firedMoments.has(key) && sim >= clip.moment.tick) {
            firedMoments.add(key);
            soundCue(`${clip.moment.game}.${clip.moment.id}`);
          }
          if (sim >= clip.end) {
            clipIndex += 1;
            const next = clips![clipIndex];
            if (next) {
              sim = next.start;
              jumped = true;
              soundCue(SHARED_CUES.highlightClip);
              callbacks.current.onClip?.(clipIndex);
            } else {
              sim = clip.end;
              ended = true;
              callbacks.current.onEnd?.();
            }
          }
        } else if (sim >= timeline.endTick) {
          sim = timeline.endTick;
          ended = true;
          callbacks.current.onEnd?.();
        }
      }
      const tick = Math.floor(sim);
      if (tick !== lastDrawn || jumped) {
        draw(tick);
        callbacks.current.onTick?.(tick);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    const resize = () => {
      fit();
      jumped = true;
    };
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [timeline, drawer, plan]);

  return (
    <canvas ref={canvasRef} className="block h-full w-full" aria-label={label} data-replay-canvas />
  );
}

/** One still frame (the slow-phone fallback): the moment's tick, drawn once. */
export function ReplayStill({
  timeline,
  drawer,
  tick,
  label,
}: {
  timeline: ReplayTimeline<any>;
  drawer: PlaybackDrawer;
  tick: number;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    const scale = canvas.clientWidth / drawer.worldW;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    try {
      drawer.draw(ctx, timeline.stateAt(tick), true);
    } catch (error) {
      console.error("[replay] still failed", error);
    }
  }, [timeline, drawer, tick]);
  return (
    <canvas ref={canvasRef} className="block h-full w-full" aria-label={label} data-replay-still />
  );
}
