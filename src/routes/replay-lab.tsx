import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { Podium } from "@/components/duel/Podium";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { RoundResultsTable } from "@/components/duel/RoundResultsTable";
import { PlayOfTheGameView } from "@/components/replay/PlayOfTheGame";
import { FullRunViewer } from "@/components/replay/ReplayPanels";
import { RoundHighlightView } from "@/components/replay/RoundHighlight";
import { useRoundAnalysis } from "@/components/replay/useRoundAnalysis";
import { gameDisplayName } from "@/lib/duel/gameNames";
import type { Standing } from "@/lib/duel/scoring";
import type { PuzzleData, PuzzleType, RoundResultRow } from "@/lib/duel/types";
import type { ReplayRound } from "@/lib/replay/replay.server";

/**
 * Replay lab (development only): the results-screen highlight, the podium's
 * play of the game and the full-run player, fed with the stored fixture runs
 * (scripts/fixtures/replay-runs.json) instead of a live room. Used by
 * scripts/replay-play-check.ts and for the PR screenshots. Not linked anywhere;
 * production builds answer it with the not-found page.
 *
 *   /replay-lab?view=results&game=wavefront
 *   /replay-lab?view=podium
 *   /replay-lab?view=player&game=matchup
 *   /replay-lab?view=timelapse&game=unblock   (also: card&game=reaction)
 */
export const Route = createFileRoute("/replay-lab")({
  ssr: false,
  // Development only: a production build answers this address with the app's not-found
  // page. A plain `import.meta.env.DEV` (no cast) so Vite folds it to false and drops the lab.
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: ReplayLab,
});

interface FixtureFile {
  runs: { type: string; puzzle: PuzzleData; answer: string; score: number }[];
  puzzles: {
    type: string;
    puzzle: PuzzleData;
    answer: string;
    isCorrect: boolean;
    score: number;
  }[];
}

const loaders = import.meta.env.DEV
  ? import.meta.glob("../../scripts/fixtures/replay-runs.json", { import: "default" })
  : {};

declare global {
  interface Window {
    __replayLab?: {
      ready: boolean;
      tick: number;
      endTick: number;
      finalScore: number | null;
      storedScore: number;
      ended: boolean;
    };
  }
}

const NAMES = ["Ana", "Bo", "Cy", "Dev", "Eve", "Fin", "Gus", "Hal", "Ivy", "Jo"];

function standingRows(scores: number[], round: number): Standing[] {
  return scores
    .map((score, i) => ({ slot: i + 1, score }))
    .sort((a, b) => b.score - a.score)
    .map((row, index) => ({
      slot: row.slot,
      name: NAMES[row.slot - 1]!,
      status: "active" as const,
      total: row.score * round,
      roundScore: row.score,
      roundCorrect: row.score > 0,
      answerMs: 30_000,
      position: index + 1,
      previousPosition: null,
      summary: `${row.score} points`,
      detail: [],
    }));
}

function cardRound(type: "reaction" | "stopwatch" | "wordsmith" | "wordhunt"): ReplayRound {
  const extra =
    type === "reaction"
      ? { times: [262, 187, 240], falseStarts: 0 }
      : type === "stopwatch"
        ? {
            distances: [40, 12, 4, 33, 90, 18, 25, 61, 9, 77],
            signed: [40, -12, -4, 33, 90, 18, -25, 61, 9, -77],
          }
        : {
            words:
              type === "wordsmith"
                ? ["PLANT", "PLANTED", "LANE"]
                : ["STONE", "TONES", "ONSET", "STONED"],
          };
  return {
    round: 3,
    puzzle: { type, letters: ["P", "L", "A", "N", "T", "E", "D"] } as unknown as PuzzleData,
    winner: {
      slot: 1,
      name: "Ana",
      score: 118,
      isCorrect: true,
      answer: null,
      extra,
      reactionAvgMs: null,
      msRemaining: 0,
    },
    runnerUp: 96,
    answered: 4,
  };
}

