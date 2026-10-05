import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { ArrowModeOverride } from "@/components/puzzles/GridDrag";
import { getIntroDemoFn } from "@/lib/duel/introDemo.functions";
import {
  PUZZLE_DEMO_HOLD_MS,
  expandActions,
  isPuzzleDemoLog,
  type DemoEvent,
  type PuzzleDemoLog,
} from "@/lib/duel/puzzleDemo";
import { puzzleDef } from "@/lib/duel/registry";
import { clearStageState } from "@/lib/duel/stageState";
import { hushForDemo, noteRealInput } from "@/lib/sound";
import type { PuzzleData, PuzzleType } from "@/lib/duel/types";

const POINTER_ID = 7331;
const TRAIL_MS = 220;
const APPROACH_MS = 350;
const BLOCKED = ["pointerdown", "pointermove", "pointerup", "click", "touchstart", "touchend", "mousedown", "mouseup", "keydown", "wheel"];

/** The saved puzzle demo for this type, or null (then the static example shows). */
export function usePuzzleDemo(type: PuzzleType): { puzzle: PuzzleData; log: PuzzleDemoLog } | null {
  const fetchDemo = useServerFn(getIntroDemoFn);
  const { data: demo } = useQuery({
    queryKey: ["intro-demo", type],
    queryFn: () => fetchDemo({ data: { type } }),
    staleTime: 5 * 60_000,
  });
  const log = demo?.input_log;
  if (!demo || demo.puzzle?.type !== type || !isPuzzleDemoLog(log)) return null;
  return { puzzle: demo.puzzle, log };
}

/** Intro slot for non-engine puzzles: the saved demo over the fixed intro example. */
export function PuzzleIntroDemo({ demo }: { demo: { puzzle: PuzzleData; log: PuzzleDemoLog } }) {
  return (
    <div className="flex justify-center">
      <PuzzleDemoPlayer puzzle={demo.puzzle} log={demo.log} />
    </div>
  );
}

