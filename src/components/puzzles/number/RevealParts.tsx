/**
 * The Number games' answer reveals (15 Nov 2026, the Number overhaul; docs/number-overhaul.md "The reveals"): the
 * pieces every one of the eight reveals is built from, so they read alike inside the shared reveal layout.
 *
 * - `RevealBoards`: one board at a time, drawn large, with a switcher of numbered tabs where there are several (each
 *   tab marked right, wrong or not reached), never shrunken copies side by side. It opens on the first board not
 *   right, so the player sees what they missed first.
 * - `RevealView`: "Yours" against "Solution" where the game has both; the board below draws the one chosen, with
 *   what was missed or wrong highlighted by the game.
 * - `RevealFacts`: the few numbers that explain the score, as label-and-value chips in plain words.
 *
 * Display only: nothing here reads or changes a grade.
 */
import { useState, type ReactNode } from "react";

import { Chip } from "@/design/components";
import { Segmented } from "@/design/components";

/** A board's verdict on its tab: right, wrong (tried, not right), or not reached. */
export type BoardMark = "right" | "wrong" | "open";

const MARK_WORD: Record<BoardMark, string> = { right: "right", wrong: "not right", open: "not reached" };
// A dot, never "✗" (Joe, 15 Nov 2026: no stray "×" on a reveal); the tab's name says the verdict in words.
const MARK_GLYPH: Record<BoardMark, string> = { right: "✓", wrong: "●", open: "○" };

/** The board to open on: the first that isn't right, else the first. */
export function firstBoardToShow(marks: readonly BoardMark[]): number {
  const at = marks.findIndex((m) => m !== "right");
  return at < 0 ? 0 : at;
}

/** Which board is shown, opening on the first that isn't right. */
export function useRevealBoard(marks: readonly BoardMark[]): [number, (i: number) => void] {
  const [index, setIndex] = useState(() => firstBoardToShow(marks));
  return [Math.min(index, Math.max(0, marks.length - 1)), setIndex];
}

export function RevealBoards({ noun, marks, index, onIndex, children }: {
  /** What a board is called ("Scale", "Equation", "Pyramid"…), for the tabs' names. */
  noun: string;
  marks: readonly BoardMark[];
  index: number;
  onIndex: (i: number) => void;
  children: ReactNode;
}) {
  return (
    <div data-number-reveal-boards className="nrv-boards">
      {marks.length > 1 ? (
        <div role="tablist" aria-label={`${noun}s`} className="nrv-tabs">
          {marks.map((mark, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`${noun} ${i + 1}, ${MARK_WORD[mark]}`}
              data-mark={mark}
              data-current={i === index ? "" : undefined}
              onClick={() => onIndex(i)}
              className="nrv-tab"
            >
              <span className="nrv-tab-n">{i + 1}</span>
              <span className="nrv-tab-mark" aria-hidden="true">{MARK_GLYPH[mark]}</span>
            </button>
          ))}
        </div>
      ) : null}
      <div role="tabpanel" data-reveal-board={index} className="nrv-board">
        {children}
      </div>
    </div>
  );
}

export type RevealSide = "yours" | "solution";

/** "Yours" against "Solution". */
export function RevealView({ value, onChange, yoursLabel = "Yours" }: { value: RevealSide; onChange: (v: RevealSide) => void; yoursLabel?: string }) {
  return (
    <Segmented
      label="Board shown"
      value={value}
      onChange={onChange}
      className="nrv-view"
      data={{ "data-reveal-view": value }}
      options={[
        { value: "yours", label: yoursLabel },
        { value: "solution", label: "Solution" },
      ]}
    />
  );
}

export interface RevealFact {
  label: string;
  value: ReactNode;
  /** "good" for a part earned in full, "miss" for one missed. */
  tone?: "good" | "miss" | undefined;
}

/** The numbers that explain the score, in plain words. */
export function RevealFacts({ facts }: { facts: readonly (RevealFact | null | false | undefined)[] }) {
  const shown = facts.filter((f): f is RevealFact => !!f);
  if (!shown.length) return null;
  return (
    <div data-number-reveal-facts className="nrv-facts">
      {shown.map((f) => (
        <Chip key={f.label} variant="status" label={f.label} value={f.value} tone={f.tone === "good" ? "good" : f.tone === "miss" ? "warn" : undefined} />
      ))}
    </div>
  );
}
