import { useEffect, useRef, useState, type CSSProperties } from "react";

import { devDiagnosticsOn } from "@/lib/arcade/diagnostics";
import {
  npComplete,
  npCorrectCells,
  npDecode,
  npDecodeRound,
  npEncodeRound,
  npFilled,
  npIndex,
  NP_SET_SIZE,
  type NpPlacements,
} from "@/lib/duel/numberPyramid";
import { useStageState } from "@/lib/duel/stageState";
import { NUMPYRAMID_TIME_MS, type NumberPyramidPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect } from "@/lib/sound";
import { Button } from "@/components/ui/button";
import { StageProgress } from "@/components/puzzles/StageProgress";

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
  const key = stateKey ?? "numpyramid";
  const [stage, setStage] = useStageState<number>(key, "numPyramidStage", () => 0);
  const [allPlacements, setAllPlacements] = useStageState<NpPlacements[]>(key, "numPyramidPlacements", () => [{}, {}, {}]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [selected, setSelected] = useState<{ tray: number; from: number | null } | null>(null);
  const submitted = useRef(false);
  const box = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(340);
  const board = data?.pyramids[Math.min(stage, NP_SET_SIZE - 1)];
  const placements = allPlacements[stage] ?? {};
  const encoded = npEncodeRound(stage, allPlacements);

  useEffect(() => { onDraftAnswer?.(encoded); }, [encoded, onDraftAnswer]);
  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const ro = new ResizeObserver(() => setWidth(node.clientWidth));
    ro.observe(node); setWidth(node.clientWidth);
    return () => ro.disconnect();
  }, []);

  const complete = board ? npComplete(board.givens, board.tray, placements, board.rows) : false;
  const busy = locked || submitted.current;

  const updatePlacements = (next: NpPlacements) => {
    const boards = [...allPlacements]; boards[stage] = next; setAllPlacements(boards);
  };
  const advance = (nextPlacements: NpPlacements) => {
    const boards = [...allPlacements]; boards[stage] = nextPlacements; setAllPlacements(boards);
    setSelected(null); setDrag(null);
    if (stage >= NP_SET_SIZE - 1) { submitted.current = true; onSubmit(npEncodeRound(stage, boards)); return; }
    setStage(stage + 1);
  };

  useEffect(() => {
    if (!complete || busy || !board) return;
    playCorrect();
    const id = window.setTimeout(() => advance(placements), 220);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, locked]);

  if (!data || !board) return null;
  const placedTray = new Set(Object.values(placements));
  const filled = npFilled(board.givens, board.tray, placements);
  const cellW = Math.max(38, Math.min(board.rows === 4 ? 58 : 52, Math.floor((width - 16) / board.rows)));
  const cellH = Math.round(cellW * 0.72);

  const drop = (tray: number, from: number | null, cell: number | null) => {
    const next: NpPlacements = { ...placements };
    if (from !== null) delete next[from];
    if (cell !== null) {
      const occupant = next[cell];
      if (occupant !== undefined && occupant !== tray && from !== null) next[from] = occupant;
      next[cell] = tray;
    }
    updatePlacements(next); buzz(8);
  };
  const targetAt = (x: number, y: number): number | "tray" | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const cellEl = el?.closest("[data-np-cell]") as HTMLElement | null;
    if (cellEl) return Number(cellEl.dataset["npCell"]);
    return el?.closest("[data-np-tray]") ? "tray" : null;
  };
  const start = (event: React.PointerEvent, tray: number, from: number | null) => {
    if (busy) return;
    event.preventDefault(); (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
    setDrag({ tray, from, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false });
  };
  const move = (event: React.PointerEvent) => {
    if (!drag) return;
    setDrag({ ...drag, x: event.clientX, y: event.clientY, moved: drag.moved || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 8 });
  };
  const end = (event: React.PointerEvent) => {
    if (!drag) return;
    const d = drag; setDrag(null);
    if (!d.moved) {
      if (selected && selected.tray !== d.tray && d.from !== null) { drop(selected.tray, selected.from, d.from); setSelected(null); }
      else setSelected(selected?.tray === d.tray ? null : { tray: d.tray, from: d.from });
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
    if (typeof target === "number" && placements[target] === undefined) { drop(selected.tray, selected.from, target); setSelected(null); }
    else if (target === "tray" && selected.from !== null) { drop(selected.tray, selected.from, null); setSelected(null); }
  };
  const tileClass = (tray: number) => `flex items-center justify-center rounded-md border-2 bg-card font-mono font-bold text-primary ${selected?.tray === tray ? "border-foreground ring-2 ring-primary" : "border-primary"}`;

  return (
    <div ref={box} data-play-area className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-2 py-1 select-none" style={NO_TOUCH} onPointerMove={move} onPointerUp={(e) => (drag ? end(e) : tapEmpty(e))} onPointerCancel={() => setDrag(null)}>
      <StageProgress stage={stage} />
      <div className="flex w-full items-center justify-between">
        <p className="font-mono text-xs uppercase text-muted-foreground">Pyramid {stage + 1} of 3</p>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => advance(placements)}>Skip</Button>
      </div>
      <div className="relative" style={NO_TOUCH}>
        <Pyramid rows={board.rows} givens={board.givens} values={filled.map((v, i) => (drag?.from === i ? null : v))} cellW={cellW} cellH={cellH} />
        <div className="absolute inset-0 flex flex-col items-center" style={{ gap: 4 }}>
          {Array.from({ length: board.rows }, (_, r) => <div key={r} className="flex" style={{ gap: 4 }}>
            {Array.from({ length: r + 1 }, (_, c) => { const cell = npIndex(r, c); const tray = placements[cell]; return <div key={c} data-np-cell={board.givens[cell] == null ? cell : undefined} className={`rounded-md ${tray !== undefined && selected?.tray === tray ? "ring-2 ring-foreground" : ""}`} style={{ width: cellW, height: cellH }} onPointerDown={tray !== undefined ? (e) => start(e, tray, cell) : undefined} />; })}
          </div>)}
        </div>
      </div>
      <div data-np-tray className="flex w-full max-w-[360px] flex-wrap justify-center gap-1.5 rounded-lg bg-muted/40 p-2" style={{ ...NO_TOUCH, minHeight: cellH * 2 + 20 }}>
        {board.tray.map((value, tray) => placedTray.has(tray) ? null : <div key={tray} className={`${tileClass(tray)} ${drag?.tray === tray ? "opacity-30" : ""}`} style={{ width: cellW, height: cellH, fontSize: cellH * 0.42 }} onPointerDown={(e) => start(e, tray, null)}>{value}</div>)}
      </div>
      {drag?.moved && <div className="pointer-events-none fixed z-50 flex items-center justify-center rounded-md border-2 border-primary bg-card font-mono font-bold text-primary shadow-lg" style={{ width: cellW, height: cellH, fontSize: cellH * 0.42, left: drag.x - cellW / 2, top: drag.y - cellH - 12 }}>{board.tray[drag.tray]}</div>}
    </div>
  );
}
function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  const [dev, setDev] = useState(false);
  useEffect(() => setDev(devDiagnosticsOn()), []);
  if (puzzle.type !== "numpyramid") return null;
  const decoded = npDecodeRound(myAnswer ?? "");
  let completed = 0;
  let totalRight = 0;
  let totalEmpty = 0;
  const rows = puzzle.pyramids.map((board, index) => {
    const solution = puzzle.solutions?.[index] ?? [];
    const placements = npDecode(decoded.boards[index] ?? "", board.givens, board.tray.length);
    const mine = npFilled(board.givens, board.tray, placements);
    const right = npCorrectCells(board.givens, board.tray, solution, placements);
    const empties = board.givens.filter((g) => g == null).length;
    const complete = npComplete(board.givens, board.tray, placements, board.rows);
    if (complete) completed++; totalRight += right; totalEmpty += empties;
    const marks: Record<number, boolean> = {};
    board.givens.forEach((g, cell) => { if (g == null && mine[cell] != null) marks[cell] = mine[cell] === solution[cell]; });
    return <div key={index} className="flex flex-col items-center gap-1">
      <span className="text-xs uppercase text-muted-foreground">Pyramid {index + 1}</span>
      <div className="flex gap-2"><Pyramid rows={board.rows} givens={board.givens} values={solution} cellW={22} cellH={18} /><Pyramid rows={board.rows} givens={board.givens} values={mine} cellW={22} cellH={18} marks={marks} /></div>
    </div>;
  });
  return <div className="flex w-full flex-col items-center gap-2">{rows}<p className="font-mono text-base text-primary">{myCorrect ? "3 / 3 complete" : `${completed} complete · ${totalRight} / ${totalEmpty} cells right`}</p>{dev && <p className="font-mono text-[10px] text-muted-foreground">dev · all three solutions shown</p>}</div>;
}
export const numberPyramidPuzzle: PuzzleDefinition = {
  key: "numpyramid",
  name: "Number Pyramid",
  category: "number",
  timeLimitMs: NUMPYRAMID_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({ type: "numpyramid", pyramids: [
      { rows: 4, givens: new Array(10).fill(1), tray: [] },
      { rows: 5, givens: new Array(15).fill(1), tray: [] },
      { rows: 5, givens: new Array(15).fill(1), tray: [] },
    ] }) satisfies NumberPyramidPuzzleData,
  check: (answer, puzzle) => {
    if (puzzle.type !== "numpyramid") return false;
    const decoded = npDecodeRound(answer);
    return puzzle.pyramids.every((board, index) => npComplete(board.givens, board.tray, npDecode(decoded.boards[index] ?? "", board.givens, board.tray.length), board.rows));
  },
  revealHeading: "The solutions",
  IntroExample,
  Stage,
  Reveal,
};
