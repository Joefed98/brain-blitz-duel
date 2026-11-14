import { useMemo } from "react";

import { GameIcon } from "@/components/app/GameIcon";
import { withServer } from "@/components/app/PracticeChallenges";
import { Progress, SectionHeader } from "@/design/components";
import { useServerChallenges } from "@/lib/challenges/challengesClient";
import { PUZZLE_REGISTRY } from "@/lib/duel/catalogue";
import { PRACTICE_CHALLENGES, challengeLive } from "@/lib/duel/practiceChallenges";
import { challengeState, readGoals } from "@/lib/duel/practiceGoals";

/** How many of the closest challenges the section lists. */
const CLOSEST = 3;

/**
 * Profile's challenges (wave 2 C1b; A2 left the section out until now): how many of the live challenges the server has
 * completed for this player, and the few closest to done (highest bar first), each a tap to Practice. Done comes from
 * the server alone; the bars also read this device's record. Hidden while nothing has been started.
 */
export function ProfileChallenges({ onOpen }: { onOpen: () => void }) {
  const server = useServerChallenges();
  const states = useMemo(() => {
    const record = readGoals();
    return PRACTICE_CHALLENGES.filter(challengeLive).map((c) => withServer(challengeState(c, record), server));
  }, [server]);
  const done = states.filter((s) => s.status === "done").length;
  const closest = states
    .filter((s) => s.status === "progress")
    .sort((a, b) => b.progress - a.progress)
    .slice(0, CLOSEST);
  if (done === 0 && closest.length === 0) return null;
  return (
    <section aria-label="Challenges" data-profile-challenges className="ap-section">
      <SectionHeader
        title="Challenges"
        right={
          <>
            <button type="button" onClick={onOpen} data-profile-challenges-done={done} className="ap-link press -my-2.5 -mr-1 h-11 min-w-11 px-1">
              {done} of {states.length} done
            </button>
          </>
        }
      />
      {closest.length > 0 ? (
        <ul className="jz-panel">
          {closest.map((s) => (
            <li key={s.challenge.id} data-profile-challenge={s.challenge.id} data-icon="game" className="jz-row">
              <GameIcon type={s.challenge.type} size={40} />
              <span className="pc-body">
                <span className="pc-name">
                  {PUZZLE_REGISTRY[s.challenge.type].name} · {s.challenge.name}
                </span>
                <span className="pc-goal">{s.challenge.text}</span>
                <span className="pc-bar">
                  <Progress value={s.progress} className="pc-progress" />
                  <span className="pc-figure">
                    {Math.floor(s.value)} / {s.target}
                  </span>
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
