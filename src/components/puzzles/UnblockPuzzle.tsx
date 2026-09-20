import { useCallback, useEffect, useRef, useState } from "react";

import {
  gridCellSize,
  liftStyle,
  useDragSnap,
  usePrefersReducedMotion,
} from "@/components/puzzles/GridDrag";
import { clampSlide, encodeMoves, isSolved, position, type UnblockMove } from "@/lib/duel/unblock";
import {
  UNBLOCK_COLS as N,
  UNBLOCK_EXIT_ROW,
  UNBLOCK_TIME_MS,
  type UnblockPuzzleData,
  type UnblockVehicle,
} from "@/lib/duel/types";

const pct = (value: number) => `${(value * 100) / N}%`;

/** One vehicle, positioned on the board by its row and column. */
function Vehicle({
  vehicle,
  style,
  onPointerDown,
  shaking,
  escaping,
}: {
  vehicle: UnblockVehicle;
  style?: React.CSSProperties;
  onPointerDown?: (event: React.PointerEvent) => void;
  shaking?: boolean;
  escaping?: boolean;
}) {
  const gold = vehicle.id === 0;
  return (
    <div
      onPointerDown={onPointerDown}
      className={`absolute rounded-lg border ${
        gold ? "border-primary bg-primary/80" : "border-border bg-muted"
      } ${shaking ? "animate-shake" : ""}`}
      style={{
        left: pct(vehicle.col),
        top: pct(vehicle.row),
        width: pct(vehicle.axis === "h" ? vehicle.len : 1),
        height: pct(vehicle.axis === "v" ? vehicle.len : 1),
        padding: 2,
        touchAction: "none",
        transition: escaping ? "transform 400ms ease-in" : "none",
        ...(escaping ? { transform: `translateX(${100 / N + 60}%)` } : {}),
        ...style,
      }}
      aria-label={gold ? "Gold car" : `${vehicle.len === 3 ? "Lorry" : "Car"} ${vehicle.id}`}
    >
      <div className={`h-full w-full rounded-[7px] ${gold ? "bg-primary" : "bg-foreground/25"}`} />
    </div>
  );
}

