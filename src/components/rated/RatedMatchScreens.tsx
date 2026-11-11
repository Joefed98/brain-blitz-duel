/**
 * The rated match from search to result (wave 3, session W3c; mockups 03, 04, 07, 12 and 13 in docs/mockups/wave-3/).
 * Every figure comes from the server's answer (backend.ts); nothing here works out a result, a rating or a tier.
 *
 * - Searching (03): your player card pulsing over widening rings, the clock and the range, the recorded-run note,
 *   Cancel.
 * - VS (04): both player cards slam in from opposite sides (theirs from the right, yours from the left), each pill
 *   with tier and rating (or the player number during placement), the tier emblems, your record against each other,
 *   and the Live tag or W3b's "Recorded run · 2 h ago" from the run's real time. The slam plays the room's flash sound.
 * - The result (07): you win or lose and the score, the Joulz Rating change with the bar to the next division,
 *   Puzzles and Arcade's changes, each game won or lost, the Joules line, a star earned (C1a's 175+ star), a near-miss
 *   line, then Next match, Rematch (8 s) and Challenge (friends only, through the existing friend challenge flow).
 * - A placement result (12): the same, with the placement boxes in place of the rating.
 * - The reveal (13): after the 5th, the tier, rating, "Better than N% of players" (the server's real counts) and
 *   Puzzles and Arcade.
 *
 * Every motion here stops under Reduce Motion (rated.css: the elements are drawn in their final place).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

import { ChallengeShareButton } from "@/components/challenge/ChallengeShare";
import { Button, Icon, LiveTag, Panel } from "@/design/components";
import { PlayerCard } from "@/design/identity";
import { puzzleName } from "@/lib/duel/catalogue";
import { loadSoundGroup, playCueSlot } from "@/lib/sound";
import type { RatedMatch, RatedPlayer, RatedResult, SearchProgress } from "@/lib/rated/backend";
import { recordRatedEvent } from "@/lib/rated/ratedEvents";
import {
  bestOfLabel,
  clockText,
  headToHeadLine,
  nearMissText,
  pickLabel,
  placementResultLine,
  rematchSecondsLeft,
  wonLostText,
} from "@/lib/rated/rules";
import { changeText, divisionBar, PLACEMENT_MATCHES, ratingText } from "@/lib/rated/tierDisplay";
import { FROZEN_LINES } from "@/lib/rated/rules";
import { usePass } from "@/lib/pass/passApi";
import type { PuzzleType } from "@/lib/duel/types";

import { DivisionBarView, GameRow, JoulesLine, MatchChips, PlacementBoxes, RankEmblem, SideTile, UnplacedEmblem } from "./RatedParts";

/** A player's card as the rated screens draw it: their look, title and, once placed, tier and rating in the pill. */
export function RatedCard({ player, label }: { player: RatedPlayer; label?: string }) {
  return (
    <PlayerCard
      look={player.look}
      name={player.username}
      playerNumber={player.playerNumber}
      title={player.title}
      badges={player.badges}
      rank={player.guest || player.deleted ? null : player.rank}
      guest={player.guest}
      label={label}
    />
  );
}

/* ------------------------------------------------------------------ searching (mockup 03) */

