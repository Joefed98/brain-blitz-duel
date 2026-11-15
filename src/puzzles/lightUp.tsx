import { gameDisplayName } from "@/lib/duel/gameNames";
import { solutionProgress } from "@/lib/duel/progressFigures";
import { puzzleReject } from "@/lib/fx/puzzleReject";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { useGridPointer } from "@/components/puzzles/GridDrag";
import { useStageState } from "@/lib/duel/stageState";
import {
  decodeBulbs,
  encodeBulbs,
  lightUpHeightOf,
  lightUpStatus,
  lightUpValid,
  LIGHTUP_SIZE,
  orth,
  type LightUpBoard,
} from "@/lib/duel/lightUp";
import { LIGHTUP_TIME_MS, type LightUpPuzzleData } from "@/lib/duel/types";
import { playCorrect } from "@/lib/sound";

import { useSolveFx } from "./logicFx";
import { soundCue } from "@/lib/fx/soundCues";
import { gameFx } from "@/lib/fx/kit";
import { logicArt, logicArtVars } from "./logicArt";
import { LogicReveal, extraCount, tallySets } from "./logic2Reveal";

const LIGHTUP_ART = logicArtVars(["logic-cell", "lightup-cell-lit", "lightup-wall"]);
import { useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import { HudPills } from "@/components/puzzles/HudPills";
import "@/polish-layout/polish-nov3-logic.css";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** The live round names the squares still dark once this few are left (the Logic overhaul, 15 Nov 2026). */
export const LIGHTUP_DARK_HINT = 6;

/** 0 empty, 1 bulb, 2 dot (a note: no bulb here). */
type Mark = 0 | 1 | 2;

/** Beam cells per bulb, plus the stretches between two bulbs that see each other. */
function beams(board: LightUpBoard, bulbs: readonly number[]) {
  const { size } = board;
  const height = lightUpHeightOf(board);
  const wallSet = new Set(board.walls);
  const bulbSet = new Set(bulbs);
  const h = new Set<number>();
  const v = new Set<number>();
  const redH = new Set<number>();
  const redV = new Set<number>();
  for (const bulb of bulbs) {
    h.add(bulb);
    v.add(bulb);
    const r = Math.floor(bulb / size);
    const c = bulb % size;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const run: number[] = [bulb];
      let rr = r + dr;
      let cc = c + dc;
      while (rr >= 0 && cc >= 0 && rr < height && cc < size && !wallSet.has(rr * size + cc)) {
        const cell = rr * size + cc;
        run.push(cell);
        (dr === 0 ? h : v).add(cell);
        if (bulbSet.has(cell)) {
          for (const x of run) (dr === 0 ? redH : redV).add(x);
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
  }
  return { h, v, redH, redV };
}

/**
 * Whether a numbered wall shows its ✓ (Logic review, 15 Nov 2026; display only). A wall with exactly its bulbs ticks as
 * before, except a 0: it has its bulbs from the start, so it ticks only once every open square beside it is lit or
 * dotted (the board used to open with a tick on every 0).
 */
export function lightUpWallTicked(n: number, neighbours: readonly number[], bulbs: ReadonlySet<number>, lit: ReadonlySet<number>, marks: readonly number[], walls: ReadonlySet<number>): boolean {
  if (n < 0) return false;
  const touching = neighbours.filter((x) => bulbs.has(x)).length;
  if (touching !== n) return false;
  if (n > 0) return true;
  return neighbours.every((x) => walls.has(x) || lit.has(x) || marks[x] === 2);
}

/**
 * How brightly each lit square is lit (the Logic overhaul, 15 Nov 2026; display only): 1 under and beside a lamp,
 * fading by 0.17 a square down its row or column to 0.25, the brightest lamp reaching it winning. Light falls across
 * the floor from the bulb instead of every lit square reading the same.
 */
export function lightFalloff(board: LightUpBoard, bulbs: readonly number[]): Map<number, number> {
  const { size } = board;
  const height = lightUpHeightOf(board);
  const walls = new Set(board.walls);
  const out = new Map<number, number>();
  const put = (cell: number, v: number) => out.set(cell, Math.max(out.get(cell) ?? 0, v));
  for (const bulb of bulbs) {
    put(bulb, 1);
    const r0 = Math.floor(bulb / size);
    const c0 = bulb % size;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      let r = r0 + dr;
      let c = c0 + dc;
      for (let k = 1; r >= 0 && c >= 0 && r < height && c < size && !walls.has(r * size + c); k++) {
        put(r * size + c, Math.max(0.25, 1 - 0.17 * (k - 1)));
        r += dr;
        c += dc;
      }
    }
  }
  return out;
}

export function Board({
  board,
  marks,
  wrong,
  small = false,
  pointer,
  spread,
  missed,
}: {
  board: LightUpBoard;
  marks: readonly Mark[];
  /** Bulbs to draw red in the reveal. */
  wrong?: ReadonlySet<number> | undefined;
  small?: boolean;
  pointer?: ReturnType<typeof useGridPointer>;
  /** The lamp just placed, keyed per tap: its light spreads out along the beams. */
  spread?: { cell: number; key: number } | null;
  /** Reveal: the solution's lamps the player didn't place (a faint ghost bulb in a dashed ring). */
  missed?: ReadonlySet<number> | undefined;
}) {
  const { size } = board;
  const height = lightUpHeightOf(board);
  const bulbs = marks.flatMap((m, cell) => (m === 1 ? [cell] : []));
  const bulbSet = new Set(bulbs);
  const status = lightUpStatus(board, bulbs);
  const beam = beams(board, bulbs);
  const lightAt = lightFalloff(board, bulbs);
  const wallIndex = new Map(board.walls.map((wall, i) => [wall, i]));
  const wallSet = new Set(board.walls);
  const beamW = small ? 2 : 4;
  return (
    <div
      ref={pointer?.ref}
      {...(pointer ? pointer.handlers : {})}
      className={`logic-lamps logic2-lamps relative grid w-full select-none ${small ? "logic-lamps-small" : ""}`}
      data-logic2="lightup"
      style={{ ...LIGHTUP_ART, ...(pointer?.handlers.style ?? {}), gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, gap: small ? 1 : 2 }}
    >
      {/*
        The light (Joe, 15 Nov 2026): one softly blurred warm layer under the squares, a pool on every lit square at its
        falloff brightness. Lit squares are see-through over it, walls and dark squares opaque, so neighbouring lit
        squares (and the gaps between them) blend into one glow with no hard edge, and the light dims away from its lamp.
        Display only; <i> elements, so the shared puzzle surfaces never treat it as a cell.
      */}
      <i
        aria-hidden="true"
        className="logic2-glow"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${height}, minmax(0, 1fr))`, gap: small ? 1 : 2 }}
      >
        {[...lightAt].map(([cell, v]) => (
          <i key={cell} style={{ gridRow: Math.floor(cell / size) + 1, gridColumn: (cell % size) + 1, "--logic2-light": v } as CSSProperties} />
        ))}
      </i>
      {Array.from({ length: size * height }, (_, cell) => {
        const wi = wallIndex.get(cell);
        if (wi !== undefined) {
          const n = board.wallNumbers[wi] ?? -1;
          const touching = orth(cell, size, height).filter((x) => bulbSet.has(x)).length;
          const over = n >= 0 && touching > n;
          const done = lightUpWallTicked(n, orth(cell, size, height), bulbSet, status.lit, marks, wallSet);
          return (
            <div
              key={cell}
              className="logic2-wall relative flex aspect-square items-center justify-center rounded-sm"
              data-over={over ? "" : undefined}
              data-met={done ? "" : undefined}
              data-wall={cell}
            >
              {n >= 0 && (
                <span className={`logic2-num ${small ? "text-xs" : "logic2-wall-num"}`}>{n}</span>
              )}
              {done && !small && (
                <span className="logic2-tick absolute right-0.5 top-0 leading-none" aria-hidden="true">✓</span>
              )}
            </div>
          );
        }
        const mark = marks[cell] ?? 0;
        const bad = status.clashing.has(cell) || wrong?.has(cell);
        const lit = status.lit.has(cell);
        const r = Math.floor(cell / size);
        const c = cell % size;
        const from = spread ? { r: Math.floor(spread.cell / size), c: spread.cell % size } : null;
        const reach = from && lit && (from.r === r || from.c === c) ? Math.abs(from.r - r) + Math.abs(from.c - c) : -1;
        return (
          <div
            key={cell}
            className="lightup-cell logic2-lamp-cell relative flex aspect-square items-center justify-center overflow-hidden rounded-sm"
            data-lit={lit ? "" : undefined}
            style={lit ? ({ "--logic-diag": r + c, "--logic2-light": lightAt.get(cell) ?? 1 } as CSSProperties) : ({ "--logic-diag": r + c } as CSSProperties)}
            data-missed={missed?.has(cell) && mark !== 1 ? "" : undefined}
          >
            {reach >= 0 && (
              <span key={spread?.key} aria-hidden="true" className="logic-light-in" style={{ animationDelay: `${reach * 40}ms` }} />
            )}
            {beam.h.has(cell) && (
              <span
                className={`absolute inset-x-0 top-1/2 -translate-y-1/2 ${beam.redH.has(cell) ? "bg-destructive" : "lightup-beam"}`}
                style={{ height: beamW }}
              />
            )}
            {beam.v.has(cell) && (
              <span
                className={`absolute inset-y-0 left-1/2 -translate-x-1/2 ${beam.redV.has(cell) ? "bg-destructive" : "lightup-beam"}`}
                style={{ width: beamW }}
              />
            )}
            {mark === 1 ? (
              <img
                className={`logic-lamp logic2-piece logic2-bulb relative ${bad ? "animate-pulse" : ""}`}
                data-clash={bad ? "" : undefined}
                data-bulb={cell}
                src={logicArt("lightup-lamp")}
                alt=""
                draggable={false}
              />
            ) : missed?.has(cell) ? (
              <img className="logic2-piece logic2-bulb logic2-ghost relative" src={logicArt("lightup-lamp")} alt="" draggable={false} />
            ) : mark === 2 ? (
              <span className="relative h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Worked 4×4 example: before (walls, one numbered 1) and after (two bulbs, all lit, the 1 ticked). */
const EXAMPLE: LightUpBoard = { size: 4, walls: [0, 1, 2, 12, 14], wallNumbers: [-1, 1, -1, -1, -1] };

export function LightUpExample() {
  const before: Mark[] = new Array(16).fill(0);
  const after: Mark[] = new Array(16).fill(0);
  after[5] = 1;
  after[11] = 1;
  return (
    <div className="flex w-full flex-col items-center gap-1">
      <div className="flex items-end justify-center gap-3">
        <div className="flex flex-col items-center gap-1" style={{ width: 112 }}>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Before</span>
          <Board board={EXAMPLE} marks={before} small />
        </div>
        <span className="pb-10 text-muted-foreground">→</span>
        <div className="flex flex-col items-center gap-1" style={{ width: 112 }}>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">After</span>
          <Board board={EXAMPLE} marks={after} small />
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">Two bulbs light every square; the 1 has one bulb beside it.</p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey }: PuzzleStageProps) {
  const data: LightUpPuzzleData | null = puzzle.type === "lightup" ? puzzle : null;
  const size = data?.size ?? LIGHTUP_SIZE;
  // 9 rows before the depth revision, 10 on it.
  const height = data ? lightUpHeightOf(data) : size;
  const [marks, setMarks] = useStageState<Mark[]>(stateKey ?? "lightup", "lightUpMarks", () =>
    new Array(size * height).fill(0),
  );
  const [spread, setSpread] = useState<{ cell: number; key: number } | null>(null);
  const submitted = useRef(false);
  const pressed = useRef(false);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const seen = useRef<{ met: Set<string>; clash: Set<string>; darkNear: boolean } | null>(null);
  // The Logic overhaul's effects (15 Nov 2026, the effects kit), read from the board as drawn after each change:
  // a new clash flickers both lamps with a buzz, a number newly satisfied pops with a tick, and the first time six or
  // fewer squares are left dark a soft nudge plays (the board says how many).
  useEffect(() => {
    const root = boardRef.current;
    if (!root || !data) return;
    const ids = (sel: string, attr: string) => new Set([...root.querySelectorAll<HTMLElement>(sel)].map((el) => el.getAttribute(attr) ?? ""));
    const met = ids("[data-wall][data-met]", "data-wall");
    const clash = ids("[data-bulb][data-clash]", "data-bulb");
    const st = lightUpStatus(data, bulbs);
    const dark = st.whites - st.lit.size;
    const darkNear = dark > 0 && dark <= LIGHTUP_DARK_HINT && bulbs.length > 0;
    const before = seen.current;
    seen.current = { met, clash, darkNear };
    if (!before) return;
    const newClash = [...clash].filter((c) => !before.clash.has(c));
    if (newClash.length) {
      soundCue("lightup.clash");
      for (const c of clash) gameFx("wrong", root.querySelector(`[data-bulb="${c}"]`), { silent: true, noHaptic: true });
    }
    const newMet = [...met].filter((c) => !before.met.has(c));
    if (newMet.length) {
      soundCue("lightup.wallMet");
      for (const c of newMet) gameFx("tap", root.querySelector(`[data-wall="${c}"]`), { silent: true });
    }
    if (darkNear && !before.darkNear) soundCue("lightup.dark");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marks]);
  const bulbs = marks.flatMap((m, cell) => (m === 1 ? [cell] : []));
  const encoded = encodeBulbs(bulbs);
  const solving = useSolveFx("lightup", Boolean(data && lightUpValid(data, bulbs)));

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  useEffect(() => {
    if (!data || locked || submitted.current || !lightUpValid(data, bulbs)) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encoded, locked]);

  const walls = new Set(data?.walls ?? []);
  const pointer = useGridPointer({
    cols: size,
    rows: height,
    onCell:
      !locked && data
        ? (cell) => {
            // One press = one tap on the cell first touched.
            if (pressed.current || submitted.current) return;
            if (walls.has(cell)) return puzzleReject();
            pressed.current = true;
            const next = ((marks[cell] ?? 0) + 1) % 3;
            soundCue(next === 1 ? "lightup.lamp" : next === 2 ? "lightup.dot" : "lightup.clear");
            setSpread((current) => (next === 1 ? { cell, key: (current?.key ?? 0) + 1 } : null));
            setMarks((current) => current.map((m, i) => (i === cell ? (((m + 1) % 3) as Mark) : m)));
          }
        : undefined,
    onRelease: () => {
      pressed.current = false;
    },
  });

  const liveStatus = data ? lightUpStatus(data, bulbs) : null;
  const inFrame = useFrameProgress(liveStatus?.lit.size ?? 0, liveStatus?.whites ?? 0, "lit");
  if (!data || !liveStatus) return null;
  const status = liveStatus;
  const darkLeft = status.whites - status.lit.size;

  return (
    <div data-logic-stage="lightup" data-logic-solved={solving ? "" : undefined} data-stage-column="2" className="relative flex min-h-0 flex-1 flex-col gap-2">
      <span aria-hidden="true" className="logic-calm-glow" />
      <div data-game-arena="logic" className="px-3">
        {inFrame ? null : (
          <p className="logic-status font-mono text-xs uppercase tracking-widest text-muted-foreground">
            lit <span className="text-primary">{status.lit.size}</span> / {status.whites}
          </p>
        )}
        <div
          className={`${height === size ? "logic-square" : "logic-board-tall"} logic-lamp-frame`}
          style={height === size ? undefined : ({ "--board-aspect": height / size } as CSSProperties)}
        >
          <div ref={boardRef} className="contents">
            <Board board={data} marks={marks} pointer={pointer} spread={spread} />
          </div>
        </div>
        {/* The hint's line is kept from the start (hidden until it shows), so the board never moves when it appears. */}
        {darkLeft > 0 && darkLeft <= LIGHTUP_DARK_HINT && bulbs.length > 0 ? (
          <p className="logic2-hint" role="status" data-lightup-dark={darkLeft}>
            {darkLeft === 1 ? "1 square dark" : `${darkLeft} squares dark`}
          </p>
        ) : (
          <p className="logic2-hint" aria-hidden="true" data-hint-hidden="">
            0 squares dark
          </p>
        )}
        {inFrame ? (
          <HudPills
            testId="lightup"
            className="logic-hud-pills"
            items={[
              { id: "lamps", label: "Lamps", value: bulbs.length },
              { id: "dots", label: "Dots", value: marks.filter((mark) => mark === 2).length },
            ]}
          />
        ) : null}
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect, myExtra }: PuzzleRevealProps) {
  if (puzzle.type !== "lightup") return null;
  const cells = puzzle.size * lightUpHeightOf(puzzle);
  const hasSolution = Array.isArray(puzzle.solution) && puzzle.solution.length > 0;
  const solution = new Set(puzzle.solution ?? []);
  const mine = decodeBulbs(myAnswer ?? "", puzzle);
  const mineSet = new Set(mine);
  const marksOf = (set: ReadonlySet<number>) => Array.from({ length: cells }, (_, c) => (set.has(c) ? 1 : 0)) as Mark[];
  const wrong = new Set(hasSolution ? mine.filter((c) => !solution.has(c)) : []);
  const missed = new Set(hasSolution ? [...solution].filter((c) => !mineSet.has(c)) : []);
  const status = lightUpStatus(puzzle, mine);
  const board = (marks: Mark[], compare: boolean) => (
    <div className="logic-lamp-frame logic2-reveal-lamps">
      <Board board={puzzle} marks={marks} wrong={compare ? wrong : undefined} missed={compare ? missed : undefined} />
    </div>
  );
  const mistakes = extraCount(myExtra, "mistakes");
  return (
    <LogicReveal
      game="lightup"
      solved={myCorrect}
      hasSolution={hasSolution}
      yours={board(marksOf(mineSet), true)}
      solution={board(marksOf(solution), false)}
      tally={tallySets(mine, solution, "lamps")}
      facts={[
        ...(myCorrect ? [] : [{ label: "Squares lit", value: `${status.lit.size} of ${status.whites}` }]),
        ...(mistakes !== null ? [{ label: "Mistakes", value: String(mistakes) }] : []),
      ]}
    />
  );
}

export const lightUpPuzzle: PuzzleDefinition = {
  key: "lightup",
  name: gameDisplayName("lightup"),
  category: "logic",
  timeLimitMs: LIGHTUP_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "lightup", size: LIGHTUP_SIZE, walls: [], wallNumbers: [] }) satisfies LightUpPuzzleData,
  check: (answer, puzzle) => puzzle.type === "lightup" && lightUpValid(puzzle, decodeBulbs(answer, puzzle)),
  revealHeading: "The solution",
  IntroExample: LightUpExample,
  Stage,
  Reveal,
};
