import { useEffect, useState, type ReactNode } from "react";

import { useGuestLook } from "@/components/nav/AvatarButton";
import { MyMiniCard } from "@/components/identity/MyMiniCard";
import { Segmented, Stars } from "@/design/components";
import { ChallengeRow, useChallengeJoules, useChallengeStates } from "@/components/games/ChallengeRows";
import { useServerChallenges } from "@/lib/challenges/challengesClient";
import { useAccount } from "@/lib/account/accountApi";
import { bestOf, levelStarsOf } from "@/lib/practice/progress";
import { usePracticeProgress } from "@/lib/practice/useProgress";
import { useDesktop } from "@/lib/desktop";
import { screenKeys } from "@/lib/desktopKeys";
import { puzzleDef, puzzleGoal } from "@/lib/duel/catalogue";
import type { PuzzleType } from "@/lib/duel/types";
import { SCHEME_LABEL, SCHEME_NOTE, schemesFor, setSchemeFor, useControlScheme, type ControlScheme } from "@/lib/gameControls";

import { useFrameGoal } from "./GameFrame";

/** This player's avatar in the frame: their card's avatar (an account) or their colour and initial (a guest). */
export function FrameMe({ size = 36 }: { size?: number }) {
  const { look, name } = useGuestLook();
  return <MyMiniCard guestLook={look} guestName={name || "You"} size={size} />;
}

/**
 * The arena's game block (phase 2 step 4 pass 2; lib/gameFrame/arena.ts): the live round's name, context, timer,
 * score, best and goal, the game menu and the controls tab, in the side panel beside the board (at the top of the room
 * panel in a room, whose standings follow it). GameLayout portals it here instead of drawing its header, so the
 * timer and score exist once.
 */
export function ArenaGamePanel({
  type,
  arcade,
  name,
  context,
  ping,
  timer,
  score,
  opponent,
  menu,
  inRoom,
  practice,
}: {
  type: PuzzleType | undefined;
  arcade: boolean;
  name: ReactNode;
  context: ReactNode;
  ping: ReactNode;
  timer: ReactNode;
  score: ReactNode;
  opponent: ReactNode;
  menu: ReactNode;
  inRoom: boolean;
  /** Practice: the score block is the best already, and this game's challenges are shown. */
  practice: boolean;
}) {
  const levelGoal = useFrameGoal(type ?? "symscan");
  const goal = type ? (arcade ? puzzleGoal(type).replace(/\.$/, "") : levelGoal) : null;
  return (
    <div data-arena-game data-in-room={inRoom ? "" : undefined} className="arena-game">
      <div className="arena-game-head">
        <span className="game-frame-avatar">
          <FrameMe size={44} />
        </span>
        <span className="arena-game-titles">
          {name}
          {context}
        </span>
        <span className="arena-game-menu">{menu}</span>
      </div>
      {ping ? <div className="arena-game-ping">{ping}</div> : null}
      {timer ? (
        <div data-frame-timer className="arena-game-timer">
          {timer}
        </div>
      ) : null}
      <div className="arena-game-score">
        {opponent ? <span className="game-frame-avatar">{opponent}</span> : null}
        {score}
        {type ? <GameStars type={type} withBest={!practice} /> : null}
      </div>
      <BoardStatus />
      {goal ? (
        <p data-arena-goal className="arena-game-goal">
          {goal}
        </p>
      ) : null}
      {practice && type ? <NextChallenges type={type} /> : null}
      {type ? <ControlsTab type={type} /> : null}
    </div>
  );
}

/** The scheme chooser (the game menu and the controls tab): only where a game offers more than one. */
export function SchemeChooser({ type }: { type: PuzzleType }) {
  const scheme = useControlScheme(type);
  const offered = schemesFor(type);
  if (offered.length < 2 || !scheme) return null;
  return (
    <div data-scheme-chooser className="arena-scheme">
      <Segmented<ControlScheme>
        label="Controls"
        value={scheme}
        onChange={(next) => setSchemeFor(type, next)}
        options={offered.map((s) => ({ value: s, label: SCHEME_LABEL[s] }))}
        data={{ "data-scheme": scheme }}
      />
      <span className="arena-scheme-note">{SCHEME_NOTE[scheme]}</span>
    </div>
  );
}

/**
 * The controls tab (replacing the keyboard hint box): a small "Controls" tab at the foot of the panel that pulls up
 * the game's keys and its control choice. Computers with a mouse only (useDesktop); nothing on a touch screen.
 */
