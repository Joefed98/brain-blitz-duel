import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { hapticTick } from "@/components/puzzles/GridDrag";
import {
  decodeTowerMoves,
  encodeTowerMoves,
  replayTower,
  towerCanMove,
  towerPegsFrom,
  type TowerMove,
  type TowerPegs,
} from "@/lib/duel/tower";
import { useGameKeys } from "@/lib/desktop";
import { useStageState } from "@/lib/duel/stageState";
import { towerPegCount } from "@/lib/duel/tower";
import { TOWER_DISCS, TOWER_PEGS, TOWER_TIME_MS, type TowerPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect, playWrong } from "@/lib/sound";

import { soundCue, useSolveFx } from "./logicFx";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Graduated by size, smallest (light yellow) to largest (sky blue); equal sizes share a colour. */
const HANOI_SHADES = 9;

function discColour(size: number, discs = TOWER_DISCS): string {
  const step = discs <= 1 ? 1 : Math.round(((size - 1) * (HANOI_SHADES - 1)) / (discs - 1)) + 1;
  return `var(--hanoi-${Math.max(1, Math.min(HANOI_SHADES, step))})`;
}

/** Three or four wooden posts; the target post stands on a gold plate. */
function Pegs({
  pegs,
  discs,
  targetPeg,
  lifted,
  shake,
  onPeg,
  compact,
  discHeight,
  dropped,
}: {
  pegs: TowerPegs;
  discs: number;
  targetPeg: number;
  lifted?: number | null;
  shake?: number | null;
  onPeg?: ((peg: number) => void) | undefined;
  compact?: boolean;
  /** CSS length for one ring's thickness (live and reveal boards size it from their box). */
  discHeight?: string;
  /** The post whose top ring just landed (it settles with a small bounce). */
  dropped?: { peg: number; key: number } | null;
}) {
  const liftedDisc =
    lifted === null || lifted === undefined ? null : (pegs[lifted]?.at(-1) ?? null);
  const ringH = discHeight ?? (compact ? "7px" : "12px");
  const gap = compact ? 2 : 3;

  return (
    <div
      className={`logic-hanoi flex h-full w-full items-end justify-center ${compact ? "gap-1.5" : "gap-3 px-2"}`}
      style={{ "--hanoi-ring": ringH, "--hanoi-gap": `${gap}px` } as CSSProperties}
    >
      {Array.from({ length: Math.max(3, pegs.length) }, (_, peg) => {
        const stack = pegs[peg] ?? [];
        const isLifted = lifted === peg;
        const target = peg === targetPeg;
        return (
          <button
            key={peg}
            type="button"
            disabled={!onPeg}
            onClick={() => onPeg?.(peg)}
            aria-label={`Post ${peg + 1}`}
            className={`relative flex h-full flex-1 flex-col items-center justify-end ${target ? "logic-hanoi-target" : ""}`}
          >
            {/* The lifted ring hovers above its post. */}
            <div
              className="flex w-full flex-col items-center justify-end"
              style={{ height: `calc(${discs + 1} * (var(--hanoi-ring) + var(--hanoi-gap)) + ${compact ? 8 : 16}px)`, maxHeight: "100%", minHeight: 0 }}
            >
              <div className="flex w-full shrink-0 items-center justify-center" style={{ height: `calc(var(--hanoi-ring) + ${compact ? 6 : 12}px)` }}>
                {isLifted && liftedDisc !== null && (
                  <div
                    className="hanoi-disc hanoi-lifted logic-hanoi-ring logic-hanoi-hover"
                    style={{
                      height: "var(--hanoi-ring)",
                      width: `${30 + (liftedDisc / discs) * 65}%`,
                      backgroundColor: discColour(liftedDisc, discs),
                    }}
                  />
                )}
              </div>

              <div className="relative flex min-h-0 w-full flex-1 flex-col items-center justify-end" style={{ gap: "var(--hanoi-gap)" }}>
                <div aria-hidden="true" className="logic-hanoi-post absolute bottom-0 rounded-t-full" />
                {target && <span aria-hidden="true" className="logic-hanoi-sparkle" style={{ bottom: `calc(${stack.length} * (var(--hanoi-ring) + var(--hanoi-gap)))` }}><i /><i /><i /></span>}
                {/* The stack is bottom-to-top from index 0, so the column is drawn
                    in reverse: the smallest disc is the topmost element. */}
                {[...stack].reverse().map((size, index) => {
                  const hide = isLifted && index === 0;
                  const landed = dropped?.peg === peg && index === 0;
                  return (
                    <div
                      key={landed ? `${size}-${dropped?.key}` : size}
                      className={`hanoi-disc logic-hanoi-ring relative z-10 shrink-0 ${shake === peg ? "animate-shake" : ""} ${landed ? "logic-hanoi-drop" : ""}`}
                      style={{
                        height: "var(--hanoi-ring)",
                        width: `${30 + (size / discs) * 65}%`,
                        backgroundColor: discColour(size, discs),
                        opacity: hide ? 0.25 : 1,
                        "--logic-i": stack.length - 1 - index,
                      } as CSSProperties}
                    />
                  );
                })}
              </div>
            </div>
            <div className={`logic-hanoi-base mt-1 w-full shrink-0 ${target ? "logic-hanoi-base-gold" : ""}`} style={{ height: compact ? 7 : 12 }} />
          </button>
        );
      })}
    </div>
  );
}

