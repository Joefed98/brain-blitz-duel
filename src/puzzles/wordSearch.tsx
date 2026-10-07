import { useEffect, useRef, useState } from "react";

import { useGridPointer } from "@/components/puzzles/GridDrag";
import { devDiagnosticsOn } from "@/lib/arcade/diagnostics";
import { useStageState } from "@/lib/duel/stageState";
import { WORDSEARCH_TIME_MS, type WordSearchPlacement, type WordSearchPuzzleData } from "@/lib/duel/types";
import { wsDecode, wsEncode, wsGrade, wsSnapLine, WS_SIZE, WS_WORDS } from "@/lib/duel/wordSearch";
import { buzz } from "@/lib/motion";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

function Grid({
  grid,
  size,
  gold,
  live,
  bad,
  missedPath,
  pointer,
  small = false,
}: {
  grid: string;
  size: number;
  gold: ReadonlySet<number>;
  live?: ReadonlySet<number>;
  bad?: ReadonlySet<number>;
  /** Reveal: cells along every word the player did not find. */
  missedPath?: ReadonlySet<number>;
  pointer?: ReturnType<typeof useGridPointer>;
  small?: boolean;
}) {
  return (
    <div
      ref={pointer?.ref}
      {...(pointer ? pointer.handlers : {})}
      data-play-area
      className="grid h-full w-full select-none"
      style={{ ...(pointer?.handlers.style ?? {}), gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, gap: small ? 1 : 2 }}
    >
      {Array.from({ length: size * size }, (_, cell) => {
        const missedOnly = (missedPath?.has(cell) ?? false) && !gold.has(cell);
        // Unfound reveal path: red letters on a faint red fill; crossings with found words stay gold.
        const fill = bad?.has(cell)
          ? "bg-destructive text-destructive-foreground"
          : live?.has(cell)
            ? "bg-primary/40 text-foreground"
            : gold.has(cell)
              ? "bg-primary text-primary-foreground"
              : missedOnly
                ? "bg-destructive/15 text-destructive"
                : "bg-card text-foreground";
        const missedOutline = missedPath?.has(cell) ? "ring-2 ring-inset ring-destructive" : "";
        return (
          <div
            key={cell}
            className={`flex aspect-square items-center justify-center rounded-sm font-mono font-bold ${fill} ${missedOutline}`}
            style={{ fontSize: small ? 9 : "clamp(14px, 5cqw, 22px)" }}
          >
            {grid[cell]}
          </div>
        );
      })}
    </div>
  );
}

