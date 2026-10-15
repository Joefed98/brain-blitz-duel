import { useArcadeFrameTiming } from "@/components/puzzles/useArcadeFrameTiming";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import { reportArcadeTick, resetArcadeClock } from "@/lib/arcade/clock";
import {
  inputAt,
  recordInput,
  ARCADE_INPUT_DRAG,
  MAX_CATCH_UP_TICKS,
  TICK_MS,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
} from "@/lib/arcade/engine";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";
import { ArcadeArenaSlot } from "@/components/puzzles/ArcadeArenaSlot";
import type { ArenaSceneView } from "@/lib/arcade/arenaScene.renderer";
import { arcadeWorldPoint } from "@/components/puzzles/tapMapping";
import { arcadeFeedback } from "@/lib/fx/arcade";

export interface PointerPayload {
  /** Event kind for the pointer/tick path (default 7, a drag); discrete games use inputKind. */
  k?: number;
  a: number;
  b: number;
  c: number;
}

interface Props<S, C> {
  diagKey: string;
  label: string;
  background: string;
  seed: number;
  enabled: boolean;
  locked: boolean;
  worldW: number;
  worldH: number;
  /**
   * Arcade games: size the arena to the world's aspect at the largest uniform scale
   * that fits (ArcadeArenaSlot), so the world is never stretched or cropped.
   */
  fitWorld?: boolean;
  /**
   * The game's own scenery beyond the world on the arcade play screen (fitWorld only;
   * display only, painted once per size and per sceneKey, never per frame).
   */
  scene?: (ctx: CanvasRenderingContext2D, view: ArenaSceneView, state: S) => void;
  /** Repaints the scene when this changes (e.g. the level, whose ground the scene meets). */
  sceneKey?: (state: S) => string | number;
  /** Opt in when the renderer must preserve circular geometry in screen pixels. */
  renderAtCanvasSize?: boolean;
  game: ArcadeGame<S, ArcadeInputEvent | null>;
  checkpoint: (state: S) => C;
  interval: number;
  encodeRun: (run: {
    seed: number;
    claimedScore: number;
    events: ArcadeInputEvent[];
    endTick: number;
    checkpoints: C[];
  }) => string;
  /**
   * Maps a pointer event (world coordinates) to the k = 7 payload the sim should
   * receive. Returning null on "down" ignores that pointer altogether.
   */
  /** Event kind recorded (default 7, a drag). */
  inputKind?: number;
  /** Discrete gestures: every payload is queued and sent once, one per tick. */
  discrete?: boolean;
  /** Called every tick; a non-null payload replaces the pointer's wanted payload. */
  tickInput?: (state: S) => PointerPayload | null;
  /** Render-side sound observer, created per run and stopped on teardown. */
  sounds?: () => { frame: (state: S, running: boolean) => void; stop: () => void };
  /** Controls drawn over the canvas (absolute), never shrinking the play area. */
  overlay?: ReactNode;
  /** Controls below the canvas which can enqueue the same recorded inputs as pointer gestures. */
  footer?: ((send: (payload: PointerPayload) => void) => ReactNode) | undefined;
  pointer: (kind: "down" | "move" | "up", x: number, y: number) => PointerPayload | null;
  onSubmit: (answer: string) => void;
  onDraftAnswer?: ((answer: string) => void) | undefined;
}

/**
 * The canvas loop shared by the finger-driven arcade games: fixed 60 Hz ticks,
 * at most one k = 7 event a tick (only when the payload changes), checkpoints,
 * drafts every 500 ms and an automatic submit when the sim says it is over.
 */
