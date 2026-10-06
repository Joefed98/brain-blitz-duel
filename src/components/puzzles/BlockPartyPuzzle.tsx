import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import {
  gridColRowAt,
  liftStyle,
  useDragSnap,
  usePrefersReducedMotion,
} from "@/components/puzzles/GridDrag";
import {
  BLOCK_PIECES,
  absoluteCells,
  encodePlacements,
  offsetsSize,
  orientationOffsets,
  type Offsets,
} from "@/lib/duel/blockParty";
import {
  BLOCK_COLS as N,
  BLOCK_FREE_CELLS,
  BLOCK_TIME_MS,
  type BlockPartyPuzzleData,
  type BlockPlacement,
} from "@/lib/duel/types";

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
];

const pct = (value: number) => `${(value * 100) / N}%`;

export function pieceColour(piece: number): string {
  return PIECE_COLOURS[piece] ?? "var(--color-foreground)";
}

/** A small drawing of one piece, used in the tray. */
function PieceGlyph({
  offsets,
  colour,
  cell,
  onCellPointerDown,
}: {
  offsets: Offsets;
  colour: string;
  cell: number;
  onCellPointerDown?:
    ((event: React.PointerEvent<HTMLDivElement>, row: number, col: number) => void) | undefined;
}) {
  const { rows, cols } = offsetsSize(offsets);
  return (
    <div
      className="relative"
      style={{ width: cols * cell, height: rows * cell, touchAction: "none" }}
      aria-hidden="true"
    >
      {offsets.map(([r, c], index) => (
        <div
          key={index}
          onPointerDown={onCellPointerDown ? (event) => onCellPointerDown(event, r, c) : undefined}
          className="absolute rounded-[3px]"
          style={{
            left: c * cell,
            top: r * cell,
            width: cell - 2,
            height: cell - 2,
            background: colour,
            opacity: 0.8,
          }}
        />
      ))}
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
}: {
  blockers: number[];
  placements: BlockPlacement[];
  size?: number;
  children?: React.ReactNode;
  boardRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={boardRef}
      className="relative aspect-square w-full rounded-xl border border-border bg-card/60"
      style={size ? { width: size, height: size } : undefined}
    >
      <div className="absolute inset-0 grid grid-cols-6 grid-rows-6" aria-hidden="true">
        {Array.from({ length: N * N }, (_, i) => (
          <div key={i} className="border border-border/30" />
        ))}
      </div>

      {placements.map((placement) =>
        placement.cells.map((cell) => (
          <div
            key={`${placement.piece}-${cell}`}
            className="absolute rounded-[4px]"
            style={{
              left: pct(cell % N),
              top: pct(Math.floor(cell / N)),
              width: pct(1),
              height: pct(1),
              padding: 2,
            }}
          >
            <div
              className="h-full w-full rounded-[4px]"
              style={{ background: pieceColour(placement.piece), opacity: 0.85 }}
            />
          </div>
        )),
      )}

      {blockers.map((cell) => (
        <div
          key={`peg-${cell}`}
          className="absolute flex items-center justify-center"
          style={{
            left: pct(cell % N),
            top: pct(Math.floor(cell / N)),
            width: pct(1),
            height: pct(1),
          }}
          aria-hidden="true"
        >
           <span className="block h-5 w-5 max-h-[80%] max-w-[80%] rounded-full border-2 border-primary bg-background" />
        </div>
      ))}

      {children}
    </div>
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
}

export function BlockPartyPuzzle({
  puzzle,
  phaseStartedAt,
  now,
  locked,
  onSubmit,
}: BlockPartyPuzzleProps) {
  const reduced = usePrefersReducedMotion();
  const layoutRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [layoutSize, setLayoutSize] = useState({ width: 348, height: 480 });
  const [traySize, setTraySize] = useState({ width: 348, height: 234 });
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

  const lockIn = useCallback(
    (final: BlockPlacement[]) => {
      if (submitted.current) return;
      submitted.current = true;
      onSubmit(encodePlacements(final));
    },
    [onSubmit],
  );

  useEffect(() => {
    if (locked) return;
    const remaining = phaseStartedAt + BLOCK_TIME_MS - now;
    if (remaining <= 600) lockIn(placedRef.current);
  }, [locked, now, phaseStartedAt, lockIn]);

  /** Where the piece would land if dropped with the pointer here. */
  const targetCells = useCallback(
    (item: DragItem, x: number, y: number): number[] | null => {
      const at = gridColRowAt(boardRef.current, x, y, N, N);
      if (!at) return null;
      const offsets = offsetsFor(item.piece);
      const row = at.row - item.grabR;
      const col = at.col - item.grabC;
      return absoluteCells(offsets, row, col);
    },
    [offsetsFor],
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
      if (next.reduce((sum, entry) => sum + entry.cells.length, 0) >= BLOCK_FREE_CELLS) {
        setTimeout(() => lockIn(next), 200);
      }
      return true;
    },
  });

  const inTray = BLOCK_PIECES.map((_, piece) => piece).filter(
    (piece) => !placed.some((entry) => entry.piece === piece),
  );
  const draggedPiece = drag.drag?.item.piece;

  useEffect(() => {
    const layout = layoutRef.current;
    const tray = trayRef.current;
    if (!layout || !tray) return;
    const read = () => {
      const layoutRect = layout.getBoundingClientRect();
      const trayRect = tray.getBoundingClientRect();
      setLayoutSize({ width: layoutRect.width, height: layoutRect.height });
      setTraySize({ width: trayRect.width, height: trayRect.height });
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(layout);
    observer.observe(tray);
    return () => observer.disconnect();
  }, []);

  // The centred board uses 85% of the stage width; the tray receives all
  // remaining height and uses the largest piece scale that keeps every piece visible.
  const trayRows = useMemo(() => {
    const rows: number[][] = [];
    for (let index = 0; index < inTray.length; index += 3)
      rows.push(inTray.slice(index, index + 3));
    return rows;
  }, [inTray]);
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
    ),
  );
  const boardSize = Math.min(layoutSize.width, Math.max(0, layoutSize.height - traySize.height - 28));
  const boardCell = boardSize / N;
  const trayCell = Math.min(boardCell * 0.75, trayCellCapacity);

  return (
    <div ref={layoutRef} data-stage-column="2" className="block-party-stage flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between font-mono text-xs uppercase tracking-widest text-muted-foreground">
        <span>
          covered <span className="text-primary">{covered}</span> / {BLOCK_FREE_CELLS}
        </span>
        <span className="text-[10px]">tap to rotate</span>
      </div>

      <div data-game-arena="fixed" className="flex shrink-0 justify-center">
        <BlockBoard
          blockers={puzzle.blockers}
          placements={placed}
          boardRef={boardRef}
          size={boardSize}
        >
          {ghost && draggedPiece !== undefined && (
            <>
              {ghost.cells.map((cell) => (
                <div
                  key={`ghost-${cell}`}
                  aria-hidden="true"
                  className={`pointer-events-none absolute rounded-[4px] border-2 border-dashed ${
                    ghost.legal ? "border-current bg-primary/10" : "border-warn/70 bg-warn/10"
                  }`}
                  style={{
                    left: pct(cell % N),
                    top: pct(Math.floor(cell / N)),
                    width: pct(1),
                    height: pct(1),
                    color: ghost.legal ? pieceColour(draggedPiece) : undefined,
                  }}
                />
              ))}
            </>
          )}
          {/* Placed pieces can be picked back up. */}
          {placed.map((placement) => {
            const minRow = Math.min(...placement.cells.map((cell) => Math.floor(cell / N)));
            const minCol = Math.min(...placement.cells.map((cell) => cell % N));
            return placement.cells.map((cell) => (
              <div
                key={`grab-${placement.piece}-${cell}`}
                onPointerDown={drag.start({
                  piece: placement.piece,
                  from: "board",
                  grabR: Math.floor(cell / N) - minRow,
                  grabC: (cell % N) - minCol,
                })}
                className="absolute"
                style={{
                  left: pct(cell % N),
                  top: pct(Math.floor(cell / N)),
                  width: pct(1),
                  height: pct(1),
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
        data-game-controls="tray" className="grid min-h-0 flex-1 grid-cols-3 content-center items-center gap-x-1 gap-y-1 overflow-hidden rounded-xl bg-card/60 px-2.5 py-2.5"
      >
        {inTray.length === 0 ? (
          <p className="col-span-3 text-center font-mono text-xs uppercase tracking-widest text-primary">
            board full
          </p>
        ) : (
          inTray.map((piece) => {
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
                          transform: `translate3d(${dragInfo.dx}px, ${dragInfo.dy - (reduced ? 0 : 6)}px, 0) scale(${boardCell / trayCell})`,
                        }
                      : { touchAction: "none" }
                  }
                >
                  <PieceGlyph
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
          })
        )}
      </div>
    </div>
  );
}
