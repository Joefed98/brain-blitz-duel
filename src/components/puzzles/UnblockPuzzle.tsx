import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useGameKeys } from "@/lib/desktop";

import {
  gridCellSize,
  liftStyle,
  useDragSnap,
  usePrefersReducedMotion,
} from "@/components/puzzles/GridDrag";
import { UnblockCarArt, UnblockExitFx, UnblockLot, useUnblockCols } from "@/components/puzzles/pattern/unblockArt";
import { useInFrame } from "@/components/puzzles/batchP/LiveSummary";
import { FramePills, parPills } from "@/components/puzzles/pattern/framePills";
import { soundCue, useSolveMoment } from "@/lib/fx/patternFx";
import { gameFx } from "@/lib/fx/kit";
import { clampSlide, encodeMoves, isSolved, occupancy, position, type UnblockMove } from "@/lib/duel/unblock";
import { usesPatternNov15 } from "@/lib/duel/patternNov15";
import {
  UNBLOCK_COLS,
  UNBLOCK_TIME_MS,
  unblockCols,
  type UnblockPuzzleData,
  type UnblockVehicle,
} from "@/lib/duel/types";

/** A position in bays as a % of the lot's grid (`N` bays a side: 7, or Easy's 6). */
const pct = (value: number, N: number) => `${(value * 100) / N}%`;

/** True when nothing stands between the gold car's nose and the exit (sound only: the lane-cleared glint). */
export function goldLaneClear(vehicles: UnblockVehicle[], N: number = UNBLOCK_COLS): boolean {
  const gold = vehicles.find((v) => v.id === 0);
  if (!gold || gold.axis !== "h") return false;
  const taken = occupancy(vehicles, 0, N);
  for (let col = gold.col + gold.len; col < N; col++) if (taken.has(gold.row * N + col)) return false;
  return true;
}

/**
 * The car standing in a refused drag's way (stage 2, display only): the vehicle on the first cell past the dragged
 * car's nose (or tail) in the way it was pushed; null when it was the kerb. Never used by grading.
 */
export function blockingCar(vehicles: UnblockVehicle[], vehicle: UnblockVehicle, forward: boolean, N: number = UNBLOCK_COLS): number | null {
  const at = forward ? position(vehicle) + vehicle.len : position(vehicle) - 1;
  if (at < 0 || at >= N) return null;
  const cell = vehicle.axis === "h" ? vehicle.row * N + at : at * N + vehicle.col;
  for (const other of vehicles) {
    if (other.id === vehicle.id) continue;
    for (let i = 0; i < other.len; i++) {
      const c = other.axis === "h" ? other.row * N + other.col + i : (other.row + i) * N + other.col;
      if (c === cell) return other.id;
    }
  }
  return null;
}

