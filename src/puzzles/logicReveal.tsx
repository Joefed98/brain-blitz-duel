/**
 * The Logic overhaul's reveal pieces (session 1, 15 Nov 2026; Joe: every reveal clear, big and legible on a phone).
 * Display only, read from the stored puzzle and the player's own answer; used inside the shared reveal layout
 * (AnswerReveal) by Box Six, Polypotions, Hanoi, Safe Cracker, Mosaic and Colour Flood.
 *
 * - `RevealFacts`: the key numbers that explain the score, each a big figure over a short plain label.
 * - `MoveStrip`: small pictures of moves (the shortest route, the par route), never a dense text list.
 */
import type { ReactNode } from "react";

export type RevealFact = { label: string; value: ReactNode; tone?: "good" | "bad" | "gold" | undefined };

export function RevealFacts({ items }: { items: readonly (RevealFact | null | false)[] }) {
  const shown = items.filter(Boolean) as RevealFact[];
  if (!shown.length) return null;
  return (
    <dl data-reveal-facts="" className="logic-reveal-facts" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>
      {shown.map((item) => (
        <div key={item.label} className="logic-reveal-fact" data-tone={item.tone}>
          <dd>{item.value}</dd>
          <dt>{item.label}</dt>
        </div>
      ))}
    </dl>
  );
}

/** A titled row of small move pictures; past `max` the rest are counted ("+6"). */
export function MoveStrip({ title, moves, max = 12, testId }: { title: string; moves: readonly ReactNode[]; max?: number; testId?: string }) {
  if (!moves.length) return null;
  const shown = moves.slice(0, max);
  return (
    <div data-move-strip={testId ?? ""} className="logic-move-strip">
      <span className="logic-move-strip-title">{title}</span>
      <div className="logic-move-strip-row">
        {shown.map((move, i) => (
          <span key={i} className="logic-move-chip">
            {move}
          </span>
        ))}
        {moves.length > max ? <span className="logic-move-chip logic-move-more">+{moves.length - max}</span> : null}
      </div>
    </div>
  );
}

/** One move picture: a coloured piece and "from → to" (posts and flasks counted from 1). */
export function MovePicture({ colour, from, to }: { colour: string; from: number; to: number }) {
  return (
    <>
      <i aria-hidden="true" className="logic-move-piece" style={{ backgroundColor: colour }} />
      <span aria-label={`${from} to ${to}`}>{from}→{to}</span>
    </>
  );
}
