import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { nearestGridCellAt, hapticTick } from "@/components/puzzles/GridDrag";
import { Button } from "@/components/ui/button";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";
import { useStageState } from "@/lib/duel/stageState";
import {
  decodeTileGrid,
  encodeTileGrid,
  placedCount,
  TG_CELLS,
  TG_REVEAL_MS,
  TG_SIZE,
  TG_TILES,
  TG_TIME_MS,
  tileGridConnected,
  tileGridRuns,
} from "@/lib/duel/tileGrid";
import type { TileGridPuzzleData } from "@/lib/duel/types";
import { playLock, playWrong } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const GAP = 2;
const TRAY_TILE = 48;

function MiniGrid({ cells, cell = 20 }: { cells: string[]; cell?: number }) {
  return (
    <div
      className="grid rounded-md border border-border bg-card p-0.5"
      style={{ gridTemplateColumns: `repeat(${TG_SIZE}, ${cell}px)`, gap: 1 }}
    >
      {cells.map((letter, i) => (
        <span
          key={i}
          className={`flex items-center justify-center rounded-[3px] font-display font-bold ${letter ? "bg-primary text-primary-foreground" : "bg-background/40"}`}
          style={{ height: cell, fontSize: Math.round(cell * 0.6) }}
        >
          {letter}
        </span>
      ))}
    </div>
  );
}

