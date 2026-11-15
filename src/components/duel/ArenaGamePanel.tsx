import { useState, type ReactNode } from "react";

import { useGuestLook } from "@/components/nav/AvatarButton";
import { MyMiniCard } from "@/components/identity/MyMiniCard";
import { Segmented } from "@/design/components";
import { useDesktop } from "@/lib/desktop";
import { screenKeys } from "@/lib/desktopKeys";
import { puzzleDef, puzzleGoal } from "@/lib/duel/catalogue";
import type { PuzzleType } from "@/lib/duel/types";
import { SCHEME_LABEL, SCHEME_NOTE, schemesFor, setSchemeFor, useControlScheme, type ControlScheme } from "@/lib/gameControls";

import { frameGoal } from "./GameFrame";

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
}) {
  const goal = type ? (arcade ? puzzleGoal(type).replace(/\.$/, "") : frameGoal(type)) : null;
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
      </div>
      {goal ? (
        <p data-arena-goal className="arena-game-goal">
          {goal}
        </p>
      ) : null}
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
