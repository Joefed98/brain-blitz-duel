import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { AnswerReveal } from "@/components/duel/AnswerReveal";
import { WaitingLine } from "@/components/duel/Dots";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { PuzzleHelp, PuzzleHelpButton } from "@/components/duel/PuzzleInstructions";

import { RoundIntro } from "@/components/duel/RoundIntro";
import { TimerBar } from "@/components/duel/TimerBar";
import { arcadeMsRemaining } from "@/lib/arcade/clock";
import {
  practiceCheckWordFn,
  practiceCheckGroupFn,
  practiceGenerateFn,
  practiceGradeFn,
} from "@/lib/duel/practice.functions";
import { SaveDemoButton } from "@/components/duel/SaveDemoButton";
import {
  PUZZLE_REGISTRY,
  RETIRED_PUZZLE_TYPES,
  puzzleCategories,
  puzzleDef,
  puzzleDurationMs,
  puzzleName,
  puzzlePrepMs,
  puzzleRevealMs,
  puzzleShowsTimer,
  puzzleTimeLimitMs,
  puzzleRunMs,
  typesInCategory,
} from "@/lib/duel/registry";
import { clearStageState } from "@/lib/duel/stageState";
import { INTRO_MS, type PuzzleData, type PuzzleType } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect, playLock, playRoundStart, unlockAudio } from "@/lib/sound";
import type { SubmitMeta } from "@/puzzles/types";

export const Route = createFileRoute("/practice")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Duelz practice — try any puzzle type" },
      {
        name: "description",
        content: "Play any single Duelz puzzle type on your own. Nothing is scored or saved.",
      },
      { property: "og:title", content: "Duelz practice — try any puzzle type" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Practise one puzzle type at a time. Nothing counts anywhere.",
      },
      { name: "twitter:description", content: "Practise one puzzle type at a time. Nothing counts anywhere." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PracticeScreen,
});

type Stage = "list" | "loading" | "intro" | "puzzle" | "reveal" | "result";

interface Graded {
  puzzle: PuzzleData;
  isCorrect: boolean;
  score: number;
  msRemaining: number;
  reactionAvgMs: number | null;
  answer: string;
  extra?: Record<string, unknown> | null;
}

