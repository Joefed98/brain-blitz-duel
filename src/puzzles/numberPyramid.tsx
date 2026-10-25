import { gameDisplayName } from "@/lib/duel/gameNames";
import { useGameColumnLayout } from "@/components/puzzles/gameColumn";
import { useContext, useEffect, useRef, useState, type CSSProperties } from "react";

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
import { useGameKeys } from "@/lib/desktop";
import { useStageState } from "@/lib/duel/stageState";
import { NUMPYRAMID_TIME_MS, type NumberPyramidPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect } from "@/lib/sound";
import { Button } from "@/components/ui/button";
import { StageProgress } from "@/components/puzzles/StageProgress";
import { StageCorrect, useStageCorrectHold } from "@/components/puzzles/StageCorrect";
import { PolishStyle, soundCue, useSolveFx } from "@/components/puzzles/numberPolish";
import { GoalLineContext } from "@/components/duel/GameFrame";
import { LiveSummary } from "@/components/puzzles/batchW/LiveSummary";
import "@/polish-layout/batch-w-numpyramid.css";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { useBeforePaint } from "@/components/puzzles/useBeforePaint";

const NO_TOUCH: CSSProperties = { touchAction: "none", userSelect: "none", WebkitUserSelect: "none" };

/*
 * Number polish (13 Oct 2026): chiselled stone blocks on a mortar bed. Display only.
 * The speckle texture is one module-constant data URI; every block keeps its cell's exact box,
 * and the art classes avoid the shared surface adapter's tile selectors so it never repaints them.
 */