/** Fixed intro example — never randomised. */
function IntroExample() {
  const pegs: TowerPegs = [[9, 8, 6], [7, 4, 2], [5, 3], [1]];
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Move every ring to the gold-based post, one at a time. Never put a bigger ring on a smaller one.
      </p>
      <div style={{ width: 190, height: 96 }}>
        <Pegs pegs={pegs} discs={9} targetPeg={3} compact />
      </div>
      <p className="text-xs text-muted-foreground">
        Nine rings on 3 or 4 posts – the line below says which. Fewest moves earn a bonus. You have 90 seconds.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey = "tower" }: PuzzleStageProps) {
  const isTower = puzzle.type === "tower";
  const discs = isTower ? puzzle.discs : TOWER_DISCS;
  const targetPeg = isTower ? puzzle.targetPeg : TOWER_PEGS - 1;
  const start = useMemo(
    () => (isTower ? (puzzle.start ?? []) : []),
    // The stored spread never changes during a round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isTower],
  );
  const [moves, setMoves] = useStageState<TowerMove[]>(stateKey, "towerMoves", () => []);
  const [lifted, setLifted] = useStageState<number | null>(stateKey, "towerLifted", () => null);
  const [shake, setShake] = useStageState<number | null>(stateKey, "towerShake", () => null);
  const [dropped, setDropped] = useState<{ peg: number; key: number } | null>(null);
  const submitted = useRef(false);

  const replay = useMemo(
    () => replayTower(start, targetPeg, discs, moves),
    [start, targetPeg, discs, moves],
  );
  const solving = useSolveFx("tower", isTower && replay.solved);

  useEffect(() => {
    onDraftAnswer?.(encodeTowerMoves(moves));
  }, [moves, onDraftAnswer]);

  useEffect(() => {
    if (locked || submitted.current || !replay.solved) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encodeTowerMoves(moves));
  }, [replay.solved, moves, locked, onSubmit]);

  const reject = (peg: number) => {
    setShake(peg);
    buzz(20);
    playWrong();
    setTimeout(() => setShake(null), 320);
  };

  const tapPeg = (peg: number) => {
    if (locked || submitted.current || replay.solved) return;
    if (lifted === null) {
      if (!(replay.pegs[peg] ?? []).length) return;
      hapticTick();
      soundCue("tower.lift");
      setLifted(peg);
      return;
    }
    if (lifted === peg) {
      setLifted(null);
      return;
    }
    if (!towerCanMove(replay.pegs, lifted, peg)) {
      reject(peg);
      setLifted(null);
      return;
    }
    hapticTick();
    soundCue("tower.drop");
    setDropped({ peg, key: moves.length + 1 });
    setMoves((current) => [...current, { from: lifted, to: peg }]);
    setLifted(null);
  };

  const undo = () => {
    setLifted(null);
    setDropped(null);
    setMoves((current) => current.slice(0, -1));
  };

  const reset = () => {
    setLifted(null);
    setDropped(null);
    setMoves([]);
  };

  // Desktop keys: 1, 2 and 3 tap posts 1–3 (left to right), Z or Backspace = Undo, R = Reset.
  useGameKeys((kind, key, event) => {
    if (!isTower) return false;
    const peg = /^[1-9]$/.test(key) ? Number(key) - 1 : -1;
    const posts = Math.max(3, replay.pegs.length);
    const used = (peg >= 0 && peg < posts) || key === "z" || key === "Backspace" || key === "r";
    if (!used || kind !== "down" || event.repeat) return used;
    if (peg >= 0) {
      if (!locked) tapPeg(peg);
    } else if (!locked && moves.length) {
      if (key === "r") reset();
      else undo();
    }
    return true;
  });

  if (!isTower) return null;

  return (
    <div data-logic-stage="tower" data-logic-solved={solving ? "" : undefined} data-stage-column="2" className="relative flex min-h-0 flex-1 flex-col gap-2">
      <span aria-hidden="true" className="logic-calm-glow" />
      <div data-game-arena="logic">
        <p className="logic-status text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
          moves <span className="text-primary">{replay.moves}</span>
        </p>
        <div className="logic-hanoi-stage">
          <Pegs
            pegs={replay.pegs}
            discs={discs}
            targetPeg={targetPeg}
            lifted={lifted}
            shake={shake}
            onPeg={tapPeg}
            dropped={dropped}
            discHeight={`clamp(12px, calc((100cqh - 92px) / ${discs + 1} - 3px), 30px)`}
          />
        </div>
      </div>

      <div data-game-controls="actions" className="flex shrink-0 justify-center gap-3 px-2">
        <button
          type="button"
          disabled={locked || !moves.length}
          onClick={undo}
          className="h-11 rounded-xl border border-border px-5 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          disabled={locked || !moves.length}
          onClick={reset}
          className="h-11 rounded-xl border border-border px-5 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "tower") return null;
  const start = puzzle.start ?? [];
  const mine = replayTower(start, puzzle.targetPeg, puzzle.discs, decodeTowerMoves(myAnswer ?? ""));
  const limit = timeLimitMs;
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((limit - myMsRemaining) / 100) / 10;

  return (
    <div className="logic-reveal">
      <div className="logic-reveal-board">
        <div className="logic-hanoi-reveal">
          <Pegs
            pegs={mine.moves ? mine.pegs : towerPegsFrom(start)}
            discs={puzzle.discs}
            targetPeg={puzzle.targetPeg}
            compact
            discHeight={`clamp(7px, calc((100cqh - 40px) / ${puzzle.discs + 1} - 2px), 14px)`}
          />
        </div>
      </div>
      <p className="shrink-0 text-center font-display text-2xl font-bold">
        <span className={myCorrect ? "text-primary" : "text-warn"}>
          {mine.moves} {myCorrect ? "✓" : "✗"}
        </span>
        <span className="ml-2 font-mono text-base uppercase tracking-widest text-muted-foreground">
          moves · min {puzzle.minMoves}
          {myCorrect && elapsed !== null ? ` · ${elapsed.toFixed(1)}s` : ""}
        </span>
      </p>
      <p className="logic-reveal-text text-center text-muted-foreground">
        Park the big rings where they won&apos;t block you.
      </p>
    </div>
  );
}

/** The spread, the minimum and one shortest solution all come from the server. */
export const towerPuzzle: PuzzleDefinition = {
  key: "tower",
  name: gameDisplayName("tower"),
  category: "logic",
  timeLimitMs: TOWER_TIME_MS,
  revealMs: 5_000,
  generate: () =>
    ({
      type: "tower",
      discs: TOWER_DISCS,
      targetPeg: TOWER_PEGS - 1,
      start: [],
      minMoves: 0,
      timeLimitMs: TOWER_TIME_MS,
    }) satisfies TowerPuzzleData,
  check: () => false,
  revealHeading: "Your tower",
  introLine: (puzzle) =>
    puzzle.type === "tower" ? `${towerPegCount(puzzle.start)} posts` : null,
  IntroExample,
  Stage,
  Reveal,
};