export function Searching({
  me,
  pickText,
  progress,
  onCancel,
}: {
  me: RatedPlayer;
  /** "Mixed, best of 3". */
  pickText: string;
  progress: SearchProgress | null;
  onCancel: () => void;
}) {
  const elapsed = progress?.elapsedMs ?? 0;
  const until = progress?.recordedAfterMs ?? 8000;
  const fraction = Math.max(0, Math.min(1, elapsed / Math.max(1, until)));
  return (
    <div className="rt-screen rt-search" data-rated-screen="searching">
      <div className="rt-search-stage" aria-hidden="true">
        <span className="rt-ring rt-ring-1" />
        <span className="rt-ring rt-ring-2" />
        <span className="rt-ring rt-ring-3" />
      </div>
      <div className="rt-search-card rt-pulse" data-pulse>
        <RatedCard player={me} label="Your card" />
      </div>
      <div className="rt-search-text" role="status" aria-live="polite">
        <h1 className="jz-screen-title rt-search-title">Finding an opponent</h1>
        <p className="rt-search-sub">
          {pickText}
          {me.rank ? `, near your ${ratingText(me.rank.rating)}` : ""}
        </p>
      </div>
      <div className="rt-search-clock">
        <span className="rt-search-time" data-search-clock>
          {clockText(elapsed)}
        </span>
        <span className="rt-search-bar" aria-hidden="true">
          <span style={{ width: `${Math.round(fraction * 100)}%` }} />
        </span>
        {progress ? <span className="rt-search-range" data-search-range>±{progress.range}</span> : null}
      </div>
      <Panel pad className="rt-note">
        <Icon name="info" size={22} tone="cyan" />
        <p>Nobody free after {Math.round(until / 1000)} seconds? You’ll play a recorded run by a real player near your rating. It’s always labelled.</p>
      </Panel>
      <div className="rt-foot">
        <Button variant="secondary" size={52} block onClick={onCancel} data-search-cancel>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ VS (mockup 04) */

export function VsScreen({ match, nowMs }: { match: RatedMatch; nowMs: number }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    recordRatedEvent({ event: "vs_shown", source: match.source.kind });
    loadSoundGroup("room");
    // The slam lands at 750 ms (rated.css .rt-vs-mark); the room's flash sound on it, silent when not decoded yet.
    const t = window.setTimeout(() => playCueSlot("room.prepare.flash"), 750);
    return () => window.clearTimeout(t);
  }, [match.source.kind]);
  // W3b's own label from the run's real time ("Recorded run · 2 h ago", recordedAgeLabel).
  const recorded = match.source.kind === "recorded" ? match.source.label : null;
  void nowMs;
  const record = headToHeadLine(match.headToHead, match.them.username);
  return (
    <div className="rt-screen rt-vs" data-rated-screen="vs" data-source={match.source.kind}>
      <div className="rt-vs-top">
        <MatchChips items={[pickLabel(match.pick), bestOfLabel(match.bestOf)].concat(match.placement ? [`Placement ${match.placement} of ${PLACEMENT_MATCHES}`] : [])} />
        {recorded ? (
          <span className="rt-recorded" data-vs-tag="recorded">
            {recorded}
          </span>
        ) : (
          <span data-vs-tag="live">
            <LiveTag />
          </span>
        )}
      </div>
      <VsSide player={match.them} side="them" />
      <div className="rt-vs-rail" aria-hidden="true">
        <span className="rt-vs-line" />
        <span className="rt-vs-mark">VS</span>
        <span className="rt-vs-line" />
      </div>
      <VsSide player={match.me} side="me" />
      {record ? (
        <p className="rt-vs-record" data-head-to-head>
          {record}
        </p>
      ) : null}
    </div>
  );
}