function ReplayLab() {
  const [fixture, setFixture] = useState<FixtureFile | null>(null);
  const params = useMemo(
    () => new URLSearchParams(typeof window === "undefined" ? "" : window.location.search),
    [],
  );
  const view = params.get("view") ?? "results";
  const game = params.get("game") ?? "wavefront";
  const players = Math.max(2, Math.min(10, Number(params.get("players") ?? 4)));
  useEffect(() => {
    const load = Object.values(loaders)[0];
    if (load) void load().then((data) => setFixture(data as FixtureFile));
  }, []);
  if (!import.meta.env.DEV) return null;
  if (!fixture) return <p className="p-4 font-mono text-xs">Loading fixtures…</p>;

  // The newest stored run for the game (runs on a later revision are appended).
  const run = [...fixture.runs].reverse().find((r) => r.type === game) ?? fixture.runs[0]!;
  const arcadeRound = (r: FixtureFile["runs"][number], round: number): ReplayRound => ({
    round,
    puzzle: r.puzzle,
    winner: {
      slot: 1,
      name: "Ana",
      score: r.score,
      isCorrect: true,
      answer: r.answer,
      extra: null,
      reactionAvgMs: null,
      msRemaining: 0,
    },
    runnerUp: Math.max(0, r.score - 25),
    answered: 4,
  });
  const puzzleRound = (p: FixtureFile["puzzles"][number], round: number): ReplayRound => ({
    round,
    puzzle: p.puzzle,
    winner: {
      slot: 1,
      name: "Ana",
      score: p.score,
      isCorrect: p.isCorrect,
      answer: p.answer,
      extra: null,
      reactionAvgMs: null,
      msRemaining: 20_000,
    },
    runnerUp: Math.max(0, p.score - 30),
    answered: 4,
  });

  if (view === "player")
    return <LabPlayer puzzle={run.puzzle} answer={run.answer} storedScore={run.score} />;

  const continueState = {
    continued: false,
    continuedCount: 1,
    waitingCount: 4,
    onContinue: () => undefined,
  };
  if (view === "podium") {
    const rounds: ReplayRound[] = [
      puzzleRound(
        fixture.puzzles.find((p) => p.type === "flood")!,
        1,
      ),
      cardRound("reaction"),
      { ...arcadeRound(run, 3), runnerUp: Math.max(0, run.score - 60) },
      puzzleRound(
        fixture.puzzles.find((p) => p.type === "unblock")!,
        4,
      ),
    ];
    const results: RoundResultRow[] = [];
    return (
      <PhoneShell>
        <Podium
          rows={standingRows([520, 610, 480, 300], 1)}
          mySlot={1}
          results={results}
          roundOrder={["flood", "reaction", run.type as PuzzleType, "unblock"]}
          isHost
          busy={false}
          onPlayAgain={() => undefined}
          onLeave={() => undefined}
          playOfTheGame={<PlayOfTheGameView rounds={rounds} />}
        />
      </PhoneShell>
    );
  }

  const round =
    view === "timelapse"
      ? puzzleRound(fixture.puzzles.find((p) => p.type === game) ?? fixture.puzzles[0]!, 2)
      : view === "card"
        ? cardRound(
            (["reaction", "stopwatch", "wordsmith", "wordhunt"].includes(game)
              ? game
              : "reaction") as "reaction",
          )
        : arcadeRound(run, 2);
  return (
    <PhoneShell gameType={round.puzzle.type}>
      <RoundResultsTable
        roundTitle={`Round 2 · ${gameDisplayName(round.puzzle.type)}`}
        rows={standingRows(
          [
            round.winner!.score,
            round.runnerUp,
            Math.max(0, round.runnerUp - 20),
            12,
            10,
            9,
            8,
            7,
            6,
            5,
          ].slice(0, players),
          2,
        )}
        times={new Map(Array.from({ length: players }, (_, i) => [i + 1, 30_000]))}
        mySlot={2}
        autoSeconds={8}
        finalRound={false}
        continueState={continueState}
        highlight={<RoundHighlightView round={round} players={players} />}
      />
    </PhoneShell>
  );
}

/** The full run at normal speed, with a test hook the play check reads. */
function LabPlayer({
  puzzle,
  answer,
  storedScore,
}: {
  puzzle: PuzzleData;
  answer: string;
  storedScore: number;
}) {
  const analysis = useRoundAnalysis(puzzle, answer);
  useEffect(() => {
    window.__replayLab = {
      ready: false,
      tick: 0,
      endTick: 0,
      finalScore: null,
      storedScore,
      ended: false,
    };
  }, [storedScore]);
  useEffect(() => {
    if (analysis.status !== "ready" || !window.__replayLab) return;
    window.__replayLab.ready = true;
    window.__replayLab.endTick = analysis.timeline.endTick;
    window.__replayLab.finalScore = analysis.timeline.finalScore;
    const timer = window.setInterval(() => {
      const canvas = document.querySelector("[data-replay-seek]") as HTMLInputElement | null;
      if (canvas && window.__replayLab) window.__replayLab.tick = Number(canvas.value);
    }, 100);
    return () => window.clearInterval(timer);
  }, [analysis]);
  if (analysis.status !== "ready") return <p className="p-4 font-mono text-xs">Replaying…</p>;
  return (
    <FullRunViewer
      timeline={analysis.timeline}
      drawer={analysis.drawer}
      name="Ana"
      onClose={() => undefined}
    />
  );
}
