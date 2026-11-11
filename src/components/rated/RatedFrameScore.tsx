/**
 * The live rated header score (wave 3, session W3c; mockups 05 and 06): both scores in the existing game header's
 * score block, "You" over the opponent, each beside their avatar. It takes FrameScore's place in GameLayout's `score`
 * slot and uses the same `.game-frame-score` box, so no game's layout changes (the header stays 60 px; the two rows
 * fit where the label and value sat).
 *
 * The hidden finish: for the final 20 % of each game's time the opponent's score shows "?" (opponentScoreHidden,
 * exactly at 20 % left), yours stays; the game's result reveals it. A game with no clock never hides.
 */
import { AnimatedScore } from "@/components/duel/AnimatedScore";
import type { CardLook } from "@/design/identity";
import { opponentScoreHidden } from "@/lib/rated/rules";

import { PlayerDot } from "./RatedParts";

export function RatedFrameScore({
  me,
  them,
  myScore,
  theirScore,
  leftMs,
  limitMs,
}: {
  me: { look: CardLook };
  them: { name: string; look: CardLook };
  myScore: number;
  theirScore: number;
  /** The game's time left and its whole length (the timer ring's own figures). */
  leftMs: number;
  limitMs: number;
}) {
  const hidden = opponentScoreHidden(leftMs, limitMs);
  return (
    <div data-frame-score data-rated-score={hidden ? "hidden" : "live"} className="game-frame-score rt-frame-score">
      <span className="rt-frame-row" data-score-row="me">
        <PlayerDot look={me.look} />
        <span className="rt-frame-who">You</span>
        <AnimatedScore value={myScore} className="rt-frame-value rt-frame-mine" />
      </span>
      <span className="rt-frame-row" data-score-row="them">
        <PlayerDot look={them.look} />
        <span className="rt-frame-who">{them.name}</span>
        {hidden ? (
          <span className="rt-frame-value rt-frame-hidden" aria-label={`${them.name}’s score is hidden`} data-hidden-score>
            ?
          </span>
        ) : (
          <AnimatedScore value={theirScore} className="rt-frame-value" />
        )}
      </span>
    </div>
  );
}
