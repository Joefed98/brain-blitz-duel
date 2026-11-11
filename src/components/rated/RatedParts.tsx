/**
 * Pieces shared by the rated match screens (wave 3, session W3c; docs/mockups/wave-3/): the placement boxes, the bar to
 * the next division, the Puzzles / Arcade tiles, the pick mark, a game's result row and the Joules line. Tokens and
 * shared components only (DESIGN.md); look in src/polish-layout/rated.css.
 */
import type { ReactNode } from "react";

import { GameIcon } from "@/components/app/GameIcon";
import { Emblem } from "@/design/art";
import { Icon } from "@/design/components";
import { Avatar, DEFAULT_AVATAR, type CardLook } from "@/design/identity";
import { JoulesBolt as PassJoulesBolt } from "@/components/pass/JoulesBolt";
import { puzzleName } from "@/lib/duel/catalogue";
import type { PuzzleType } from "@/lib/duel/types";
import type { PlacementResult, RatedGame, RatedPick, SideRating } from "@/lib/rated/backend";
import { isArcadePick } from "@/lib/rated/rules";
import { divisionBar, emblemDivision, emblemTier, PLACEMENT_MATCHES, ratingText, type RankView } from "@/lib/rated/tierDisplay";

/** The tier emblem for a standing (Lightning shows its Top 500 number when it has one). */
export function RankEmblem({ rank, size, marker = false }: { rank: RankView; size: number; marker?: boolean }) {
  return (
    <Emblem
      tier={emblemTier(rank.tier)}
      division={emblemTier(rank.tier) === "lightning" ? undefined : emblemDivision(rank)}
      rank={rank.rank ?? undefined}
      size={size}
      marker={marker}
      label={rank.label}
    />
  );
}

/** The unplaced shield (mockup 11): a dashed outline with a question mark, no tier. */
export function UnplacedEmblem() {
  return (
    <span className="rt-unplaced" role="img" aria-label="Tier not revealed yet" data-unplaced-emblem>
      ?
    </span>
  );
}

/**
 * The five placement boxes (mockups 11 and 12): a tick on green for a win, a cross on red for a loss, the next one gold.
 * A match played whose result this device doesn't know (played elsewhere; W3a keeps only the count) is a plain
 * "played" box with its number, never a guessed tick or cross; a drawn match shows a dash.
 */