export function ControlsTab({ type }: { type: PuzzleType }) {
  const desktop = useDesktop();
  const [open, setOpen] = useState(false);
  const scheme = useControlScheme(type);
  if (!desktop) return null;
  const keys = scheme === "keys" || scheme === "move" ? screenKeys(type, true) : undefined;
  const offered = schemesFor(type);
  return (
    <div data-controls-tab data-open={open ? "" : undefined} className="arena-controls">
      {open ? (
        <div data-controls-hint aria-label="Controls" className="arena-controls-body">
          <SchemeChooser type={type} />
          {keys?.length ? (
            <ul className="arena-controls-keys">
              {keys.map(([key, action]) => (
                <li key={key}>
                  <kbd>{key}</kbd> {action}
                </li>
              ))}
            </ul>
          ) : null}
          {offered.length < 2 && scheme ? <span className="arena-scheme-note">{SCHEME_NOTE[scheme]}</span> : null}
        </div>
      ) : null}
      <button
        type="button"
        data-controls-toggle
        aria-expanded={open}
        className="press arena-controls-tab"
        onClick={() => setOpen((v) => !v)}
        title={puzzleDef(type).name}
      >
        Controls · {scheme ? SCHEME_LABEL[scheme] : ""}
        <span aria-hidden="true" className="arena-controls-caret" data-open={open ? "" : undefined}>
          ▴
        </span>
      </button>
    </div>
  );
}

/**
 * This game's stars (Easy, Classic, Hard) and, where the score block isn't already the best (a room, the Daily), the
 * best: the account's practice progress (the same as the Games page). Nothing until it has answered.
 */
function GameStars({ type, withBest }: { type: PuzzleType; withBest: boolean }) {
  const progress = usePracticeProgress();
  if (!progress) return null;
  const best = withBest ? bestOf(progress, type) : null;
  return (
    <span data-arena-stars className="arena-game-stars">
      <Stars levels={levelStarsOf(progress, type)} size="m" />
      {best !== null ? (
        <span data-arena-best className="arena-game-best">
          Best {best}
        </span>
      ) : null}
    </span>
  );
}

interface Pill {
  id: string;
  label: string;
  value: string;
  tone: string | null;
}

/**
 * The board's status in the panel: the goal line's progress ("13 / 36 filled", "Stage 2 of 3") and the game's status
 * pills (moves, par, mistakes, lives…), read from the board's own (hidden in the arena, game-fx.css), so each number is
 * on screen once. Shown only when the game has them.
 */
