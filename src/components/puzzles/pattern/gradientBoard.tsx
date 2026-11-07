/**
 * Jumbled tilesRev 3 (the remodel; jumbled.ts, docs/depth/d5-remodels.md): the gradient board, the live stage,
 * the reveal and the intro still. The tray and bevelled tiles keep Jumbled's polished look (tiles.css, batch P);
 * the drag, wrap and anchors are new (jumbled.css).
 *
 * A drag picks its line by its first clear direction: across = the touched row, up or down = the touched column.
 * The line follows the finger, wrapping round (five copies of the line slide inside a box clipped to it), and on
 * release settles on the nearest step; only then is the slide recorded. Anchors (the corners, dotted) never move:
 * the edge lines slide their middle three tiles. The board only shows what replayJumbled decided.
 *
 * Gradient, tilesRev 4 (27 Oct 2026, Joe's phone notes; jumbled.ts): the round's own colour scheme, and a move is a
 * swap: tap a tile, then another (or drag one onto another). A tile on its own cell locks and shows the anchors'
 * dot; a locked tile can't be picked. The board only shows what replayGradient decided.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactElement } from "react";

import { useGridMetrics, usePrefersReducedMotion } from "@/components/puzzles/GridDrag";
import { useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import { FramePills, parPills } from "@/components/puzzles/pattern/framePills";
import { useNoTouchScroll } from "@/components/puzzles/noScroll";
import { useGameKeys } from "@/lib/desktop";
import {
  JUMBLED_CORNERS,
  JUMBLED_MOVABLE,
  JUMBLED_N,
  JUMBLED_RESET,
  JUMBLED_UNDO,
  encodeGradient,
  encodeJumbled,
  gradientLocked,
  isGradientSwap,
  replayGradient,
  replayGradientAnswer,
  jumbledPalette,
  jumbledProgress,
  lineCells,
  replayJumbled,
  solvedJumbled,
  type GradientSwap,
  type JumbledMove,
  type JumbledToken,
  type LineKind,
} from "@/lib/duel/jumbled";
import { useStageState } from "@/lib/duel/stageState";
import type { TilesPuzzleData } from "@/lib/duel/types";
import { rightMoveFlash, wrongMoveFlash } from "@/lib/fx/gameToolkit";
import { soundCue, useSolveMoment } from "@/lib/fx/patternFx";
import { playLock, playTick } from "@/lib/sound";
import type { PuzzleRevealProps, PuzzleStageProps } from "@/puzzles/types";

import "@/polish-pattern/jumbled.css";

/** The number toggle (tile numbers 1–25 in reading order), remembered on this device. */
const NUMBERS_KEY = "duelz-jumbled-numbers:v1";
function readNumbers(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(NUMBERS_KEY) === "1";
  } catch {
    return false;
  }
}
function writeNumbers(on: boolean): void {
  try {
    window.localStorage.setItem(NUMBERS_KEY, on ? "1" : "0");
  } catch {
    /* storage is optional */
  }
}

/** Pixels before a touch commits to a row or a column. */
const AXIS_SLOP = 8;
/** The settle onto the nearest step. */
const SETTLE_MS = 110;

interface Drag {
  kind: LineKind;
  index: number;
  /** Px along the line (right / down positive). */
  offset: number;
  settling: boolean;
}

const isCorner = (cell: number) => JUMBLED_CORNERS.includes(cell);

/** Light tiles take dark numerals (and a dark anchor dot already reads on every tile). */
function isLight(hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42;
}

/* ------------------------------------------------------------------ the board */

export interface GradientBoardProps {
  frame: readonly number[];
  /** Square size in px. */
  size: number;
  numbers?: boolean;
  /** Live round: tiles in place glow, a tile slid home flashes. */
  showHome?: boolean;
  celebrate?: boolean;
  /** When set, the board takes drags and reports a finished slide. */
  onSlide?: ((move: JumbledMove) => void) | undefined;
  /** tilesRev 4: the round's colours (cell by cell); absent = the fixed tilesRev 3 gradient. */
  palette?: readonly string[] | undefined;
  /** tilesRev 4: tiles home are locked (dotted like the anchors). */
  locks?: boolean;
  /** tilesRev 4: the picked tile's cell. */
  selected?: number | null;
  /** tilesRev 4: a tap on a cell, or a drag from one cell onto another (swap mode; no slides). */
  onTapCell?: ((cell: number) => void) | undefined;
  onDragSwap?: ((swap: GradientSwap) => void) | undefined;
}

