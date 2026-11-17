import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  BlockArtDefs,
  BlockBoardArt,
  BlockDropFlash,
  BlockPiecesArt,
  BlockSweepFx,
  BlockColsContext,
  PieceArt,
  sweepDelay,
} from "@/components/puzzles/pattern/blockPartyArt";
import { gameFx, releaseGameFx } from "@/lib/fx/kit";
import { soundCue, useSolveMoment } from "@/lib/fx/patternFx";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import {
  gridColRowAt,
  type DragInfo,
  liftStyle,
  useDragSnap,
  usePrefersReducedMotion,
} from "@/components/puzzles/GridDrag";
import {
  absoluteCells,
  blockGeometry,
  encodeBlockAnswer,
  encodePlacements,
  offsetsSize,
  orientationOffsets,
  tapPose,
  type Offsets,
} from "@/lib/duel/blockParty";
import {
  BLOCK_COLS as N,
  BLOCK_TIME_MS,
  type BlockPartyPuzzleData,
  type BlockPlacement,
} from "@/lib/duel/types";
import { useBeforePaint } from "@/components/puzzles/useBeforePaint";
import { useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import { Button } from "@/design/components/Button";
import { useGameKeys } from "@/lib/desktop";
import { usesPatternNov15 } from "@/lib/duel/patternNov15";

/** One distinct fill per piece, shared by the tray and board. */
const PIECE_COLOURS = [
  GLYPH_COLOURS.RED,
  GLYPH_COLOURS.BLUE,
  GLYPH_COLOURS.GREEN,
  GLYPH_COLOURS.PURPLE,
  GLYPH_COLOURS.PINK,
  GLYPH_COLOURS.ORANGE,
  GLYPH_COLOURS.BROWN,
  GLYPH_COLOURS.YELLOW,
  "var(--color-foreground)",
  // Stage 3 (levels): Expert's U and P, as their sprites (blockparty.py cyan, slate).
  "#2FD3EE",
  "#7F8AA3",
];

const pct = (value: number, n: number = N) => `${(value * 100) / n}%`;

type Size = { width: number; height: number };
/** A state update that keeps the current size (no re-render) when the new one is within half a pixel. */
const sameSize = (next: Size) => (current: Size) =>
  Math.abs(current.width - next.width) < 0.5 && Math.abs(current.height - next.height) < 0.5 ? current : next;

export function pieceColour(piece: number): string {
  return PIECE_COLOURS[piece] ?? "var(--color-foreground)";
}

/** A small drawing of one piece, used in the tray. */
function PieceGlyph({
  offsets,
  piece,
  cell,
  onCellPointerDown,
  turn,
}: {
  offsets: Offsets;
  /** The piece's index (its colour). */
  piece: number;
  cell: number;
  onCellPointerDown?:
    ((event: React.PointerEvent<HTMLDivElement>, row: number, col: number) => void) | undefined;
  /** The tap that just changed this piece's pose, for a short turn animation. */
  turn?: "turn" | "flip" | undefined;
}) {
  const { rows, cols } = offsetsSize(offsets);
  return (
    <div
      className={`relative ${turn === "turn" ? "bp-glyph-turn" : turn === "flip" ? "bp-glyph-flip" : ""}`}
      style={{ width: cols * cell, height: rows * cell, touchAction: "none" }}
      aria-hidden="true"
    >
      {/* The hit cells (unchanged geometry), then the art beneath them. */}
      {offsets.map(([r, c], index) => (
        <div
          key={index}
          onPointerDown={onCellPointerDown ? (event) => onCellPointerDown(event, r, c) : undefined}
          className="absolute z-[1]"
          style={{
            left: c * cell,
            top: r * cell,
            width: cell - 2,
            height: cell - 2,
          }}
        />
      ))}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        viewBox={`0 0 ${cols * 100} ${rows * 100}`}
        aria-hidden="true"
      >
        <PieceArt cells={offsets} piece={piece} tray />
      </svg>
    </div>
  );
}

/** The pegged board with a set of placements drawn on it. */
export function BlockBoard({
  blockers,
  placements,
  size,
  children,
  boardRef,
  flash,
  celebrate,
  cols = N,
}: {
  blockers: number[];
  placements: BlockPlacement[];
  /** The board's width in cells (7 on blockRev 1). */
  cols?: number;
  size?: number;
  children?: React.ReactNode;
  boardRef?: React.Ref<HTMLDivElement>;
  /** Stage only (stage 2): the last drop, whose covered squares flash once (`n` counts drops). */
  flash?: { cells: number[]; n: number } | null | undefined;
  /** Stage only: the completion shine is running. */
  celebrate?: boolean;
}) {
  const wave = useMemo(() => {
    if (!celebrate) return null;
    return new Map(placements.map((placement) => [placement.piece, sweepDelay(placement.cells, cols)]));
  }, [celebrate, placements, cols]);
  return (
    <BlockColsContext.Provider value={cols}>
    <BlockArtDefs>
      <div
        ref={boardRef}
        className="bp-board relative aspect-square w-full"
        data-celebrate={celebrate ? "on" : undefined}
        style={size ? { width: size, height: size } : undefined}
      >
        <BlockBoardArt blockers={blockers} />
        <BlockPiecesArt placements={placements} colourFor={pieceColour} wave={wave} />
        {flash ? <BlockDropFlash key={flash.n} cells={flash.cells} /> : null}
        {celebrate && <BlockSweepFx blockers={blockers} />}
        {children}
      </div>
    </BlockArtDefs>
    </BlockColsContext.Provider>
  );
}

interface DragItem {
  piece: number;
  from: "tray" | "board";
  grabR: number;
  grabC: number;
}

interface BlockPartyPuzzleProps {
  puzzle: BlockPartyPuzzleData;
  phaseStartedAt: number;
  now: number;
  locked: boolean;
  onSubmit: (answer: string) => void;
  /** The answer as it stands, for the room's time-out (a reveal that arrives before this stage locks in). */
  onDraftAnswer?: ((answer: string) => void) | undefined;
}

/**
 * How long a tap waits for a second tap before it turns the piece (the Pattern overhaul, 15 Nov 2026): a double tap
 * only flips, so the turn is shown once the window has passed. Display and sound only (the pose is the same).
 */
export const DOUBLE_TAP_MS = 260;

export function BlockPartyPuzzle({
  puzzle,
  phaseStartedAt,
  now,
  locked,
  onSubmit,
  onDraftAnswer,
}: BlockPartyPuzzleProps) {
  const reduced = usePrefersReducedMotion();
  // blockRev 1 (depth batch 4): the 7×7 board, sixteen pegs and nine pieces (a Plus for the Dot).
  const geo = blockGeometry(puzzle);
  const n = geo.cols;
  // blockRev 4 (the Pattern overhaul): Undo and Reset, and the answer reports its illegal drops.
  const overhaul = usesPatternNov15(puzzle, "blockparty");
  const layoutRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [layoutSize, setLayoutSize] = useState({ width: 348, height: 480 });
  const [traySize, setTraySize] = useState({ width: 348, height: 234 });
  const [actionsH, setActionsH] = useState(0);
  const readSizes = useRef<(() => void) | null>(null);
  const [placed, setPlaced] = useState<BlockPlacement[]>([]);
  const [history, setHistory] = useState<BlockPlacement[][]>([]);
  const [illegal, setIllegal] = useState(0);
  const [pose, setPose] = useState<Record<number, { rot: number; flip: boolean }>>({});
  // A single tap's turn, held back for the double-tap window: the pose the piece shows until then.
  const [held, setHeld] = useState<{ piece: number; pose: { rot: number; flip: boolean } } | null>(null);
  const heldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ghost, setGhost] = useState<{ cells: number[]; legal: boolean } | null>(null);
  const lastTap = useRef<{ piece: number; at: number } | null>(null);
  const lifted = useRef<number | null>(null);
  // The last legal drop (stage 2): the piece's drop effect and its squares' flash play once for each.
  const [returning, setReturning] = useState<number | null>(null);
  const [drop, setDrop] = useState<{ piece: number; cells: number[]; n: number } | null>(null);
  const submitted = useRef(false);
  const placedRef = useRef<BlockPlacement[]>([]);
  placedRef.current = placed;
  const illegalRef = useRef(0);
  illegalRef.current = illegal;

  const encode = useCallback(
    (list: BlockPlacement[], drops: number) => (overhaul ? encodeBlockAnswer(list, drops) : encodePlacements(list)),
    [overhaul],
  );

  const offsetsFor = useCallback(
    (piece: number) => {
      const state = pose[piece] ?? { rot: 0, flip: false };
      return orientationOffsets(piece, state.rot, state.flip, geo.pieces);
    },
    [pose],
  );
  /** What the tray shows: a turn still inside the double-tap window shows the pose before it. */
  const shownOffsetsFor = useCallback(
    (piece: number) =>
      held?.piece === piece ? orientationOffsets(piece, held.pose.rot, held.pose.flip, geo.pieces) : offsetsFor(piece),
    [held, offsetsFor],
  );

  const covered = placed.reduce((sum, entry) => sum + entry.cells.length, 0);
  const celebrating = useSolveMoment(covered >= geo.free, "blockparty.solve");
  const inFrame = useFrameProgress(covered, geo.free, "covered");
  const [turned, setTurned] = useState<{ piece: number; kind: "turn" | "flip"; n: number } | null>(
    null,
  );

  /** Shows a held turn now (the window passed, or the piece is being dragged). */
  const heldRef = useRef(held);
  heldRef.current = held;
  const releaseHeld = useCallback((sound: boolean) => {
    if (heldTimer.current) clearTimeout(heldTimer.current);
    heldTimer.current = null;
    const current = heldRef.current;
    if (!current) return;
    heldRef.current = null;
    setHeld(null);
    setTurned((t) => ({ piece: current.piece, kind: "turn", n: (t?.n ?? 0) + 1 }));
    if (sound) soundCue("blockparty.turn");
  }, []);
  useEffect(() => () => {
    if (heldTimer.current) clearTimeout(heldTimer.current);
  }, []);

  const lockIn = useCallback(
    (final: BlockPlacement[]) => {
      if (submitted.current) return;
      submitted.current = true;
      onSubmit(encode(final, illegalRef.current));
    },
    [onSubmit, encode],
  );

  // Every change goes to the room as a draft, so a reveal that arrives before this stage locks in
  // (a backgrounded phone, a stalled clock) still sends the answer as it stands, never "".
  useEffect(() => {
    onDraftAnswer?.(encode(placed, illegal));
  }, [placed, illegal, onDraftAnswer, encode]);

  useEffect(() => {
    if (locked) return;
    // A level's own clock (stage 3: Expert's 90 s), else the game's 60 s.
    const remaining = phaseStartedAt + (puzzle.timeLimitMs ?? BLOCK_TIME_MS) - now;
    if (remaining <= 600) lockIn(placedRef.current);
  }, [locked, now, phaseStartedAt, lockIn, puzzle.timeLimitMs]);

  /** A new board: Undo can give it back (blockRev 4). */
  const commit = useCallback((next: BlockPlacement[]) => {
    const before = placedRef.current;
    setHistory((current) => [...current, before]);
    setPlaced(next);
  }, []);

  /** Where the piece would land if dropped with the pointer here (`over`: the pointer is over the board). */
  const landing = useCallback(
    (item: DragItem, x: number, y: number): { over: boolean; cells: number[] | null } => {
      const at = gridColRowAt(boardRef.current, x, y, n, n);
      if (!at) return { over: false, cells: null };
      const offsets = offsetsFor(item.piece);
      const row = at.row - item.grabR;
      const col = at.col - item.grabC;
      return { over: true, cells: absoluteCells(offsets, row, col, n) };
    },
    [offsetsFor, n],
  );

  const blockedCells = useCallback(
    (skip: number) => {
      const taken = new Set<number>(puzzle.blockers);
      for (const entry of placed) {
        if (entry.piece === skip) continue;
        for (const cell of entry.cells) taken.add(cell);
      }
      return taken;
    },
    [placed, puzzle.blockers],
  );

  /*
   * The effects (stage 2, the effects kit; presentation only: they observe the moves this stage already decided and
   * never hold a move up). Every effect animates a piece's own element: a tray piece's slot (`data-bp-tray-piece`),
   * the wrapper that follows the finger (`data-bp-move`), the lift wrapper inside it (`data-bp-lift`), or the placed
   * piece's group on the board (`data-bp-piece`), never the board, the arena or the tray holding the hit areas. The
   * game plays its own cue for each moment, so every kit call is `silent`.
   */
  const trayPart = useCallback((piece: number, part?: "move" | "lift"): HTMLElement | null => {
    const slot = trayRef.current?.querySelector<HTMLElement>(`[data-bp-tray-piece="${piece}"]`) ?? null;
    return part ? (slot?.querySelector<HTMLElement>(`[data-bp-${part}]`) ?? null) : slot;
  }, []);
  const boardPiece = useCallback(
    (piece: number): Element | null => boardRef.current?.querySelector(`[data-bp-piece="${piece}"]`) ?? null,
    [],
  );
  /** The element that rises under the finger for a dragged piece. */
  const liftOf = useCallback(
    (item: DragItem) => (item.from === "tray" ? trayPart(item.piece, "lift") : boardPiece(item.piece)),
    [trayPart, boardPiece],
  );

  // Turn and flip: the CSS spin on the glyph (bp-glyph-turn / -flip) with the kit's tap on the lift wrapper, the
  // click; under reduced motion the spin is cut and the tap is the kit's 120 ms crossfade.
  useLayoutEffect(() => {
    // Not while that piece is up under the finger (a held turn shown by the drag): the pick-up keeps its lift.
    if (turned && lifted.current !== turned.piece) gameFx("tap", trayPart(turned.piece, "lift"), { silent: true });
  }, [turned, trayPart]);
  // A legal drop: the piece comes down with the kit's squash (its BlockDropFlash lights the covered squares).
  useLayoutEffect(() => {
    if (drop) gameFx("drop", boardPiece(drop.piece), { silent: true });
  }, [drop, boardPiece]);

  /** A tray piece let go where it can't stay glides back into its slot from where the finger left it (FLIP). */
  const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (returnTimer.current) clearTimeout(returnTimer.current);
  }, []);
  const slideHome = useCallback(
    (info: DragInfo<DragItem>) => {
      setReturning(info.item.piece);
      if (returnTimer.current) clearTimeout(returnTimer.current);
      returnTimer.current = setTimeout(() => setReturning(null), 400);
      gameFx("slide", trayPart(info.item.piece, "move"), { from: { x: info.dx, y: info.dy }, silent: true });
    },
    [trayPart],
  );

  /**
   * An illegal drop: a dull thud as the piece goes back, and (blockRev 4) one off the clean-drops bonus. A tray piece
   * slides back to its slot from where it was let go (the kit's slide, FLIP) and its slot gives the kit's refused
   * shake; a placed piece, which never left the board, shakes where it is.
   */
  const refuse = useCallback(
    (info?: DragInfo<DragItem>) => {
      soundCue("blockparty.illegal");
      if (overhaul) setIllegal((current) => current + 1);
      if (!info) return;
      if (info.item.from === "tray") {
        slideHome(info);
        gameFx("wrong", trayPart(info.item.piece), { silent: true, delayMs: 150 });
      } else {
        gameFx("wrong", boardPiece(info.item.piece), { silent: true });
      }
    },
    [overhaul, trayPart, boardPiece, slideHome],
  );

  const drag = useDragSnap<DragItem>({
    disabled: locked,
    onMove: (info) => {
      // The first real movement picks the piece up (a held turn shows at once: the drag uses the turned shape).
      if (lifted.current === null && Math.abs(info.dx) + Math.abs(info.dy) >= 8) {
        lifted.current = info.item.piece;
        if (held?.piece === info.item.piece) releaseHeld(true);
        soundCue("blockparty.pickup");
        // The kit's pick-up: the piece rises and grows a touch under the finger, and stays up until it lands.
        gameFx("pickUp", liftOf(info.item), { silent: true });
      }
      const { cells } = landing(info.item, info.x, info.y);
      if (!cells) {
        setGhost(null);
        return;
      }
      const taken = blockedCells(info.item.piece);
      setGhost({ cells, legal: cells.every((cell) => !taken.has(cell)) });
    },
    onDrop: (info) => {
      setGhost(null);
      // Whatever happens next, the lifted piece comes down (a legal drop then plays the kit's drop on its new spot).
      if (lifted.current !== null) releaseGameFx(liftOf(info.item));
      lifted.current = null;
      const moved = Math.abs(info.dx) + Math.abs(info.dy);

      // A tap on a tray piece rotates it; preserve the existing alternate pose gesture.
      if (moved < 8) {
        if (info.item.from === "board") {
          commit(placed.filter((entry) => entry.piece !== info.item.piece));
          soundCue("blockparty.pickup");
          return true;
        }
        const previous = lastTap.current;
        const double =
          previous && previous.piece === info.item.piece && Date.now() - previous.at < DOUBLE_TAP_MS;
        // A double tap is used up, so a third quick tap is a plain turn, never a second double.
        lastTap.current = double ? null : { piece: info.item.piece, at: Date.now() };
        const state = pose[info.item.piece] ?? { rot: 0, flip: false };
        if (double) {
          // The first tap's turn was never shown: the piece only flips (one sound).
          if (heldTimer.current) clearTimeout(heldTimer.current);
          heldTimer.current = null;
          setHeld(null);
          setTurned((current) => ({ piece: info.item.piece, kind: "flip", n: (current?.n ?? 0) + 1 }));
          soundCue("blockparty.flip");
        } else {
          // Another piece's held turn shows now; this one's waits out the double-tap window.
          if (held && held.piece !== info.item.piece) releaseHeld(true);
          if (heldTimer.current) clearTimeout(heldTimer.current);
          setHeld({ piece: info.item.piece, pose: state });
          heldTimer.current = setTimeout(() => releaseHeld(true), DOUBLE_TAP_MS);
        }
        setPose((current) => {
          const state = current[info.item.piece] ?? { rot: 0, flip: false };
          // A double tap's first tap already turned the piece: tapPose takes that turn back as it flips.
          return { ...current, [info.item.piece]: tapPose(state, Boolean(double)) };
        });
        return true;
      }

      const { over, cells } = landing(info.item, info.x, info.y);
      if (!cells) {
        if (over) {
          // Let go over the board where it doesn't fit (off its edge): an illegal drop.
          refuse(info);
          return false;
        }
        // Dropped off the board: the piece goes back to the tray.
        if (info.item.from === "board") {
          commit(placed.filter((entry) => entry.piece !== info.item.piece));
          return true;
        }
        // A tray piece let go off the board glides home (no move, no sound).
        slideHome(info);
        return false;
      }
      const taken = blockedCells(info.item.piece);
      if (cells.some((cell) => taken.has(cell))) {
        refuse(info);
        return false;
      }

      const next = [
        ...placed.filter((entry) => entry.piece !== info.item.piece),
        { piece: info.item.piece, cells },
      ];
      commit(next);
      setDrop((current) => ({ piece: info.item.piece, cells, n: (current?.n ?? 0) + 1 }));
      soundCue("blockparty.place");
      if (next.reduce((sum, entry) => sum + entry.cells.length, 0) >= geo.free) {
        setTimeout(() => lockIn(next), 200);
      }
      return true;
    },
  });

  /** Undo (blockRev 4): the board before the last change, the move given back. */
  const undo = useCallback(() => {
    if (locked || history.length === 0) return;
    setPlaced(history[history.length - 1]!);
    setHistory((current) => current.slice(0, -1));
    setDrop(null);
    soundCue("blockparty.undo");
  }, [locked, history]);
  /** Reset (blockRev 4): every piece back to the tray; Undo brings the board back. */
  const reset = useCallback(() => {
    if (locked || placedRef.current.length === 0) return;
    commit([]);
    setDrop(null);
    soundCue("blockparty.reset");
  }, [locked, commit]);

  // Desktop keys (blockRev 4): Z or Backspace = Undo, R = Reset.
  useGameKeys((kind, key, event) => {
    const used = key === "z" || key === "Backspace" || key === "r";
    if (!used || kind !== "down" || event.repeat) return used;
    if (key === "r") reset();
    else undo();
    return true;
  }, overhaul);

  const inTray = geo.pieces.map((_, piece) => piece).filter(
    (piece) => !placed.some((entry) => entry.piece === piece),
  );
  const draggedPiece = drag.drag?.item.piece;
  // A tray piece under the finger, or gliding home after a refused drop (the tray stops clipping meanwhile).
  const trayCarrying = drag.drag?.item.from === "tray" || returning !== null;

  useBeforePaint(() => {
    const layout = layoutRef.current;
    const tray = trayRef.current;
    if (!layout || !tray) return;
    const read = () => {
      const layoutRect = layout.getBoundingClientRect();
      const trayRect = tray.getBoundingClientRect();
      // Unscaled CSS px. Inside a scale() transform (the intro-demo player) the rects
      // shrink with it, and sizing the tray from them shrank it again on every resize
      // until the pieces were a fraction of a pixel tall. Without a transform (practice,
      // rooms) the ratio is 1 up to offsetWidth's rounding and the rects are used as is.
      const ratio = layout.offsetWidth > 0 ? layoutRect.width / layout.offsetWidth : 1;
      const k = Math.abs(ratio - 1) > 0.02 ? ratio : 1;
      setLayoutSize(sameSize({ width: layoutRect.width / k, height: layoutRect.height / k }));
      setTraySize(sameSize({ width: trayRect.width / k, height: trayRect.height / k }));
      // The Undo / Reset row (blockRev 4) and its 8px gap leave the board's share.
      const actions = actionsRef.current;
      const h = actions ? actions.getBoundingClientRect().height / k + 8 : 0;
      setActionsH((current) => (Math.abs(current - h) < 0.5 ? current : h));
    };
    readSizes.current = read;
    read();
    const observer = new ResizeObserver(read);
    observer.observe(layout);
    observer.observe(tray);
    return () => {
      readSizes.current = null;
      observer.disconnect();
    };
  }, []);
  // The board takes what the tray leaves and the tray (flex-1) what the board leaves, so one
  // read settles over several renders. Re-read after each render, before paint, until the
  // sizes stop changing (16 Oct 2026, display only): the first painted frame is the final
  // layout instead of a short board that grows over the next frames. At most 8 passes a commit.
  const settlePasses = useRef(0);
  useBeforePaint(() => {
    if (settlePasses.current++ === 0) queueMicrotask(() => (settlePasses.current = 0));
    if (settlePasses.current <= 8) readSizes.current?.();
  });

  // The centred board uses 85% of the stage width; the tray receives all
  // remaining height and uses the largest piece scale that keeps every piece visible.
  // Stage 3 (levels): Expert's eleven pieces sit four to a row, so the tray needs three rows, not four, and leaves the
  // board its height on a phone; every other board keeps three to a row.
  const trayCols = geo.pieces.length > 9 ? 4 : 3;
  const trayRows = useMemo(() => {
    const rows: number[][] = [];
    for (let index = 0; index < inTray.length; index += trayCols)
      rows.push(inTray.slice(index, index + trayCols));
    return rows;
  }, [inTray, trayCols]);
  const trayHeightUnits = trayRows.reduce(
    (sum, row) => Math.max(...row.map((piece) => offsetsSize(shownOffsetsFor(piece)).rows), 1) + sum,
    0,
  );
  const trayWidthUnits = Math.max(
    ...trayRows.map((row) =>
      row.reduce((sum, piece) => sum + offsetsSize(shownOffsetsFor(piece)).cols, 0),
    ),
    1,
  );
  const trayCellCapacity = Math.max(
    1,
    Math.min(
      (traySize.height - 20 - Math.max(0, trayRows.length - 1) * 4) / trayHeightUnits,
      (traySize.width - 20 - 8) / trayWidthUnits,
      // The tray's three columns are equal: the widest piece fits its own column, never over a neighbour
      // (Pattern overhaul; display only).
      (traySize.width - 20 - 8) / trayCols / Math.max(1, ...inTray.map((piece) => offsetsSize(shownOffsetsFor(piece)).cols)),
    ),
  );
  // The board and the tray settle against each other (see useBeforePaint above); in the frame the HUD
  // row (16px + an 8px gap) is not drawn, so its 24px leave the reserve, which keeps the same balance.
  const boardSize = Math.min(layoutSize.width, Math.max(0, layoutSize.height - traySize.height - actionsH - (inFrame ? 4 : 28)));
  const boardCell = boardSize / n;
  const trayCell = Math.min(boardCell * 0.92, trayCellCapacity);

  return (
    <div ref={layoutRef} data-stage-column="2" data-polish="blockparty" className="block-party-stage flex min-h-0 flex-1 flex-col gap-2">
      {inFrame ? null : (
        <div className="flex shrink-0 items-center justify-between font-mono text-xs uppercase tracking-widest text-muted-foreground">
          <span>
            covered <span className="text-primary">{covered}</span> / {geo.free}
          </span>
          <span className="text-[10px]">tap: turn · double tap: flip</span>
        </div>
      )}

      <div data-game-arena="fixed" className="flex shrink-0 justify-center">
        <BlockBoard
          blockers={puzzle.blockers}
          placements={placed}
          boardRef={boardRef}
          size={boardSize}
          cols={n}
          flash={drop}
          celebrate={celebrating}
        >
          {ghost && draggedPiece !== undefined && (
            <>
              {ghost.cells.map((cell) => (
                <div
                  key={`ghost-${cell}`}
                  aria-hidden="true"
                  className={`bp-ghost pointer-events-none absolute border-2 border-dashed ${
                    ghost.legal ? "border-current" : "bp-ghost--blocked border-warn/70 bg-warn/10"
                  }`}
                  style={{
                    left: pct(cell % n, n),
                    top: pct(Math.floor(cell / n), n),
                    width: pct(1, n),
                    height: pct(1, n),
                    color: ghost.legal ? pieceColour(draggedPiece) : undefined,
                  }}
                />
              ))}
            </>
          )}
          {/* Placed pieces can be picked back up. */}
          {placed.map((placement) => {
            const minRow = Math.min(...placement.cells.map((cell) => Math.floor(cell / n)));
            const minCol = Math.min(...placement.cells.map((cell) => cell % n));
            return placement.cells.map((cell) => (
              <div
                key={`grab-${placement.piece}-${cell}`}
                onPointerDown={drag.start({
                  piece: placement.piece,
                  from: "board",
                  grabR: Math.floor(cell / n) - minRow,
                  grabC: (cell % n) - minCol,
                })}
                className="absolute"
                style={{
                  left: pct(cell % n, n),
                  top: pct(Math.floor(cell / n), n),
                  width: pct(1, n),
                  height: pct(1, n),
                  touchAction: "none",
                }}
              />
            ));
          })}
        </BlockBoard>
      </div>

      {/* Tray: every remaining piece, at a reduced scale. While a tray piece is under the finger or gliding home
          (stage 2) the tray stops clipping, so the lifted piece is seen over the board, not cut off at the tray's top. */}
      <div
        ref={trayRef}
        data-game-controls="tray"
        data-bp-carrying={trayCarrying ? "" : undefined}
        className={`block-party-tray grid min-h-0 flex-1 ${trayCols === 4 ? "grid-cols-4" : "grid-cols-3"} content-center items-center gap-x-1 gap-y-1 ${trayCarrying ? "overflow-visible" : "overflow-hidden"} rounded-xl px-2.5 py-2.5`}
      >
        {inTray.length === 0 ? (
          <p className={`${trayCols === 4 ? "col-span-4" : "col-span-3"} text-center font-mono text-xs uppercase tracking-widest text-primary`}>
            board full
          </p>
        ) : (
          <BlockArtDefs>
          {inTray.map((piece) => {
            const dragging = drag.drag?.item.piece === piece && drag.drag.item.from === "tray";
            const dragInfo = dragging ? drag.drag : null;
            const offsets = shownOffsetsFor(piece);
            const { rows, cols } = offsetsSize(offsets);
            return (
              <div
                key={piece}
                data-bp-tray-piece={piece}
                className="relative flex min-h-0 items-center justify-center"
                // A piece gliding home after a refused drop stays above its neighbours on the way (stage 2).
                style={{ minWidth: cols * trayCell, minHeight: rows * trayCell, zIndex: returning === piece ? 30 : undefined }}
                aria-label={`Piece ${piece + 1}`}
              >
                <div
                  data-bp-move=""
                  style={
                    dragInfo
                      ? {
                          ...liftStyle(dragInfo.dx, dragInfo.dy, reduced),
                          boxShadow: undefined,
                          // The rise under the finger is the kit's pick-up on the lift wrapper below (stage 2).
                          transform: `translate3d(${dragInfo.dx}px, ${dragInfo.dy}px, 0) scale(${boardCell / trayCell})`,
                        }
                      : { touchAction: "none" }
                  }
                >
                  <div data-bp-lift="" className="bp-lift">
                  <PieceGlyph
                    key={turned?.piece === piece ? `t${turned.n}` : "rest"}
                    turn={turned?.piece === piece ? turned.kind : undefined}
                    offsets={offsets}
                    piece={piece}
                    cell={trayCell}
                    onCellPointerDown={(event, grabR, grabC) =>
                      drag.start({ piece, from: "tray", grabR, grabC })(event)
                    }
                  />
                  </div>
                </div>
              </div>
            );
          })}
          </BlockArtDefs>
        )}
      </div>

      {overhaul ? (
        <div ref={actionsRef} data-game-controls="actions" className="bp-actions shrink-0">
          <Button variant="secondary" size={44} onClick={undo} disabled={locked || history.length === 0} data-testid="blockparty-undo">
            Undo
          </Button>
          <Button variant="secondary" size={44} onClick={reset} disabled={locked || placed.length === 0} data-testid="blockparty-reset">
            Reset
          </Button>
        </div>
      ) : null}
    </div>
  );
}
