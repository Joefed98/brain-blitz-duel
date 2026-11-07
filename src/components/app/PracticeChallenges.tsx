import { Check, Lock } from "lucide-react";
import { useMemo, useState } from "react";

import { Button, GameTile, Progress, SectionHeader, Segmented } from "@/design/components";
import { challengeState, type ChallengeState, type GoalsRecord } from "@/lib/duel/practiceGoals";
import { PRACTICE_CHALLENGES } from "@/lib/duel/practiceChallenges";
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
 * Practice's Challenges (practice goals, 6 Nov 2026): this side's challenges (practiceChallenges.ts) with In progress /
 * New / Done filters, each row the game's tile (a tap plays it), its name, the goal, a progress bar with the figure, and
 * the reward, which unlocks with an account (none exist yet). Progress comes from this device's record only.
 * Text emphasis: the goal is the row's one bright line; the name, figure and reward are quieter.
 */
export function PracticeChallenges({
  types,
  record,
  nameOf,
  onPlay,
}: {
  /** The games shown on this side of Practice (a challenge of another side's game is left out). */
  types: ReadonlySet<PuzzleType>;
  record: GoalsRecord;
  nameOf: (type: PuzzleType) => string;
  onPlay: (type: PuzzleType) => void;
}) {
  const states = useMemo(
    () => PRACTICE_CHALLENGES.filter((c) => types.has(c.type)).map((c) => challengeState(c, record)),
    [types, record],
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
            <ChallengeRow key={s.challenge.id} state={s} name={nameOf(s.challenge.type)} onPlay={onPlay} />
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

function ChallengeRow({ state, name, onPlay }: { state: ChallengeState; name: string; onPlay: (type: PuzzleType) => void }) {
  const { challenge, value, target, progress, status } = state;
  const done = status === "done";
  return (
    <div data-challenge={challenge.id} data-status={status} className="jz-row pc-row">
      <GameTile type={challenge.type} iconSize={44} onClick={() => onPlay(challenge.type)} aria-label={`Play ${name}`} />
      <span className="pc-body">
        <span className="pc-name">{name}</span>
        <span className="pc-goal">{challenge.text}</span>
        <span className="pc-bar">
          <Progress value={progress} done={done} className="pc-progress" />
          <span data-challenge-figure className="pc-figure">
            {done ? (
              <>
                <Check aria-hidden="true" className="pc-icon" />
                Done
              </>
            ) : (
              `${Math.floor(value)} / ${target}`
            )}
          </span>
        </span>
        {/* Rewards wait for accounts (none yet): a completed challenge says so. */}
        {done ? <span data-challenge-unlock className="pc-unlock">Unlocks with your account</span> : null}
      </span>
      <span data-challenge-reward className="pc-reward">
        <Lock aria-hidden="true" className="pc-icon" />
        {challenge.reward}
      </span>
    </div>
  );
}
