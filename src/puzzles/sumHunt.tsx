import { useEffect, useMemo, useRef, useState } from "react";

import {
  adjacentGridCellAt,
  gridCellAt,
  gridCellCentre,
  hapticTick,
  useGridMetrics,
} from "@/components/puzzles/GridDrag";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";
import { useStageState } from "@/lib/duel/stageState";
import {
  applySumPath,
  decodeSumPaths,
  encodeSumPaths,
  pathSum,
  replaySumHunt,
  SH_REVEAL_MS,
  SH_SIZE,
  SH_TIME_MS,
  sumHuntText,
} from "@/lib/duel/sumHunt";
import type { SumHuntPuzzleData } from "@/lib/duel/types";
import { playCorrect, playWrong } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const CELL = 52;
const GAP = 4;

function IntroExample() {
  const digits = [5, 1, 8, 4, 3, 2, 7, 6, 9];
  const path = new Set([0, 3, 4]);
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <span className="font-mono text-lg font-bold text-primary">12</span>
      <div className="grid gap-1 rounded-lg border-2 border-border bg-card p-1" style={{ gridTemplateColumns: "repeat(3, 30px)" }}>
        {digits.map((d, i) => (
          <span
            key={i}
            className={`flex h-[30px] items-center justify-center rounded font-mono text-sm font-bold ${path.has(i) ? "bg-primary text-primary-foreground" : "bg-background/40 text-foreground"}`}
          >
            {d}
          </span>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">5 + 4 + 3 = 12 clears three cells.</p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit, onDraftAnswer, stateKey = "sumhunt" }: PuzzleStageProps) {
  const data: SumHuntPuzzleData | null = puzzle.type === "sumhunt" ? puzzle : null;
  const [paths, setPaths] = useStageState<number[][]>(stateKey, "sumPaths", () => []);
  const [path, setPath] = useState<number[]>([]);
  const [finger, setFinger] = useState<{ x: number; y: number } | null>(null);
  const [shake, setShake] = useState(false);
  const submitted = useRef(false);
  const board = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLSpanElement | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  useNoTouchScroll(root);
  const metrics = useGridMetrics(board, SH_SIZE, SH_SIZE);

  const state = useMemo(() => (data ? replaySumHunt(data.seed, data.target, paths) : null), [data, paths]);
  const encoded = encodeSumPaths(paths);

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  useEffect(() => {
    if (!data || locked || submitted.current) return;
    if (now < phaseStartedAt + SH_TIME_MS - 400) return;
    submitted.current = true;
    onSubmit(encoded);
  }, [now, phaseStartedAt, locked, data, encoded, onSubmit]);

  if (!data || !state) return null;
  const frozen = locked || submitted.current;
  const sum = pathSum(state.board, path);

  const down = (event: React.PointerEvent) => {
    if (frozen) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a nicety.
    }
    const cell = gridCellAt(board.current, event.clientX, event.clientY, SH_SIZE, SH_SIZE);
    if (cell === null) return;
    hapticTick();
    setPath([cell]);
    setFinger({ x: event.clientX, y: event.clientY });
  };
  const move = (event: React.PointerEvent) => {
    if (!path.length) return;
    setFinger({ x: event.clientX, y: event.clientY });
    const last = path[path.length - 1]!;
    const cell = adjacentGridCellAt(board.current, event.clientX, event.clientY, SH_SIZE, SH_SIZE, last);
    if (cell === null) return;
    if (cell === path[path.length - 2]) {
      setPath(path.slice(0, -1));
      return;
    }
    const r = Math.floor(cell / SH_SIZE) - Math.floor(last / SH_SIZE);
    const c = (cell % SH_SIZE) - (last % SH_SIZE);
    if (Math.abs(r) + Math.abs(c) !== 1 || path.includes(cell)) return;
    hapticTick();
    setPath([...path, cell]);
  };
  const up = () => {
    const drawn = path;
    setPath([]);
    setFinger(null);
    if (drawn.length < 2 || frozen) return;
    if (applySumPath(state, data.target, drawn)) {
      playCorrect();
      setPaths([...paths, drawn]);
      targetRef.current?.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }],
        { duration: 320, easing: "ease-out" },
      );
      board.current?.animate([{ opacity: 0.6 }, { opacity: 1 }], { duration: 180 });
    } else {
      playWrong();
      setShake(true);
      window.setTimeout(() => setShake(false), 380);
    }
  };

  const points = metrics ? path.map((cell) => gridCellCentre(metrics, cell, SH_SIZE)) : [];
  const inPath = new Set(path);

  return (
    <div ref={root} className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2" style={NO_SCROLL_STYLE}>
      <span ref={targetRef} className="shrink-0 font-mono text-5xl font-bold leading-none text-primary">
        {data.target}
      </span>
      <div className={`relative shrink-0 ${shake ? "animate-shake" : ""}`}>
        <div
          ref={board}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className="puzzle-board grid rounded-xl border-2 border-border bg-card p-1"
          style={{ gridTemplateColumns: `repeat(${SH_SIZE}, ${CELL}px)`, gap: GAP, ...NO_SCROLL_STYLE }}
          aria-label="Sum Hunt board"
        >
          {state.board.map((d, i) => (
            <span
              key={i}
              className={`flex items-center justify-center rounded-lg font-mono text-2xl font-bold ${inPath.has(i) ? "bg-primary/25 text-primary" : "bg-background/40 text-foreground"}`}
              style={{ height: CELL }}
            >
              {d}
            </span>
          ))}
        </div>
        {points.length > 1 && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            <polyline
              points={points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={6}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.85}
            />
          </svg>
        )}
      </div>
      <p className="shrink-0 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        points <span className="text-primary">{state.raw}</span> · paths {state.paths}
      </p>
      {finger && path.length > 0 && (
        <span
          className={`pointer-events-none fixed z-50 rounded-full px-3 py-1 font-mono text-base font-bold shadow-lg ${sum === data.target ? "bg-opponent text-background" : "bg-card text-foreground"}`}
          style={{ left: finger.x + 18, top: finger.y - 52 }}
        >
          {sum}
        </span>
      )}
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  if (puzzle.type !== "sumhunt") return null;
  const state = replaySumHunt(puzzle.seed, puzzle.target, decodeSumPaths(myAnswer ?? ""));
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-2">
      <p className={`text-center font-mono text-lg font-bold ${myCorrect ? "text-primary" : "text-foreground"}`}>
        {sumHuntText(state)}
      </p>
      <p className="text-center text-sm text-muted-foreground">Target {puzzle.target}</p>
      {state.reshuffles > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Board reshuffled {state.reshuffles}× when no path was left
        </p>
      )}
    </div>
  );
}

export const sumHuntPuzzle: PuzzleDefinition = {
  key: "sumhunt",
  name: "Sum Hunt",
  category: "number",
  timeLimitMs: SH_TIME_MS,
  revealMs: SH_REVEAL_MS,
  generate: () => ({ type: "sumhunt", seed: 12345, target: 12 }) satisfies SumHuntPuzzleData,
  check: () => false,
  revealHeading: "Your hunt",
  IntroExample,
  Stage,
  Reveal,
};