export function GradientBoard({
  frame,
  size,
  numbers = false,
  showHome = false,
  celebrate = false,
  onSlide,
  palette: ownPalette,
  locks = false,
  selected = null,
  onTapCell,
  onDragSwap,
}: GradientBoardProps) {
  const palette = ownPalette ?? jumbledPalette();
  const swapMode = Boolean(onTapCell);
  const boardRef = useRef<HTMLDivElement | null>(null);
  useNoTouchScroll(boardRef);
  const reduced = usePrefersReducedMotion();
  const pad = Math.max(4, Math.round(size * 0.018));
  const gap = Math.max(3, Math.round(size * 0.014));
  const step = (size - 2 * pad + gap) / JUMBLED_N;
  const tile = step - gap;
  const [drag, setDrag] = useState<Drag | null>(null);
  const start = useRef<{ x: number; y: number; cell: number; id: number } | null>(null);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;

  // A tile that has just arrived home flashes once (live round only).
  const before = useRef<readonly number[] | null>(null);
  useEffect(() => {
    const prev = before.current;
    before.current = frame;
    if (!showHome || !prev || prev.join() === frame.join()) return;
    const root = boardRef.current;
    if (!root) return;
    frame.forEach((t, cell) => {
      if (t === cell && prev[cell] !== cell && !isCorner(cell)) rightMoveFlash(root.querySelector(`[data-cell="${cell}"]`));
    });
  }, [frame, showHome]);

  const cellAt = (x: number, y: number): number | null => {
    const c = Math.floor((x - pad + gap / 2) / step);
    const r = Math.floor((y - pad + gap / 2) / step);
    return r >= 0 && r < JUMBLED_N && c >= 0 && c < JUMBLED_N ? r * JUMBLED_N + c : null;
  };

  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (swapMode) {
      const rect = event.currentTarget.getBoundingClientRect();
      const cell = cellAt(event.clientX - rect.left, event.clientY - rect.top);
      if (cell === null) return;
      event.preventDefault();
      start.current = { x: event.clientX, y: event.clientY, cell, id: event.pointerId };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }
    if (!onSlide || dragRef.current?.settling) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const cell = cellAt(event.clientX - rect.left, event.clientY - rect.top);
    if (cell === null) return;
    event.preventDefault();
    start.current = { x: event.clientX, y: event.clientY, cell, id: event.pointerId };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s || s.id !== event.pointerId || swapMode) return;
    const dx = event.clientX - s.x;
    const dy = event.clientY - s.y;
    const current = dragRef.current;
    if (!current) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_SLOP) return;
      const kind: LineKind = Math.abs(dx) >= Math.abs(dy) ? "R" : "C";
      const index = kind === "R" ? Math.floor(s.cell / JUMBLED_N) : s.cell % JUMBLED_N;
      if (!lineCells(kind, index).includes(s.cell)) {
        // An anchor: it never moves.
        start.current = null;
        wrongMoveFlash(boardRef.current?.querySelector(`[data-cell="${s.cell}"]`));
        return;
      }
      setDrag({ kind, index, offset: kind === "R" ? dx : dy, settling: false });
      return;
    }
    if (current.settling) return;
    setDrag({ ...current, offset: current.kind === "R" ? dx : dy });
  };

  const up = (event: ReactPointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s || s.id !== event.pointerId) return;
    start.current = null;
    if (swapMode) {
      // A tap picks (or swaps with the picked tile); a drag from one tile onto another swaps the two.
      const rect = event.currentTarget.getBoundingClientRect();
      const end = cellAt(event.clientX - rect.left, event.clientY - rect.top);
      const moved = Math.max(Math.abs(event.clientX - s.x), Math.abs(event.clientY - s.y)) >= step / 2;
      if (moved && end !== null && end !== s.cell && onDragSwap) onDragSwap({ a: s.cell, b: end });
      else onTapCell?.(s.cell);
      return;
    }
    const current = dragRef.current;
    if (!current || current.settling) return;
    const len = lineCells(current.kind, current.index).length;
    const loopPx = len * step;
    const steps = Math.round(Math.max(-1.5 * loopPx, Math.min(1.5 * loopPx, current.offset)) / step);
    const shift = ((steps % len) + len) % len;
    const commit = () => {
      setDrag(null);
      if (shift !== 0) onSlide?.({ kind: current.kind, index: current.index, shift });
    };
    // Reduced motion or reduced effects: the slide lands at once, no settle.
    if (reduced || document.documentElement.hasAttribute("data-reduced-effects")) return commit();
    setDrag({ ...current, offset: steps * step, settling: true });
    setTimeout(commit, SETTLE_MS);
  };

  const cancel = () => {
    start.current = null;
    if (dragRef.current && !dragRef.current.settling) setDrag(null);
  };

  const dragCells = drag ? lineCells(drag.kind, drag.index) : [];
  const hidden = new Set(dragCells);
  const pos = (cell: number) => ({ left: pad + (cell % JUMBLED_N) * step, top: pad + Math.floor(cell / JUMBLED_N) * step });

  const tileEl = (t: number, cell: number | null, style: CSSProperties, key: string) => {
    const home = cell !== null && t === cell;
    const r = Math.floor(t / JUMBLED_N);
    const c = t % JUMBLED_N;
    return (
      <span
        key={key}
        data-cell={cell ?? undefined}
        data-tile={t}
        data-home={showHome && home && !isCorner(t) ? "" : undefined}
        data-anchor={isCorner(t) || (locks && home) ? "" : undefined}
        data-locked={locks && home && !isCorner(t) ? "" : undefined}
        data-selected={cell !== null && cell === selected ? "" : undefined}
        className="tiles-tile jumbled-tile"
        style={{
          ...style,
          width: tile,
          height: tile,
          borderRadius: Math.max(3, Math.round(tile * 0.14)),
          background: palette[t],
          ["--tile-fill" as string]: palette[t],
          ["--tile-order" as string]: r + c,
        }}
      >
        {numbers ? <span className="tiles-numeral jumbled-numeral" data-dark={isLight(palette[t]!) ? "" : undefined}>{t + 1}</span> : null}
      </span>
    );
  };

  // The dragged line: three copies of its tiles slide inside a box clipped to the line.
  let strip: ReactElement | null = null;
  if (drag) {
    const len = dragCells.length;
    const first = pos(dragCells[0]!);
    const span = len * step - gap;
    const loop = len * step;
    // Five copies of the line, the middle one at rest: a drag of up to one and a half turns either way stays
    // covered, and the settle runs straight to its step (no wrap jump).
    const off = Math.max(-1.5 * loop, Math.min(1.5 * loop, drag.offset));
    const horizontal = drag.kind === "R";
    const tiles = dragCells.map((cell) => frame[cell]!);
    strip = (
      <div
        className="jumbled-strip"
        data-jumbled-strip=""
        style={{ left: first.left, top: first.top, width: horizontal ? span : tile, height: horizontal ? tile : span }}
      >
        <div
          className="jumbled-strip-run"
          style={{
            transform: horizontal ? `translateX(${off - 2 * loop}px)` : `translateY(${off - 2 * loop}px)`,
            transition: drag.settling ? `transform ${SETTLE_MS}ms cubic-bezier(.22,.8,.28,1)` : "none",
          }}
        >
          {[0, 1, 2, 3, 4].flatMap((copy) =>
            tiles.map((t, k) =>
              tileEl(t, null, horizontal ? { left: (copy * len + k) * step, top: 0 } : { left: 0, top: (copy * len + k) * step }, `s${copy}-${k}`),
            ),
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={boardRef}
      className="tiles-frame jumbled-frame puzzle-board"
      data-jumbled-board=""
      data-celebrate={celebrate ? "on" : undefined}
      data-dragging={drag ? "" : undefined}
      style={{ width: size, height: size }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={cancel}
      aria-label="Colour gradient board"
      data-gradient-swap={swapMode ? "" : undefined}
    >
      {frame.map((t, cell) =>
        hidden.has(cell) ? null : tileEl(t, cell, pos(cell), `t${t}`),
      )}
      {strip}
    </div>
  );
}

/* ------------------------------------------------------------------ the live stage */

export function GradientStage(props: PuzzleStageProps) {
  return isGradientSwap(props.puzzle) ? <GradientSwapStage {...props} /> : <GradientSlideStage {...props} />;
}

/** tilesRev 4 (Gradient): tap a tile, then another, to swap them; tiles home lock. */
function GradientSwapStage({ puzzle, phaseStartedAt, now, locked, onSubmit, onDraftAnswer, stateKey = "tiles" }: PuzzleStageProps) {
  const data = puzzle as TilesPuzzleData;
  const [swaps, setSwaps] = useStageState<GradientSwap[]>(stateKey, "gradientSwaps", () => []);
  const [selected, setSelected] = useState<number | null>(null);
  const [numbers, setNumbers] = useState(readNumbers);
  const submitted = useRef(false);
  const replay = useMemo(() => replayGradient(data.frame, swaps), [data.frame, swaps]);
  const par = data.par ?? 0;
  const celebrate = useSolveMoment(replay.solved, "tiles.solve");
  const inFrame = useFrameProgress(replay.inPlace, JUMBLED_MOVABLE, "in place");
  const spaceRef = useRef<HTMLDivElement | null>(null);
  const space = useGridMetrics(spaceRef, 1, 1);
  const boardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    onDraftAnswer?.(encodeGradient(swaps));
  }, [swaps, onDraftAnswer]);

  useEffect(() => {
    if (locked || submitted.current) return;
    if (now < phaseStartedAt + (data.timeLimitMs ?? 120_000) - 400) return;
    submitted.current = true;
    onSubmit(encodeGradient(swaps));
  }, [now, phaseStartedAt, locked, data.timeLimitMs, swaps, onSubmit]);

  const blocked = locked || submitted.current || replay.solved;
  const tileAt = (cell: number) => boardRef.current?.querySelector(`[data-cell="${cell}"]`);

  const swap = (a: number, b: number) => {
    setSelected(null);
    if (blocked) return;
    if (gradientLocked(replay.frame, a) || gradientLocked(replay.frame, b)) {
      wrongMoveFlash(tileAt(gradientLocked(replay.frame, a) ? a : b) ?? null);
      return;
    }
    const next = [...swaps, { a, b }];
    const after = replayGradient(data.frame, next);
    soundCue("tiles.slide");
    if (after.inPlace > replay.inPlace) playLock();
    else playTick(0.6);
    setSwaps(next);
    if (after.solved) {
      submitted.current = true;
      onSubmit(encodeGradient(next));
    }
  };

  const tap = (cell: number) => {
    if (blocked) return;
    if (gradientLocked(replay.frame, cell)) {
      // A locked tile (home, or a corner anchor) can't be picked.
      wrongMoveFlash(tileAt(cell) ?? null);
      return;
    }
    if (selected === null) setSelected(cell);
    else if (selected === cell) setSelected(null);
    else swap(selected, cell);
  };

  useGameKeys((kind, key) => {
    if (key !== "Escape" || kind !== "down") return false;
    setSelected(null);
    return true;
  });

  const toggleNumbers = () => {
    setNumbers((on) => {
      writeNumbers(!on);
      return !on;
    });
  };

  const size = space ? Math.max(0, Math.floor(Math.min(space.width, space.height, 460))) : 0;

  return (
    <div data-stage-column="3" data-polish="tiles-gradient" className="flex min-h-0 flex-1 flex-col items-center gap-2">
      <div ref={spaceRef} data-game-arena="board" className="jumbled-arena flex min-h-0 w-full flex-1 items-center justify-center">
        <div ref={boardRef}>
          {size ? (
            <GradientBoard
              frame={replay.frame}
              size={size}
              numbers={numbers}
              showHome
              celebrate={celebrate}
              palette={jumbledPalette(data)}
              locks
              selected={selected}
              onTapCell={blocked ? undefined : tap}
              onDragSwap={blocked ? undefined : (s) => swap(s.a, s.b)}
            />
          ) : null}
        </div>
      </div>
      {inFrame ? (
        <FramePills testId="tiles" items={parPills("Swaps", replay.moves, par)} />
      ) : (
        <p data-after-arena data-game-controls="status" className="shrink-0 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          swaps <span className="text-primary">{replay.moves}</span> · par <span className="text-primary">{par}</span>
        </p>
      )}
      <div data-game-controls="actions" className="flex shrink-0 gap-3 px-2">
        <button
          type="button"
          aria-pressed={numbers}
          aria-label="Show tile numbers"
          onClick={toggleNumbers}
          className="jumbled-numbers-toggle flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-foreground"
        >
          {/* Puzzle polish (3 Nov 2026): the toggle says what it does. */}
          <span aria-hidden="true" className="font-mono text-xs font-bold">123</span>
          <span className="text-sm font-semibold">Numbers</span>
        </button>
      </div>
    </div>
  );
}

/** tilesRev 3: row and column slides. */
function GradientSlideStage({ puzzle, phaseStartedAt, now, locked, onSubmit, onDraftAnswer, stateKey = "tiles" }: PuzzleStageProps) {
  const data = puzzle as TilesPuzzleData;
  const [tokens, setTokens] = useStageState<JumbledToken[]>(stateKey, "jumbledMoves", () => []);
  const [numbers, setNumbers] = useState(readNumbers);
  const submitted = useRef(false);
  const replay = useMemo(() => replayJumbled(data.frame, tokens), [data.frame, tokens]);
  const par = data.par ?? 0;
  const celebrate = useSolveMoment(replay.solved, "tiles.solve");
  const inFrame = useFrameProgress(replay.inPlace, JUMBLED_MOVABLE, "in place");
  const spaceRef = useRef<HTMLDivElement | null>(null);
  const space = useGridMetrics(spaceRef, 1, 1);

  useEffect(() => {
    onDraftAnswer?.(encodeJumbled(tokens));
  }, [tokens, onDraftAnswer]);

  useEffect(() => {
    if (locked || submitted.current) return;
    if (now < phaseStartedAt + (data.timeLimitMs ?? 120_000) - 400) return;
    submitted.current = true;
    onSubmit(encodeJumbled(tokens));
  }, [now, phaseStartedAt, locked, data.timeLimitMs, tokens, onSubmit]);

  const blocked = locked || submitted.current || replay.solved;

  const slide = (move: JumbledMove) => {
    if (blocked) return;
    const next = [...tokens, move];
    const after = replayJumbled(data.frame, next);
    soundCue("tiles.slide");
    playTick(0.6);
    setTokens(next);
    if (after.solved) {
      submitted.current = true;
      playLock();
      onSubmit(encodeJumbled(next));
    }
  };

  const mark = (token: typeof JUMBLED_UNDO | typeof JUMBLED_RESET) => {
    if (blocked || replay.moves === 0) return;
    setTokens([...tokens, token]);
  };

  useGameKeys((kind, key, event) => {
    const used = key === "z" || key === "Backspace" || key === "r";
    if (!used || kind !== "down" || event.repeat) return used;
    mark(key === "r" ? JUMBLED_RESET : JUMBLED_UNDO);
    return true;
  });

  const toggleNumbers = () => {
    setNumbers((on) => {
      writeNumbers(!on);
      return !on;
    });
  };

  const size = space ? Math.max(0, Math.floor(Math.min(space.width, space.height, 460))) : 0;

  return (
    <div data-stage-column="3" data-polish="tiles-gradient" className="flex min-h-0 flex-1 flex-col items-center gap-2">
      <div ref={spaceRef} data-game-arena="board" className="jumbled-arena flex min-h-0 w-full flex-1 items-center justify-center">
        {size ? <GradientBoard frame={replay.frame} size={size} numbers={numbers} showHome celebrate={celebrate} onSlide={blocked ? undefined : slide} /> : null}
      </div>
      {inFrame ? (
        <FramePills testId="tiles" items={parPills("Moves", replay.moves, par)} />
      ) : (
        <p data-after-arena data-game-controls="status" className="shrink-0 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          moves <span className="text-primary">{replay.moves}</span> · par <span className="text-primary">{par}</span>
        </p>
      )}
      <div data-game-controls="actions" className="flex shrink-0 gap-3 px-2">
        <button
          type="button"
          onPointerDown={() => mark(JUMBLED_UNDO)}
          className="h-11 w-24 rounded-xl border border-border bg-card font-display text-sm font-bold uppercase tracking-widest text-foreground"
        >
          Undo
        </button>
        <button
          type="button"
          onPointerDown={() => mark(JUMBLED_RESET)}
          className="h-11 w-24 rounded-xl border border-border bg-card font-display text-sm font-bold uppercase tracking-widest text-foreground"
        >
          Reset
        </button>
        <button
          type="button"
          aria-pressed={numbers}
          aria-label="Show tile numbers"
          onClick={toggleNumbers}
          className="jumbled-numbers-toggle flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-foreground"
        >
          {/* Puzzle polish (3 Nov 2026): the toggle says what it does. */}
          <span aria-hidden="true" className="font-mono text-xs font-bold">123</span>
          <span className="text-sm font-semibold">Numbers</span>
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ reveal */

export function GradientReveal({ puzzle, myAnswer, myCorrect, scoreParts }: PuzzleRevealProps) {
  const data = puzzle as TilesPuzzleData;
  const replay = replayGradientAnswer(data, myAnswer);
  const swaps = isGradientSwap(data);
  const spaceRef = useRef<HTMLDivElement | null>(null);
  const space = useGridMetrics(spaceRef, 1, 1);
  const size = space ? Math.max(0, Math.floor(Math.min(space.width, space.height, 300))) : 0;
  const par = data.par ?? 0;
  const parts = scoreParts && scoreParts.kind === "finish" ? `${scoreParts.base} + ${scoreParts.efficiency ?? 0} par + ${scoreParts.speed ?? 0} speed` : null;
  return (
    <div className="tiles-reveal jumbled-reveal flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3" data-jumbled-reveal="">
      <div ref={spaceRef} className="jumbled-reveal-space">
        {size ? <GradientBoard frame={replay.solved ? solvedJumbled() : replay.frame} size={size} palette={jumbledPalette(data)} locks={swaps && !replay.solved} /> : null}
      </div>
      <p className={`whitespace-normal break-words text-center font-mono text-base font-bold ${myCorrect ? "text-primary" : "text-foreground"}`}>
        {replay.solved
          ? `Solved in ${replay.moves} ${swaps ? "swaps" : "moves"} · par ${par}${data.minMoves ? ` · best ${data.minMoves}` : ""}`
          : `${replay.inPlace} / ${JUMBLED_MOVABLE} in place · ${Math.round(jumbledProgress(data.frame, replay.frame) * 100)} % rebuilt`}
      </p>
      {parts ? <p className="font-mono text-base text-primary">{parts}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ intro still */

/**
 * Gradient's intro still (tilesRev 4; fixed, never randomised): one of the round colour schemes, two tiles swapped,
 * and the board after the swap with both locked.
 */
const INTRO_PALETTE: readonly string[] = [
  "#482501", "#6d3919", "#914f37", "#b76755", "#df7f74", "#672e21", "#87453b", "#a95d57", "#cc7674", "#f09091",
  "#843941", "#a2525b", "#c16c76", "#e18692", "#ffa4b0", "#a24261", "#be5e7a", "#da7a95", "#f796b0", "#fdc1cf",
  "#c14c81", "#db6a9a", "#f488b4", "#fdb1ce", "#fedbe7",
];
const INTRO_SWAP: GradientSwap = { a: 7, b: 17 };
const INTRO_AFTER = solvedJumbled();
const INTRO_BEFORE = (() => {
  const f = solvedJumbled();
  [f[INTRO_SWAP.a], f[INTRO_SWAP.b]] = [f[INTRO_SWAP.b]!, f[INTRO_SWAP.a]!];
  return f;
})();

export function GradientIntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2" data-jumbled-intro="">
      <div className="flex items-center gap-3">
        <GradientBoard frame={INTRO_BEFORE} size={124} palette={INTRO_PALETTE} locks selected={INTRO_SWAP.a} />
        <span className="font-mono text-xs text-muted-foreground">→</span>
        <GradientBoard frame={INTRO_AFTER} size={124} palette={INTRO_PALETTE} locks />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Tap two tiles to swap them. A tile in its right place locks (dotted) and can’t move. Every round has new colours.
      </p>
    </div>
  );
}

export const JUMBLED_INTRO = { before: INTRO_BEFORE, swap: INTRO_SWAP, after: INTRO_AFTER };
