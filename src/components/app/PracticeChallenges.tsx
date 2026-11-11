import { useEffect, useMemo, useState } from "react";

import { Coin } from "@/components/app/CoinCounter";
import { Icon } from "@/design/components";
import { Button, GameTile, Progress, SectionHeader, Segmented } from "@/design/components";
import { takeChallengeMoments, type ChallengeMoment, type ServerChallenges } from "@/lib/challenges/challengesClient";
import { challengeState, type ChallengeState, type GoalsRecord } from "@/lib/duel/practiceGoals";
import { PRACTICE_CHALLENGES, challengeById, challengeLive } from "@/lib/duel/practiceChallenges";
import type { PuzzleType } from "@/lib/duel/types";

type Filter = "progress" | "new" | "done";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "progress", label: "In progress" },
  { value: "new", label: "New" },
  { value: "done", label: "Done" },
];

/** Rows shown before "Show all". */
const FIRST_ROWS = 3;

/**
 * One challenge's state with the server's answer laid over this device's record (wave 2 C1b): done only when the server
 * says so (it alone completes a challenge, from its own grade); the bar's value the higher of the two, held short of
 * the target while the server hasn't completed it.
 */
export function withServer(state: ChallengeState, server: ServerChallenges | null): ChallengeState {
  const row = server?.rows.find((r) => r.id === state.challenge.id);
  const done = Boolean(row?.done);
  const best = Math.max(state.value, row?.best ?? 0);
  const value = done ? state.target : Math.min(best, Math.max(0, state.target - (state.target > 1 ? 1 : state.target)));
  return {
    ...state,
    value,
    progress: done ? 1 : state.target > 0 ? value / state.target : 0,
    status: done ? "done" : value > 0 ? "progress" : "new",
  };
}

/**
 * Practice's Challenges (practice goals, 6 Nov 2026; the full catalogue since wave 2 C1b): this side's live challenges
 * (practiceChallenges.ts; Hard and Expert wait for their levels) with In progress / New / Done filters, each row the
 * game's tile (a tap plays it), the game and the challenge's name, the goal, a progress bar with the figure, and the
 * reward (coins, or a badge). Done comes from the server alone (`server`, getMyChallengesFn); the bar also reads this
 * device's record. Text emphasis: the goal is the row's one bright line; the name, figure and reward are quieter.
 */
export function PracticeChallenges({
  types,
  record,
  nameOf,
  onPlay,
  server = null,
}: {
  /** The games shown on this side of Practice (a challenge of another side's game is left out). */
  types: ReadonlySet<PuzzleType>;
  record: GoalsRecord;
  nameOf: (type: PuzzleType) => string;
  onPlay: (type: PuzzleType) => void;
  /** The server's progress (null until it answers: nothing shows as done). */
  server?: ServerChallenges | null;
}) {
  const states = useMemo(
    () =>
      PRACTICE_CHALLENGES.filter((c) => types.has(c.type) && challengeLive(c)).map((c) => withServer(challengeState(c, record), server)),
    [types, record, server],
  );
  const counts = { progress: 0, new: 0, done: 0 } as Record<Filter, number>;
  for (const s of states) counts[s.status] += 1;
  const [chosen, setChosen] = useState<Filter | null>(null);
  const filter: Filter = chosen ?? (counts.progress > 0 ? "progress" : "new");
  const [all, setAll] = useState(false);
  if (states.length === 0) return null;
  // In progress: nearest to done first; New and Done keep the list's order.
  const rows = states
    .filter((s) => s.status === filter)
    .sort((a, b) => (filter === "progress" ? b.progress - a.progress : 0));
  const shown = all ? rows : rows.slice(0, FIRST_ROWS);
  return (
    <section aria-label="Challenges" data-practice-challenges className="ap-section">
      <SectionHeader
        title="Challenges"
        right={
          <span className="ap-meta" data-challenges-done={counts.done}>
            {counts.done} of {states.length} done
          </span>
        }
      />
      <p data-challenges-note className="pc-note">
        Each challenge is completed in a single Practice run.
      </p>
      <p data-challenges-badges className="pc-note">
        Every challenge counts towards your Challenger badges.
      </p>
      <Segmented
        label="Challenges shown"
        radio
        value={filter}
        onChange={(value) => {
          setChosen(value);
          setAll(false);
        }}
        options={FILTERS.map((f) => ({ value: f.value, label: f.label, count: counts[f.value], data: { "data-challenge-filter": f.value } }))}
      />
      {shown.length > 0 ? (
        <div className="jz-panel">
          {shown.map((s) => (
            <ChallengeRow key={s.challenge.id} state={s} name={nameOf(s.challenge.type)} onPlay={onPlay} account={server?.account ?? false} />
          ))}
        </div>
      ) : (
        <p data-challenges-empty className="jz-panel ap-empty">
          {filter === "done" ? "None done yet" : filter === "progress" ? "None started yet" : "All started"}
        </p>
      )}
      {rows.length > FIRST_ROWS ? (
        <Button variant="quiet" size={44} onClick={() => setAll((v) => !v)} data-challenges-more="">
          {all ? "Show fewer" : `Show all ${rows.length}`}
        </Button>
      ) : null}
    </section>
  );
}

