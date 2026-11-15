import { useEffect, useRef, useState } from "react";

import { puzzleDef, puzzleGoal } from "@/lib/duel/catalogue";
import type { PuzzleType } from "@/lib/duel/types";

import { CATEGORY_NAMES, frameGoal } from "./GameFrame";

/**
 * The computer arena's side panel (phase 2 step 4, 15 Nov 2026; presentation only, docs/design/game-fx/README.md):
 * on a computer's live round outside a room (practice, the Daily, challenges, offline; a room has its 380 px room
 * panel with the standings), a quiet panel right of the play column with the game, its goal, the time left and the
 * score, larger than the header's. It mirrors the frame header (the same numbers, read from it as they change), so
 * it adds no second timer, sound or effect. polish-layout/game-fx.css shows it only where the space right of the
 * column holds it, so the column, the world and every control stay exactly where they were. Never on a phone or
 * tablet (PhoneShell draws it on the desktop layout only), never takes a click.
 */
interface Mirror {
  time: string;
  critical: boolean;
  scoreLabel: string;
  score: string;
  note: string;
  context: string;
}

const EMPTY: Mirror = { time: "", critical: false, scoreLabel: "", score: "", note: "", context: "" };

function read(header: Element | null): Mirror {
  if (!header) return EMPTY;
  const text = (sel: string) => (header.querySelector(sel)?.textContent ?? "").trim();
  return {
    time: text(".game-timer-seconds"),
    critical: Boolean(header.querySelector(".fx-timer-critical")),
    scoreLabel: text(".game-frame-score-label"),
    score: text(".game-frame-score-value"),
    note: text(".game-frame-score-note"),
    context: text(".game-frame-context-text"),
  };
}

export function ArenaSidePanel({ type }: { type: PuzzleType }) {
  const ref = useRef<HTMLElement>(null);
  const [mirror, setMirror] = useState<Mirror>(EMPTY);
  useEffect(() => {
    const panel = ref.current;
    const shell = panel?.parentElement;
    if (!panel || !shell) return;
    let frame = 0;
    let observer: MutationObserver | null = null;
    const update = () => {
      frame = 0;
      const next = read(shell.querySelector("[data-game-frame-header]"));
      setMirror((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    const later = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    // Work only while the panel is drawn (the stylesheet hides it where it doesn't fit), and watch only the header:
    // its digits and score change a few times a second, so this is one read a change, never a frame loop.
    const attach = () => {
      const shown = getComputedStyle(panel).display !== "none";
      const header = shell.querySelector("[data-game-frame-header]");
      observer?.disconnect();
      observer = null;
      if (!shown) return;
      // No header yet (the intro's frame becomes the live round's): wait for it, then watch only it.
      observer = new MutationObserver(header ? later : () => void (shell.querySelector("[data-game-frame-header]") && attach()));
      if (header) observer.observe(header, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class"] });
      else observer.observe(shell, { childList: true, subtree: true });
      update();
    };
    attach();
    window.addEventListener("resize", attach);
    return () => {
      window.removeEventListener("resize", attach);
      observer?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [type]);
  const def = puzzleDef(type);
  const arcade = def.category === "arcade" || Boolean(def.arcadeRun);
  const goal = arcade ? puzzleGoal(type).replace(/\.$/, "") : frameGoal(type);
  return (
    <aside ref={ref} data-arena-panel aria-hidden="true" className="dk-arena-panel">
      <div className="dk-ap-head">
        <span className="dk-ap-title">{def.name}</span>
        <span className="dk-ap-sub">
          <span className="dk-ap-dot" />
          {mirror.context || CATEGORY_NAMES[def.category]}
        </span>
      </div>
      <p className="dk-ap-goal">{goal}</p>
      <div className="dk-ap-stats">
        <div className="dk-ap-stat">
          <span className="dk-ap-stat-label">Time</span>
          <span data-arena-panel-time className="dk-ap-stat-value" data-critical={mirror.critical ? "" : undefined}>
            {mirror.time ? `${mirror.time} s` : "–"}
          </span>
        </div>
        <div className="dk-ap-stat">
          <span className="dk-ap-stat-label">{mirror.scoreLabel || "Score"}</span>
          <span data-arena-panel-score className="dk-ap-stat-value">{mirror.score || "–"}</span>
        </div>
      </div>
      {mirror.note ? <p className="dk-ap-note">{mirror.note}</p> : null}
    </aside>
  );
}
