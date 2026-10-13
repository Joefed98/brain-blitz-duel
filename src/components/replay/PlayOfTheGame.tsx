import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useAppUpdateStatus } from "@/lib/appUpdate";
import { preloadGameData } from "@/lib/duel/gamePreload";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { analyseRound, scanInSlices } from "@/lib/replay/analyse";
import { momentCard, type MomentCard } from "@/lib/replay/cards";
import { soundCue, SHARED_CUES } from "@/lib/replay/cues";
import { rankMoments } from "@/lib/replay/moments";
import {
  momentWeight,
  pickPlayOfTheGame,
  planPlayOfTheGame,
  type PlayCandidate,
} from "@/lib/replay/pick";
import { gameReplaysFn } from "@/lib/replay/replay.functions";
import type { ReplayRound } from "@/lib/replay/replay.server";
import { canReplay } from "@/lib/replay/steppers";
import { planTimelapse } from "@/lib/replay/timelapse";

import { ClipPlayer, MomentCardView, PuzzleTimelapse, ReplayFrame } from "./ReplayPanels";
import { ReplayBoundary } from "./ReplayBoundary";
import { useRoundAnalysis } from "./useRoundAnalysis";

export const PLAY_MAX_HEIGHT = "min(26vh, 210px)";
const CARD_MS = 6_000;

/**
 * The podium's play of the game (fetches every round once the game has
 * finished): the single best moment across all rounds, played once with Skip.
 * Display only; Play again, Leave and the chat work exactly as before.
 */
export function PlayOfTheGame({ roomId, active }: { roomId: string; active: boolean }) {
  const fetchGame = useServerFn(gameReplaysFn);
  const { data } = useQuery({
    queryKey: ["game-replays", roomId],
    queryFn: () => fetchGame({ data: { roomId } }),
    enabled: active,
    staleTime: Infinity,
    retry: 1,
  });
  if (!active || !data || !data.ok) return null;
  return (
    <ReplayBoundary>
      <PlayOfTheGameView rounds={data.data} />
    </ReplayBoundary>
  );
}

interface Chosen {
  candidate: PlayCandidate;
  round: ReplayRound;
  card?: MomentCard;
}

/** Ranks every round's candidates (arcade moments, time-lapses, cards) and plays the best. */
export function PlayOfTheGameView({ rounds }: { rounds: ReplayRound[] }) {
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [done, setDone] = useState(false);
  // The final screen allows the stale-version reload too: once it starts, the play simply ends.
  const updating = useAppUpdateStatus() === "updating";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const candidates: { c: PlayCandidate; round: ReplayRound; card?: MomentCard }[] = [];
      for (const round of rounds) {
        const w = round.winner;
        if (!w) continue;
        const margin = w.score - round.runnerUp;
        if (canReplay(round.puzzle.type) && w.answer) {
          await preloadGameData(round.puzzle.type).catch(() => undefined);
          const analysis = analyseRound(round.puzzle, w.answer);
          if (!analysis) continue;
          const result = await scanInSlices(analysis, { isCancelled: () => cancelled });
          if (!result) return;
          const best = rankMoments(result.moments)[0];
          if (best)
            candidates.push({
              c: {
                round: round.round,
                slot: w.slot,
                kind: "arcade",
                weight: best.weight,
                margin,
                caption: best.caption,
                moment: best,
              },
              round,
            });
          continue;
        }
        const card = momentCard(round.puzzle, w.answer, w.extra);
        if (card) {
          candidates.push({
            c: {
              round: round.round,
              slot: w.slot,
              kind: "card",
              weight: card.weight,
              margin,
              caption: `${card.title}: ${card.value}`,
            },
            round,
            card,
          });
          continue;
        }
        const plan = planTimelapse(round.puzzle, w.answer, w.isCorrect);
        if (plan && w.isCorrect) {
          const minimum = plan.min !== null && plan.total <= plan.min;
          candidates.push({
            c: {
              round: round.round,
              slot: w.slot,
              kind: "timelapse",
              weight: momentWeight("puzzle", minimum ? "minimum" : "solved"),
              margin,
              caption: minimum
                ? `Solved in ${plan.total} — the minimum`
                : `Solved in ${plan.total} ${plan.spec.unit}s`,
            },
            round,
          });
        }
      }
      if (cancelled) return;
      const best = pickPlayOfTheGame(candidates.map((x) => x.c));
      const entry = best ? candidates.find((x) => x.c === best) : undefined;
      if (entry) {
        setChosen({
          candidate: entry.c,
          round: entry.round,
          ...(entry.card ? { card: entry.card } : {}),
        });
        soundCue(SHARED_CUES.playOfTheGame);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rounds]);

  if (!chosen || done || updating) return null;
  const finish = () => {
    soundCue(SHARED_CUES.playOfTheGameEnd);
    setDone(true);
  };
  const skip = () => {
    soundCue(SHARED_CUES.playOfTheGameSkip);
    setDone(true);
  };
  const w = chosen.round.winner!;
  const heading = `Play of the game · ${w.name} · R${chosen.round.round} ${gameDisplayName(chosen.round.puzzle.type)}`;
  if (chosen.candidate.kind === "card" && chosen.card)
    return <CardPlay heading={heading} card={chosen.card} onSkip={skip} onEnd={finish} />;
  if (chosen.candidate.kind === "timelapse") {
    const plan = planTimelapse(chosen.round.puzzle, w.answer, w.isCorrect)!;
    return (
      <ReplayFrame
        heading={heading}
        caption={chosen.candidate.caption}
        onSkip={skip}
        testId="play-of-the-game"
      >
        <PuzzleTimelapse
          puzzle={chosen.round.puzzle}
          plan={plan}
          isCorrect={w.isCorrect}
          height={220}
          onEnd={() => window.setTimeout(finish, 1500)}
        />
      </ReplayFrame>
    );
  }
  return (
    <ArcadePlay
      heading={heading}
      round={chosen.round}
      candidate={chosen.candidate}
      onSkip={skip}
      onEnd={finish}
    />
  );
}

function CardPlay({
  heading,
  card,
  onSkip,
  onEnd,
}: {
  heading: string;
  card: MomentCard;
  onSkip: () => void;
  onEnd: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onEnd, CARD_MS);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <ReplayFrame heading={heading} onSkip={onSkip} testId="play-of-the-game">
      <MomentCardView card={card} />
    </ReplayFrame>
  );
}

function ArcadePlay({
  heading,
  round,
  candidate,
  onSkip,
  onEnd,
}: {
  heading: string;
  round: ReplayRound;
  candidate: PlayCandidate;
  onSkip: () => void;
  onEnd: () => void;
}) {
  const analysis = useRoundAnalysis(round.puzzle, round.winner!.answer);
  const [caption, setCaption] = useState<string | null>(candidate.caption);
  const clips = useMemo(
    () =>
      analysis.status === "ready" && candidate.moment
        ? [planPlayOfTheGame(candidate.moment, analysis.timeline.endTick)]
        : [],
    [analysis, candidate.moment],
  );
  if (analysis.status !== "ready" || clips.length === 0) return null;
  return (
    <ReplayFrame heading={heading} caption={caption} onSkip={onSkip} testId="play-of-the-game">
      <ClipPlayer
        timeline={analysis.timeline}
        drawer={analysis.drawer}
        clips={clips}
        maxHeight={PLAY_MAX_HEIGHT}
        slow={analysis.slow}
        onCaption={setCaption}
        onEnd={onEnd}
        label="Play of the game"
      />
    </ReplayFrame>
  );
}
