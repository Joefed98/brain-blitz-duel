import { useEffect, useRef, useState, type CSSProperties } from "react";

import { devDiagnosticsOn } from "@/lib/arcade/diagnostics";
import {
  npComplete,
  npDecode,
  npEncode,
  npFilled,
  npIndex,
  NP_ROWS,
  type NpPlacements,
} from "@/lib/duel/numberPyramid";
import { useStageState } from "@/lib/duel/stageState";
import { NUMPYRAMID_TIME_MS, type NumberPyramidPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const NO_TOUCH: CSSProperties = { touchAction: "none", userSelect: "none", WebkitUserSelect: "none" };

function Pyramid({
  rows,
  givens,
  values,
  cellW,
  cellH,
  marks,
  dragFrom,
}: {
  rows: number;
  givens: readonly (number | null)[];
  values: readonly (number | null)[];
  cellW: number;
  cellH: number;
  /** Reveal: true = right, false = wrong, per cell. */
  marks?: Record<number, boolean>;
  dragFrom?: number | null;
}) {
  return (
    <div className="flex flex-col items-center" style={{ gap: 4 }}>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex" style={{ gap: 4 }}>
          {Array.from({ length: r + 1 }, (_, c) => {
            const cell = npIndex(r, c);
            const given = givens[cell] != null;
            const value = values[cell];
            const mark = marks?.[cell];
            const cls = given
              ? "bg-muted text-muted-foreground"
              : value != null
                ? `border-2 bg-card text-primary ${mark === false ? "border-destructive" : "border-primary"}`
                : "border-2 border-dashed border-border bg-background";
            return (
              <div
                key={c}
                data-np-cell={given ? undefined : cell}
                className={`flex items-center justify-center rounded-md font-mono font-bold ${cls} ${dragFrom === cell ? "opacity-30" : ""}`}
                style={{ width: cellW, height: cellH, fontSize: cellH * 0.42 }}
              >
                {value ?? ""}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Three-row example: 12 / 5 7 / 2 3 4, the 5 is dragged in once. */
function IntroExample() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const a = setTimeout(() => setPhase(1), 900);
    const b = setTimeout(() => setPhase(2), 1900);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);
  const givens = [12, null, 7, 2, 3, 4];
  const values = [12, phase === 2 ? 5 : null, 7, 2, 3, 4];
  return (
    <div className="flex flex-col items-center gap-2">
      <Pyramid rows={3} givens={givens} values={values} cellW={40} cellH={32} />
      <div className="relative flex gap-2" style={{ height: 32 }}>
        {[5, 8].map((v) => (
          <div
            key={v}
            className="flex h-8 w-10 items-center justify-center rounded-md border-2 border-primary bg-card font-mono text-sm font-bold text-primary transition-all duration-700"
            style={
              v === 5
                ? { opacity: phase === 2 ? 0 : 1, transform: phase >= 1 ? "translate(-2px, -78px)" : undefined }
                : undefined
            }
          >
            {v}
          </div>
        ))}
      </div>
      <p className="max-w-[260px] text-center text-xs text-muted-foreground">5 = 2 + 3 and 12 = 5 + 7. The 8 is a decoy.</p>
    </div>
  );
}

interface Drag {
  tray: number;
  /** Cell it was lifted from, or null for the tray. */
  from: number | null;
  x: number;
  y: number;
  moved: boolean;
  startX: number;
  startY: number;
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey }: PuzzleStageProps) {
  const data: NumberPyramidPuzzleData | null = puzzle.type === "numpyramid" ? puzzle : null;
  const [placements, setPlacements] = useStageState<NpPlacements>(stateKey ?? "numpyramid", "numPyramidPlacements", () => ({}));
  const [drag, setDrag] = useState<Drag | null>(null);
  const [selected, setSelected] = useState<{ tray: number; from: number | null } | null>(null);
  const submitted = useRef(false);
  const box = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(340);
  const encoded = npEncode(placements);

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const ro = new ResizeObserver(() => setWidth(node.clientWidth));
    ro.observe(node);
    setWidth(node.clientWidth);
    return () => ro.disconnect();
  }, []);

  const complete = data ? npComplete(data.givens, data.tray, placements) : false;
  useEffect(() => {
    if (!complete || submitted.current || locked) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, locked]);

  if (!data) return null;
  const busy = locked || complete;
  const placedTray = new Set(Object.values(placements));
  const filled = npFilled(data.givens, data.tray, placements);
  const cellW = Math.max(44, Math.min(64, Math.floor((width - 16) / NP_ROWS)));
  const cellH = Math.round(cellW * 0.78);

  /** Moves a tile onto a cell (swapping) or back to the tray (cell = null). */
  const drop = (tray: number, from: number | null, cell: number | null) => {
    setPlacements((current) => {
      const next: NpPlacements = { ...current };
      if (from !== null) delete next[from];
      if (cell === null) return next;
      const occupant = next[cell];
      if (occupant !== undefined && occupant !== tray) {
        if (from !== null) next[from] = occupant;
      }
      next[cell] = tray;
      return next;
    });
    buzz(8);
  };

  const targetAt = (x: number, y: number): number | "tray" | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const cellEl = el?.closest("[data-np-cell]") as HTMLElement | null;
    if (cellEl) return Number(cellEl.dataset["npCell"]);
    if (el?.closest("[data-np-tray]")) return "tray";
    return null;
  };

  const start = (event: React.PointerEvent, tray: number, from: number | null) => {
    if (busy) return;
    event.preventDefault();
    (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
    setDrag({ tray, from, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false });
  };

  const move = (event: React.PointerEvent) => {
    if (!drag) return;
    const moved = drag.moved || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 8;
    setDrag({ ...drag, x: event.clientX, y: event.clientY, moved });
  };

  const end = (event: React.PointerEvent) => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) {
      // A tap: pick the tile up, or put the picked tile here.
      if (selected && selected.tray !== d.tray && d.from !== null) {
        drop(selected.tray, selected.from, d.from);
        setSelected(null);
      } else if (selected && selected.tray === d.tray) setSelected(null);
      else setSelected({ tray: d.tray, from: d.from });
      return;
    }
    const target = targetAt(event.clientX, event.clientY);
    if (typeof target === "number") drop(d.tray, d.from, target);
    else if (target === "tray" && d.from !== null) drop(d.tray, d.from, null);
    setSelected(null);
  };

  const tapEmpty = (event: React.PointerEvent) => {
    if (busy || drag || !selected) return;
    const target = targetAt(event.clientX, event.clientY);
    if (typeof target === "number" && placements[target] === undefined) {
      drop(selected.tray, selected.from, target);
      setSelected(null);
    } else if (target === "tray" && selected.from !== null) {
      drop(selected.tray, selected.from, null);
      setSelected(null);
    }
  };

  const tileClass = (tray: number) =>
    `flex items-center justify-center rounded-md border-2 bg-card font-mono font-bold text-primary ${
      selected?.tray === tray ? "border-foreground ring-2 ring-primary" : "border-primary"
    }`;

  return (
    <div
      ref={box}
      data-play-area
      className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-4 py-1 select-none"
      style={NO_TOUCH}
      onPointerMove={move}
      onPointerUp={(e) => (drag ? end(e) : tapEmpty(e))}
      onPointerCancel={() => setDrag(null)}
    >
      <div className="relative" style={NO_TOUCH}>
        <Pyramid rows={NP_ROWS} givens={data.givens} values={filled.map((v, i) => (drag?.from === i ? null : v))} cellW={cellW} cellH={cellH} />
        {/* Placed tiles: an invisible handle over each filled empty cell. */}
        <div className="absolute inset-0 flex flex-col items-center" style={{ gap: 4 }}>
          {Array.from({ length: NP_ROWS }, (_, r) => (
            <div key={r} className="flex" style={{ gap: 4 }}>
              {Array.from({ length: r + 1 }, (_, c) => {
                const cell = npIndex(r, c);
                const tray = placements[cell];
                return (
                  <div
                    key={c}
                    data-np-cell={data.givens[cell] == null ? cell : undefined}
                    className={`rounded-md ${tray !== undefined && selected?.tray === tray ? "ring-2 ring-foreground" : ""}`}
                    style={{ width: cellW, height: cellH }}
                    onPointerDown={tray !== undefined ? (e) => start(e, tray, cell) : undefined}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div data-np-tray className="flex w-full max-w-[360px] flex-wrap justify-center gap-2 rounded-lg bg-muted/40 p-2" style={{ ...NO_TOUCH, minHeight: cellH * 2 + 24 }}>
        {data.tray.map((value, tray) =>
          placedTray.has(tray) ? null : (
            <div
              key={tray}
              className={`${tileClass(tray)} ${drag?.tray === tray ? "opacity-30" : ""}`}
              style={{ width: cellW, height: cellH, fontSize: cellH * 0.42 }}
              onPointerDown={(e) => start(e, tray, null)}
            >
              {value}
            </div>
          ),
        )}
      </div>
      {drag?.moved && (
        <div
          className="pointer-events-none fixed z-50 flex items-center justify-center rounded-md border-2 border-primary bg-card font-mono font-bold text-primary shadow-lg"
          style={{ width: cellW, height: cellH, fontSize: cellH * 0.42, left: drag.x - cellW / 2, top: drag.y - cellH - 12 }}
        >
          {data.tray[drag.tray]}
        </div>
      )}
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  const [dev, setDev] = useState(false);
  useEffect(() => setDev(devDiagnosticsOn()), []);
  if (puzzle.type !== "numpyramid") return null;
  const solution = puzzle.solution ?? [];
  const placements = npDecode(myAnswer ?? "", puzzle.givens, puzzle.tray.length);
  const mine = npFilled(puzzle.givens, puzzle.tray, placements);
  const empties = puzzle.givens.filter((g) => g == null).length;
  const marks: Record<number, boolean> = {};
  let right = 0;
  puzzle.givens.forEach((g, cell) => {
    if (g != null || mine[cell] == null) return;
    marks[cell] = mine[cell] === solution[cell];
    if (marks[cell]) right++;
  });
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex w-full justify-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Solution</span>
          <Pyramid rows={NP_ROWS} givens={puzzle.givens} values={solution} cellW={30} cellH={24} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Yours</span>
          <Pyramid rows={NP_ROWS} givens={puzzle.givens} values={mine} cellW={30} cellH={24} marks={marks} />
        </div>
      </div>
      <p className="font-mono text-base text-primary">{myCorrect ? "Complete" : `${right} / ${empties} placed correctly`}</p>
      {dev && <p className="font-mono text-[10px] text-muted-foreground">dev · solution [{solution.join(", ")}]</p>}
    </div>
  );
}

export const numberPyramidPuzzle: PuzzleDefinition = {
  key: "numpyramid",
  name: "Number Pyramid",
  category: "number",
  timeLimitMs: NUMPYRAMID_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({ type: "numpyramid", givens: new Array(15).fill(1), tray: [] }) satisfies NumberPyramidPuzzleData,
  check: (answer, puzzle) =>
    puzzle.type === "numpyramid" && npComplete(puzzle.givens, puzzle.tray, npDecode(answer, puzzle.givens, puzzle.tray.length)),
  revealHeading: "The solution",
  IntroExample,
  Stage,
  Reveal,
};