/** Fixed 5×5 example: LION found on a diagonal, read backwards. */
const EXAMPLE_GRID = "NTEKARNSIGBMOUPWELIDCAHYL";
const EXAMPLE_CELLS = [24, 18, 12, 6];

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Animals · <span className="text-primary">1</span> / 6
      </p>
      <div style={{ width: 150, containerType: "inline-size" }}>
        <Grid grid={EXAMPLE_GRID} size={5} gold={new Set(EXAMPLE_CELLS)} small />
      </div>
      <p className="max-w-[260px] text-center text-xs text-muted-foreground">
        LION, found diagonally and backwards. Words can run in any of eight directions.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, checkWord, stateKey }: PuzzleStageProps) {
  const data: WordSearchPuzzleData | null = puzzle.type === "wordsearch" ? puzzle : null;
  const key = stateKey ?? "wordsearch";
  const [selections, setSelections] = useStageState<number[][]>(key, "wsSelections", () => []);
  const [found, setFound] = useStageState<WordSearchPlacement[]>(key, "wsFound", () => []);
  const [line, setLine] = useState<number[]>([]);
  const [bad, setBad] = useState<number[]>([]);
  const start = useRef<number | null>(null);
  const current = useRef<number[]>([]);
  const submitted = useRef(false);
  const size = data?.size ?? WS_SIZE;
  const total = data?.wordCount ?? WS_WORDS;
  const encoded = wsEncode(selections);

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  useEffect(() => {
    if (submitted.current || locked || found.length < total) return;
    submitted.current = true;
    onSubmit(encoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found.length, locked]);

  const done = locked || found.length >= total;
  const pointer = useGridPointer({
    cols: size,
    rows: size,
    onCell: done
      ? undefined
      : (cell) => {
          if (start.current === null) start.current = cell;
          const next = wsSnapLine(start.current, cell, size);
          if (next.join(".") !== current.current.join(".")) {
            current.current = next;
            setLine(next);
          }
        },
    onRelease: () => {
      const path = current.current;
      start.current = null;
      current.current = [];
      setLine([]);
      if (path.length < 2 || !checkWord) return;
      setSelections((s) => [...s, path]);
      const already = found.map((f) => f.word);
      void checkWord("", already, path).then((verdict) => {
        if (verdict.valid) {
          buzz(12);
          setFound((f) => (f.some((x) => x.word === verdict.word) ? f : [...f, { word: verdict.word, cells: path }]));
        } else if (verdict.reason !== "Already found") {
          setBad(path);
          setTimeout(() => setBad([]), 350);
        }
      });
    },
  });

  if (!data) return null;
  const gold = new Set(found.flatMap((f) => f.cells));
  return (
    <div data-stage-column="2" className="flex min-h-0 flex-1 flex-col items-center gap-2 py-1">
      <div className="flex shrink-0 flex-col items-center">
        <p className="font-display text-xl font-bold leading-tight text-foreground">{data.category}</p>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          <span className="text-primary">{found.length}</span> / {total} found
        </p>
      </div>
      <div data-game-arena="board" className="flex min-h-0 w-full flex-1 items-center justify-center" style={{ containerType: "size" }}>
        <div style={{ width: "min(100cqw, 100cqh)", aspectRatio: "1 / 1" }}>
          <Grid grid={data.grid} size={size} gold={gold} live={new Set(line)} bad={new Set(bad)} pointer={pointer} />
        </div>
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myMsRemaining }: PuzzleRevealProps) {
  const [dev, setDev] = useState(false);
  useEffect(() => setDev(devDiagnosticsOn()), []);
  if (puzzle.type !== "wordsearch") return null;
  const placements = puzzle.placements ?? [];
  const verdict = wsGrade(placements, wsDecode(myAnswer ?? "", puzzle.size));
  const foundSet = new Set(verdict.found);
  const gold = new Set(verdict.found.flatMap((i) => placements[i]?.cells ?? []));
  const missed = new Set(placements.flatMap((p, i) => (foundSet.has(i) ? [] : p.cells)));
  const all = verdict.found.length === placements.length && placements.length > 0;
  const elapsed = Math.max(0, timeLimitMs - (myMsRemaining ?? 0));
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div style={{ width: 210, containerType: "inline-size" }}>
        <Grid grid={puzzle.grid} size={puzzle.size} gold={gold} missedPath={missed} small />
      </div>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 font-mono text-xs uppercase tracking-widest">
        {placements.map((p, i) => (
          <span key={p.word} className={foundSet.has(i) ? "text-primary" : "text-destructive"}>
            {p.word}
          </span>
        ))}
      </div>
      <p className="font-mono text-base text-primary">
        {all
          ? `6 / 6 · ${(elapsed / 1000).toFixed(1)}s`
          : `${verdict.found.length} / ${placements.length} found`}
      </p>
      {dev && (
        <div className="font-mono text-[10px] text-muted-foreground">
          {placements.map((p) => (
            <div key={p.word}>
              dev · {p.word}: [{p.cells.join(", ")}]
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const wordSearchPuzzle: PuzzleDefinition = {
  key: "wordsearch",
  name: "Word Search",
  category: "word",
  timeLimitMs: WORDSEARCH_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({ type: "wordsearch", size: WS_SIZE, grid: "E".repeat(WS_SIZE * WS_SIZE), category: "Animals", wordCount: WS_WORDS }) satisfies WordSearchPuzzleData,
  check: (answer, puzzle) =>
    puzzle.type === "wordsearch" &&
    wsGrade(puzzle.placements ?? [], wsDecode(answer, puzzle.size)).found.length === (puzzle.placements?.length ?? -1),
  revealHeading: "The hidden words",
  IntroExample,
  Stage,
  Reveal,
};