const SPECKLE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cg%3E${[
  "13,6,.6,000,.1", "14.6,2.3,.8,000,.1", "17.3,2.8,.6,fff,.18", "2.4,22.6,.8,000,.18", "23.1,15.9,.8,000,.1",
  "11.6,5.8,.6,fff,.18", "22.4,27.3,.6,000,.18", "14.9,21.9,.6,000,.18", "24.8,19.9,1.3,fff,.14", "28,9.8,1,fff,.18",
  "35,29.2,1,000,.18", "4.7,16.7,1,fff,.1", "16.9,38.5,.6,fff,.18", "13.6,14,1.3,fff,.18", "2.8,3.7,1,000,.14",
  "2.4,28.1,1.3,fff,.14", "35.5,13.9,1.3,000,.14", "29.5,15.9,1.3,000,.1", "18,22,.8,fff,.14", "28.3,39.5,1.3,000,.1",
  "33.2,7.3,1,000,.1", "18.3,34.8,1.3,fff,.14", "8,33,.9,000,.16", "37,36,.7,fff,.12",
].map((d) => { const [x, y, r, c, a] = d.split(","); return `%3Ccircle cx='${x}' cy='${y}' r='${r}' fill='%23${c}' fill-opacity='${a}'/%3E`; }).join("")}%3C/g%3E%3C/svg%3E")`;
const SANDSTONE = `${SPECKLE}, linear-gradient(165deg, #efd9aa 0%, #d5b27a 50%, #b48b52 100%)`;
const SAND_SHADE = "inset 2px 2px 0 rgba(255,250,235,.55), inset -2px -3px 0 rgba(96,62,22,.4), 0 2px 0 rgba(0,0,0,.45)";
const NP_CSS = `
.np-art { --np-mortar: #342e26; }
.np-row { border-radius: 5px; background: var(--np-mortar); box-shadow: 0 0 0 2px var(--np-mortar); }
.np-stone { position: relative; display: flex; align-items: center; justify-content: center; border-radius: 4px; font-family: var(--font-mono); font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: 0; }
.np-given { background-color: #5c5750; background-image: ${SPECKLE}, linear-gradient(165deg, #7c766d 0%, #5f5a53 52%, #48433d 100%); color: #f7f1e6; box-shadow: inset 2px 2px 0 rgba(255,255,255,.17), inset -2px -3px 0 rgba(0,0,0,.34); text-shadow: 0 -1px 0 rgba(0,0,0,.65), 0 1px 0 rgba(255,255,255,.14); }
.np-socket { background-color: #191714; background-image: ${SPECKLE}, linear-gradient(180deg, #13110e, #24201b); box-shadow: inset 0 3px 6px rgba(0,0,0,.75), inset 0 0 0 1px rgba(222,196,150,.16); }
.np-socket::after { content: ""; position: absolute; inset: 5px; border-radius: 2px; outline: 1px dashed rgba(222,196,150,.3); pointer-events: none; }
.np-block, .np-loose { background-color: #d4b17a; background-image: ${SANDSTONE}; color: #26180a; box-shadow: ${SAND_SHADE}; text-shadow: 0 1px 0 rgba(255,244,220,.5); }
.np-block { position: absolute; inset: 0; z-index: 1; }
.np-block.np-wrong { background-color: #ecc0b4; background-image: ${SPECKLE}, linear-gradient(165deg, #f5d3c9, #dfa797); color: #560c0c; box-shadow: inset 0 0 0 2px #c0262d, 0 2px 0 rgba(0,0,0,.45); text-shadow: none; }
.np-set { animation: np-set 210ms cubic-bezier(.2,.9,.3,1.15) both; }
@keyframes np-set { from { opacity: .35; transform: translateY(-22%) scale(1.08); } to { opacity: 1; transform: none; } }
.np-glow { position: absolute; inset: -1px; z-index: 2; border-radius: 4px; pointer-events: none; opacity: 0; background: radial-gradient(ellipse at 50% 42%, rgba(255,230,150,.62), rgba(255,196,64,.22) 62%, rgba(255,196,64,0) 82%); box-shadow: inset 0 0 0 2px rgba(255,216,112,.95), 0 0 10px 2px rgba(255,190,60,.55); animation: np-lit 740ms ease-out both; }
@keyframes np-lit { 0% { opacity: 0; transform: scale(.92); } 22% { opacity: 1; transform: scale(1.03); } 65% { opacity: .8; transform: scale(1); } 100% { opacity: 0; transform: scale(1); } }
.np-plinth { border-radius: 3px; background-color: #4a453e; background-image: ${SPECKLE}, linear-gradient(180deg, #6e675e, #3c3832); box-shadow: inset 0 1px 0 rgba(255,255,255,.18), 0 3px 6px rgba(0,0,0,.45); }
.np-quarry { border-radius: 10px; background-color: #1c1a17; background-image: ${SPECKLE}, linear-gradient(180deg, #26221d, #161411); box-shadow: inset 0 2px 6px rgba(0,0,0,.6), inset 0 0 0 1px rgba(222,196,150,.15); }
.np-loose { border-radius: 5px; transition: transform 140ms ease-out; }
[data-puzzle-surface] [data-polish] .pyramid-tray-tile.np-loose { border: 0 !important; background-color: #d4b17a !important; background-image: ${SANDSTONE} !important; color: #26180a !important; box-shadow: ${SAND_SHADE} !important; }
.pyramid-tray-tile.np-loose.np-picked, [data-puzzle-surface] [data-polish] .pyramid-tray-tile.np-loose.np-picked { transform: translateY(-3px); box-shadow: 0 0 0 2px #1c1a17, 0 0 0 4px var(--primary), 0 6px 8px rgba(0,0,0,.5) !important; }
.np-ghost { box-shadow: 0 10px 18px rgba(0,0,0,.55), inset 2px 2px 0 rgba(255,250,235,.55) !important; }
.game-column [data-polish="numpyramid"] > .np-spacer { flex: 1 1 0 !important; min-height: 0; margin: 0 !important; }
.np-reveal-label { color: #d9d2c4; }
@media (prefers-reduced-motion: reduce) {
  .np-set, .np-loose { animation: none; transition: none; }
  .np-glow { animation: none; opacity: .7; transform: none; }
}
`;