export function PlacementBoxes({ results }: { results: readonly PlacementResult[] }) {
  return (
    <ol className="rt-boxes" aria-label={`Placement, ${results.length} of ${PLACEMENT_MATCHES} played`} data-placement-boxes>
      {Array.from({ length: PLACEMENT_MATCHES }, (_, i) => {
        const played = i < results.length;
        const r = played ? (results[i] ?? "played") : null;
        const next = i === results.length;
        return (
          <li
            key={i}
            className="rt-box"
            data-box={r ?? (next ? "next" : "later")}
            aria-label={r === "won" ? `Match ${i + 1}: won` : r === "lost" ? `Match ${i + 1}: lost` : r === "drawn" ? `Match ${i + 1}: drawn` : r ? `Match ${i + 1}: played` : `Match ${i + 1}`}
          >
            {r === "won" ? <Icon name="check" size={24} /> : r === "lost" ? <Icon name="cross" size={24} /> : <span aria-hidden="true">{r === "drawn" ? "–" : i + 1}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** The bar to the next division (mockups 01, 07, 13, 14): the gold fill, "Volt II" left, "122 to Volt I" right. */
export function DivisionBarView({ rank, labels = true }: { rank: RankView; labels?: boolean }) {
  const bar = divisionBar(rank);
  return (
    <div className="rt-bar-block" data-division-bar>
      <span className="rt-bar" aria-hidden="true">
        <span style={{ width: `${Math.round(bar.fraction * 100)}%` }} />
      </span>
      {labels ? (
        <span className="rt-bar-labels">
          <span className="rt-bar-here">{bar.here}</span>
          <span className="rt-bar-next" data-bar-next>
            {bar.next}
          </span>
        </span>
      ) : null}
    </div>
  );
}

/** The Puzzles / Arcade tile (mockups 01, 11, 13): the icon, the label and the rating, or what stands in for it. */
export function SideTile({ side, rating, hidden = false, sub }: { side: "puzzles" | "arcade"; rating: SideRating; hidden?: boolean; sub?: ReactNode }) {
  // During placement every rating is hidden (W3a shows none, played or not): "Hidden".
  const value = hidden
    ? "Hidden"
    : rating.rating !== null
      ? ratingText(rating.rating)
      : "Not played yet";
  const figure = !hidden && rating.rating !== null;
  return (
    <div className="rt-side" data-side={side} data-side-value={figure ? "rating" : hidden ? "hidden" : "none"}>
      <span className="rt-side-icon" aria-hidden="true">
        <SideIcon side={side} />
      </span>
      <span className="rt-side-text">
        <span className="rt-side-label">{side === "puzzles" ? "Puzzles" : "Arcade"}</span>
        <span className={figure ? "rt-side-value" : "rt-side-value rt-side-word"}>{value}</span>
        {sub ? <span className="rt-side-sub">{sub}</span> : null}
      </span>
    </div>
  );
}

/** "3 matches", "1 match", "2 played". */
export function matchesText(n: number, word: "matches" | "played" = "matches"): string {
  if (word === "played") return `${n} played`;
  return `${n} ${n === 1 ? "match" : "matches"}`;
}

function SideIcon({ side }: { side: "puzzles" | "arcade" }) {
  // Two plain marks drawn from the mockup: four squares (puzzles) and a pad (arcade); currentColor, tokens in CSS.
  return side === "puzzles" ? (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" className="rt-side-gold" />
    </svg>
  ) : (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="7" width="19" height="10" rx="5" />
      <path d="M7 10v4M5 12h4" />
      <circle cx="16" cy="11" r="0.6" className="rt-side-gold" />
      <circle cx="18" cy="13" r="0.6" className="rt-side-gold" />
    </svg>
  );
}

/** The pick's mark (mockup 02): four category diamonds for Mixed, two for a side, one for a category. */
export function PickMark({ pick }: { pick: RatedPick }) {
  const tones =
    pick === "mixed"
      ? ["word", "number", "speed", "pattern"]
      : pick === "puzzles"
        ? ["word", "logic"]
        : pick === "arcade"
          ? ["retro", "action"]
          : [pick];
  return (
    <span className="rt-pick-mark" data-count={tones.length} aria-hidden="true">
      {tones.map((t) => (
        <span key={t} className="rt-diamond" data-tone={t} data-arcade={isArcadePick(t as RatedPick) ? "" : undefined} />
      ))}
    </span>
  );
}

/** One game's row on the result (mockups 07 and 12): its tile, name, won or lost, and "168 v 151". */
export function GameRow({ game, them, showVerdict = true }: { game: RatedGame; them: string; showVerdict?: boolean }) {
  const won = game.myScore > game.theirScore;
  const lost = game.myScore < game.theirScore;
  return (
    <li className="jz-row rt-game" data-game-row={game.type} data-outcome={won ? "won" : lost ? "lost" : "level"}>
      <GameIcon type={game.type as PuzzleType} size={44} />
      <span className="rt-game-text">
        <span className="rt-game-name">{puzzleName(game.type as PuzzleType)}</span>
        {showVerdict ? (
          <span className="rt-verdict" data-verdict={won ? "won" : lost ? "lost" : "level"}>
            {won ? <Icon name="check" size={18} /> : lost ? <Icon name="cross" size={18} /> : null}
            {won ? "Won" : lost ? "Lost" : "Level"}
          </span>
        ) : null}
      </span>
      <span className="rt-game-scores" aria-label={`You ${game.myScore}, ${them} ${game.theirScore}`}>
        <span className={won ? "rt-score rt-score-won" : "rt-score"}>{game.myScore}</span>
        <span className="rt-v" aria-hidden="true">
          v
        </span>
        <span className="rt-score rt-score-them">{game.theirScore}</span>
      </span>
    </li>
  );
}

/** D2's Joules bolt (src/components/pass/JoulesBolt.tsx), the one bolt every Joules amount wears. */
export function JoulesBolt({ size = 16 }: { size?: number }) {
  return <PassJoulesBolt size={size} />;
}

/**
 * The Joules line in D2's style (D2's `.joules-line` and bolt, src/components/pass/): the amount W3a's answer says this
 * match paid (credited by D2's pass under ratedJoulesKey); D2's own JoulesLine asks the pass for Joules since a time, which
 * a rated result doesn't need: the match's own amount is exact: "+120 Joules" and the pass level when given. `tile`
 * draws the result's tile (mockup 07): the bolt, "+120" in lime, then "Joules, pass level 13".
 */
export function JoulesLine({ amount, passLevel, tile = false }: { amount: number; passLevel: number | null; tile?: boolean }) {
  if (tile)
    return (
      <p className="joules-line rt-joules rt-joules-tile" data-joules-line={amount}>
        <JoulesBolt size={24} />
        <span className="rt-joules-amount">+{ratingText(amount)}</span>
        <span className="rt-joules-level">Joules{passLevel !== null ? `, pass level ${passLevel}` : ""}</span>
      </p>
    );
  return (
    <p className="joules-line" data-joules-line={amount}>
      <JoulesBolt />
      <span className="rt-joules-amount">+{ratingText(amount)} Joules</span>
      {passLevel !== null ? <span className="rt-joules-level">, pass level {passLevel}</span> : null}
    </p>
  );
}

/** A small avatar for a player (the header's You / opponent rows), from their card look. */
export function PlayerDot({ look, size = 18 }: { look: CardLook; size?: number }) {
  return <Avatar look={look.avatar ?? DEFAULT_AVATAR} size={size} />;
}

/** The chips over a result or VS: "Mixed", "Best of 3", "v Sam". */
export function MatchChips({ items }: { items: string[] }) {
  return (
    <ul className="rt-chips" data-match-chips>
      {items.map((t) => (
        <li key={t} className="rt-chip">
          {t}
        </li>
      ))}
    </ul>
  );
}