function IntroExample() {
  // CAT across, with the T going down into TOP.
  const cells = Array.from({ length: 9 }, () => "");
  cells[0] = "C";
  cells[1] = "A";
  cells[2] = "T";
  cells[5] = "O";
  cells[8] = "P";
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="grid gap-1 rounded-lg border-2 border-border bg-card p-1" style={{ gridTemplateColumns: "repeat(3, 30px)" }}>
        {cells.map((letter, i) => (
          <span
            key={i}
            className={`flex h-[30px] items-center justify-center rounded font-display text-sm font-bold ${letter ? "bg-primary text-primary-foreground shadow-[inset_0_-3px_0_var(--opponent)]" : "bg-background/40"}`}
          >
            {letter}
          </span>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">CAT across, and its T starts TOP going down.</p>
    </div>
  );
}

interface Drag {
  tile: number;
  from: number | null;
  x: number;
  y: number;
  startX: number;
  startY: number;
  moved: boolean;
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit, onDraftAnswer, checkWord, stateKey = "tilegrid" }: PuzzleStageProps) {
  const data: TileGridPuzzleData | null = puzzle.type === "tilegrid" ? puzzle : null;
  /** Which tray tile sits in each cell, or null. */
  const [placed, setPlaced] = useStageState<(number | null)[]>(stateKey, "placed", () =>
    Array.from({ length: TG_CELLS }, () => null),
  );
  const [verdicts, setVerdicts] = useState<Record<string, boolean>>({});
  const [flash, setFlash] = useState<Set<number>>(new Set());
  const [drag, setDrag] = useState<Drag | null>(null);
  const [checking, setChecking] = useState(false);
  const submitted = useRef(false);
  const board = useRef<HTMLDivElement | null>(null);
  const boardSpace = useRef<HTMLDivElement | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const [cellSize, setCellSize] = useState(40);
  useNoTouchScroll(root);

  useEffect(() => {
    const space = boardSpace.current;
    if (!space) return;
    const measure = () => setCellSize(Math.max(40, Math.min(44, Math.floor(Math.min(
      (space.clientWidth - 12 - GAP * (TG_SIZE - 1)) / TG_SIZE,
      (space.clientHeight - 12 - GAP * (TG_SIZE - 1)) / TG_SIZE,
    )))));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(space);
    return () => observer.disconnect();
  }, []);

  const tray = data?.tray ?? [];
  const cells = useMemo(() => placed.map((t) => (t === null ? "" : (tray[t] ?? ""))), [placed, tray]);
  const runs = useMemo(() => tileGridRuns(cells), [cells]);
  const encoded = encodeTileGrid(cells);

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  // Live word feedback: each new run of three or more is checked on the server once.
  const pending = useRef(new Set<string>());
  const verify = useCallback(
    async (word: string): Promise<boolean> => {
      if (word in verdicts) return verdicts[word]!;
      if (!checkWord) return false;
      pending.current.add(word);
      const verdict = await checkWord(word, []).catch(() => ({ valid: false }));
      pending.current.delete(word);
      setVerdicts((v) => ({ ...v, [word]: verdict.valid }));
      return verdict.valid;
    },
    [checkWord, verdicts],
  );
  useEffect(() => {
    for (const run of runs) {
      if (run.word.length >= 3 && !(run.word in verdicts) && !pending.current.has(run.word)) void verify(run.word);
    }
  }, [runs, verdicts, verify]);

  useEffect(() => {
    if (!data || locked || submitted.current) return;
    if (now < phaseStartedAt + TG_TIME_MS - 400) return;
    submitted.current = true;
    onSubmit(encoded);
  }, [now, phaseStartedAt, locked, data, encoded, onSubmit]);

  const goodCells = useMemo(() => {
    const out = new Set<number>();
    for (const run of runs) if (verdicts[run.word] === true) run.cells.forEach((c) => out.add(c));
    return out;
  }, [runs, verdicts]);

  if (!data) return null;
  const frozen = locked || submitted.current;
  const inTray = tray.map((_, i) => i).filter((i) => !placed.includes(i));

  const begin = (event: React.PointerEvent, tile: number, from: number | null) => {
    if (frozen) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a nicety.
    }
    setDrag({ tile, from, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false });
  };
  const move = (event: React.PointerEvent) => {
    if (!drag) return;
    const moved = drag.moved || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 6;
    setDrag({ ...drag, x: event.clientX, y: event.clientY, moved });
  };
  const end = (event: React.PointerEvent) => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    const next = [...placed];
    if (!d.moved) {
      // A tap on a placed tile returns it to the tray.
      if (d.from !== null) {
        next[d.from] = null;
        hapticTick();
        setPlaced(next);
      }
      return;
    }
    const hit = nearestGridCellAt(board.current, event.clientX, event.clientY, TG_SIZE, TG_SIZE);
    if (hit !== null) {
      if (d.from !== null) next[d.from] = null;
      const other = next[hit] ?? null;
      next[hit] = d.tile;
      if (other !== null && d.from !== null) next[d.from] = other;
      hapticTick();
      setPlaced(next);
    }
  };

  const done = async () => {
    if (frozen || checking) return;
    setChecking(true);
    const results = await Promise.all(runs.map(async (run) => (run.word.length >= 3 ? verify(run.word) : false)));
    setChecking(false);
    const bad = new Set<number>();
    runs.forEach((run, i) => {
      if (!results[i]) run.cells.forEach((c) => bad.add(c));
    });
    const connected = tileGridConnected(cells);
    if (!connected) cells.forEach((c, i) => c && bad.add(i));
    if (bad.size === 0 && runs.length > 0 && placedCount(cells) >= 3) {
      submitted.current = true;
      playLock();
      onSubmit(encoded);
      return;
    }
    playWrong();
    setFlash(bad.size ? bad : new Set(cells.map((c, i) => (c ? i : -1)).filter((i) => i >= 0)));
    window.setTimeout(() => setFlash(new Set()), 700);
  };

  return (
    <div
      ref={root}
      className="flex min-h-0 flex-1 flex-col items-center gap-1"
      style={NO_SCROLL_STYLE}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={() => setDrag(null)}
    >
      <div ref={boardSpace} className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
      <div
        ref={board}
        className="puzzle-board grid shrink-0 rounded-xl border-2 border-border bg-card p-1"
        style={{ gridTemplateColumns: `repeat(${TG_SIZE}, ${cellSize}px)`, gap: GAP, ...NO_SCROLL_STYLE }}
        aria-label="Tile Grid board"
      >
        {placed.map((tile, i) => {
          const letter = cells[i];
          const dragging = drag?.moved && drag.from === i;
          return (
            <span
              key={i}
              onPointerDown={tile !== null ? (e) => begin(e, tile, i) : undefined}
              className={`flex items-center justify-center rounded-md font-display text-xl font-bold transition-colors ${
                letter && !dragging
                  ? flash.has(i)
                    ? "bg-warn text-foreground"
                    : "bg-primary text-primary-foreground"
                  : "bg-background/40"
              }`}
              style={{
                height: cellSize,
                boxShadow: letter && !dragging && goodCells.has(i) ? "inset 0 -3px 0 var(--opponent)" : undefined,
              }}
            >
              {dragging ? "" : letter}
            </span>
          );
        })}
      </div>
      </div>
      <div className="flex min-h-[102px] w-[318px] shrink-0 flex-wrap content-start justify-center gap-1.5">
        {inTray.map((tile) => (
          <span
            key={tile}
            onPointerDown={(e) => begin(e, tile, null)}
            className={`flex items-center justify-center rounded-lg bg-primary font-display text-2xl font-bold text-primary-foreground ${drag?.tile === tile && drag.moved ? "opacity-30" : ""}`}
            style={{ width: TRAY_TILE, height: TRAY_TILE, ...NO_SCROLL_STYLE }}
          >
            {tray[tile]}
          </span>
        ))}
      </div>
      <div className="flex w-[318px] shrink-0 items-center gap-2">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          placed <span className="text-primary">{placedCount(cells)}</span> / {TG_TILES}
        </span>
        <Button
          type="button"
          disabled={frozen || checking}
          onClick={() => void done()}
          className="ml-auto h-11 w-28 font-display font-bold uppercase tracking-widest"
        >
          Done
        </Button>
      </div>
      {drag?.moved && (
        <span
          className="pointer-events-none fixed z-50 flex items-center justify-center rounded-lg bg-primary font-display text-2xl font-bold text-primary-foreground shadow-lg"
          style={{ width: TRAY_TILE, height: TRAY_TILE, left: drag.x - TRAY_TILE / 2, top: drag.y - TRAY_TILE / 2 }}
        >
          {tray[drag.tile]}
        </span>
      )}
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  if (puzzle.type !== "tilegrid") return null;
  const mine = decodeTileGrid(myAnswer ?? "");
  const count = placedCount(mine);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <div className="flex flex-wrap justify-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Yours</span>
          <MiniGrid cells={mine} />
        </div>
        {puzzle.solution && (
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">One solution</span>
            <MiniGrid cells={puzzle.solution} />
          </div>
        )}
      </div>
      <p className={`text-center font-mono text-base font-bold ${myCorrect ? "text-primary" : "text-foreground"}`}>
        {myCorrect ? `${count} / ${TG_TILES} tiles · valid` : `${count} / ${TG_TILES} · invalid at the timer`}
      </p>
    </div>
  );
}

export const tileGridPuzzle: PuzzleDefinition = {
  key: "tilegrid",
  name: "Tile Grid",
  category: "word",
  timeLimitMs: TG_TIME_MS,
  revealMs: TG_REVEAL_MS,
  generate: () => ({ type: "tilegrid", tray: [..."STONEBESBAND"] }) satisfies TileGridPuzzleData,
  check: () => false,
  revealHeading: "Your grid",
  IntroExample,
  Stage,
  Reveal,
};
