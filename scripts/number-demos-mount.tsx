/**
 * Browser-side helper for scripts/number-demos-check.ts (served by the check's Vite dev server, imported from
 * Playwright; never imported by the app). Plays a saved puzzle demo log over the game's real Stage (the registered
 * definition, its feedback wrapper included) the way the intro's PuzzleDemoPlayer does (src/components/duel/PuzzleDemo.tsx:
 * the same expanded events, touch pointer events at elementFromPoint with pointer capture emulated, a click on each
 * tap's release, the same column layout classes and providers), at scale 1, and resolves with the answer the Stage
 * submits.
 */
import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ArrowModeOverride } from "@/components/puzzles/GridDrag";
import { GameColumnLayout } from "@/components/puzzles/gameColumn";
import { GameKeysOff } from "@/lib/desktop";
import { loadGameDef } from "@/lib/duel/gameLoader";
import { expandActions, GAME_COLUMN_LAYOUT, type DemoEvent, type PuzzleDemoLog } from "@/lib/duel/puzzleDemo";
import type { PuzzleData } from "@/lib/duel/types";
import type { PuzzleStageProps } from "@/puzzles/types";
import type { ComponentType } from "react";

const POINTER_ID = 7331;
let root: Root | null = null;

function Player({ Stage, puzzle, log, done }: { Stage: ComponentType<PuzzleStageProps>; puzzle: PuzzleData; log: PuzzleDemoLog; done: (answer: string) => void }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    const events = expandActions(log.actions);
    let next = 0;
    let frame = 0;
    let captured: Element | null = null;
    const fire = (ev: Extract<DemoEvent, { x: number }>) => {
      const r = stageRef.current!.getBoundingClientRect();
      const cx = r.left + ev.x * r.width;
      const cy = r.top + ev.y * r.height;
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
        const init = { bubbles: true, cancelable: true, composed: true, clientX: cx, clientY: cy, pointerId: POINTER_ID, pointerType: "touch", isPrimary: true, button: 0, buttons: ev.kind === "up" ? 0 : 1 };
        const name = ev.kind === "down" ? "pointerdown" : ev.kind === "move" ? "pointermove" : "pointerup";
        target.dispatchEvent(new PointerEvent(name, init));
        if (ev.kind === "up") {
          if (ev.tap !== false) (inside ?? target).dispatchEvent(new MouseEvent("click", init));
          captured = null;
        }
      } finally {
        [proto.setPointerCapture, proto.releasePointerCapture, proto.hasPointerCapture] = saved;
      }
    };
    const tick = () => {
      const elapsed = Date.now() - start;
      while (next < events.length && events[next]!.t <= elapsed) {
        const ev = events[next++]!;
        if (ev.kind !== "type" && ev.kind !== "select") fire(ev);
      }
      if (next < events.length) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [log, start]);
  const layout = log.layout ?? 0;
  return (
    <div
      ref={stageRef}
      className={`flex flex-col overflow-hidden ${layout >= 1 ? "game-column" : ""} ${layout >= 2 ? "game-column-centred" : ""} ${layout >= GAME_COLUMN_LAYOUT ? "game-column-lifted" : ""}`}
      style={{ width: log.w, height: log.h }}
    >
      <GameColumnLayout.Provider value={layout >= 1}>
        <ArrowModeOverride.Provider value={log.joystick ?? false}>
          <GameKeysOff.Provider value>
            <Stage stateKey={`number-demo-${puzzle.type}-${start}`} puzzle={puzzle} phaseStartedAt={start} now={now} locked={false} onSubmit={(answer) => done(answer)} checkMoves={() => Promise.resolve(null)} />
          </GameKeysOff.Provider>
        </ArrowModeOverride.Provider>
      </GameColumnLayout.Provider>
    </div>
  );
}

/** Plays `log` over `puzzle`'s real Stage; resolves with the first submitted answer, or null after `timeoutMs`. */
export async function playDemo(puzzle: PuzzleData, log: PuzzleDemoLog, timeoutMs: number): Promise<{ answer: string | null; ms: number }> {
  const def = await loadGameDef(puzzle.type);
  root?.unmount();
  document.getElementById("number-demo-host")?.remove();
  const host = document.createElement("div");
  host.id = "number-demo-host";
  host.style.cssText = "position:fixed;left:0;top:0;z-index:99999;background:#0b0b0f";
  document.body.appendChild(host);
  root = createRoot(host);
  const t0 = Date.now();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (answer: string | null) => {
      if (settled) return;
      settled = true;
      resolve({ answer, ms: Date.now() - t0 });
    };
    window.setTimeout(() => finish(null), timeoutMs);
    root!.render(<Player Stage={def.Stage} puzzle={puzzle} log={log} done={finish} />);
  });
}