function ChallengeRow({ state, name, onPlay, account }: { state: ChallengeState; name: string; onPlay: (type: PuzzleType) => void; account: boolean }) {
  const { challenge, value, target, progress, status } = state;
  const done = status === "done";
  return (
    <div data-challenge={challenge.id} data-status={status} className="jz-row pc-row">
      <GameTile type={challenge.type} iconSize={44} onClick={() => onPlay(challenge.type)} aria-label={`Play ${name}`} />
      <span className="pc-body">
        <span className="pc-name">
          {name} · {challenge.name}
        </span>
        <span className="pc-goal">{challenge.text}</span>
        <span className="pc-bar">
          <Progress value={progress} done={done} className="pc-progress" />
          <span data-challenge-figure className="pc-figure">
            {done ? (
              <>
                <Icon name="check" size={18} style={{ width: 14, height: 14 }} className="pc-icon" />
                Done
              </>
            ) : (
              `${Math.floor(value)} / ${target}`
            )}
          </span>
        </span>
        {/* A guest's coins wait for an account: a completed coin challenge says so. */}
        {done && challenge.coins > 0 && !account ? <span data-challenge-unlock className="pc-unlock">Unlocks with your account</span> : null}
      </span>
      {/* Only coin challenges show a reward (Joe, 11 Nov 2026): the rest pay nothing and show none. */}
      {challenge.coins > 0 ? (
        <span data-challenge-reward data-coins={challenge.coins} className="pc-reward">
          <Coin size={14} />+{challenge.coins}
        </span>
      ) : null}
    </div>
  );
}

/** How long one completion moment stays (ms) before the next, or before it goes. */
export const CHALLENGE_MOMENT_MS = 3200;

/**
 * The small completion moment (wave 2 C1b): a challenge the server completed on a graded run, shown on the Practice
 * list when the player comes back to it, one at a time, never over a round, its reveal or any result (wave 1's rule).
 * A tap dismisses it. Its fade is CSS (`pc-moment`), still under reduced motion.
 */
export function ChallengeMoments() {
  const [queue, setQueue] = useState<ChallengeMoment[]>([]);
  useEffect(() => {
    setQueue(takeChallengeMoments().filter((m) => challengeById(m.id)));
  }, []);
  const head = queue[0];
  useEffect(() => {
    if (!head) return;
    const t = window.setTimeout(() => setQueue((q) => q.slice(1)), CHALLENGE_MOMENT_MS);
    return () => window.clearTimeout(t);
  }, [head]);
  if (!head) return null;
  const c = challengeById(head.id)!;
  return (
    <button
      type="button"
      key={head.id}
      role="status"
      data-challenge-moment={head.id}
      className="pc-moment jz-panel press"
      onClick={() => setQueue((q) => q.slice(1))}
    >
      <Icon name="check" size={18} className="pc-moment-icon" />
      <span className="pc-moment-text">
        <span className="pc-moment-title">Challenge done</span>
        <span className="pc-moment-name">{c.name}</span>
      </span>
      {head.coins > 0 ? (
        <span data-challenge-moment-coins className="pc-moment-coins">
          <Coin size={16} />+{head.coins}
          {head.paid ? null : <span className="pc-moment-wait">with an account</span>}
        </span>
      ) : null}
    </button>
  );
}