function Pyramid({
  rows,
  givens,
  values,
  cellW,
  cellH,
  marks,
  dragFrom,
  lit,
  fontSize,
  gap = 4,
  plinth = false,
  animate = true,
}: {
  rows: number;
  givens: readonly (number | null)[];
  values: readonly (number | null)[];
  cellW: number;
  cellH: number;
  /** Reveal: true = right, false = wrong, per cell. */
  marks?: Record<number, boolean>;
  dragFrom?: number | null;
  /** Completion: every row's sums light, bottom row first. */
  lit?: boolean;
  fontSize?: number;
  gap?: number;
  plinth?: boolean;
  /** Block set-in on a new placement (off for the static reveal). */
  animate?: boolean;
}) {
  const size = fontSize ?? Math.round(Math.min(cellH * 0.5, cellW * 0.36));
  return (
    <div className="np-art flex flex-col items-center" style={{ gap }}>
      <PolishStyle id="numpyramid" css={NP_CSS} />
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="np-row flex" style={{ gap }}>
          {Array.from({ length: r + 1 }, (_, c) => {
            const cell = npIndex(r, c);
            const given = givens[cell] != null;
            const value = values[cell];
            const mark = marks?.[cell];
            return (
              <div
                key={c}
                data-np-cell={given ? undefined : cell}
                className={`np-stone ${given ? "np-given" : "np-socket"} ${dragFrom === cell ? "opacity-30" : ""}`}
                style={{ width: cellW, height: cellH, fontSize: size }}
              >
                {given ? value : value != null ? (
                  <span key={`${cell}:${value}`} className={`np-stone np-block${animate ? " np-set" : ""}${mark === false ? " np-wrong" : ""}`}>{value}</span>
                ) : null}
                {lit && <span className="np-glow" style={{ animationDelay: `${(rows - 1 - r) * 90}ms` }} />}
              </div>
            );
          })}
        </div>
      ))}
      {plinth && <div className="np-plinth" style={{ width: rows * cellW + (rows - 1) * gap + 8, height: 8 }} />}
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
            className="np-stone np-loose flex h-8 w-10 items-center justify-center text-sm transition-all duration-700"
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
  const column = useGameColumnLayout();
  // Batch W: inside a live round's frame the goal line shows "Stage n of 4", so the stage's own
  // "Pyramid n of 4" text gives way to the live summary (same row, same height).
  const framed = Boolean(useContext(GoalLineContext));
  const data: NumberPyramidPuzzleData | null = puzzle.type === "numpyramid" ? puzzle : null;
  const key = stateKey ?? "numpyramid";
  const [stage, setStage] = useStageState<number>(key, "numPyramidStage", () => 0);
  const [allPlacements, setAllPlacements] = useStageState<NpPlacements[]>(key, "numPyramidPlacements", () => [{}, {}, {}, {}]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [selected, setSelected] = useState<{ tray: number; from: number | null } | null>(null);
  const submitted = useRef(false);
  const lastPlacedTap = useRef<{ cell: number; at: number } | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 340, height: 500 });
  const board = data?.pyramids[Math.min(stage, NP_SET_SIZE - 1)];
  const placements = allPlacements[stage] ?? {};
  const encoded = npEncodeRound(stage, allPlacements);

  useEffect(() => { onDraftAnswer?.(encoded); }, [encoded, onDraftAnswer]);
  useBeforePaint(() => {
    const node = box.current;
    if (!node) return;
    const measure = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(node); measure();
    return () => ro.disconnect();
  }, []);

  const complete = board ? npComplete(board.givens, board.tray, placements, board.rows) : false;
  const holding = useStageCorrectHold({
    complete,
    finalStage: stage >= NP_SET_SIZE - 1,
    locked: locked || submitted.current,
    stateKey: key,
    onAdvance: () => { playCorrect(); advance(placements); },
  });
  // Completion: the final board's sums light from the bottom row up (display only, after the submit).
  const lit = useSolveFx(complete && stage >= NP_SET_SIZE - 1, "numpyramid.solve", 1100);
  const busy = locked || submitted.current || complete;

  const updatePlacements = (next: NpPlacements) => {
    const boards = [...allPlacements]; boards[stage] = next; setAllPlacements(boards);
  };
  const advance = (nextPlacements: NpPlacements) => {
    const boards = [...allPlacements]; boards[stage] = nextPlacements; setAllPlacements(boards);
    setSelected(null); setDrag(null);
    if (stage >= NP_SET_SIZE - 1) { submitted.current = true; onSubmit(npEncodeRound(NP_SET_SIZE, boards)); return; }
    setStage(stage + 1);
  };

  // Desktop keys: Enter = Skip (on to the next pyramid).
  useGameKeys((kind, pressed, event) => {
    if (!data || !board || pressed !== "Enter") return false;
    if (kind === "down" && !event.repeat && !busy) advance(placements);
    return true;
  });

  if (!data || !board) return null;
  const placedTray = new Set(Object.values(placements));
  const filled = npFilled(board.givens, board.tray, placements);
  const givenCount = board.givens.filter((g) => g != null).length;
  const emptyCount = board.givens.length - givenCount;
  const placedCount = Object.keys(placements).length;
  // The plinth runs 4px past each side of the bottom row.
  const widthFit = Math.floor((size.width - (board.rows - 1) * 4 - 12) / board.rows);
  const cellW = Math.max(44, widthFit);
  const trayW = Math.max(44, Math.floor((size.width - 16 - 5 * 6) / 6));
  const trayRows = Math.ceil(board.tray.length / 6);
  const heightFit = Math.floor((size.height - 132 - trayRows * 50 - (board.rows - 1) * 4) / board.rows);
  const cellH = Math.max(44, Math.min(Math.round(cellW * 0.82), heightFit));
  const fontSize = Math.round(Math.min(cellH * 0.5, cellW * 0.36));

  const drop = (tray: number, from: number | null, cell: number | null) => {
    if (busy) return;
    const next: NpPlacements = { ...placements };
    if (from !== null) delete next[from];
    if (cell !== null) {
      const occupant = next[cell];
      if (occupant !== undefined && occupant !== tray && from !== null) next[from] = occupant;
      next[cell] = tray;
      soundCue("numpyramid.place");
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
    if (busy || !drag) return;
    setDrag({ ...drag, x: event.clientX, y: event.clientY, moved: drag.moved || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 8 });
  };
  const end = (event: React.PointerEvent) => {
    if (busy || !drag) return;
    const d = drag; setDrag(null);
    if (!d.moved) {
      if (d.from !== null) {
        const previous = lastPlacedTap.current;
        lastPlacedTap.current = { cell: d.from, at: event.timeStamp };
        if (previous?.cell === d.from && event.timeStamp - previous.at <= 350) {
          drop(d.tray, d.from, null); setSelected(null); lastPlacedTap.current = null; return;
        }
      }
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
  const tileClass = (tray: number) => `pyramid-tray-tile np-stone np-loose${selected?.tray === tray ? " np-picked" : ""}`;

  return (
    <div ref={box} data-polish="numpyramid" data-play-area data-stage-column="1" className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 py-0.5 select-none" style={NO_TOUCH} onPointerMove={move} onPointerUp={(e) => (drag ? end(e) : tapEmpty(e))} onPointerCancel={() => setDrag(null)}>
      {column && <div className="np-spacer" aria-hidden />}
      <StageProgress stage={stage} total={NP_SET_SIZE} />
      <div className="flex h-11 w-full shrink-0 items-center justify-between">
        {framed ? (
          <div className="min-w-0 flex-1">
            <LiveSummary
              testId="numpyramid"
              parts={[
                `${givenCount} given`,
                `${placedCount} placed`,
                complete ? "complete" : `${Math.max(0, emptyCount - placedCount)} to go`,
              ]}
            />
          </div>
        ) : (
          <p className="font-mono text-xs uppercase text-muted-foreground">Pyramid {stage + 1} of {NP_SET_SIZE}</p>
        )}
        <Button type="button" variant="ghost" size="sm" className="h-11 min-w-11" disabled={busy} onClick={() => advance(placements)}>Skip</Button>
      </div>
      <StageCorrect visible={holding} />
      <div data-game-arena="board" className="flex min-h-0 w-full flex-1 items-center justify-center">
        <div className="relative" style={NO_TOUCH}>
          <Pyramid rows={board.rows} givens={board.givens} values={filled.map((v, i) => (drag?.from === i ? null : v))} cellW={cellW} cellH={cellH} fontSize={fontSize} lit={lit} plinth />
          {/* The pick-up layer sits above the placed blocks (.np-block is z-index 1): below them, taps on a
              placed tile never reached it, so tiles could not be double-tapped back or dragged to another cell. */}
          <div className="absolute inset-0 flex flex-col items-center" style={{ gap: 4, zIndex: 3 }}>
            {Array.from({ length: board.rows }, (_, r) => <div key={r} className="flex" style={{ gap: 4 }}>
              {Array.from({ length: r + 1 }, (_, c) => { const cell = npIndex(r, c); const tray = placements[cell]; return <div key={c} data-np-cell={board.givens[cell] == null ? cell : undefined} className={`rounded-md ${tray !== undefined && selected?.tray === tray ? "ring-2 ring-foreground" : ""}`} style={{ width: cellW, height: cellH }} onPointerDown={tray !== undefined ? (e) => start(e, tray, cell) : undefined} />; })}
            </div>)}
          </div>
        </div>
      </div>
      {column && <div className="np-spacer" aria-hidden />}
      <div data-np-tray data-game-controls="tray" className={`${column ? "" : "mt-auto "}np-quarry flex w-full shrink-0 flex-wrap content-start justify-center gap-1.5 p-2`} style={{ ...NO_TOUCH, minHeight: trayRows * 50 + 10 }}>
        {board.tray.map((value, tray) => placedTray.has(tray) ? null : <div key={tray} className={`${tileClass(tray)} ${drag?.tray === tray ? "opacity-30" : ""}`} style={{ width: trayW, height: 44, fontSize: 21 }} onPointerDown={(e) => start(e, tray, null)}>{value}</div>)}
      </div>
      {/* position is inline: .np-stone's position: relative (NP_CSS, injected after the utilities) beat the fixed class, so the
          ghost joined the column, pushed the pyramid up mid-drag and drops landed between cells. */}
      {drag?.moved && <div className="np-stone np-loose np-ghost pointer-events-none z-50 font-mono" style={{ position: "fixed", width: cellW, height: cellH, fontSize, left: drag.x - cellW / 2, top: drag.y - cellH - 12 }}>{board.tray[drag.tray]}</div>}
    </div>
  );
}

/** Reveal sizing: the space the shared reveal frame gives this board, measured once per resize. */
function useHostSpace(fallback: { w: number; h: number }) {
  const root = useRef<HTMLDivElement | null>(null);
  const [space, setSpace] = useState(fallback);
  useBeforePaint(() => {
    const host = root.current?.parentElement;
    if (!host) return;
    const read = () => setSpace({ w: host.clientWidth, h: host.clientHeight });
    const ro = new ResizeObserver(read);
    ro.observe(host); read();
    return () => ro.disconnect();
  }, []);
  return [root, space] as const;
}

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  const [dev, setDev] = useState(false);
  useEffect(() => setDev(devDiagnosticsOn()), []);
  const [root, space] = useHostSpace({ w: 343, h: 440 });
  if (puzzle.type !== "numpyramid") return null;
  const decoded = npDecodeRound(myAnswer ?? "");
  let completed = 0;
  let totalRight = 0;
  let totalEmpty = 0;
  // Brick sizes: two pyramids a row (solution, yours), four rows, a 14px index column; text never below 12px.
  const rowsMax = Math.max(...puzzle.pyramids.map((b) => b.rows));
  const gap = 3;
  const pyramidW = (space.w - 14 - 8 - 12 - 8) / 2;
  const cellW = Math.max(24, Math.min(40, Math.floor((pyramidW - (rowsMax - 1) * gap) / rowsMax)));
  const perBoard = (space.h - 18 - 28 - (dev ? 16 : 0) - 6 * 5) / 4;
  const cellH = Math.max(15, Math.min(28, Math.floor((perBoard - (rowsMax - 1) * gap) / rowsMax)));
  const fontSize = Math.max(12, Math.min(16, Math.floor(Math.min(cellH * 0.78, cellW * 0.44))));
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
    return <div key={index} className="flex w-full items-center justify-center gap-2" aria-label={`Pyramid ${index + 1}`}>
      <span className="np-reveal-label w-3.5 shrink-0 text-center font-mono text-xs font-bold">{index + 1}</span>
      <div className="flex gap-3"><Pyramid rows={board.rows} givens={board.givens} values={solution} cellW={cellW} cellH={cellH} gap={gap} fontSize={fontSize} animate={false} /><Pyramid rows={board.rows} givens={board.givens} values={mine} cellW={cellW} cellH={cellH} gap={gap} fontSize={fontSize} marks={marks} animate={false} /></div>
    </div>;
  });
  const colW = rowsMax * cellW + (rowsMax - 1) * gap;
  return <div ref={root} className="flex w-full flex-col items-center gap-1.5">
    <div className="flex w-full items-center justify-center gap-2" aria-hidden>
      <span className="w-3.5 shrink-0" />
      <div className="flex gap-3"><span className="np-reveal-label text-center text-xs uppercase tracking-widest" style={{ width: colW }}>Solution</span><span className="np-reveal-label text-center text-xs uppercase tracking-widest" style={{ width: colW }}>Yours</span></div>
    </div>
    {rows}
    <p className="font-mono text-base text-primary">{myCorrect ? "4 / 4 complete" : `${completed} complete · ${totalRight} / ${totalEmpty} cells right`}</p>{dev && <p className="font-mono text-[10px] text-muted-foreground">dev · all four solutions shown</p>}</div>;
}
export const numberPyramidPuzzle: PuzzleDefinition = {
  key: "numpyramid",
  name: gameDisplayName("numpyramid"),
  category: "number",
  timeLimitMs: NUMPYRAMID_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({ type: "numpyramid", pyramids: [
      { rows: 4, givens: new Array(10).fill(1), tray: [] },
      { rows: 5, givens: new Array(15).fill(1), tray: [] },
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