function useTicker(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

function PracticeScreen() {
  const [stage, setStage] = useState<Stage>("list");
  const [type, setType] = useState<PuzzleType | null>(null);
  const [puzzle, setPuzzle] = useState<PuzzleData | null>(null);
  const [sealed, setSealed] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const [graded, setGraded] = useState<Graded | null>(null);
  const [run, setRun] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const grading = useRef(false);
  const introCancelled = useRef(false);
  const draftAnswer = useRef("");
  const now = useTicker(stage === "intro" || stage === "puzzle" || stage === "reveal");
  const stateKey = `practice-${run}`;

  useEffect(() => setHelpOpen(false), [stage, type]);

  const load = useCallback(async (next: PuzzleType) => {
    unlockAudio();
    introCancelled.current = false;
    grading.current = false;
    draftAnswer.current = "";
    setRun((count) => {
      clearStageState(`practice-${count}`);
      return count + 1;
    });
    setType(next);
    setGraded(null);
    setPuzzle(null);
    setStage("loading");
    const made = await practiceGenerateFn({ data: { type: next } });
    setPuzzle(made.puzzle as PuzzleData);
    setSealed(made.sealed);
    setStartedAt(Date.now());
    setStage("intro");
  }, []);

  const cancelIntro = useCallback(() => {
    introCancelled.current = true;
    grading.current = true;
    draftAnswer.current = "";
    clearStageState(stateKey);
    setPuzzle(null);
    setType(null);
    setSealed("");
    setGraded(null);
    setStartedAt(0);
    setHelpOpen(false);
    setStage("list");
  }, [stateKey]);

  const prepMs = puzzlePrepMs(puzzle ?? undefined);
  const durationMs = puzzleDurationMs(puzzle ?? undefined);
  const clockStart = stage === "puzzle" ? startedAt + prepMs : null;
  const timeLimitMs = puzzleTimeLimitMs(puzzle ?? undefined);
  const clockDeadline = clockStart === null ? null : clockStart + timeLimitMs;
  const msRemaining = clockDeadline === null ? timeLimitMs : Math.max(0, clockDeadline - now);
  const runMs = stage === "puzzle" ? puzzleRunMs(puzzle ?? undefined) : null;

  const grade = useCallback(
    async (answer: string, meta?: SubmitMeta) => {
      if (!puzzle || grading.current) return;
      grading.current = true;
      playLock();
      buzz(15);
      const remaining =
        clockDeadline === null ? timeLimitMs : Math.max(0, clockDeadline - Date.now());
      const result = await practiceGradeFn({
        data: {
          puzzle,
          sealed,
          answer,
          msRemaining: remaining,
          extra: {
            reactionAvgMs: meta?.reactionAvgMs,
            correctCount: meta?.correctCount,
            errors: meta?.errors,
          },
        },
      });
      const { extraJson, ...rest } = result as typeof result & { extraJson?: string | null };
      let extra: Record<string, unknown> | null = null;
      try {
        extra = extraJson ? (JSON.parse(extraJson) as Record<string, unknown>) : null;
      } catch {
        extra = null;
      }
      setGraded({ ...(rest as Graded), extra });
      setStartedAt(Date.now());
      setStage("reveal");
    },
    [puzzle, sealed, clockDeadline, timeLimitMs],
  );

  // The intro runs for exactly as long as it does in a room.
  useEffect(() => {
    if (stage !== "intro" || introCancelled.current) return;
    if (now - startedAt < INTRO_MS) return;
    setStartedAt(Date.now());
    setStage("puzzle");
  }, [stage, now, startedAt]);

  // Out of time: grade an empty answer, exactly as a room does.
  useEffect(() => {
    if (stage !== "puzzle" || !puzzle) return;
    if (now - startedAt <= durationMs) return;
    void grade(draftAnswer.current);
  }, [stage, now, startedAt, durationMs, puzzle, grade]);

  useEffect(() => {
    if (stage !== "reveal") return;
    if (now - startedAt < puzzleRevealMs(puzzle ?? undefined)) return;
    setStage("result");
  }, [stage, now, startedAt, puzzle]);

  // The countdown sting lands its final hit on GO, exactly as a room does.
  const stingCued = useRef(0);
  useEffect(() => {
    if (stage !== "intro") return;
    if (stingCued.current === run) return;
    if (now - startedAt < INTRO_MS - 1300) return;
    stingCued.current = run;
    playRoundStart();
  }, [stage, now, startedAt, run]);

  // The practice card takes the place of the podium fanfare.
  const resultCued = useRef(0);
  useEffect(() => {
    if (stage !== "result" || resultCued.current === run) return;
    resultCued.current = run;
    playCorrect();
  }, [stage, run]);

  if (stage === "list") {
    return (
      <PhoneShell>
        <div className="flex flex-1 flex-col gap-6">
          <div>
            <h1 className="font-display text-2xl font-bold">Practice</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              One puzzle at a time, on this device. Nothing is scored or saved.
            </p>
          </div>

          {puzzleCategories().map((category) => (
            <div key={category} className="flex flex-col gap-2">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {category}
              </p>
              <div className="flex flex-col gap-2">
                {typesInCategory(category).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => void load(key)}
                    className="press tap-target w-full rounded-xl border border-border bg-card px-4 text-left font-display text-sm font-semibold text-foreground"
                  >
                    {PUZZLE_REGISTRY[key].name}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {RETIRED_PUZZLE_TYPES.length > 0 && (
            <details className="flex flex-col gap-2">
              <summary className="press cursor-pointer font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Retired ({RETIRED_PUZZLE_TYPES.length})
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                {RETIRED_PUZZLE_TYPES.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => void load(key)}
                    className="press tap-target w-full rounded-xl border border-border bg-card px-4 text-left font-display text-sm font-semibold text-muted-foreground"
                  >
                    {PUZZLE_REGISTRY[key].name}
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>
      </PhoneShell>
    );
  }

  if (stage === "loading" || !puzzle || !type) {
    return (
      <PhoneShell>
        <div className="flex flex-1 items-center justify-center">
          <WaitingLine label="Making a puzzle" />
        </div>
      </PhoneShell>
    );
  }

  if (stage === "intro") {
    return (
      <PhoneShell gameScreen>
        <RoundIntro
          round={1}
          type={type}
          startedAt={startedAt}
          now={now}
          outcomes={[]}
          practice
          onBack={cancelIntro}
          puzzle={puzzle}
          onReady={() => {
            if (introCancelled.current) return;
            playLock();
            setStartedAt(Date.now());
            setStage("puzzle");
          }}
        />
      </PhoneShell>
    );
  }

  if (stage === "reveal" && graded) {
    return (
      <PhoneShell constrained gameScreen>
        <AnswerReveal
          round={1}
          puzzle={graded.puzzle}
          answersReady
          myAnswer={graded.answer || null}
          myCorrect={graded.isCorrect}
          myReactionAvgMs={graded.reactionAvgMs}
          myMsRemaining={graded.msRemaining}
          myScore={graded.score}
          myExtra={graded.extra ?? null}
          startedAt={startedAt}
          now={now}
        />
        <SaveDemoButton puzzle={graded.puzzle} sealed={sealed} answer={graded.answer} />
      </PhoneShell>
    );
  }

  if (stage === "result" && graded) {
    const secondsUsed = Math.max(0, Math.round((timeLimitMs - graded.msRemaining) / 100) / 10);
    return (
      <PhoneShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center animate-phase-in">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            {puzzleName(type)}
          </p>
          <p className="font-mono text-6xl font-bold text-primary animate-pop-in">{graded.score}</p>
          <p className="text-sm text-muted-foreground">
            {graded.isCorrect ? "Correct" : "Not quite"} ·{" "}
            {graded.reactionAvgMs !== null
              ? `${graded.reactionAvgMs}ms average`
              : `${secondsUsed}s`}
          </p>

          <div className="flex w-full max-w-xs flex-col gap-2">
            <button
              type="button"
              onClick={() => void load(type)}
              className="press tap-target w-full rounded-xl bg-primary px-6 font-display text-base font-bold uppercase tracking-wide text-primary-foreground"
            >
              Play again
            </button>
            <button
              type="button"
              onClick={() => setStage("list")}
              className="press tap-target w-full rounded-xl border border-border bg-card font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground"
            >
              Back
            </button>
          </div>
        </div>
      </PhoneShell>
    );
  }

  const StageComponent = puzzleDef(puzzle.type).Stage;
  const clockActive = clockStart !== null && now >= clockStart;
  return (
    <PhoneShell constrained gameScreen>
      <div className="flex min-h-0 flex-1 flex-col gap-2 animate-phase-in">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            PRACTICE
          </span>
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-bold text-foreground">
              {puzzleName(puzzle.type)}
            </span>
            <PuzzleHelpButton onClick={() => setHelpOpen(true)} />
          </div>
        </div>

        {puzzleShowsTimer(puzzle) && (
          <TimerBar
            msRemaining={runMs !== null ? arcadeMsRemaining(runMs) : msRemaining}
            totalMs={runMs ?? timeLimitMs}
            active={clockActive}
          />
        )}

        {puzzle.type === "balance" && <div id={`balance-progress-${stateKey}`} className="h-3 w-full shrink-0" />}

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <StageComponent
            key={stateKey}
            stateKey={stateKey}
            puzzle={puzzle}
            phaseStartedAt={startedAt}
            now={now}
            locked={false}
            onSubmit={(answer, meta) => void grade(answer, meta)}
            onDraftAnswer={(answer) => {
              draftAnswer.current = answer;
            }}
            checkWord={(word, found, path) =>
              practiceCheckWordFn({ data: { puzzle, word, found, path: path ?? [], sealed } })
            }
            checkGroup={(indices) => practiceCheckGroupFn({ data: { puzzle, sealed, indices } })}
          />
          <PuzzleHelp type={puzzle.type} open={helpOpen} onClose={() => setHelpOpen(false)} />
        </div>
      </div>
    </PhoneShell>
  );
}