export function ArcadeCanvasStage<S, C>(props: Props<S, C>) {
  const { game, seed, enabled } = props;
  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const frameTiming = useArcadeFrameTiming(canvas);
  const state = useRef<S>(game.init(seed));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<C[]>([]);
  const wanted = useRef<PointerPayload | null>(null);
  const queue = useRef<PointerPayload[]>([]);
  const sent = useRef<string>("");
  const pointerId = useRef<number | null>(null);
  const submitted = useRef(false);
  const [, forceRedraw] = useState(0);
  const [sceneKey, setSceneKey] = useState<string | number | undefined>(undefined);
  const sceneKeyRef = useRef<string | number | undefined>(undefined);
  useNoTouchScroll(wrap);

  const propsRef = useRef(props);
  propsRef.current = props;

  const encode = (): string => {
    const score = game.score(state.current);
    return appendClientCounters(
      propsRef.current.encodeRun({
        seed,
        claimedScore: score,
        events: events.current,
        endTick: (state.current as { tick: number }).tick,
        checkpoints: checkpoints.current,
      }),
      arcadeCounters(props.diagKey, state.current, score),
    );
  };

  useEffect(() => {
    state.current = game.init(seed);
    events.current = [];
    checkpoints.current = [];
    wanted.current = null;
    queue.current = [];
    sent.current = "";
    pointerId.current = null;
    submitted.current = false;
    forceRedraw((n) => n + 1);
  }, [game, seed]);

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    resetArcadeClock();
    let last = performance.now();
    let accumulator = 0;
    let draftAt = 0;
    const feedback = arcadeFeedback();
    const sounds = propsRef.current.sounds?.();
    const tickOf = () => (state.current as { tick: number }).tick;

    const finish = () => {
      if (submitted.current) return;
      submitted.current = true;
      propsRef.current.onSubmit(encode());
    };

    const loop = (time: number) => {
      frameTiming.begin(time);
      frame = requestAnimationFrame(loop);
      const delta = time - last;
      last = time;
      if (!game.isOver(state.current) && !propsRef.current.locked) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          if (propsRef.current.discrete) {
            const next = queue.current.shift();
            if (next) {
              recordInput(
                events.current,
                { t: tickOf() + 1, k: next.k ?? propsRef.current.inputKind ?? ARCADE_INPUT_DRAG, a: next.a, b: next.b, c: next.c, d: 0 },
                game.inputRanges,
              );
            }
          }
          const fromTick = propsRef.current.tickInput?.(state.current);
          if (fromTick) wanted.current = fromTick;
          const target = propsRef.current.discrete ? null : wanted.current;
          if (target) {
            const kind = target.k ?? ARCADE_INPUT_DRAG;
            const key = `${kind},${target.a},${target.b},${target.c}`;
            if (key !== sent.current) {
              sent.current = key;
              recordInput(
                events.current,
                { t: tickOf() + 1, k: kind, a: target.a, b: target.b, c: target.c, d: 0 },
                game.inputRanges,
              );
            }
          }
          state.current = game.step(state.current, inputAt(events.current, tickOf() + 1));
          if (tickOf() % propsRef.current.interval === 0) {
            checkpoints.current.push(propsRef.current.checkpoint(state.current));
          }
          if (game.isOver(state.current)) break;
        }
      }
      const key = propsRef.current.sceneKey?.(state.current);
      if (key !== undefined && key !== sceneKeyRef.current) {
        sceneKeyRef.current = key;
        setSceneKey(key);
      }
      reportArcadeTick(tickOf(), game.isOver(state.current));
      feedback(state.current as object, game.isOver(state.current));
      sounds?.frame(state.current, !game.isOver(state.current) && !propsRef.current.locked);
      frameTiming.draw();
      const size = sizeCanvas();
      if (size) {
        const ctx = canvas.current?.getContext("2d");
        if (ctx) {
          const { worldW, worldH } = propsRef.current;
          ctx.save();
          if (propsRef.current.renderAtCanvasSize) {
            game.draw(ctx, state.current, size);
          } else {
            ctx.scale(size.width / worldW, size.height / worldH);
            game.draw(ctx, state.current, { width: worldW, height: worldH });
          }
          ctx.restore();
        }
      }
      frameTiming.rendered();

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        propsRef.current.onDraftAnswer?.(encode());
      }
      if (game.isOver(state.current)) finish();
      frameTiming.end();
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      sounds?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, game, seed]);

  const sizeCanvas = (): CanvasSize | null => {
    const node = canvas.current;
    const box = wrap.current?.getBoundingClientRect();
    if (!node || !box || box.width < 1 || box.height < 1) return null;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(box.width);
    const height = Math.round(box.height);
    if (node.width !== Math.round(width * ratio) || node.height !== Math.round(height * ratio)) {
      node.width = Math.round(width * ratio);
      node.height = Math.round(height * ratio);
      node.style.width = `${width}px`;
      node.style.height = `${height}px`;
    }
    const ctx = node.getContext("2d");
    if (!ctx) return null;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { width, height };
  };

  /** Screen point to world point, or null outside the drawn play area. */
  const worldPoint = (clientX: number, clientY: number, clamp: boolean) => {
    const { worldW, worldH } = propsRef.current;
    return arcadeWorldPoint(wrap.current?.getBoundingClientRect(), clientX, clientY, worldW, worldH, clamp);
  };

  const push = (payload: PointerPayload) => {
    if (props.discrete) {
      if (queue.current.length < 4) queue.current.push(payload);
    } else wanted.current = payload;
  };

  const blocked = () => props.locked || submitted.current || game.isOver(state.current);

  const release = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointerId.current !== event.pointerId) return;
    pointerId.current = null;
    const point = worldPoint(event.clientX, event.clientY, true);
    if (point && !blocked()) {
      const payload = props.pointer("up", point.x, point.y);
      if (payload) push(payload);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const arena = (
    <div
      ref={wrap}
      data-play-area=""
      data-game-arena="canvas" className="relative min-h-0 w-full flex-1 overflow-hidden"
      style={{ ...NO_SCROLL_STYLE, WebkitTouchCallout: "none" }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <canvas
        ref={canvas}
        className="puzzle-board block h-full w-full rounded-xl"
        style={{ background: props.background, touchAction: "none" }}
        aria-label={props.label}
        onPointerDown={(event) => {
          event.preventDefault();
          if (blocked() || pointerId.current !== null) return;
          const point = worldPoint(event.clientX, event.clientY, false);
          if (!point) return;
          const payload = props.pointer("down", point.x, point.y);
          if (!payload && !props.discrete) return;
          pointerId.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          if (payload) push(payload);
        }}
        onPointerMove={(event) => {
          if (blocked() || pointerId.current !== event.pointerId) return;
          const point = worldPoint(event.clientX, event.clientY, true);
          if (!point) return;
          const payload = props.pointer("move", point.x, point.y);
          if (payload) push(payload);
        }}
        onPointerUp={release}
        onPointerCancel={release}
      />
      {props.overlay}
    </div>
  );

  return (
    <>
    {props.fitWorld ? (
      <ArcadeArenaSlot
        width={props.worldW}
        height={props.worldH}
        scene={props.scene ? (ctx, view) => propsRef.current.scene?.(ctx, view, state.current) : undefined}
        sceneKey={sceneKey ?? props.sceneKey?.(state.current)}
      >
        {arena}
      </ArcadeArenaSlot>
    ) : arena}
    {props.footer?.(push)}
    </>
  );
}