/** The board on its own — used by the stage and by the reveal playback. */
export function UnblockBoard({
  vehicles,
  children,
  size,
}: {
  vehicles: UnblockVehicle[];
  children?: React.ReactNode;
  size?: number;
}) {
  return (
    <div
      className="relative aspect-square w-full rounded-xl border border-border bg-card/60"
      style={size ? { width: size, height: size } : undefined}
    >
      {/* The exit gap. */}
      <div
        className="absolute rounded-r-sm border-y-2 border-r-4 border-primary bg-primary/20"
        style={{ top: pct(UNBLOCK_EXIT_ROW), height: pct(1), width: 10, right: -10 }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${N}, minmax(0, 1fr))`,
        }}
        aria-hidden="true"
      >
        {Array.from({ length: N * N }, (_, i) => (
          <div key={i} className="border border-border/30" />
        ))}
      </div>
      {vehicles.map((vehicle) => (
        <Vehicle key={vehicle.id} vehicle={vehicle} />
      ))}
      {children}
    </div>
  );
}

interface UnblockPuzzleProps {
  puzzle: UnblockPuzzleData;
  phaseStartedAt: number;
  now: number;
  locked: boolean;
  onSubmit: (answer: string) => void;
}

export function UnblockPuzzle({
  puzzle,
  phaseStartedAt,
  now,
  locked,
  onSubmit,
}: UnblockPuzzleProps) {
  const reduced = usePrefersReducedMotion();
  const boardRef = useRef<HTMLDivElement>(null);
  const [vehicles, setVehicles] = useState<UnblockVehicle[]>(() =>
    puzzle.vehicles.map((v) => ({ ...v })),
  );
  const [history, setHistory] = useState<{ state: UnblockVehicle[]; moves: UnblockMove[] }[]>([]);
  const [moves, setMoves] = useState<UnblockMove[]>([]);
  const [escaping, setEscaping] = useState(false);
  const [ghost, setGhost] = useState<{ vehicle: UnblockVehicle; to: number } | null>(null);
  const submitted = useRef(false);
  const movesRef = useRef<UnblockMove[]>([]);
  movesRef.current = moves;

  const lockIn = useCallback(
    (final: UnblockMove[]) => {
      if (submitted.current) return;
      submitted.current = true;
      onSubmit(encodeMoves(final));
    },
    [onSubmit],
  );

  useEffect(() => {
    if (locked) return;
    const remaining = phaseStartedAt + UNBLOCK_TIME_MS - now;
    if (remaining <= 600) lockIn(movesRef.current);
  }, [locked, now, phaseStartedAt, lockIn]);

  const wantedPosition = useCallback((vehicle: UnblockVehicle, dx: number, dy: number) => {
    // Measured live, so a resized or scaled board still steps by whole cells.
    const size = gridCellSize(boardRef.current, N, N);
    const cellPx = vehicle.axis === "h" ? (size?.cellW ?? 52) : (size?.cellH ?? 52);
    const delta = Math.round((vehicle.axis === "h" ? dx : dy) / (cellPx || 52));
    return position(vehicle) + delta;
  }, []);

  const drag = useDragSnap<number>({
    disabled: locked || escaping,
    onMove: (info) => {
      const vehicle = vehicles.find((v) => v.id === info.item);
      if (!vehicle) return;
      const to = clampSlide(vehicles, vehicle.id, wantedPosition(vehicle, info.dx, info.dy));
      setGhost({ vehicle, to });
    },
    onDrop: (info) => {
      setGhost(null);
      const vehicle = vehicles.find((v) => v.id === info.item);
      if (!vehicle) return false;
      const to = clampSlide(vehicles, vehicle.id, wantedPosition(vehicle, info.dx, info.dy));
      if (to === position(vehicle)) return false;
      const next = vehicles.map((entry) =>
        entry.id === vehicle.id
          ? entry.axis === "h"
            ? { ...entry, col: to }
            : { ...entry, row: to }
          : entry,
      );
      const nextMoves = [...moves, { id: vehicle.id, to }];
      setHistory((current) => [...current, { state: vehicles, moves }]);
      setVehicles(next);
      setMoves(nextMoves);
      if (isSolved(next)) {
        setEscaping(true);
        setTimeout(() => lockIn(nextMoves), 420);
      }
      return true;
    },
  });

  const undo = () => {
    const last = history[history.length - 1];
    if (!last || escaping) return;
    setVehicles(last.state);
    setMoves(last.moves);
    setHistory((current) => current.slice(0, -1));
  };

  const reset = () => {
    if (escaping) return;
    setVehicles(puzzle.vehicles.map((v) => ({ ...v })));
    setMoves([]);
    setHistory([]);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between font-mono text-xs uppercase tracking-widest text-muted-foreground">
        <span>
          moves <span className="text-primary">{moves.length}</span>
        </span>
        <span>get the gold car out</span>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div
          ref={boardRef}
          className="relative aspect-square h-auto max-h-full w-full min-w-0 max-w-full"
        >

        <div className="relative h-full w-full rounded-xl border border-border bg-card/60">
          <div
            className="absolute rounded-r-sm border-y-2 border-r-4 border-primary bg-primary/20"
            style={{ top: pct(UNBLOCK_EXIT_ROW), height: pct(1), width: 10, right: -10 }}
            aria-hidden="true"
          />
          <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${N}, minmax(0, 1fr))`,
        }}
        aria-hidden="true"
      >
            {Array.from({ length: N * N }, (_, i) => (
              <div key={i} className="border border-border/30" />
            ))}
          </div>

          {ghost && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute rounded-lg border-2 border-dashed border-primary/70 bg-primary/10"
              style={{
                left: pct(ghost.vehicle.axis === "h" ? ghost.to : ghost.vehicle.col),
                top: pct(ghost.vehicle.axis === "v" ? ghost.to : ghost.vehicle.row),
                width: pct(ghost.vehicle.axis === "h" ? ghost.vehicle.len : 1),
                height: pct(ghost.vehicle.axis === "v" ? ghost.vehicle.len : 1),
              }}
            />
          )}

          {vehicles.map((vehicle) => {
            const dragging = drag.drag?.item === vehicle.id;
            const dx = dragging && vehicle.axis === "h" ? drag.drag!.dx : 0;
            const dy = dragging && vehicle.axis === "v" ? drag.drag!.dy : 0;
            return (
              <Vehicle
                key={vehicle.id}
                vehicle={vehicle}
                onPointerDown={drag.start(vehicle.id)}
                shaking={drag.rejected === vehicle.id}
                escaping={escaping && vehicle.id === 0}
                {...(dragging ? { style: liftStyle(dx, dy, reduced) } : {})}
              />
            );
          })}
          </div>
        </div>
      </div>


      <div className="flex gap-2">
        <button
          type="button"
          onClick={undo}
          disabled={locked || history.length === 0}
          className="press tap-target flex-1 rounded-xl border border-border bg-card font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={locked || moves.length === 0}
          className="press tap-target flex-1 rounded-xl border border-border bg-card font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
