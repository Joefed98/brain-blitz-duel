import { useMemo } from "react";

import { Coin } from "@/components/app/CoinCounter";
import { liveChallengeStates, type ChallengeState } from "@/components/app/PracticeChallenges";
import { JoulesBolt } from "@/components/pass/JoulesBolt";
import { Icon, Progress } from "@/design/components";
import type { ServerChallenges } from "@/lib/challenges/challengesClient";
import type { PuzzleType } from "@/lib/duel/types";
import { JOULES } from "@/lib/pass/joules";
import { usePass } from "@/lib/pass/passApi";

/**
 * The challenge rows of the Games session (phase 2 step 3, 14 Nov 2026; style guide "Challenge row"): a tick (done) or
 * a ring, the goal, a thin progress bar with the best so far, and the reward on the right. One list for a game's page
 * and the full Challenges page (More → Challenges). Done comes from the server alone (getMyChallengesFn, as Practice's
 * old list read it, `withServer`); the bar also reads this device's record. Only live challenges of playable games
 * are shown (challengeLive: retired games' challenges are hidden).
 */

/** Each live challenge's state, the server's answer laid over this device's record. */
export function useChallengeStates(
  server: ServerChallenges | null,
  type?: PuzzleType,
): ChallengeState[] {
  return useMemo(() => liveChallengeStates(server, type), [server, type]);
}

/** The Joules a completed Practice challenge earns, shown only where the pass is on for this player. */
export function useChallengeJoules(): number | null {
  const pass = usePass();
  return pass.state === "open" ? JOULES.practice_challenge : null;
}

/** "28 / 45", "Not yet" before any progress, "Done" once the server has completed it. */
function figureOf(state: ChallengeState): string {
  if (state.status === "done") return "Done";
  if (state.value <= 0) return "Not yet";
  return `${Math.floor(state.value)} / ${state.target} best`;
}

export function ChallengeRow({
  state,
  joules,
  account,
}: {
  state: ChallengeState;
  joules: number | null;
  account: boolean;
}) {
  const { challenge, progress, status } = state;
  const done = status === "done";
  return (
    <li data-challenge={challenge.id} data-status={status} className="gm-ch-row">
      <span aria-hidden="true" data-done={done ? "" : undefined} className="gm-ch-mark">
        {done ? <Icon name="check" size={18} /> : null}
      </span>
      <span className="gm-ch-body">
        <span className="gm-ch-goal">{challenge.text}</span>
        <span className="gm-ch-line">
          {done ? null : <Progress value={progress} className="gm-ch-bar" />}
          <span data-challenge-figure className="gm-ch-figure">
            {done ? <span className="sr-only">{challenge.name}: </span> : null}
            {figureOf(state)}
          </span>
        </span>
        {/* A guest's coins wait for an account: a completed coin challenge says so. */}
        {done && challenge.coins > 0 && !account ? (
          <span data-challenge-unlock className="gm-ch-unlock">
            Unlocks with your account
          </span>
        ) : null}
      </span>
      {joules !== null || challenge.coins > 0 ? (
        <span className="gm-ch-rewards" data-done={done ? "" : undefined}>
          {joules !== null ? (
            <span data-challenge-joules={joules} className="gm-ch-joules">
              <JoulesBolt size={14} />
              {joules}
              <span className="sr-only"> Joules</span>
            </span>
          ) : null}
          {/* Only coin challenges show coins (Joe, 11 Nov 2026). */}
          {challenge.coins > 0 ? (
            <span data-challenge-reward data-coins={challenge.coins} className="gm-ch-coins">
              <Coin size={14} />
              {challenge.coins}
              <span className="sr-only"> coins</span>
            </span>
          ) : null}
        </span>
      ) : null}
    </li>
  );
}

/** A panel of challenge rows (no heading: the page names it). */
export function ChallengeRows({
  states,
  joules,
  account,
  label,
}: {
  states: readonly ChallengeState[];
  joules: number | null;
  account: boolean;
  label: string;
}) {
  return (
    <ul aria-label={label} className="gm-ch-list">
      {states.map((s) => (
        <ChallengeRow key={s.challenge.id} state={s} joules={joules} account={account} />
      ))}
    </ul>
  );
}
