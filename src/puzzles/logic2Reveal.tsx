/**
 * The answer reveal for the Logic overhaul's seven games (15 Nov 2026, Joe: clear, big and legible on a phone). It sits
 * inside the shared reveal layout (AnswerReveal: the verdict row, score line, stars and new best above it) and draws:
 *
 *   - one large board at a time: the player's answer marked against the solution (wrong pieces ringed red, missed
 *     ones as faint dashed ghosts), with a switch to the clean solution; a solved board, or a round whose solution is
 *     still locked (a Daily or challenge before it closes), shows its one board and no switch;
 *   - a legend and a bar in place of a line of text: how many were right, wrong and missed, out of the solution's;
 *   - a few plain number chips that explain the score (mistakes, undos, numbers met).
 *
 * Display only: every figure comes from the stored puzzle, the player's stored answer and the stored extra.
 */
import { useState, type ReactNode } from "react";

export interface RevealTally {
  right: number;
  wrong: number;
  missed: number;
  /** What the items are, plural and lower case ("tents", "lamps", "squares"). */
  unit: string;
}

export interface RevealFact {
  label: string;
  value: string;
}

type View = "yours" | "solution";

/** A mistakes / undos count from the stored extra, when the grade recorded one (null without a timeline). */
export function extraCount(extra: Record<string, unknown> | null | undefined, key: string): number | null {
  const v = extra?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** right / wrong / missed between a set of the player's items and the solution's. */
export function tallySets(mine: Iterable<number | string>, solution: Iterable<number | string>, unit: string): RevealTally {
  const sol = new Set(solution);
  const my = new Set(mine);
  let right = 0;
  for (const k of my) if (sol.has(k)) right++;
  return { right, wrong: my.size - right, missed: sol.size - right, unit };
}

export function LogicReveal({
  game,
  solved,
  hasSolution,
  yours,
  solution,
  tally,
  facts = [],
}: {
  game: string;
  solved: boolean;
  /** False while the round's solution is locked: only the player's own board, unmarked. */
  hasSolution: boolean;
  yours: ReactNode;
  solution: ReactNode;
  tally: RevealTally | null;
  facts?: readonly RevealFact[];
}) {
  const [view, setView] = useState<View>("yours");
  const switchable = hasSolution && !solved;
  const shown: View = !hasSolution ? "yours" : solved ? "solution" : view;
  const total = tally ? tally.right + tally.missed : 0;
  return (
    <div className="logic-reveal logic2-reveal" data-logic2-reveal={game} data-reveal-view={shown}>
      {switchable ? (
        <div role="tablist" aria-label="Board shown" className="logic2-reveal-switch" data-logic2-reveal-switch="">
          {(["yours", "solution"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              data-on={view === v ? "" : undefined}
              onClick={() => setView(v)}
            >
              {v === "yours" ? "Your answer" : "Solution"}
            </button>
          ))}
        </div>
      ) : (
        <p className="logic2-reveal-title">{solved ? "Your solution" : "Your answer"}</p>
      )}
      <div className="logic-reveal-board logic2-reveal-board">{shown === "yours" ? yours : solution}</div>
      {tally && hasSolution && !solved && total > 0 ? (
        <div className="logic2-reveal-tally" data-logic2-tally="">
          <div className="logic2-reveal-bar" aria-hidden="true">
            <span data-part="right" style={{ flexGrow: tally.right }} />
            <span data-part="wrong" style={{ flexGrow: tally.wrong }} />
            <span data-part="missed" style={{ flexGrow: tally.missed }} />
          </div>
          <ul className="logic2-reveal-legend">
            <li data-part="right">
              <i aria-hidden="true" />
              <b>{tally.right}</b> of {total} {tally.unit} right
            </li>
            {tally.wrong > 0 ? (
              <li data-part="wrong">
                <i aria-hidden="true" />
                <b>{tally.wrong}</b> wrong
              </li>
            ) : null}
            {tally.missed > 0 ? (
              <li data-part="missed">
                <i aria-hidden="true" />
                <b>{tally.missed}</b> missed
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
      {facts.length ? (
        <ul className="logic2-reveal-facts" data-logic2-facts="">
          {facts.map((f) => (
            <li key={f.label}>
              <span>{f.label}</span>
              <b>{f.value}</b>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
