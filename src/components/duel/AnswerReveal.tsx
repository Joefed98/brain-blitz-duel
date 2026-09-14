import { useEffect, useRef } from "react";

import { WaitingLine } from "@/components/duel/Dots";

import { puzzleDef } from "@/lib/duel/registry";
import { REVEAL_MS, TOTAL_ROUNDS, type PuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect, playWrong } from "@/lib/sound";

interface AnswerRevealProps {
  round: number;
  puzzle: PuzzleData;
  /** The player's own submitted answer, or null if they never submitted. */
  myAnswer: string | null;
  myCorrect: boolean;
  myReactionAvgMs: number | null;
  /** False until the round's answers have arrived from the server. */
  answersReady: boolean;
  startedAt: number;
  now: number;
}

function Verdict({ correct }: { correct: boolean }) {
  return (
    <div
      className={`flex h-14 w-14 items-center justify-center rounded-full border-2 animate-pop-in ${
        correct ? "border-me text-me" : "border-warn text-warn"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
        {correct ? (
          <path
            d="m5 13 4.5 4.5L19 7"
            className="animate-draw-stroke"
            style={{ strokeDasharray: 30, ["--draw-length" as string]: 30 }}
          />
        ) : (
          <>
            <path
              d="M6 6l12 12"
              className="animate-draw-stroke"
              style={{ strokeDasharray: 24, ["--draw-length" as string]: 24 }}
            />
            <path
              d="M18 6 6 18"
              className="animate-draw-stroke"
              style={{ strokeDasharray: 24, ["--draw-length" as string]: 24, animationDelay: "120ms" }}
            />
          </>
        )}
      </svg>
    </div>
  );
}

export function AnswerReveal({
  round,
  puzzle,
  myAnswer,
  myCorrect,
  myReactionAvgMs,
  answersReady,
  startedAt,
  now,
}: AnswerRevealProps) {
  const secondsLeft = Math.max(0, Math.ceil((REVEAL_MS - Math.max(0, now - startedAt)) / 1000));
  const def = puzzleDef(puzzle.type);
  const Reveal = def.Reveal;
  const cued = useRef(0);

  useEffect(() => {
    if (cued.current === round) return;
    cued.current = round;
    if (myCorrect) {
      playCorrect();
      buzz(20);
    } else {
      playWrong();
      buzz([12, 60, 12]);
    }
  }, [round, myCorrect]);

  return (
    <div className="flex flex-1 flex-col gap-6 animate-phase-in">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Round {round} of {TOTAL_ROUNDS}
        </span>
        <span className="font-mono text-xs text-muted-foreground">{secondsLeft}s</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <Verdict correct={myCorrect} />
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          {def.revealHeading ?? "The answer was"}
        </p>
        <div className="w-full animate-rise-settle">
          {answersReady ? (
            <Reveal
              puzzle={puzzle}
              myAnswer={myAnswer}
              myCorrect={myCorrect}
              myReactionAvgMs={myReactionAvgMs}
            />
          ) : (
            <div className="flex justify-center">
              <WaitingLine label="Revealing" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