/** A car's drawn art (its sprite), never the vehicle box the drag reads: the kit animates only this. */
export function carArt(board: HTMLElement | null, id: number): HTMLElement | null {
  return (board?.querySelector(`[data-unblock-car="${id}"] .unblock-car-sprite`) as HTMLElement | null) ?? null;
}

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
  quietShake,
  escaping,
  lifted,
  release,
  settle,
}: {
  vehicle: UnblockVehicle;
  style?: React.CSSProperties;
  onPointerDown?: (event: React.PointerEvent) => void;
  shaking?: boolean;
  /** A blocked drag's shake: it plays its own knock (`unblock.blocked`), so the shared shake observer stays silent. */
  quietShake?: boolean;
  escaping?: boolean;
  lifted?: boolean;
  release?: Release | null;
  /** The live stage (stage 2): a soft bump on the car's art as its glide ends (the kit's `tap`, silent). */
  settle?: boolean;
}) {
  const gold = vehicle.id === 0;
  const N = useUnblockCols();
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef({ col: vehicle.col, row: vehicle.row });
  const reduced = usePrefersReducedMotion();

  // Display only: the car glides from where it was drawn to its new bay.
  useLayoutEffect(() => {
    const from = last.current;
    last.current = { col: vehicle.col, row: vehicle.row };
    const node = ref.current;
    if (!node || (from.col === vehicle.col && from.row === vehicle.row)) return;
    const glideMs = release && release.id === vehicle.id ? 170 : 210;
    // The bump as the car stops: the kit's settle on the car's own art (never the box the drag reads), started where
    // the glide ends; silent, the slide's own scrape ends in the bump. Reduced motion: no glide, the kit's crossfade.
    if (settle) gameFx("tap", node.querySelector(".unblock-car-sprite"), { silent: true, delayMs: reduced ? 0 : glideMs });
    if (reduced) return;
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
      duration: glideMs,
      easing: "cubic-bezier(0.2, 0.8, 0.25, 1)",
    });
  }, [vehicle.col, vehicle.row, release, reduced, vehicle.axis, vehicle.id, settle, N]);

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      data-unblock-car={vehicle.id}
      data-quiet-shake={quietShake ? "" : undefined}
      className={`unblock-car absolute ${gold ? "unblock-car--gold" : ""} ${
        lifted ? "is-lifted" : ""
      } ${escaping ? "unblock-car--escape" : ""} ${shaking ? "animate-shake" : ""}`}
      style={{
        left: pct(vehicle.col, N),
        top: pct(vehicle.row, N),
        width: pct(vehicle.axis === "h" ? vehicle.len : 1, N),
        height: pct(vehicle.axis === "v" ? vehicle.len : 1, N),
        touchAction: "none",
        ["--escape" as string]: `${((vehicle.len + 0.6) / vehicle.len) * 100}%`,
        ...style,
      }}
      aria-label={gold ? "Gold car" : `${vehicle.len === 3 ? "Van" : "Car"} ${vehicle.id}`}
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
  cols,
}: {
  vehicles: UnblockVehicle[];
  children?: React.ReactNode;
  size?: number;
  /** The lot's size (`unblockCols(puzzle)`); 7 by default. */
  cols?: number;
}) {
  return (
    <UnblockLot size={size} cols={cols}>
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
  /** The answer as it stands, for the room's time-out (a reveal that arrives before this stage locks in). */
  onDraftAnswer?: ((answer: string) => void) | undefined;
}

export function UnblockPuzzle({
  puzzle,
  phaseStartedAt,
  now,
  locked,
  onSubmit,
  onDraftAnswer,
}: UnblockPuzzleProps) {
  const reduced = usePrefersReducedMotion();
  const inFrame = useInFrame();
  // The lot's size and the clock (the difficulty levels: Easy's 6×6 lot, Expert's 90 s; absent = 7 and 60 s).
  const N = unblockCols(puzzle);
  const clockMs = puzzle.timeLimitMs ?? UNBLOCK_TIME_MS;
  const boardRef = useRef<HTMLDivElement>(null);
  const [vehicles, setVehicles] = useState<UnblockVehicle[]>(() =>
    puzzle.vehicles.map((v) => ({ ...v })),
  );
  const [history, setHistory] = useState<UnblockVehicle[][]>([]);
  const [moves, setMoves] = useState<UnblockMove[]>([]);
  const [escaping, setEscaping] = useState(false);
  const [ghost, setGhost] = useState<{ vehicle: UnblockVehicle; to: number } | null>(null);
  const [release, setRelease] = useState<Release | null>(null);
  const [knocked, setKnocked] = useState<number | null>(null);
  /** The lane-cleared glint (stage 2): bumps each time a move opens the gold car's lane short of the solve. */
  const [glint, setGlint] = useState(0);
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

  // Every change goes to the room as a draft, so a reveal that arrives before this stage locks in
  // (a backgrounded phone, a stalled clock) still sends the answer as it stands, never "".
  useEffect(() => {
    onDraftAnswer?.(encodeMoves(moves));
  }, [moves, onDraftAnswer]);

  useEffect(() => {
    if (locked) return;
    const remaining = phaseStartedAt + clockMs - now;
    if (remaining <= 600) lockIn(movesRef.current);
  }, [locked, now, phaseStartedAt, lockIn, clockMs]);

  const wantedPosition = useCallback((vehicle: UnblockVehicle, dx: number, dy: number) => {
    // Measured live, so a resized or scaled board still steps by whole cells.
    const size = gridCellSize(boardRef.current, N, N);
    const cellPx = vehicle.axis === "h" ? (size?.cellW ?? 52) : (size?.cellH ?? 52);
    const delta = Math.round((vehicle.axis === "h" ? dx : dy) / (cellPx || 52));
    return position(vehicle) + delta;
  }, [N]);

  const drag = useDragSnap<number>({
    disabled: locked || escaping,
    onMove: (info) => {
      const vehicle = vehicles.find((v) => v.id === info.item);
      if (!vehicle) return;
      const to = clampSlide(vehicles, vehicle.id, wantedPosition(vehicle, info.dx, info.dy), N);
      setGhost({ vehicle, to });
    },
    onDrop: (info) => {
      setGhost(null);
      const vehicle = vehicles.find((v) => v.id === info.item);
      if (!vehicle) return false;
      const wanted = wantedPosition(vehicle, info.dx, info.dy);
      const to = clampSlide(vehicles, vehicle.id, wanted, N);
      if (to === position(vehicle)) {
        // Sound only: a drag pushed into the car (or wall) in the way knocks against it; a plain tap keeps the shake's
        // quiet `wrong`.
        const blocked = wanted !== position(vehicle);
        setKnocked(blocked ? vehicle.id : null);
        if (blocked) soundCue("unblock.blocked");
        if (blocked) {
          // The kit's wrong shake on the car in the way too (its art only; silent: the knock is the sound; no haptic:
          // refused moves give none). The kerb has no car to shake.
          const other = blockingCar(vehicles, vehicle, wanted > position(vehicle), N);
          if (other !== null) gameFx("wrong", carArt(boardRef.current, other), { silent: true, noHaptic: true });
        }
        return false;
      }
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
      // Sound only: a short scrape for one or two bays, a longer one for three or more, each ending in a soft bump.
      soundCue(Math.abs(to - position(vehicle)) >= 3 ? "unblock.slideLong" : "unblock.slide");
      if (!isSolved(next, N) && goldLaneClear(next, N) && !goldLaneClear(vehicles, N)) {
        soundCue("unblock.laneClear");
        setGlint((n) => n + 1);
      }
      if (isSolved(next, N)) {
        setEscaping(true);
        // The drive-out's one sound is `unblock.solve` (useSolveMoment, the next render): its slot plays pz_car_escape
        // and stands in for the generic sounds of that moment (15 Nov 2026, Joe).
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

  // Desktop keys: Z or Backspace = Undo, R = Reset.
  useGameKeys((kind, key, event) => {
    const used = key === "z" || key === "Backspace" || key === "r";
    if (!used || kind !== "down" || event.repeat) return used;
    if (key === "r") {
      if (!locked && moves.length > 0) reset();
    } else if (!locked && history.length > 0) undo();
    return true;
  });

  // unblockRev 4 (the Pattern overhaul): Undo and Reset give the move back, so the count is the slides on the board,
  // as the server counts them; older stamps count every slide played.
  const moveCount = usesPatternNov15(puzzle, "unblock") ? history.length : moves.filter((move) => move.id >= 0).length;

  return (
    <div data-stage-column="3" data-polish="unblock" className="flex min-h-0 flex-1 flex-col gap-3">
      {inFrame ? null : (
        <div className="flex items-center justify-between font-mono text-xs uppercase tracking-widest text-muted-foreground">
          <span>
            moves <span className="text-primary">{moveCount}</span>
          </span>
          <span>get the gold car out</span>
        </div>
      )}

      <div data-game-arena="board" className="unblock-arena flex min-h-0 flex-1 items-center justify-center">
        <UnblockLot cols={N} gridRef={boardRef} celebrate={celebrating} glint={glint > 0 && gold ? { key: glint, fromCol: gold.col + gold.len } : null}>
          {ghost && (
            <div
              aria-hidden="true"
              className={`unblock-ghost pointer-events-none absolute border-dashed ${
                ghost.vehicle.id === 0 ? "unblock-ghost--gold" : ""
              }`}
              style={{
                left: pct(ghost.vehicle.axis === "h" ? ghost.to : ghost.vehicle.col, N),
                top: pct(ghost.vehicle.axis === "v" ? ghost.to : ghost.vehicle.row, N),
                width: pct(ghost.vehicle.axis === "h" ? ghost.vehicle.len : 1, N),
                height: pct(ghost.vehicle.axis === "v" ? ghost.vehicle.len : 1, N),
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
                quietShake={drag.rejected === vehicle.id && knocked === vehicle.id}
                escaping={escaping && vehicle.id === 0 && !reduced}
                lifted={dragging}
                release={release}
                settle
                {...(dragging ? { style: { ...liftStyle(dx, dy, reduced), boxShadow: undefined } } : {})}
              />
            );
          })}
          {celebrating && !reduced && gold && <UnblockExitFx fromCol={gold.col} />}
        </UnblockLot>
      </div>

      {/* unblockRev 1 (depth batch 4): "Moves n" and "Par p" as pills (puzzle polish, 3 Nov 2026). */}
      <FramePills
        testId="unblock"
        items={(puzzle.unblockRev ?? 0) >= 1 && (puzzle.par ?? 0) > 0
          ? parPills("Moves", moveCount, puzzle.par!)
          : [{ id: "moves", label: "Moves", value: moveCount }]}
      />

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
