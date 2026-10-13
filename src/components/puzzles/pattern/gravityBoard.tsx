/**
 * Topsy-Turvy (gravity) board art — presentation only (Pattern polish, 13 Oct 2026).
 * A tilting tray: recessed floor, raised blocks, colour-matched target sockets
 * and shaded balls that roll (CSS transform) to the cells the replay decided.
 * Nothing here reads or writes tilts, grading or timing.
 */
import { useEffect, useMemo, useRef, useState } from "react";

import { gridCellCentre, useGridMetrics } from "@/components/puzzles/GridDrag";
import { gravityLocked, type GravityBalls } from "@/lib/duel/gravity";
import { GRAV_COLS, type GravityDir, type GravityPuzzleData } from "@/lib/duel/types";

export interface GravityBoardProps {
  data: Pick<GravityPuzzleData, "walls" | "targets">;
  balls: GravityBalls;
  colours: readonly string[];
  lean?: GravityDir | null;
  size?: number;
  cols?: number;
  /** The completion moment is playing: the balls light up in turn. */
  solving?: boolean;
}

export function GravityBoard({ data, balls, colours, lean, size, cols = GRAV_COLS, solving = false }: GravityBoardProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const metrics = useGridMetrics(gridRef, cols, cols);
  const walls = useMemo(() => new Set(data.walls), [data.walls]);
  const locked = gravityLocked(balls, data.targets);
  const ballSize = metrics ? Math.max(6, Math.min(metrics.cellW, metrics.cellH) * 0.78) : 0;

  // A ball that has just locked flashes its socket (not on first draw).
  const lockedKey = locked.map((on) => (on ? 1 : 0)).join("");
  const previous = useRef<string | null>(null);
  const [fresh, setFresh] = useState<boolean[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  useEffect(() => {
    const before = previous.current;
    previous.current = lockedKey;
    if (before === null) return;
    const added = lockedKey.split("").map((on, index) => on === "1" && before[index] !== "1");
    if (!added.some(Boolean)) return;
    setFresh(added);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFresh([]), 700);
  }, [lockedKey]);

  const leanName = lean === "U" || lean === "D" || lean === "L" || lean === "R" ? lean : "none";

  return (
    <div
      className={`gravity-board grav-tray relative shrink-0${solving ? " is-solving" : ""}`}
      data-lean={leanName}
      style={{
        width: size ?? "100%",
        height: size ?? "auto",
        aspectRatio: "1 / 1",
        ["--grav-cols" as string]: cols,
      }}
    >
      <div className="grav-well">
        <div
          ref={gridRef}
          className="puzzle-board grav-grid grid h-full w-full gap-[2px]"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols * cols }, (_, cell) => {
            const target = data.targets.indexOf(cell);
            if (walls.has(cell)) return <div key={cell} className="grav-block" />;
            if (target < 0) return <div key={cell} className="grav-floor" />;
            const isLocked = locked[target];
            return (
              <div key={cell} className="grav-floor">
                <span
                  aria-label={isLocked ? "Locked target" : "Target"}
                  className={`grav-socket${isLocked ? " is-locked" : ""}${fresh[target] ? " is-fresh" : ""}`}
                  style={{ ["--ball" as string]: colours[target], ["--order" as string]: target }}
                />
              </div>
            );
          })}
        </div>

        {metrics
          ? balls.map((cell, index) => {
              const centre = gridCellCentre(metrics, cell, cols);
              return (
                <span
                  key={index}
                  aria-hidden="true"
                  className={`grav-ball${locked[index] ? " is-locked" : ""}`}
                  style={{
                    width: ballSize,
                    height: ballSize,
                    transform: `translate(${centre.x - ballSize / 2}px, ${centre.y - ballSize / 2}px)`,
                    ["--ball" as string]: colours[index],
                    ["--order" as string]: index,
                  }}
                >
                  <span className="grav-ball-glow" />
                </span>
              );
            })
          : null}
      </div>
    </div>
  );
}
