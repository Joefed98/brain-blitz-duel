import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  BlockArtDefs,
  BlockBoardArt,
  BlockPiecesArt,
  BlockSolveFx,
  BlockColsContext,
  PieceArt,
  pegDistances,
  SHINE_STEP_MS,
} from "@/components/puzzles/pattern/blockPartyArt";
import { soundCue, useSolveMoment } from "@/lib/fx/patternFx";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import {
  gridColRowAt,
  liftStyle,
  useDragSnap,
  usePrefersReducedMotion,
} from "@/components/puzzles/GridDrag";
import {
  absoluteCells,
  blockGeometry,
  encodePlacements,
  offsetsSize,
  orientationOffsets,
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
  // blockRev 1 (depth batch 4): the 7×7 board's Plus.
  "#19C9C0",
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
  colour,
  cell,
  onCellPointerDown,
  turn,
}: {
  offsets: Offsets;
  colour: string;
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
        <PieceArt cells={offsets} colour={colour} />
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
  snap,
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
  /** Stage only: pieces click into place as they land. */
  snap?: boolean;
  /** Stage only: the completion shine is running. */
  celebrate?: boolean;
}) {
  const wave = useMemo(() => {
    if (!celebrate) return null;
    const distance = pegDistances(blockers, cols);
    return new Map(
      placements.map((placement) => [
        placement.piece,
        60 + (Math.min(...placement.cells.map((cell) => distance[cell] ?? 1)) - 1) * SHINE_STEP_MS,
      ]),
    );
  }, [celebrate, blockers, placements, cols]);
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
        <BlockPiecesArt placements={placements} colourFor={pieceColour} snap={snap} wave={wave} />
        {celebrate && <BlockSolveFx blockers={blockers} />}
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

export function BlockPartyPuzzle({
  puzzle,
  phaseStartedAt,
  now,
  locked,
  onSubmit,
  onDraftAnswer,
}: BlockPartyPuzzleProps) {
  const reduced = usePrefersReducedMotion();
  // blockRev 1 (depth batch 4): the 7×7 board, fifteen pegs and ten pieces.
  const geo = blockGeometry(puzzle);
  const n = geo.cols;
  const layoutRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [layoutSize, setLayoutSize] = useState({ width: 348, height: 480 });
  const [traySize, setTraySize] = useState({ width: 348, height: 234 });
  const readSizes = useRef<(() => void) | null>(null);
  const [placed, setPlaced] = useState<BlockPlacement[]>([]);
  const [pose, setPose] = useState<Record<number, { rot: number; flip: boolean }>>({});
  const [ghost, setGhost] = useState<{ cells: number[]; legal: boolean } | null>(null);
  const lastTap = useRef<{ piece: number; at: number } | null>(null);
  const submitted = useRef(false);
  const placedRef = useRef<BlockPlacement[]>([]);
  placedRef.current = placed;

  const offsetsFor = useCallback(
    (piece: number) => {
      const state = pose[piece] ?? { rot: 0, flip: false };
      return orientationOffsets(piece, state.rot, state.flip);
    },
    [pose],
  );

  const covered = placed.reduce((sum, entry) => sum + entry.cells.length, 0);
  const celebrating = useSolveMoment(covered >= geo.free, "blockparty.solve");
  const inFrame = useFrameProgress(covered, geo.free, "covered");
  const [turned, setTurned] = useState<{ piece: number; kind: "turn" | "flip"; n: number } | null>(
    null,
  );

  const lockIn = useCallback(
    (final: BlockPlacement[]) => {
      if (submitted.current) return;
      submitted.current = true;
      onSubmit(encodePlacements(final));
    },
    [onSubmit],
  );

  // Every change goes to the room as a draft, so a reveal that arrives before this stage locks in
  // (a backgrounded phone, a stalled clock) still sends the answer as it stands, never "".
  useEffect(() => {
    onDraftAnswer?.(encodePlacements(placed));
  }, [placed, onDraftAnswer]);

  useEffect(() => {
    if (locked) return;
    const remaining = phaseStartedAt + BLOCK_TIME_MS - now;
    if (remaining <= 600) lockIn(placedRef.current);
  }, [locked, now, phaseStartedAt, lockIn]);

  /** Where the piece would land if dropped with the pointer here. */
  const targetCells = useCallback(
    (item: DragItem, x: number, y: number): number[] | null => {
      const at = gridColRowAt(boardRef.current, x, y, n, n);
      if (!at) return null;
      const offsets = offsetsFor(item.piece);
      const row = at.row - item.grabR;
      const col = at.col - item.grabC;
      return absoluteCells(offsets, row, col, n);
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

  const drag = useDragSnap<DragItem>({
    disabled: locked,
    onMove: (info) => {
      const cells = targetCells(info.item, info.x, info.y);
      if (!cells) {
        setGhost(null);
        return;
      }
      const taken = blockedCells(info.item.piece);
      setGhost({ cells, legal: cells.every((cell) => !taken.has(cell)) });
    },
    onDrop: (info) => {
      setGhost(null);
      const moved = Math.abs(info.dx) + Math.abs(info.dy);

      // A tap on a tray piece rotates it; preserve the existing alternate pose gesture.
      if (moved < 8) {
        if (info.item.from === "board") {
          setPlaced((current) => current.filter((entry) => entry.piece !== info.item.piece));
          return true;
        }
        const previous = lastTap.current;
        const double =
          previous && previous.piece === info.item.piece && Date.now() - previous.at < 300;
        lastTap.current = { piece: info.item.piece, at: Date.now() };
        setTurned((current) => ({
          piece: info.item.piece,
          kind: double ? "flip" : "turn",
          n: (current?.n ?? 0) + 1,
        }));
        soundCue(double ? "blockparty.flip" : "blockparty.turn");
        setPose((current) => {
          const state = current[info.item.piece] ?? { rot: 0, flip: false };
          return {
            ...current,
            [info.item.piece]: double
              ? { ...state, flip: !state.flip }
              : { ...state, rot: (state.rot + 1) % 4 },
          };
        });
        return true;
      }

      const cells = targetCells(info.item, info.x, info.y);
      if (!cells) {
        // Dropped off the board: the piece goes back to the tray.
        if (info.item.from === "board") {
          setPlaced((current) => current.filter((entry) => entry.piece !== info.item.piece));
          return true;
        }
        return false;
      }
      const taken = blockedCells(info.item.piece);
      if (cells.some((cell) => taken.has(cell))) return false;

      const next = [
        ...placed.filter((entry) => entry.piece !== info.item.piece),
        { piece: info.item.piece, cells },
      ];
      setPlaced(next);
      soundCue("blockparty.place");
      if (next.reduce((sum, entry) => sum + entry.cells.length, 0) >= geo.free) {
        setTimeout(() => lockIn(next), 200);
      }
      return true;
    },
  });

  const inTray = geo.pieces.map((_, piece) => piece).filter(
    (piece) => !placed.some((entry) => entry.piece === piece),
  );
  const draggedPiece = drag.drag?.item.piece;

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
  const trayPerRow = geo.pieces.length > 9 ? 4 : 3;
  const trayRows = useMemo(() => {
    const rows: number[][] = [];
    // Ten pieces sit four to a row, so the tray keeps three rows and the board its size.
    for (let index = 0; index < inTray.length; index += trayPerRow)
      rows.push(inTray.slice(index, index + trayPerRow));
    return rows;
  }, [inTray, trayPerRow]);
  const trayHeightUnits = trayRows.reduce(
    (sum, row) => Math.max(...row.map((piece) => offsetsSize(offsetsFor(piece)).rows), 1) + sum,
    0,
  );
  const trayWidthUnits = Math.max(
    ...trayRows.map((row) =>
      row.reduce((sum, piece) => sum + offsetsSize(offsetsFor(piece)).cols, 0),
    ),
    1,
  );
  const trayCellCapacity = Math.max(
    1,
    Math.min(
      (traySize.height - 20 - Math.max(0, trayRows.length - 1) * 4) / trayHeightUnits,
      (traySize.width - 20 - 8) / trayWidthUnits,
      // Four to a row (the 7×7 board): the grid's columns are equal, so the widest piece must fit one column.
      trayPerRow === 4
        ? (traySize.width - 20 - 12) / 4 / Math.max(1, ...inTray.map((piece) => offsetsSize(offsetsFor(piece)).cols))
        : Infinity,
    ),
  );
  // The board and the tray settle against each other (see useBeforePaint above); in the frame the HUD
  // row (16px + an 8px gap) is not drawn, so its 24px leave the reserve, which keeps the same balance.
  const boardSize = Math.min(layoutSize.width, Math.max(0, layoutSize.height - traySize.height - (inFrame ? 4 : 28)));
  const boardCell = boardSize / n;
  const trayCell = Math.min(boardCell * 0.92, trayCellCapacity);

  return (
    <div ref={layoutRef} data-stage-column="2" data-polish="blockparty" className="block-party-stage flex min-h-0 flex-1 flex-col gap-2">
      {inFrame ? null : (
        <div className="flex shrink-0 items-center justify-between font-mono text-xs uppercase tracking-widest text-muted-foreground">
          <span>
            covered <span className="text-primary">{covered}</span> / {geo.free}
          </span>
          <span className="text-[10px]">tap to rotate</span>
        </div>
      )}

      <div data-game-arena="fixed" className="flex shrink-0 justify-center">
        <BlockBoard
          blockers={puzzle.blockers}
          placements={placed}
          boardRef={boardRef}
          size={boardSize}
          cols={n}
          snap
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

      {/* Tray: every remaining piece, at a reduced scale. */}
      <div
        ref={trayRef}
        data-game-controls="tray" className={`block-party-tray grid min-h-0 flex-1 ${trayPerRow === 4 ? "grid-cols-4" : "grid-cols-3"} content-center items-center gap-x-1 gap-y-1 overflow-hidden rounded-xl px-2.5 py-2.5`}
      >
        {inTray.length === 0 ? (
          <p className="col-span-full text-center font-mono text-xs uppercase tracking-widest text-primary">
            board full
          </p>
        ) : (
          <BlockArtDefs>
          {inTray.map((piece) => {
            const dragging = drag.drag?.item.piece === piece && drag.drag.item.from === "tray";
            const dragInfo = dragging ? drag.drag : null;
            const offsets = offsetsFor(piece);
            const { rows, cols } = offsetsSize(offsets);
            return (
              <div
                key={piece}
                className={`relative flex min-h-0 items-center justify-center ${
                  drag.rejected?.piece === piece ? "animate-shake" : ""
                }`}
                style={{ minWidth: cols * trayCell, minHeight: rows * trayCell }}
                aria-label={`Piece ${piece + 1}`}
              >
                <div
                  style={
                    dragInfo
                      ? {
                          ...liftStyle(dragInfo.dx, dragInfo.dy, reduced),
                          boxShadow: undefined,
                          transform: `translate3d(${dragInfo.dx}px, ${dragInfo.dy - (reduced ? 0 : 6)}px, 0) scale(${boardCell / trayCell})`,
                        }
                      : { touchAction: "none" }
                  }
                >
                  <PieceGlyph
                    key={turned?.piece === piece ? `t${turned.n}` : "rest"}
                    turn={turned?.piece === piece ? turned.kind : undefined}
                    offsets={offsets}
                    colour={pieceColour(piece)}
                    cell={trayCell}
                    onCellPointerDown={(event, grabR, grabC) =>
                      drag.start({ piece, from: "tray", grabR, grabC })(event)
                    }
                  />
                </div>
              </div>
            );
          })}
          </BlockArtDefs>
        )}
      </div>
    </div>
  );
}
