/**
 * The live rated header score (wave 3, session W3c; mockups 05 and 06): both scores in the existing game header's
 * score block, "You" over the opponent, each beside their avatar. It takes FrameScore's place in GameLayout's `score`
 * slot and uses the same `.game-frame-score` box, so no game's layout changes (the header stays 60 px; the two rows
 * fit where the label and value sat).
 *
 * The hidden finish: for the final 20 % of each game's time the opponent's score shows "?" (W3b's
 * opponentScoreHidden, exactly at 20 % left; the server's ratedOpponentScoreFn hides it as well), yours stays; the
 * game's result reveals it. `RatedRoomScore` is the room route's wrapper: W3b's opponent score once a second, your
 * score from your stored result or, in an arcade game, the run's own running score.
 */
import { useEffect, useRef, useState } from "react";

import { AnimatedScore } from "@/components/duel/AnimatedScore";
import type { CardLook } from "@/design/identity";
import { backendNow } from "@/lib/rated/ratedApi";
import { readLiveScore, wantLiveScore } from "@/lib/rated/liveScore";
import type { RatedMatch } from "@/lib/rated/backend";
import { opponentScoreHidden } from "@/lib/rated/rules";

import { PlayerDot } from "./RatedParts";

export function RatedFrameScore({
  me,
  them,
  myScore,
  theirScore,
  leftMs,
  limitMs,
  serverHidden = false,
  extra,
}: {
  me: { look: CardLook };
  them: { name: string; look: CardLook };
  myScore: number | null;
  theirScore: number | null;
  /** The game's time left and its whole length (the timer ring's own figures). */
  leftMs: number;
  limitMs: number;
  /** The server already hides it (ratedOpponentScoreFn's `hidden`). */
  serverHidden?: boolean;
  /** Drawn over the block's corner (a room's unread-chat dot); takes no space. */
  extra?: React.ReactNode;
}) {
  const hidden = serverHidden || opponentScoreHidden(Math.max(0, limitMs - leftMs), limitMs);
  return (
    <div data-frame-score data-rated-score={hidden ? "hidden" : "live"} className="game-frame-score rt-frame-score">
      <span className="rt-frame-row" data-score-row="me">
        <PlayerDot look={me.look} />
        <span className="rt-frame-who th-name" data-one-line>
          You
        </span>
        {myScore === null ? (
          <span className="rt-frame-value rt-frame-mine">–</span>
        ) : (
          <AnimatedScore value={myScore} className="rt-frame-value rt-frame-mine" />
        )}
      </span>
      <span className="rt-frame-row" data-score-row="them">
        <PlayerDot look={them.look} />
        <span className="rt-frame-who th-name" data-one-line>
          {them.name}
        </span>
        {hidden ? (
          <span className="rt-frame-value rt-frame-hidden" aria-label={`${them.name}’s score is hidden`} data-hidden-score>
            ?
          </span>
        ) : theirScore === null ? (
          <span className="rt-frame-value">–</span>
        ) : (
          <AnimatedScore value={theirScore} className="rt-frame-value" />
        )}
      </span>
      {extra}
    </div>
  );
}

/** The room route's rated header: W3b's opponent score and your own, for the room's current game. */
export function RatedRoomScore({
  matchId,
  round,
  storedScore,
  leftMs,
  limitMs,
  active,
  extra,
}: {
  matchId: string;
  round: number;
  /** Your stored score for this game once the server has graded it, else null. */
  storedScore: number | null;
  leftMs: number;
  limitMs: number;
  /** The game is being played (the puzzle phase). */
  active: boolean;
  extra?: React.ReactNode;
}) {
  const [match, setMatch] = useState<RatedMatch | null>(null);
  const [theirs, setTheirs] = useState<{ round: number; score: number | null; hidden: boolean } | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const sent = useRef<number | null>(null);

  useEffect(() => {
    let on = true;
    void backendNow().then(async (b) => {
      const m = b ? await b.match(matchId).catch(() => null) : null;
      if (on) setMatch(m);
    });
    return () => {
      on = false;
    };
  }, [matchId]);

  // The arcade run's own running score, published by its stage while this header asks.
  useEffect(() => {
    if (!active) return;
    const release = wantLiveScore();
    const id = setInterval(() => setLive(readLiveScore()), 1000);
    return () => {
      clearInterval(id);
      release();
      setLive(null);
    };
  }, [active, round]);

  // W3b's opponent score about once a second, and our own live score to a live opponent (display only).
  useEffect(() => {
    let on = true;
    const tick = async () => {
      const b = await backendNow();
      if (!b || !on) return;
      const o = await b.opponentScore(matchId).catch(() => null);
      if (on && o) setTheirs({ round: o.round, score: o.score, hidden: o.hidden });
      const mine = readLiveScore();
      if (active && match?.source.kind === "live" && mine !== null && mine !== sent.current) {
        sent.current = mine;
        void b.progress(matchId, round, mine);
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 1000);
    return () => {
      on = false;
      clearInterval(id);
    };
  }, [matchId, round, active, match?.source.kind]);

  const sameRound = theirs?.round === round;
  return (
    <RatedFrameScore
      me={{ look: match?.me.look ?? { cardArt: null, frame: null, nameColour: null, avatar: null } }}
      them={{ name: match?.them.username ?? "Opponent", look: match?.them.look ?? { cardArt: null, frame: null, nameColour: null, avatar: null } }}
      myScore={storedScore ?? live}
      theirScore={sameRound ? (theirs?.score ?? null) : null}
      serverHidden={sameRound ? (theirs?.hidden ?? false) : false}
      leftMs={leftMs}
      limitMs={limitMs}
      extra={extra}
    />
  );
}
