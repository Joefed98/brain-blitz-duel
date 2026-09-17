import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { AnswerReveal } from "@/components/duel/AnswerReveal";
import { WaitingLine } from "@/components/duel/Dots";
import { PhoneShell } from "@/components/duel/PhoneShell";

import { RoundIntro } from "@/components/duel/RoundIntro";
import { TimerRing, timerSlotClass } from "@/components/duel/TimerRing";
import {
  practiceCheckWordFn,
  practiceCheckGroupFn,
  practiceGenerateFn,
  practiceGradeFn,
} from "@/lib/duel/practice.functions";
import {
  PUZZLE_REGISTRY,
  puzzleCategories,
  puzzleDef,
  puzzleDurationMs,
  puzzleName,
  puzzlePrepMs,
  puzzleRevealMs,
  puzzleShowsTimer,
  puzzleTimeLimitMs,
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
      {
        property: "og:description",
        content: "Practise one puzzle type at a time. Nothing counts anywhere.",
      },
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
  const grading = useRef(false);
  const draftAnswer = useRef("");
  const now = useTicker(stage === "intro" || stage === "puzzle" || stage === "reveal");
  const stateKey = `practice-${run}`;

  const load = useCallback(async (next: PuzzleType) => {
    unlockAudio();
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

  const prepMs = puzzlePrepMs(puzzle ?? undefined);
  const durationMs = puzzleDurationMs(puzzle ?? undefined);
  const clockStart = stage === "puzzle" ? startedAt + prepMs : null;
  const timeLimitMs = puzzleTimeLimitMs(puzzle ?? undefined);
  const clockDeadline = clockStart === null ? null : clockStart + timeLimitMs;
  const msRemaining = clockDeadline === null ? timeLimitMs : Math.max(0, clockDeadline - now);

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
      setGraded(result as Graded);
      setStartedAt(Date.now());
      setStage("reveal");
    },
    [puzzle, sealed, clockDeadline, timeLimitMs],
  );

  // The intro runs for exactly as long as it does in a room.
  useEffect(() => {
    if (stage !== "intro") return;
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
      <PhoneShell>
        <RoundIntro
          round={1}
          type={type}
          startedAt={startedAt}
          now={now}
          outcomes={[]}
          practice
          onReady={() => {
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
      <PhoneShell constrained>
        <AnswerReveal
          round={1}
          puzzle={graded.puzzle}
          answersReady
          myAnswer={graded.answer || null}
          myCorrect={graded.isCorrect}
          myReactionAvgMs={graded.reactionAvgMs}
          myMsRemaining={graded.msRemaining}
          startedAt={startedAt}
          now={now}
        />
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
    <PhoneShell constrained>
      <div className="flex min-h-0 flex-1 flex-col gap-2 animate-phase-in">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            PRACTICE
          </span>
          <span className="font-display text-sm font-bold text-foreground">
            {puzzleName(puzzle.type)}
          </span>
        </div>

        {puzzleShowsTimer(puzzle) && (
          <div
            className={`flex shrink-0 items-center justify-center ${timerSlotClass(puzzle.type)}`}
          >
            <TimerRing msRemaining={msRemaining} totalMs={timeLimitMs} active={clockActive} />
          </div>
        )}

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
              practiceCheckWordFn({ data: { puzzle, word, found, path: path ?? [] } })
            }
            checkGroup={(indices) => practiceCheckGroupFn({ data: { puzzle, sealed, indices } })}
          />
        </div>
      </div>
    </PhoneShell>
  );
}