function PuzzleDemoPlayer({ puzzle, log }: { puzzle: PuzzleData; log: PuzzleDemoLog }) {
  const Stage = puzzleDef(puzzle.type).Stage;
  const events = useMemo(() => expandActions(log.actions), [log]);
  const loopMs = (events.at(-1)?.t ?? 0) + PUZZLE_DEMO_HOLD_MS;
  const boxRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<HTMLCanvasElement | null>(null);
  const [scale, setScale] = useState(0);
  const [loop, setLoop] = useState({ id: 0, start: 0 });
  const [now, setNow] = useState(() => Date.now());
  const verdictIndex = useRef(0);
  const stateKey = `intro-demo-${puzzle.type}-${loop.id}`;
  const mounted = scale > 0 && loop.id > 0;

  // Silent while mounted; real taps briefly lift the hush for Ready/Back.
  useEffect(() => {
    hushForDemo(true);
    const real = (e: Event) => {
      if (e.isTrusted) noteRealInput();
    };
    window.addEventListener("pointerdown", real, true);
    return () => {
      hushForDemo(false);
      window.removeEventListener("pointerdown", real, true);
    };
  }, []);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const fit = () => setScale(Math.min(box.clientWidth / log.w, box.clientHeight / log.h));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [log.w, log.h]);

  // Real input never reaches the demo's puzzle.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const block = (e: Event) => {
      if (!e.isTrusted) return;
      e.stopPropagation();
      if (e.cancelable && e.type !== "pointerdown") e.preventDefault();
    };
    for (const type of BLOCKED) el.addEventListener(type, block, true);
    return () => {
      for (const type of BLOCKED) el.removeEventListener(type, block, true);
    };
  }, [mounted]);

  useEffect(() => {
    if (!scale) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    setLoop({ id: 1, start: Date.now() });
    return () => window.clearInterval(id);
  }, [scale]);

  useEffect(() => {
    if (!loop.start) return;
    verdictIndex.current = 0;
    let frame = 0;
    let next = 0;
    let pressed = false;
    let captured: Element | null = null;
    let pos: { x: number; y: number } | null = null;
    const trail: { x: number; y: number; at: number }[] = [];

    const client = (x: number, y: number) => {
      const r = stageRef.current!.getBoundingClientRect();
      return { cx: r.left + x * r.width, cy: r.top + y * r.height };
    };
    const fire = (ev: Extract<DemoEvent, { x: number }>) => {
      const { cx, cy } = client(ev.x, ev.y);
      const hit = document.elementFromPoint(cx, cy);
      const inside = hit && stageRef.current?.contains(hit) ? hit : null;
      const target = ev.kind === "down" ? inside : (captured ?? inside);
      if (ev.kind === "down") captured = null;
      if (!target) return;
      const proto = Element.prototype;
      const saved = [proto.setPointerCapture, proto.releasePointerCapture, proto.hasPointerCapture] as const;
      proto.setPointerCapture = function (this: Element) {
        captured = this;
      };
      proto.releasePointerCapture = function () {
        captured = null;
      };
      proto.hasPointerCapture = function (this: Element) {
        return captured === this;
      };
      try {
        const init = {
          bubbles: true,
          cancelable: true,
          composed: true,
          clientX: cx,
          clientY: cy,
          pointerId: POINTER_ID,
          pointerType: "touch",
          isPrimary: true,
          button: 0,
          buttons: ev.kind === "up" ? 0 : 1,
        };
        const name = ev.kind === "down" ? "pointerdown" : ev.kind === "move" ? "pointermove" : "pointerup";
        target.dispatchEvent(new PointerEvent(name, init));
        if (ev.kind === "up") {
          const clickTarget = inside ?? target;
          if (ev.tap !== false) clickTarget.dispatchEvent(new MouseEvent("click", init));
          captured = null;
        }
      } finally {
        [proto.setPointerCapture, proto.releasePointerCapture, proto.hasPointerCapture] = saved;
      }
    };
    const typeText = (text: string) => {
      const root = stageRef.current;
      if (!root) return;
      const input = root.querySelector("input, textarea") as HTMLInputElement | null;
      for (const ch of text) {
        const key = ch === "\n" ? "Enter" : ch === "\b" ? "Backspace" : ch;
        const target = input ?? root;
        target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
        if (input && key.length === 1) {
          const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set;
          setter?.call(input, input.value + key);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        } else if (input && key === "Backspace") {
          const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set;
          setter?.call(input, input.value.slice(0, -1));
          input.dispatchEvent(new Event("input", { bubbles: true }));
        } else if (input && key === "Enter") {
          input.form?.requestSubmit();
        }
        target.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
      }
    };
    const select = (option: string) => {
      const root = stageRef.current;
      if (!root) return;
      const wanted = option.trim().toLowerCase();
      const el = [...root.querySelectorAll("button, [role=button], [data-option]")].find(
        (node) => (node.textContent ?? "").trim().toLowerCase() === wanted || node.getAttribute("data-option") === option,
      ) as HTMLElement | undefined;
      el?.click();
      if (el) {
        const r = el.getBoundingClientRect();
        const s = stageRef.current!.getBoundingClientRect();
        pos = { x: (r.left + r.width / 2 - s.left) / s.width, y: (r.top + r.height / 2 - s.top) / s.height };
      }
    };

    const draw = (elapsed: number) => {
      const canvas = cursorRef.current;
      const box = boxRef.current;
      const stage = stageRef.current;
      if (!canvas || !box || !stage) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = box.clientWidth;
      const h = box.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
      if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // Hovering finger glides to the next press before it lands.
      let shown = pos;
      if (!pressed) {
        const upcoming = events.slice(next).find((e): e is Extract<DemoEvent, { x: number }> => e.kind === "down");
        if (upcoming && upcoming.t - elapsed < APPROACH_MS) {
          const f = 1 - Math.max(0, upcoming.t - elapsed) / APPROACH_MS;
          const from = pos ?? { x: upcoming.x, y: upcoming.y + 0.08 };
          shown = { x: from.x + (upcoming.x - from.x) * f, y: from.y + (upcoming.y - from.y) * f };
        }
      }
      if (!shown) return;
      const b = box.getBoundingClientRect();
      const s = stage.getBoundingClientRect();
      const px = s.left - b.left + shown.x * s.width;
      const py = s.top - b.top + shown.y * s.height;
      const at = performance.now();
      trail.push({ x: px, y: py, at });
      while (trail.length && at - trail[0]!.at > TRAIL_MS) trail.shift();
      for (let i = 0; i < trail.length - 1; i++) {
        const p = trail[i]!;
        const fade = 1 - (at - p.at) / TRAIL_MS;
        ctx.fillStyle = `rgba(255,255,255,${0.18 * fade})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6 * fade + 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(255,255,255,${pressed ? 0.55 : 0.32})`;
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, pressed ? 9 : 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };

    const tick = () => {
      const elapsed = Date.now() - loop.start;
      while (next < events.length && events[next]!.t <= elapsed) {
        const ev = events[next++]!;
        try {
          if (ev.kind === "type") typeText(ev.text);
          else if (ev.kind === "select") select(ev.option);
          else {
            pos = { x: ev.x, y: ev.y };
            pressed = ev.kind !== "up";
            fire(ev);
          }
        } catch (error) {
          console.error("[intro demo] action failed", error);
        }
      }
      draw(elapsed);
      if (elapsed >= loopMs) {
        clearStageState(stateKey);
        setLoop((l) => ({ id: l.id + 1, start: Date.now() }));
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [loop, events, loopMs, stateKey]);

  useEffect(() => () => clearStageState(stateKey), [stateKey]);

  const verdict = <T,>(fallback: T): Promise<T> => {
    const list = log.verdicts ?? [];
    const v = list[verdictIndex.current++];
    return Promise.resolve((v ?? fallback) as T);
  };

  return (
    <div
      ref={boxRef}
      className="intro-demo relative overflow-hidden rounded-lg border border-border bg-background"
      style={{ aspectRatio: `${log.w} / ${log.h}` }}
      aria-label="Demo of the puzzle being solved"
    >
      {mounted ? (
        <div
          ref={stageRef}
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 flex flex-col overflow-hidden"
          style={{
            width: log.w,
            height: log.h,
            transform: `translate(-50%, -50%) scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <ArrowModeOverride.Provider value={log.joystick ?? false}>
            <Stage
              key={stateKey}
              stateKey={stateKey}
              puzzle={puzzle}
              phaseStartedAt={loop.start}
              now={now}
              locked={false}
              onSubmit={() => undefined}
              checkWord={(word) => verdict({ valid: false, points: 0, word })}
              checkGroup={() => verdict({ valid: false })}
            />
          </ArrowModeOverride.Provider>
        </div>
      ) : null}
      <canvas ref={cursorRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      <span className="pointer-events-none absolute right-1.5 top-1 font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
        Demo
      </span>
    </div>
  );
}