export function BoardStatus({ className = "arena-game-status", pills: withPills = true }: { className?: string; pills?: boolean } = {}) {
  const [state, setState] = useState<{ progress: string | null; pills: Pill[] }>({ progress: null, pills: [] });
  useEffect(() => {
    const layout = document.querySelector("[data-round-layout]");
    if (!layout) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const progress = layout.querySelector("[data-goal-progress]")?.textContent?.trim() || null;
      const pills = [...(withPills ? layout.querySelectorAll("[data-game-stage] [data-hud-pills] .hud-pill") : [])].map((el, i) => ({
        id: el.getAttribute("data-hud-pill") || String(i),
        label: el.querySelector(".hud-pill-label")?.textContent?.trim() ?? "",
        value: el.querySelector(".hud-pill-value")?.textContent?.trim() ?? "",
        tone: el.getAttribute("data-tone"),
      }));
      setState((prev) => (JSON.stringify(prev) === JSON.stringify({ progress, pills }) ? prev : { progress, pills }));
    };
    read();
    // A change a move makes: one read a frame at most, never a loop of its own.
    const observer = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(read);
    });
    observer.observe(layout, { subtree: true, childList: true, characterData: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [withPills]);
  if (!state.progress && !state.pills.length) return null;
  return (
    <dl data-arena-status className={className}>
      {state.progress ? (
        <div className="arena-status-row" data-arena-progress>
          <dt>Progress</dt>
          <dd>{state.progress}</dd>
        </div>
      ) : null}
      {state.pills.map((p) => (
        <div key={p.id} className="arena-status-row" data-arena-pill={p.id} data-tone={p.tone ?? undefined}>
          <dt>{p.label}</dt>
          <dd>{p.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Practice: the next one or two of this game's challenges in progress (new ones when none has started), with progress. */
function NextChallenges({ type }: { type: PuzzleType }) {
  const server = useServerChallenges(false);
  const states = useChallengeStates(server, type);
  const joules = useChallengeJoules();
  const account = useAccount().kind === "account";
  const open = states.filter((s) => s.status === "progress");
  const next = (open.length ? open : states.filter((s) => s.status === "new")).slice(0, 2);
  if (!next.length) return null;
  return (
    <section data-arena-challenges aria-label="Challenges" className="arena-game-challenges">
      <span className="arena-game-caption">{open.length ? "Challenges in progress" : "Challenges"}</span>
      <ul className="gm-ch-list">
        {next.map((s) => (
          <ChallengeRow key={s.challenge.id} state={s} joules={joules} account={account} />
        ))}
      </ul>
    </section>
  );
}

/**
 * The phone's status panel (15 Nov 2026, Joe: the phone equivalent of the side panel, so nothing above the board is left
 * empty): in the space above a puzzle's board (the board and its controls sit at the bottom, phone-gap-check), the goal
 * and the board's live progress and status (moves, par, filled count, mistakes…) in larger type, read from the board's
 * own and hidden there while the panel shows (so each number is on screen once). Laid over that space only: it never
 * moves the board, and it shows only where there is room (PHONE_STATUS_MIN_PX).
 */
export const PHONE_STATUS_MIN_PX = 72;
export function PhoneStatus({ type, tray }: { type: PuzzleType; tray: { current: HTMLElement | null } }) {
  const [room, setRoom] = useState(0);
  // The status pills are mirrored (and hidden on the board) only when they sit above the board; pills under it stay put.
  const [mirrored, setMirrored] = useState(false);
  useEffect(() => {
    const plate = tray.current;
    const region = plate?.parentElement;
    if (!plate || !region) return;
    let frame = 0;
    // The free space: from the region's top down to the first thing the stage draws (its board's tray, or anything
    // above it: a key strip, a status line, a control), less 8 px. The status pills it carries don't count.
    const read = () => {
      frame = 0;
      if (!plate.hasAttribute("data-placed") || plate.closest("[data-arena]")) return setRoom(0);
      const top0 = region.getBoundingClientRect().top;
      let top = Number.parseFloat(plate.style.top) || 0;
      const column = region.querySelector("[data-game-stage] [data-stage-column]") ?? region.querySelector("[data-game-stage]");
      // What the stage draws, not its wrappers (an arena or a column that stretches and centres its content): the top
      // of the highest visible leaf (or canvas, button, image or drawing), the status pills mirrored here aside.
      const pills = region.querySelector<HTMLElement>("[data-game-stage] [data-hud-pills]");
      const mirror = Boolean(pills && pills.getBoundingClientRect().bottom <= (Number.parseFloat(plate.style.top) || 0) + top0 + 0.5);
      if (pills) pills.toggleAttribute("data-phone-mirrored", mirror);
      setMirrored(mirror);
      const drawnTop = (el: Element): number => {
        if ((mirror && el === pills) || getComputedStyle(el).display === "none") return Infinity;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return Infinity;
        const leaf = el.children.length === 0 || el.matches("canvas, button, img, svg, [role='button']");
        if (!leaf) return Math.min(...Array.from(el.children).map(drawnTop));
        return getComputedStyle(el).visibility === "hidden" ? Infinity : r.top - top0;
      };
      for (const el of column ? Array.from(column.children) : []) top = Math.min(top, drawnTop(el));
      setRoom(Math.max(0, Math.floor(top) - 8));
    };
    read();
    const again = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    const watch = new MutationObserver(again);
    watch.observe(plate, { attributes: true, attributeFilter: ["style", "data-placed"] });
    const resize = new ResizeObserver(again);
    resize.observe(region);
    return () => {
      watch.disconnect();
      resize.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [tray]);
  const shown = room >= PHONE_STATUS_MIN_PX;
  // A level's own goal (the Attention overhaul's levels) where its stage publishes one.
  const goalText = useFrameGoal(type);
  useEffect(() => {
    const layout = tray.current?.closest("[data-round-layout]");
    if (!layout) return;
    layout.toggleAttribute("data-phone-status", shown);
    return () => layout.removeAttribute("data-phone-status");
  }, [shown, tray]);
  if (!shown) return null;
  return (
    <div data-phone-status-panel className="phone-status" style={{ height: room }}>
      <p className="phone-status-goal">{goalText}</p>
      <BoardStatus className="phone-status-figures" pills={mirrored} />
    </div>
  );
}
