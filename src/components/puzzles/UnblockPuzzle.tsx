import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { playSound } from "@/lib/sound";

import {
  gridCellSize,
  liftStyle,
  useDragSnap,
  usePrefersReducedMotion,
} from "@/components/puzzles/GridDrag";
import { UnblockCarArt, UnblockExitFx, UnblockLot } from "@/components/puzzles/pattern/unblockArt";
import { soundCue, useSolveMoment } from "@/lib/fx/patternFx";
import { clampSlide, encodeMoves, isSolved, position, type UnblockMove } from "@/lib/duel/unblock";
import {
  UNBLOCK_COLS as N,
  UNBLOCK_TIME_MS,
  type UnblockPuzzleData,
  type UnblockVehicle,
} from "@/lib/duel/types";

const pct = (value: number) => `${(value * 100) / N}%`;

/** A slide just released by a drag: where the car was drawn when the finger let go. */
interface Release {
  id: number;
  dx: number;
  dy: number;
}

/** One vehicle, positioned on the board by its row and column. */
function Vehicle({
  vehicle,
  style,
  onPointerDown,
  shaking,
  escaping,
  lifted,
  release,
}: {
  vehicle: UnblockVehicle;
  style?: React.CSSProperties;
  onPointerDown?: (event: React.PointerEvent) => void;
  shaking?: boolean;
  escaping?: boolean;
  lifted?: boolean;
  release?: Release | null;
}) {
  const gold = vehicle.id === 0;
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef({ col: vehicle.col, row: vehicle.row });
  const reduced = usePrefersReducedMotion();

  // Display only: the car glides from where it was drawn to its new bay.
  useLayoutEffect(() => {
    const from = last.current;
    last.current = { col: vehicle.col, row: vehicle.row };
    const node = ref.current;
    if (!node || reduced || (from.col === vehicle.col && from.row === vehicle.row)) return;
    const cell = (node.parentElement?.clientWidth ?? 0) / N;
    if (!cell) return;
    let x = (from.col - vehicle.col) * cell;
    let y = (from.row - vehicle.row) * cell;
    let lift = "";
    if (release && release.id === vehicle.id) {
      x += vehicle.axis === "h" ? release.dx : 0;
      y += (vehicle.axis === "v" ? release.dy : 0) - 6;
      lift = " scale(1.06)";
    }
    node.animate([{ transform: `translate(${x}px, ${y}px)${lift}` }, { transform: "none" }], {
      duration: lift ? 170 : 210,
      easing: "cubic-bezier(0.2, 0.8, 0.25, 1)",
    });
  }, [vehicle.col, vehicle.row, release, reduced, vehicle.axis, vehicle.id]);

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      className={`unblock-car absolute ${gold ? "unblock-car--gold" : ""} ${
        lifted ? "is-lifted" : ""
      } ${escaping ? "unblock-car--escape" : ""} ${shaking ? "animate-shake" : ""}`}
      style={{
        left: pct(vehicle.col),
        top: pct(vehicle.row),
        width: pct(vehicle.axis === "h" ? vehicle.len : 1),
        height: pct(vehicle.axis === "v" ? vehicle.len : 1),
        touchAction: "none",
        ["--escape" as string]: `${((vehicle.len + 0.6) / vehicle.len) * 100}%`,
        ...style,
      }}
      aria-label={gold ? "Gold block" : `${vehicle.len === 3 ? "Long block" : "Block"} ${vehicle.id}`}
    >
      <UnblockCarArt id={vehicle.id} axis={vehicle.axis} len={vehicle.len} />
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
    <UnblockLot size={size}>
      {vehicles.map((vehicle) => (
        <Vehicle key={vehicle.id} vehicle={vehicle} />
      ))}
      {children}
    </UnblockLot>
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
  const [history, setHistory] = useState<UnblockVehicle[][]>([]);
  const [moves, setMoves] = useState<UnblockMove[]>([]);
  const [escaping, setEscaping] = useState(false);
  const [ghost, setGhost] = useState<{ vehicle: UnblockVehicle; to: number } | null>(null);
  const [release, setRelease] = useState<Release | null>(null);
  const celebrating = useSolveMoment(escaping, "unblock.solve");
  const gold = vehicles.find((vehicle) => vehicle.id === 0);
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
      setHistory((current) => [...current, vehicles]);
      setRelease({ id: vehicle.id, dx: info.dx, dy: info.dy });
      setVehicles(next);
      setMoves(nextMoves);
      soundCue("unblock.slide");
      if (isSolved(next)) {
        setEscaping(true);
        playSound("pz_car_escape");
        setTimeout(() => lockIn(nextMoves), 420);
      }
      return true;
    },
  });

  const undo = () => {
    const last = history[history.length - 1];
    if (!last || escaping) return;
    setRelease(null);
    soundCue("unblock.slide");
    setVehicles(last);
    setMoves((current) => [...current, { id: -1, to: 0 }]);
    setHistory((current) => current.slice(0, -1));
  };

  const reset = () => {
    if (escaping) return;
    setRelease(null);
    if (history.length > 0) soundCue("unblock.slide");
    setVehicles(puzzle.vehicles.map((v) => ({ ...v })));
    setMoves((current) => [...current, { id: -2, to: 0 }]);
    setHistory([]);
  };

  return (
    <div data-stage-column="3" data-polish="unblock" className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between font-mono text-xs uppercase tracking-widest text-muted-foreground">
        <span>
          moves <span className="text-primary">{moves.filter((move) => move.id >= 0).length}</span>
        </span>
        <span>get the gold block out</span>
      </div>

      <div data-game-arena="board" className="unblock-arena flex min-h-0 flex-1 items-center justify-center">
        <UnblockLot gridRef={boardRef} celebrate={celebrating}>
          {ghost && (
            <div
              aria-hidden="true"
              className={`unblock-ghost pointer-events-none absolute border-dashed ${
                ghost.vehicle.id === 0 ? "unblock-ghost--gold" : ""
              }`}
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
                escaping={escaping && vehicle.id === 0 && !reduced}
                lifted={dragging}
                release={release}
                {...(dragging ? { style: { ...liftStyle(dx, dy, reduced), boxShadow: undefined } } : {})}
              />
            );
          })}
          {celebrating && !reduced && gold && <UnblockExitFx fromCol={gold.col} />}
        </UnblockLot>
      </div>

      <div data-game-controls="actions" className="flex gap-2">
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
