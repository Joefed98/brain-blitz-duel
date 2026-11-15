import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { GameIcon } from "@/components/app/GameIcon";
import { YourChallenges } from "@/components/challenge/YourChallenges";
import { PhoneShell } from "@/components/duel/PhoneShell";
import {
  ChallengeRows,
  useChallengeJoules,
  useChallengeStates,
} from "@/components/games/ChallengeRows";
import { Icon, Progress, Segmented } from "@/design/components";
import { useAccount } from "@/lib/account/accountApi";
import { APP_NAME } from "@/lib/brand";
import { useServerChallenges } from "@/lib/challenges/challengesClient";
import { PUZZLE_REGISTRY } from "@/lib/duel/catalogue";
import type { ChallengeState } from "@/components/app/PracticeChallenges";
import type { PuzzleType } from "@/lib/duel/types";
import { gamePageLink } from "@/lib/nav/gamePage";
import { unlockAudio } from "@/lib/sound";
import { useHomeBed } from "@/lib/useScreenMusic";

/**
 * Challenges (phase 2 step 3, 14 Nov 2026; mockup docs/design/style-guide/phone/challenges.png), opened from More →
 * Challenges: every live challenge (retired games' hidden, challengeLive) with the done count and its bar, In progress |
 * New | Done, and the challenges grouped by game, each game's name opening its page (gamePage.ts). Done comes from the
 * server alone (getMyChallengesFn); each challenge's Joules show only where the pass is on.
 */
export const Route = createFileRoute("/challenges")({
  ssr: false,
  head: () => ({
    meta: [{ title: `${APP_NAME}: challenges` }, { name: "robots", content: "noindex" }],
  }),
  component: ChallengesScreen,
});

type Filter = ChallengeState["status"] | "friends";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "progress", label: "In progress" },
  { value: "new", label: "New" },
  { value: "done", label: "Done" },
  // The friend challenges this device made or sent (Profile's former "Your challenges", 14 Nov 2026).
  { value: "friends", label: "Friends" },
];

/**
 * Where the Friends tab's empty state sends a player to challenge a friend: today's Challenge a friend screen (the
 * create form). The brief named /rooms, which isn't on main yet; point this there once that route lands.
 */
const CHALLENGE_A_FRIEND = { to: "/challenge", search: {} } as const;

function ChallengesScreen() {
  useHomeBed();
  const router = useRouter();
  const account = useAccount();
  const server = useServerChallenges(true);
  const states = useChallengeStates(server);
  const joules = useChallengeJoules();
  const counts: Record<ChallengeState["status"], number> = { progress: 0, new: 0, done: 0 };
  for (const s of states) counts[s.status] += 1;
  const [chosen, setChosen] = useState<Filter | null>(null);
  const filter: Filter = chosen ?? (counts.progress > 0 ? "progress" : "new");
  // Grouped by game, in the catalogue's order; In progress puts each game's nearest-to-done first.
  const groups = useMemo(() => {
    const byGame = new Map<PuzzleType, ChallengeState[]>();
    for (const s of states) {
      if (s.status !== filter) continue;
      const list = byGame.get(s.challenge.type) ?? [];
      list.push(s);
      byGame.set(s.challenge.type, list);
    }
    const out = [...byGame.entries()].map(([type, list]) => ({
      type,
      list: filter === "progress" ? [...list].sort((a, b) => b.progress - a.progress) : list,
    }));
    if (filter === "progress")
      out.sort(
        (a, b) =>
          Math.max(...b.list.map((s) => s.progress)) - Math.max(...a.list.map((s) => s.progress)),
      );
    return out;
  }, [states, filter]);
  const back = () => {
    const history = (router as { history?: { back?: () => void; length?: number } }).history;
    if (typeof window !== "undefined" && window.history.length > 1 && history?.back) history.back();
    else void router.navigate({ to: "/more" });
  };
  const openGame = (type: PuzzleType) => {
    unlockAudio();
    void router.navigate({ ...gamePageLink(type), state: { fromPlayTab: true } as never });
  };
  const isAccount = server?.account ?? account.kind === "account";
  return (
    <PhoneShell skin="practice" railTab="more">
      <div className="gm-challenges" data-challenges-page>
        <header className="gm-sub-head">
          <button
            type="button"
            onClick={back}
            aria-label="Back"
            data-challenges-back
            className="gm-icon-btn press"
          >
            <Icon name="back" size={24} />
          </button>
          <h1 className="gm-sub-title">Challenges</h1>
          <span aria-hidden="true" className="gm-icon-btn-space" />
        </header>
        <section aria-label="Your challenges" className="gm-ch-summary">
          <p
            className="gm-ch-summary-count"
            data-challenges-done={counts.done}
            data-challenges-total={states.length}
          >
            {counts.done} of {states.length} done
          </p>
          <Progress
            value={states.length > 0 ? counts.done / states.length : 0}
            label={`${counts.done} of ${states.length} challenges done`}
            className="gm-ch-summary-bar"
          />
          <p data-challenges-badges className="gm-ch-summary-note">
            Every challenge counts towards your Challenger badges.
          </p>
        </section>
        <Segmented
          label="Challenges shown"
          radio
          value={filter}
          onChange={(value) => setChosen(value)}
          options={FILTERS.map((f) => ({
            value: f.value,
            label: f.label,
            // No counts on the tabs (the mockup's; four tabs fit a 375 px phone): the done count is in the summary.
            data: { "data-challenge-filter": f.value },
          }))}
        />
        {filter === "friends" ? (
          // Each row opens the challenge as it did on Profile.
          <YourChallenges
            variant="tab"
            onOpen={(code) =>
              void router.navigate({
                to: "/challenge",
                search: { code },
                state: { fromPlayTab: true } as never,
              } as never)
            }
            onNew={() =>
              void router.navigate({
                ...CHALLENGE_A_FRIEND,
                state: { fromPlayTab: true } as never,
              } as never)
            }
          />
        ) : groups.length === 0 ? (
          <p data-challenges-empty className="gm-empty">
            {filter === "done"
              ? "None done yet"
              : filter === "progress"
                ? "None started yet"
                : "All started"}
          </p>
        ) : (
          groups.map(({ type, list }) => {
            const name = PUZZLE_REGISTRY[type].name;
            return (
              <section
                key={type}
                aria-label={name}
                data-challenge-game={type}
                className="gm-ch-group"
              >
                <button
                  type="button"
                  onClick={() => openGame(type)}
                  data-challenge-game-link={type}
                  className="gm-ch-game press"
                >
                  <GameIcon type={type} size={44} />
                  <span className="gm-ch-game-name" data-wrap-ok="">
                    {name}
                  </span>
                  <Icon name="chevron-right" size={20} className="gm-ch-game-chevron" />
                </button>
                <ChallengeRows
                  states={list}
                  joules={joules}
                  account={isAccount}
                  label={`${name} challenges`}
                />
              </section>
            );
          })
        )}
      </div>
    </PhoneShell>
  );
}
