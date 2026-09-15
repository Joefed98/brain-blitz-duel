import { useCallback, useEffect, useRef, useState } from "react";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { liftStyle, useDragSnap, usePrefersReducedMotion } from "@/components/puzzles/GridDrag";
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

/** Five soft colours from the game palette, so pieces stay distinguishable. */
const PIECE_COLOURS = [
  GLYPH_COLOURS.BLUE,
  GLYPH_COLOURS.GREEN,
  GLYPH_COLOURS.PURPLE,
  GLYPH_COLOURS.PINK,
  GLYPH_COLOURS.RED,
];

const pct = (value: number) => `${(value * 100) / N}%`;

export function pieceColour(piece: number): string {
  return PIECE_COLOURS[BLOCK_PIECES[piece]!.colour % PIECE_COLOURS.length]!;
}

/** A small drawing of one piece, used in the tray. */
function PieceGlyph({ offsets, colour, cell }: { offsets: Offsets; colour: string; cell: number }) {
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
          <span className="block h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />
        </div>
      ))}

      {children}
    </div>
  );
}

interface DragItem {
  piece: number;
  from: "tray" | "board";
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
  const boardRef = useRef<HTMLDivElement>(null);
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
    (piece: number, x: number, y: number): number[] | null => {
      const rect = boardRef.current?.getBoundingClientRect();
      if (!rect) return null;
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
      const cell = rect.width / N;
      const offsets = offsetsFor(piece);
      const { rows, cols } = offsetsSize(offsets);
      const pointerCol = Math.floor((x - rect.left) / cell);
      const pointerRow = Math.floor((y - rect.top) / cell);
      const row = pointerRow - Math.floor((rows - 1) / 2);
      const col = pointerCol - Math.floor((cols - 1) / 2);
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
      const cells = targetCells(info.item.piece, info.x, info.y);
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

      // A tap on a tray piece turns it; a second quick tap flips it.
      if (moved < 8) {
        if (info.item.from === "board") {
          setPlaced((current) => current.filter((entry) => entry.piece !== info.item.piece));
          return true;
        }
        const previous = lastTap.current;
        const double = previous && previous.piece === info.item.piece && Date.now() - previous.at < 300;
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

      const cells = targetCells(info.item.piece, info.x, info.y);
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

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-center justify-between font-mono text-xs uppercase tracking-widest text-muted-foreground">
        <span>
          covered <span className="text-primary">{covered}</span> / {BLOCK_FREE_CELLS}
        </span>
        <span>tap to turn · double tap to flip</span>
      </div>

      <BlockBoard blockers={puzzle.blockers} placements={placed} boardRef={boardRef}>
        {ghost && (
          <>
            {ghost.cells.map((cell) => (
              <div
                key={`ghost-${cell}`}
                aria-hidden="true"
                className={`pointer-events-none absolute rounded-[4px] border-2 border-dashed ${
                  ghost.legal ? "border-primary/70 bg-primary/10" : "border-warn/70 bg-warn/10"
                }`}
                style={{
                  left: pct(cell % N),
                  top: pct(Math.floor(cell / N)),
                  width: pct(1),
                  height: pct(1),
                }}
              />
            ))}
          </>
        )}
        {/* Placed pieces can be picked back up. */}
        {placed.map((placement) =>
          placement.cells.map((cell) => (
            <div
              key={`grab-${placement.piece}-${cell}`}
              onPointerDown={drag.start({ piece: placement.piece, from: "board" })}
              className="absolute"
              style={{
                left: pct(cell % N),
                top: pct(Math.floor(cell / N)),
                width: pct(1),
                height: pct(1),
                touchAction: "none",
              }}
            />
          )),
        )}
      </BlockBoard>

      {/* Tray: every remaining piece, at a reduced scale. */}
      <div className="flex flex-wrap items-end justify-center gap-3 rounded-xl bg-card/60 px-3 py-3">
        {inTray.length === 0 ? (
          <p className="font-mono text-xs uppercase tracking-widest text-primary">board full</p>
        ) : (
          inTray.map((piece) => {
            const dragging = drag.drag?.item.piece === piece && drag.drag.item.from === "tray";
            return (
              <div
                key={piece}
                onPointerDown={drag.start({ piece, from: "tray" })}
                className={drag.rejected?.piece === piece ? "animate-shake" : ""}
                style={
                  dragging
                    ? liftStyle(drag.drag!.dx, drag.drag!.dy, reduced)
                    : { touchAction: "none" }
                }
              >
                <PieceGlyph offsets={offsetsFor(piece)} colour={pieceColour(piece)} cell={15} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
