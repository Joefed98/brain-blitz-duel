import { useRouter } from "@tanstack/react-router";

import { Button, LevelMark } from "@/design/components";
import { STAR_SCORE } from "@/lib/practice/progressRules";
import { useRatedStatus } from "@/lib/rated/ratedApi";

/**
 * The first game's win screen (P2, 22 Nov 2026; the polish plan's section 3.4, mockup first3-e-phone.webp; behind
 * FIRST_GAME_ON_OPEN, off): the score, the first star when it was earned, then Play again (gold), Try another game,
 * and Play a real opponent where rated play is open to this player. "No account needed"; Home is one tap away.
 */
export function FirstGameWin({ score, onPlayAgain }: { score: number; onPlayAgain: () => void }) {
  const router = useRouter();
  const rated = useRatedStatus();
  const star = score >= STAR_SCORE;
  return (
    <section data-first-game-win="" aria-labelledby="first-game-win-title" className="gm-first-win">
      <LevelMark level="easy" label />
      <h1 id="first-game-win-title" className="gm-first-win-title">
        Your first game
      </h1>
      <p data-first-game-score={score} className="gm-first-win-score">
        {score}
      </p>
      <p className="gm-first-win-line">{star ? "Your first star." : `${STAR_SCORE} for a star.`}</p>
      <div className="gm-first-win-actions">
        <Button variant="gold" size={60} block onClick={onPlayAgain} data-first-game-again="">
          Play again
        </Button>
        <Button variant="secondary" size={52} block onClick={() => void router.navigate({ to: "/practice", search: {} as never })} data-first-game-other="">
          Try another game
        </Button>
        {rated?.open ? (
          <Button variant="secondary" size={52} block onClick={() => void router.navigate({ to: "/rated" as never })} data-first-game-rated="">
            Play a real opponent
          </Button>
        ) : null}
        <Button variant="quiet" size={48} block onClick={() => void router.navigate({ to: "/" })} data-first-game-home="">
          Home
        </Button>
      </div>
      <p className="gm-first-win-note">No account needed.</p>
    </section>
  );
}
