import { devDiagnosticsOn, type ArcadeDiag } from "@/lib/arcade/diagnostics";
import { useEffect, useRef } from "react";

import { WaitingLine } from "@/components/duel/Dots";

import { puzzleDef, puzzleRevealMs } from "@/lib/duel/registry";
import { TOTAL_ROUNDS, type PuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect, playWrong, stopMusic } from "@/lib/sound";

interface AnswerRevealProps {
  round: number;
  puzzle: PuzzleData;
  /** The player's own submitted answer, or null if they never submitted. */
  myAnswer: string | null;
  myCorrect: boolean;
  myReactionAvgMs: number | null;
  myMsRemaining?: number;
  /** The stored result detail; arcade runs carry dev diagnostics under `diag`. */
  myExtra?: Record<string, unknown> | null;
  /** False until the round's answers have arrived from the server. */
  answersReady: boolean;
  startedAt: number;
  now: number;
}

/** Dev-only (?dev=1): what the server did with this arcade run. */
function DevDiagnostics({ extra }: { extra: Record<string, unknown> | null }) {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(devDiagnosticsOn()), []);
  const diag = extra?.["diag"] as ArcadeDiag | undefined;
  if (!on || !diag) return null;
  const names = Array.from(
    new Set([...Object.keys(diag.server ?? {}), ...Object.keys(diag.client ?? {})]),
  ).filter((name) => name !== "tick");
  const differs = names.filter((name) => diag.client?.[name] !== diag.server?.[name]);
  const first = diag.first
    ? `#${diag.first.index} t${diag.first.t} k${diag.first.k} [${diag.first.a},${diag.first.b},${diag.first.c},${diag.first.d}] ${diag.first.reason}`
    : "none";
  return (
    <div className="shrink-0 break-all font-mono text-[10px] leading-tight text-muted-foreground opacity-70">
      <div>
        events {diag.received} · clamped {diag.clamped} · dropped {diag.dropped} · end t
        {diag.replayEndTick} · desync {diag.desyncTick ?? "none"} · {diag.replayMs}ms
      </div>
      <div>first fix: {first}</div>
      <div>
        {diag.client
          ? differs.length === 0
            ? "client = server"
            : differs
                .map((name) => `${name} c${diag.client?.[name] ?? "-"}/s${diag.server?.[name] ?? "-"}`)
                .join(" · ")
          : "no client counters"}
      </div>
    </div>
  );
}

function Verdict({ correct }: { correct: boolean }) {
  return (
    <div
      className={`flex h-14 w-14 items-center justify-center rounded-full border-2 animate-pop-in ${
        correct ? "border-me text-me" : "border-warn text-warn"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-7 w-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        aria-hidden="true"
      >
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
              style={{
                strokeDasharray: 24,
                ["--draw-length" as string]: 24,
                animationDelay: "120ms",
              }}
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
  myMsRemaining,
  myExtra,
  answersReady,
  startedAt,
  now,
}: AnswerRevealProps) {
  const secondsLeft = Math.max(
    0,
    Math.ceil((puzzleRevealMs(puzzle) - Math.max(0, now - startedAt)) / 1000),
  );
  const def = puzzleDef(puzzle.type);
  const Reveal = def.Reveal;
  const puzzleOwnsRevealLayout = puzzle.type === "chain" || puzzle.type === "intruder";
  const cued = useRef(0);

  useEffect(() => {
    if (cued.current === round) return;
    cued.current = round;
    stopMusic(200);
    if (myCorrect) {
      playCorrect();
      buzz(20);
    } else {
      playWrong();
      buzz([12, 60, 12]);
    }
  }, [round, myCorrect]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden animate-phase-in">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Round {round} of {TOTAL_ROUNDS}
        </span>
        <span className="font-mono text-xs text-muted-foreground">{secondsLeft}s</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
        {!puzzleOwnsRevealLayout ? <Verdict correct={myCorrect} /> : null}
        {!puzzleOwnsRevealLayout ? (
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            {def.revealHeading ?? "The answer was"}
          </p>
        ) : null}
        <div className="answer-reveal-content flex min-h-0 w-full flex-col items-center justify-center overflow-hidden animate-rise-settle">
          {answersReady ? (
            <Reveal
              puzzle={puzzle}
              myAnswer={myAnswer}
              myCorrect={myCorrect}
              myReactionAvgMs={myReactionAvgMs}
              myMsRemaining={myMsRemaining}
            />
          ) : (
            <div className="flex justify-center">
              <WaitingLine label="Revealing" />
            </div>
          )}
        </div>
      </div>
      <DevDiagnostics extra={myExtra ?? null} />
    </div>
  );
}
