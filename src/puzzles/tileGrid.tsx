import { gameDisplayName } from "@/lib/duel/gameNames";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { hapticTick } from "@/components/puzzles/GridDrag";
import { Button } from "@/components/ui/button";
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
  tileGridWordCells,
} from "@/lib/duel/tileGrid";
import type { TileGridPuzzleData } from "@/lib/duel/types";
import { playLock, playWrong } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { FoundWordMoment, type AcceptedWordMoment } from "@/components/puzzles/FoundWordMoment";

const GAP = 2;
const TRAY_TILE = 44; // eight per row at 360px, with no overlapping targets

function MiniGrid({ cells, cell = 20 }: { cells: string[]; cell?: number }) {
  return (
    <div
      className="grid rounded-md border border-border bg-card p-0.5"
      style={{ gridTemplateColumns: `repeat(${TG_SIZE}, ${cell}px)`, gap: 1 }}
    >
      {cells.map((letter, i) => (
        <span
          key={i}
          className={`word-letter-tile flex items-center justify-center rounded-[3px] font-display font-bold ${letter ? "bg-primary text-primary-foreground" : "bg-background/40"}`}
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
            className={`word-letter-tile flex h-[30px] items-center justify-center rounded font-display text-sm font-bold ${letter ? "bg-primary text-primary-foreground shadow-[inset_0_-3px_0_var(--opponent)]" : "bg-background/40"}`}
          >
            {letter}
          </span>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">CAT across, and its T starts TOP going down.</p>
    </div>
  );
}

/** Word checks here are background validation: the shared wrapper plays no verdict for them. */
const SILENT_CHECKS = true;
function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit, onDraftAnswer, checkWord, stateKey = "tilegrid" }: PuzzleStageProps) {
  const data: TileGridPuzzleData | null = puzzle.type === "tilegrid" ? puzzle : null;
  /** Which tray tile sits in each cell, or null. */
  const [placed, setPlaced] = useStageState<(number | null)[]>(stateKey, "placed", () =>
    Array.from({ length: TG_CELLS }, () => null),
  );
  const [verdicts, setVerdicts] = useState<Record<string, boolean>>({});
  const [flash, setFlash] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [accepted, setAccepted] = useState<AcceptedWordMoment | null>(null);
  const lastTap = useRef<{ tile: number; time: number } | null>(null);
  const submitted = useRef(false);
  const boardSpace = useRef<HTMLDivElement | null>(null);
  const [cellSize, setCellSize] = useState(40);

  useEffect(() => {
    const space = boardSpace.current;
    if (!space) return;
    const measure = () => setCellSize(Math.max(44, Math.floor(Math.min(
      (space.clientWidth - 12 - GAP * (TG_SIZE - 1)) / TG_SIZE,
      (space.clientHeight - 12 - GAP * (TG_SIZE - 1)) / TG_SIZE,
    ))));
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
      const cached = verdicts[word];
      if (cached !== undefined) return cached;
      if (!checkWord) return false;
      pending.current.add(word);
      const verdict = await checkWord(word, []).catch(() => ({ valid: false }));
      pending.current.delete(word);
      setVerdicts((v) => ({ ...v, [word]: verdict.valid }));
      if (verdict.valid) setAccepted(previous => ({ word, points: "points" in verdict && typeof verdict.points === "number" ? verdict.points : 0, serial: (previous?.serial ?? 0) + 1 }));
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

  const goodCells = useMemo(
    () => tileGridWordCells(cells, (word) => verdicts[word] === true),
    [cells, verdicts],
  );

  if (!data) return null;
  const frozen = locked || submitted.current;
  const inTray = tray.map((_, i) => i).filter((i) => !placed.includes(i));


  const place = (tile: number, hit: number) => {
    if (placed[hit] !== null) return;
    const from = placed.indexOf(tile);
    if (from === hit) return;
    const next = [...placed];
    if (from >= 0) next[from] = null;
    next[hit] = tile;
    hapticTick();
    setPlaced(next);
    setSelected(null);
  };
  const returnToTray = (tile: number) => {
    const from = placed.indexOf(tile);
    if (from < 0) return;
    const next = [...placed]; next[from] = null;
    setPlaced(next); setSelected(null); hapticTick();
  };
  const clearAll = () => {
    if (frozen) return;
    setPlaced(Array.from({ length: TG_CELLS }, () => null));
    setSelected(null);
    hapticTick();
  };
  const tapPlaced = (tile: number) => {
    const previous = lastTap.current;
    const isDouble = previous?.tile === tile && Date.now() - previous.time < 350;
    lastTap.current = isDouble ? null : { tile, time: Date.now() };
    if (isDouble) returnToTray(tile);
    else setSelected((current) => current === tile ? null : tile);
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
    <div data-polish="tilegrid" data-stage-column="1" className="flex min-h-0 flex-1 flex-col items-center gap-1">
      <FoundWordMoment value={accepted} />
      <div ref={boardSpace} data-game-arena="board" className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
      <div
        className="grid shrink-0 rounded-xl border-2 border-border bg-card p-1"
        style={{ gridTemplateColumns: `repeat(${TG_SIZE}, ${cellSize}px)`, gap: GAP }}
        aria-label={`${gameDisplayName("tilegrid")} board`}
      >
        {placed.map((tile, i) => {
          const letter = cells[i];
          return (
            <span
              key={i}
              onClick={() => {
                if (frozen) return;
                if (tile !== null) tapPlaced(tile);
                else if (selected !== null) place(selected, i);
              }}
              className={`word-letter-tile interlock-cell flex items-center justify-center rounded-md font-display text-xl font-bold transition-colors ${
                letter
                  ? flash.has(i)
                    ? "bg-warn text-foreground"
                    : "bg-primary text-primary-foreground"
                  : selected !== null ? "bg-primary/15" : "bg-background/40"
              } ${selected === tile && tile !== null ? "ring-2 ring-primary shadow-[0_0_16px_var(--primary)]" : ""}`}
              style={{
                height: cellSize,
                boxShadow: letter && goodCells.has(i) ? "inset 0 -3px 0 var(--opponent)" : undefined,
              }}
            >
              {letter}
            </span>
          );
        })}
      </div>
      </div>
      <div onClick={(event) => {
        if (selected === null || event.target !== event.currentTarget || placed.indexOf(selected) < 0) return;
        returnToTray(selected);
      }} data-game-controls="tray" className="interlock-tray grid w-full shrink-0 grid-cols-8 justify-items-center">
        {inTray.map((tile) => (
          <span
            key={tile}
            onClick={() => { if (!frozen) setSelected((current) => current === tile ? null : tile); }}
            className={`word-letter-tile flex items-center justify-center rounded-lg bg-primary font-display text-xl font-bold text-primary-foreground ${selected === tile ? "ring-2 ring-primary shadow-[0_0_16px_var(--primary)]" : ""}`}
            style={{ width: TRAY_TILE, height: TRAY_TILE }}
          >
            {tray[tile]}
          </span>
        ))}
      </div>
      <div data-game-controls="actions" className="flex w-full shrink-0 items-center gap-2">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          placed <span className="text-primary">{goodCells.size}</span> / {TG_TILES}
        </span>
        <Button
          type="button"
          variant="ghost"
          disabled={frozen || placedCount(cells) === 0}
          onClick={clearAll}
          className="ml-auto h-11 w-24 font-display font-bold uppercase tracking-widest text-muted-foreground"
        >
          Clear
        </Button>
        <Button
          type="button"
          disabled={frozen || checking}
          onClick={() => void done()}
          className="h-11 w-28 font-display font-bold uppercase tracking-widest"
        >
          Done
        </Button>
      </div>
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
  name: gameDisplayName("tilegrid"),
  category: "word",
  timeLimitMs: TG_TIME_MS,
  revealMs: TG_REVEAL_MS,
  generate: () => ({ type: "tilegrid", tray: [..."PLANETSCOMLEXBN"] }) satisfies TileGridPuzzleData,
  check: () => false,
  revealHeading: "Your grid",
  IntroExample,
  Stage,
  Reveal,
};
(Stage as { silentWordChecks?: boolean }).silentWordChecks = SILENT_CHECKS;