function VsSide({ player, side }: { player: RatedPlayer; side: "me" | "them" }) {
  return (
    <div className={`rt-vs-side rt-vs-${side}`} data-vs-side={side}>
      <div className="rt-vs-card">
        <RatedCard player={player} label={side === "me" ? "Your card" : `${player.username}’s card`} />
      </div>
      <span className="rt-vs-emblem">
        {player.rank ? <RankEmblem rank={player.rank} size={48} /> : <UnplacedEmblem />}
        <span className="rt-vs-tier">{player.deleted ? "" : player.guest ? "Guest" : player.rank ? player.rank.label : "Placement"}</span>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ the result (mockups 07 and 12) */

export function MatchResult({
  result,
  nowMs,
  onNext,
  onRematch,
  onTiers,
  onChallenge,
  onReveal,
}: {
  result: RatedResult;
  nowMs: number;
  onNext: () => void;
  /** After the 5th placement match: on to the reveal (mockup 13). */
  onReveal: () => void;
  onRematch: () => void;
  onTiers: () => void;
  onChallenge: () => Promise<{ ok: true; code: string } | { ok: false; message: string }>;
}) {
  const { match } = result;
  const placing = result.placementResults !== null;
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    recordRatedEvent({ event: "result_viewed", outcome: result.outcome === "won" ? "won" : "lost", placement: placing });
  }, [result.outcome, placing]);
  const pass = usePass();
  const passLevel = pass.state === "open" ? pass.view.level : null;
  const them = match.them.username;
  const rematchLeft = rematchSecondsLeft(result.rematchUntil, nowMs);
  const nextPlacement = placing && result.placementResults!.length < PLACEMENT_MATCHES ? result.placementResults!.length + 1 : null;

  return (
    <div className="rt-screen rt-result" data-rated-screen={placing ? "placement-result" : "result"} data-outcome={result.outcome}>
      <header className="rt-result-head jz-stripes">
        <MatchChips items={[pickLabel(match.pick), bestOfLabel(match.bestOf), `v ${them}`]} />
        <h1 className="jz-display rt-result-title">{result.outcome === "won" ? "You win" : result.outcome === "drawn" ? "A draw" : `${them} wins`}</h1>
        <p className="rt-result-score" aria-label={`${result.myGames} games to ${result.theirGames}`} data-match-score>
          {result.myGames}–{result.theirGames}
        </p>
      </header>

      {placing ? (
        <Panel pad className="rt-placement" data-placement-panel>
          <div className="rt-placement-head">
            <h2 className="rt-placement-title">
              Placement {result.placementResults!.length} of {PLACEMENT_MATCHES}
            </h2>
            <span className="rt-placement-won">
              {result.placementResults!.filter((r) => r === "won").length} won
            </span>
          </div>
          <PlacementBoxes results={result.placementResults!} />
          <p className="rt-placement-line">{placementResultLine(result.placementResults!)}</p>
        </Panel>
      ) : result.rating ? (
        <Panel pad className="rt-rating" data-rating-panel>
          <div className="rt-rating-head">
            <RankEmblem rank={result.rating.after} size={44} />
            <span className="rt-rating-text">
              <span className="rt-rating-label">Joulz Rating</span>
              <span className="rt-rating-value" data-joulz-rating>
                {ratingText(result.rating.after.rating)}
              </span>
            </span>
            <Change value={result.rating.change} big />
          </div>
          <DivisionBarView rank={result.rating.after} />
          {result.rating.puzzles || result.rating.arcade ? (
            <div className="rt-rating-sides" data-side-changes>
              {result.rating.puzzles ? (
                <span>
                  Puzzles <b>{ratingText(result.rating.puzzles.rating)}</b> <Change value={result.rating.puzzles.change} />
                </span>
              ) : (
                <span />
              )}
              {result.rating.arcade ? (
                <span>
                  Arcade <b>{ratingText(result.rating.arcade.rating)}</b> <Change value={result.rating.arcade.change} />
                </span>
              ) : null}
            </div>
          ) : null}
        </Panel>
      ) : null}

      {result.frozen ? (
        <p className="rt-frozen" data-frozen={result.frozen}>
          {FROZEN_LINES[result.frozen]}
        </p>
      ) : null}

      <Panel className="rt-games">
        {!placing ? (
          <div className="rt-games-head">
            <span>Game</span>
            <span>You v {them}</span>
          </div>
        ) : null}
        <ul>
          {result.games.map((g, i) => (
            <GameRow key={`${g.type}-${i}`} game={g} them={them} showVerdict={!placing} />
          ))}
        </ul>
      </Panel>

      {placing ? (
        result.joules ? <JoulesLine amount={result.joules.amount} passLevel={null} /> : null
      ) : result.joules || result.star ? (
        <div className="rt-earned">
          {result.joules ? (
            <Panel pad className="rt-earned-tile" data-earned="joules">
              <JoulesLine amount={result.joules.amount} passLevel={result.joules.passLevel ?? passLevel} tile />
            </Panel>
          ) : null}
          {result.star ? (
            <Panel pad className="rt-earned-tile" data-earned="star">
              <Icon name="star" size={22} tone="gold" />
              <span className="rt-star-text">Star on {puzzleName(result.star.type as PuzzleType)}</span>
            </Panel>
          ) : null}
        </div>
      ) : null}

      {result.nearMiss ? <NearMiss {...nearMissText(result.nearMiss)} /> : null}

      <div className="rt-actions">
        <Button
          variant="gold"
          size={58}
          block
          data-next-match={result.reveal ? undefined : ""}
          data-reveal-open={result.reveal ? "" : undefined}
          onClick={() => {
            if (result.reveal) return onReveal();
            recordRatedEvent({ event: "next_match_tapped" });
            onNext();
          }}
        >
          {result.reveal ? "Reveal my tier" : nextPlacement ? `Play placement ${nextPlacement}` : "Next match"}
        </Button>
        {!placing && (rematchLeft > 0 || result.friend) ? (
          <div className="rt-action-row">
            {rematchLeft > 0 ? (
              <Button variant="secondary" size={52} block onClick={onRematch} data-rematch>
                Rematch, {rematchLeft} s
              </Button>
            ) : null}
            {result.friend ? <ChallengeButton them={them} total={result.games.reduce((t, g) => t + g.myScore, 0)} rounds={result.games.length} make={onChallenge} /> : null}
          </div>
        ) : null}
        {!placing ? (
          <Button variant="quiet" size={44} block onClick={onTiers} data-open-tiers>
            See the tiers
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Change({ value, big = false }: { value: number; big?: boolean }) {
  const dir = value > 0 ? "up" : value < 0 ? "down" : "level";
  return (
    <span className={big ? "rt-change rt-change-big" : "rt-change"} data-change={dir}>
      {dir === "up" ? <Icon name="up" size={big ? 24 : 18} /> : dir === "down" ? <Icon name="down" size={big ? 24 : 18} /> : null}
      {changeText(value)}
    </span>
  );
}

function NearMiss({ game, line }: { game: string; line: string }) {
  return (
    <p className="rt-near-miss" data-near-miss>
      {game}: <span className="rt-near-miss-line">{line}</span>
    </p>
  );
}

/** Challenge (friends only): the existing friend challenge flow, made from this match's games, then shared. */
function ChallengeButton({
  them,
  total,
  rounds,
  make,
}: {
  them: string;
  total: number;
  rounds: number;
  make: () => Promise<{ ok: true; code: string } | { ok: false; message: string }>;
}) {
  const [state, setState] = useState<{ kind: "idle" | "busy" } | { kind: "ready"; code: string } | { kind: "error"; message: string }>({
    kind: "idle",
  });
  if (state.kind === "ready")
    return <ChallengeShareButton code={state.code} kind="invite" total={total} rounds={rounds} label={`Challenge ${them}`} />;
  return (
    <span className="rt-challenge">
      <Button
        variant="secondary"
        size={52}
        block
        data-rated-challenge={state.kind}
        disabled={state.kind === "busy"}
        onClick={() => {
          setState({ kind: "busy" });
          void make().then(
            (r) => setState(r.ok ? { kind: "ready", code: r.code } : { kind: "error", message: r.message }),
            () => setState({ kind: "error", message: "That didn’t work. Try again." }),
          );
        }}
      >
        Challenge {them}
      </Button>
      {state.kind === "error" ? <span className="rt-error">{state.message}</span> : null}
    </span>
  );
}

/* ------------------------------------------------------------------ the reveal (mockup 13) */

export function PlacementReveal({
  reveal,
  onNext,
  onTiers,
  share,
}: {
  reveal: NonNullable<RatedResult["reveal"]>;
  onNext: () => void;
  onTiers: () => void;
  share?: ReactNode;
}) {
  return (
    <div className="rt-screen rt-reveal" data-rated-screen="reveal" data-tier={reveal.rank.tier}>
      <div className="rt-reveal-rays" aria-hidden="true" />
      <p className="rt-reveal-done">
        {reveal.won !== null && reveal.lost !== null ? `Placement complete, ${wonLostText(reveal.won, reveal.lost)}` : "Placement complete"}
      </p>
      <div className="rt-reveal-emblem">
        <RankEmblem rank={reveal.rank} size={176} />
      </div>
      <h1 className="jz-display rt-reveal-title" data-reveal-tier>
        You’re {reveal.rank.label}
      </h1>
      {reveal.betterThan !== null ? (
        <p className="rt-reveal-better" data-better-than>
          Better than {reveal.betterThan}% of players
        </p>
      ) : null}
      <Panel pad className="rt-reveal-panel">
        <div className="rt-reveal-row">
          <span className="rt-rating-label">Joulz Rating</span>
          <DivisionNext rank={reveal.rank} />
        </div>
        <span className="rt-reveal-value" data-joulz-rating>
          {ratingText(reveal.rank.rating)}
        </span>
        <div className="rt-sides">
          <SideTile side="puzzles" rating={reveal.puzzles} sub={`${reveal.puzzles.matches} ${reveal.puzzles.matches === 1 ? "match" : "matches"}`} />
          <SideTile side="arcade" rating={reveal.arcade} sub={`${reveal.arcade.matches} ${reveal.arcade.matches === 1 ? "match" : "matches"}`} />
        </div>
      </Panel>
      <div className="rt-actions">
        <Button
          variant="gold"
          size={58}
          block
          data-next-match
          onClick={() => {
            recordRatedEvent({ event: "next_match_tapped" });
            onNext();
          }}
        >
          Find a match
        </Button>
        <div className="rt-action-row">
          <Button variant="secondary" size={52} block onClick={onTiers} data-open-tiers>
            See the tiers
          </Button>
          {share}
        </div>
      </div>
    </div>
  );
}

function DivisionNext({ rank }: { rank: NonNullable<RatedPlayer["rank"]> }) {
  // The words only (the reveal draws no bar: mockup 13).
  return (
    <span className="rt-reveal-next" data-bar-next>
      {divisionBar(rank).next}
    </span>
  );
}
