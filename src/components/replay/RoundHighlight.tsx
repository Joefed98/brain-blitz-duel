import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { gameDisplayName } from "@/lib/duel/gameNames";
import { momentCard } from "@/lib/replay/cards";
import { soundCue, SHARED_CUES } from "@/lib/replay/cues";
import { finalMomentsClip, planHighlight } from "@/lib/replay/pick";
import { pickMoments } from "@/lib/replay/moments";
import { roundReplayFn } from "@/lib/replay/replay.functions";
import type { ReplayRound } from "@/lib/replay/replay.server";
import { canReplay } from "@/lib/replay/steppers";
import { planTimelapse } from "@/lib/replay/timelapse";

import {
  ClipPlayer,
  FullRunViewer,
  MomentCardView,
  PuzzleTimelapse,
  ReplayFrame,
} from "./ReplayPanels";
import { ReplayBoundary } from "./ReplayBoundary";
import { useRoundAnalysis } from "./useRoundAnalysis";

/**
 * The highlight's moment area on the results screen: tall enough to read, short
 * enough that the table and Continue stay on screen. Below the smallest useful
 * height (a short phone with a full room) the panel drops its picture and keeps
 * only the caption line and the Watch button.
 */
export const HIGHLIGHT_MAX_PX = 230;
export const HIGHLIGHT_MIN_PX = 90;
/** Space the results screen needs besides the highlight: app header, title, Continue, panel chrome, and ~44 px a row. */
export function highlightPx(players: number, viewportH: number): number {
  const free = viewportH - 290 - Math.max(2, players) * 44;
  return free < HIGHLIGHT_MIN_PX ? 0 : Math.min(HIGHLIGHT_MAX_PX, free);
}
function useHighlightPx(players: number): number {
  return highlightPx(players, typeof window === "undefined" ? 800 : window.innerHeight);
}

/**
 * Results-screen highlight (fetches the round once it has closed for everyone).
 * Display only and never in the way: it sits above the table, plays once on its
 * own with Skip, and Continue, the host's controls and every timer carry on
 * exactly as before whatever it is doing.
 */
export function RoundHighlight({
  roomId,
  round,
  active,
  players,
}: {
  roomId: string;
  round: number;
  active: boolean;
  players: number;
}) {
  const fetchRound = useServerFn(roundReplayFn);
  const { data } = useQuery({
    queryKey: ["round-replay", roomId, round],
    queryFn: () => fetchRound({ data: { roomId, roundNumber: round } }),
    enabled: active,
    staleTime: Infinity,
    retry: 1,
  });
  if (!active || !data || !data.ok || !data.data) return null;
  return (
    <ReplayBoundary>
      <RoundHighlightView round={data.data} players={players} />
    </ReplayBoundary>
  );
}

/** The highlight for one closed round's data (also used by the replay lab). */
export function RoundHighlightView({ round, players }: { round: ReplayRound; players: number }) {
  const px = useHighlightPx(players);
  const winner = round.winner;
  if (!winner) return null;
  const type = round.puzzle.type;
  if (canReplay(type) && winner.answer) return <ArcadeHighlight round={round} px={px} />;
  const card = momentCard(round.puzzle, winner.answer, winner.extra);
  if (card) return px > 0 ? <CardHighlight round={round} /> : null;
  const plan = planTimelapse(round.puzzle, winner.answer, winner.isCorrect);
  if (plan) return px > 0 ? <TimelapseHighlight round={round} px={px} /> : null;
  return null;
}

function ArcadeHighlight({ round, px }: { round: ReplayRound; px: number }) {
  const winner = round.winner!;
  const analysis = useRoundAnalysis(round.puzzle, winner.answer);
  const [stage, setStage] = useState<"play" | "done">("play");
  const [caption, setCaption] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const clips = useMemo(() => {
    if (analysis.status !== "ready") return [];
    const picked = pickMoments(analysis.moments, 2);
    if (picked.length) return planHighlight(picked, analysis.timeline.endTick);
    return [
      finalMomentsClip(analysis.timeline.endTick, round.puzzle.type, `${winner.score} points`),
    ];
  }, [analysis, round.puzzle.type, winner.score]);
  useEffect(() => {
    if (analysis.status === "ready") soundCue(SHARED_CUES.highlightStart);
  }, [analysis.status]);
  if (analysis.status === "none") return null;
  const name = winner.name;
  const watch = analysis.status === "ready" && (
    <button
      type="button"
      onClick={() => setWatching(true)}
      className="press shrink-0 rounded border border-primary/60 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-primary"
      data-replay-watch
    >
      Watch {name}&apos;s run
    </button>
  );
  if (
    stage === "done" ||
    analysis.status === "loading" ||
    (px === 0 && analysis.status === "ready")
  ) {
    // The slim bar: one line, so a full room on a short phone keeps the table and Continue in view.
    return (
      <ReplayFrame
        heading={
          analysis.status === "loading"
            ? "Loading highlight…"
            : `${name} took the round · ${gameDisplayName(round.puzzle.type)}`
        }
        action={analysis.status === "ready" ? watch : null}
        testId="highlight-done"
      >
        {watching && analysis.status === "ready" ? (
          <FullRunViewer
            timeline={analysis.timeline}
            drawer={analysis.drawer}
            name={name}
            onClose={() => setWatching(false)}
          />
        ) : null}
      </ReplayFrame>
    );
  }
  return (
    <ReplayFrame
      heading={`Highlight · ${name}`}
      caption={caption}
      onSkip={() => {
        soundCue(SHARED_CUES.highlightSkip);
        setStage("done");
      }}
      action={watch}
      testId="highlight"
    >
      <ClipPlayer
        timeline={analysis.timeline}
        drawer={analysis.drawer}
        clips={clips}
        maxHeight={`${px}px`}
        slow={analysis.slow}
        onCaption={setCaption}
        onEnd={() => {
          soundCue(SHARED_CUES.highlightEnd);
          setStage("done");
        }}
        label={`${name}'s highlight`}
      />
      {watching && (
        <FullRunViewer
          timeline={analysis.timeline}
          drawer={analysis.drawer}
          name={name}
          onClose={() => setWatching(false)}
        />
      )}
    </ReplayFrame>
  );
}

function CardHighlight({ round }: { round: ReplayRound }) {
  const winner = round.winner!;
  const card = momentCard(round.puzzle, winner.answer, winner.extra)!;
  const [skipped, setSkipped] = useState(false);
  if (skipped) return null;
  return (
    <ReplayFrame
      heading={`Moment · ${winner.name}`}
      onSkip={() => (soundCue(SHARED_CUES.highlightSkip), setSkipped(true))}
      testId="card"
    >
      <MomentCardView card={card} />
    </ReplayFrame>
  );
}

function TimelapseHighlight({ round, px }: { round: ReplayRound; px: number }) {
  const winner = round.winner!;
  const plan = useMemo(
    () => planTimelapse(round.puzzle, winner.answer, winner.isCorrect)!,
    [round.puzzle, winner.answer, winner.isCorrect],
  );
  const [done, setDone] = useState(false);
  if (done) return null;
  return (
    <ReplayFrame
      heading={`Time-lapse · ${winner.name}`}
      onSkip={() => (soundCue(SHARED_CUES.highlightSkip), setDone(true))}
      testId="timelapse"
    >
      <PuzzleTimelapse
        puzzle={round.puzzle}
        plan={plan}
        isCorrect={winner.isCorrect}
        height={Math.max(HIGHLIGHT_MIN_PX, px - 30)}
        onEnd={() => window.setTimeout(() => setDone(true), 1500)}
      />
    </ReplayFrame>
  );
}
