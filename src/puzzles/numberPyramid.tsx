import { gameDisplayName } from "@/lib/duel/gameNames";
import { useGameColumnLayout } from "@/components/puzzles/gameColumn";
import { useContext, useEffect, useRef, useState, type CSSProperties } from "react";

import { devDiagnosticsOn } from "@/lib/arcade/diagnostics";
import {
  npComplete,
  npDecode,
  npDecodeRound,
  npEncodeRound,
  npFilled,
  npBrokenCells,
  npIndex,
  npSeams,
  NP_TRAY_GAP,
  NP_TRAY_MIN_W,
  npTrayRows,
  NP_SET_SIZE,
  type NpPlacements,
  type NpSeam,
} from "@/lib/duel/numberPyramid";
import { useGameKeys } from "@/lib/desktop";
import { useStageState } from "@/lib/duel/stageState";
import { NUMPYRAMID_TIME_MS, type NumberPyramidPuzzleData } from "@/lib/duel/types";
import { Button } from "@/components/ui/button";
import { StageProgress } from "@/components/puzzles/StageProgress";
import { useStageCorrectHold } from "@/components/puzzles/StageCorrect";
import { NUMBER_STAGE_MOMENT_SOUND, NumberStage } from "@/components/puzzles/number/overhaul";
import { gameFx } from "@/lib/fx/kit";
import { npRowsRight } from "@/lib/duel/numberOverhaulFx";
import { RevealBoards, RevealFacts, RevealView, useRevealBoard, type BoardMark, type RevealSide } from "@/components/puzzles/number/RevealParts";
import { PolishStyle, soundCue, useSolveFx } from "@/components/puzzles/numberPolish";
import { wrongMoveFlash } from "@/lib/fx/gameToolkit";
import { GoalLineContext } from "@/components/duel/GameFrame";
import { LiveSummary } from "@/components/puzzles/batchW/LiveSummary";
import "@/polish-layout/batch-w-numpyramid.css";
import "@/polish-number/numpyramid.css";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { useBeforePaint } from "@/components/puzzles/useBeforePaint";
// The Number overhaul's shared look (darker background, navy and champagne controls), loaded with the game.
import "@/polish-layout/number-overhaul.css";

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
/** The gold rows climb one row every 110 ms: five rows are gold well inside the 1 s CORRECT hold. */
const NP_GOLD_ROW_MS = 110;

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
/* Polish batch W (25 Oct 2026, display only; live round only, [data-bw-live]): the same stone and sand, lit. A
   light top bevel, a body about a fifth lighter at the top than the bottom, a shadow under each brick; sockets
   sunk deeper; a soft pool of light behind the pyramid. */
[data-bw-live] .np-row { background: transparent; box-shadow: none; }
[data-bw-live] .np-given { isolation: isolate; background-image: linear-gradient(180deg, rgba(255,255,255,.2) 0%, rgba(255,255,255,0) 42%, rgba(0,0,0,.24) 100%), ${SPECKLE}, linear-gradient(165deg, #847e74 0%, #625d56 52%, #45403a 100%); box-shadow: inset 0 2px 0 rgba(255,255,255,.34), inset 2px 0 0 rgba(255,255,255,.1), inset -2px -3px 0 rgba(0,0,0,.42), 0 5px 8px rgba(0,0,0,.6), 0 1px 0 rgba(0,0,0,.6); }
[data-bw-live] .np-socket { background-image: ${SPECKLE}, linear-gradient(180deg, #0b0a08, #1d1a16 70%, #26221c); box-shadow: inset 0 5px 10px rgba(0,0,0,.9), inset 0 -1px 0 rgba(222,196,150,.14), inset 0 0 0 1px rgba(222,196,150,.2), 0 1px 0 rgba(255,255,255,.06); }
[data-bw-live] .np-block, [data-bw-live] .np-loose, [data-puzzle-surface] [data-bw-live] .pyramid-tray-tile.np-loose { background-image: linear-gradient(180deg, rgba(255,255,255,.26) 0%, rgba(255,255,255,0) 42%, rgba(70,40,10,.22) 100%), ${SANDSTONE} !important; }
[data-bw-live] .np-block { box-shadow: inset 0 2px 0 rgba(255,250,235,.7), inset 2px 0 0 rgba(255,250,235,.3), inset -2px -3px 0 rgba(96,62,22,.45), 0 5px 8px rgba(0,0,0,.6); }
[data-puzzle-surface] [data-bw-live] .pyramid-tray-tile.np-loose:not(.np-picked), [data-bw-live] .pyramid-tray-tile.np-loose:not(.np-picked) { box-shadow: inset 0 2px 0 rgba(255,250,235,.7), inset 2px 0 0 rgba(255,250,235,.3), inset -2px -3px 0 rgba(96,62,22,.45), 0 5px 9px rgba(0,0,0,.6) !important; }
[data-bw-live] [data-game-arena="board"] > .relative { isolation: isolate; }
[data-bw-live] [data-game-arena="board"] > .relative::before { content: ""; position: absolute; inset: -18% -6% -10%; z-index: -1; pointer-events: none; background: radial-gradient(60% 55% at 50% 52%, color-mix(in srgb, var(--category-accent) 30%, transparent), transparent 72%); }
[data-bw-live] .np-quarry { background-image: ${SPECKLE}, linear-gradient(180deg, #100e0c, #221e19 60%, #2a251f); box-shadow: inset 0 4px 10px rgba(0,0,0,.8), inset 0 0 0 1px rgba(222,196,150,.2), 0 1px 0 rgba(255,255,255,.06); }
/* Joe’s phone notes (28 Oct 2026, display only): a completed pyramid’s stones turn gold row by row from the bottom
   during the short CORRECT hold (and the final board’s finish). The layer tints each stone gold (blend "color" keeps
   its light and dark, so the numbers stay readable), lifted by a screen layer with a warm rim; it stays until the next
   pyramid shows. */
.np-gold, .np-gold-lift { position: absolute; inset: 0; z-index: 4; border-radius: 4px; pointer-events: none; opacity: 0; animation: np-gold-in 240ms ease-out forwards; }
.np-gold { background: linear-gradient(165deg, #ffe7a0 0%, #f2c75c 48%, #c9922a 100%); mix-blend-mode: color; }
.np-gold-lift { z-index: 5; background: linear-gradient(180deg, rgba(242,199,92,.55), rgba(201,146,42,.35)); mix-blend-mode: screen; box-shadow: inset 0 0 0 2px rgba(255,222,130,.95), 0 0 8px rgba(255,196,64,.45); }
@keyframes np-gold-in { 0% { opacity: 0; transform: scale(.9); } 60% { opacity: 1; transform: scale(1.04); } 100% { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .np-set, .np-loose { animation: none; transition: none; }
  .np-glow { animation: none; opacity: .7; transform: none; }
  .np-gold, .np-gold-lift { animation: none; opacity: 1; }
}
`;

export function Pyramid({
  rows,
  givens,
  values,
  cellW,
  cellH,
  marks,
  dragFrom,
  lit,
  gold = false,
  fontSize,
  gap = 4,
  plinth = false,
  animate = true,
  seams,
  missed,
  fix,
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
  /** Completed: the stones turn gold, bottom row first (display only). */
  gold?: boolean;
  fontSize?: number;
  gap?: number;
  plinth?: boolean;
  /** Block set-in on a new placement (off for the static reveal). */
  animate?: boolean;
  /** The Number overhaul (display only): the judged sums, a faint gold seam if right, a red crack if wrong. */
  seams?: readonly NpSeam[] | undefined;
  /** Reveal: empty stones the player left (a dashed red outline). */
  missed?: ReadonlySet<number> | undefined;
  /** Reveal, the solution: stones the player didn't have right (a champagne outline). */
  fix?: ReadonlySet<number> | undefined;
}) {
  const size = fontSize ?? Math.round(Math.min(cellH * 0.5, cellW * 0.36));
  const bottomW = rows * cellW + (rows - 1) * gap;
  const boxW = plinth ? bottomW + 8 : bottomW;
  const rowLeft = (r: number) => (boxW - ((r + 1) * cellW + r * gap)) / 2;
  const rowTop = (r: number) => r * (cellH + gap);
  return (
    <div className="np-art relative flex flex-col items-center" style={{ gap }}>
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
                data-np-missed={missed?.has(cell) ? "" : undefined}
                className={`np-stone ${given ? "np-given" : "np-socket"} ${dragFrom === cell ? "opacity-30" : ""}${missed?.has(cell) ? " np-missed" : ""}`}
                style={{ width: cellW, height: cellH, fontSize: size }}
              >
                {given ? value : value != null ? (
                  <span key={`${cell}:${value}`} data-np-wrong={mark === false ? "" : undefined} data-np-fix={fix?.has(cell) ? "" : undefined} className={`np-stone np-block${animate ? " np-set" : ""}${mark === false ? " np-wrong" : ""}${fix?.has(cell) ? " np-fix" : ""}`}>{value}</span>
                ) : null}
                {lit && <span className="np-glow" style={{ animationDelay: `${(rows - 1 - r) * 90}ms` }} />}
                {gold && (
                  <>
                    <span className="np-gold" data-np-gold="" style={{ animationDelay: `${(rows - 1 - r) * NP_GOLD_ROW_MS}ms` }} />
                    <span className="np-gold-lift" style={{ animationDelay: `${(rows - 1 - r) * NP_GOLD_ROW_MS}ms` }} />
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {plinth && <div className="np-plinth" style={{ width: rows * cellW + (rows - 1) * gap + 8, height: 8 }} />}
      {seams?.length ? (
        <svg className="np-seams" width={boxW} height={rows * (cellH + gap)} aria-hidden="true">
          {seams.map(({ row, col, state }) => {
            const x = rowLeft(row) + col * (cellW + gap);
            const cx = x + cellW / 2;
            const yBottom = rowTop(row) + cellH;
            if (state === "right") return <line key={`${row}:${col}`} data-np-seam="right" className="np-seam" x1={x + cellW * 0.16} x2={x + cellW * 0.84} y1={yBottom + gap / 2} y2={yBottom + gap / 2} />;
            const yLow = rowTop(row + 1);
            const points = [
              [cx + 1, yBottom - cellH * 0.22],
              [cx - 3, yBottom - cellH * 0.08],
              [cx + 2, yBottom + gap / 2],
              [cx - 2, yLow + cellH * 0.14],
              [cx + 1.5, yLow + cellH * 0.3],
            ].map(([a, b]) => `${a},${b}`).join(" ");
            return <polyline key={`${row}:${col}`} data-np-seam="wrong" className="np-crack" points={points} />;
          })}
        </svg>
      ) : null}
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
    onAdvance: () => advance(placements),
  });
  // Completion: the final board's sums light from the bottom row up (display only, after the submit).
  const lit = useSolveFx(complete && stage >= NP_SET_SIZE - 1, "numpyramid.solve", 1100);
  const busy = locked || submitted.current || complete;
  // Game review fix (15 Nov 2026, display only): a full pyramid that isn't right gets the shared wrong-move shake with
  // its quiet reject sound, once per arrangement. The Number overhaul (Joe's approval, 15 Nov 2026): its broken sums
  // show as cracks only (the seams below), no red fill on the stones.
  const fullValues = board ? npFilled(board.givens, board.tray, placements) : [];
  const fullWrong = !!board && !complete && fullValues.every((v) => v != null);
  // The Number overhaul (display only): each judged sum shows as a gold seam or a red crack as soon as it can be judged.
  const seams = board ? npSeams(board.givens, fullValues, board.rows) : [];
  const rightSeams = seams.filter((x) => x.state === "right").length;
  const wrongSeams = seams.length - rightSeams;
  // Stage 2 (the effects kit), display only: a sum judged right pops its stone with gold sparks, a wrong one shakes it
  // (each plays its own cue, so the kit's sound is left out); a full row right is the kit's combo, counting up the rows,
  // with `numpyramid.row`.
  const rowsRight = board ? npRowsRight(board.givens, fullValues, board.rows).length : 0;
  const seamKeys = seams.map((x) => `${x.row}:${x.col}:${x.state}`).join(",");
  const seamCounts = useRef({ stage, right: rightSeams, wrong: wrongSeams, rows: rowsRight, keys: seamKeys });
  useEffect(() => {
    const was = seamCounts.current;
    seamCounts.current = { stage, right: rightSeams, wrong: wrongSeams, rows: rowsRight, keys: seamKeys };
    if (was.stage !== stage || locked || submitted.current) return;
    const before = new Set(was.keys ? was.keys.split(",") : []);
    const stoneAt = (row: number, col: number) => box.current?.querySelectorAll<HTMLElement>(".np-row")[row]?.children[col] ?? null;
    for (const seam of seams) {
      if (before.has(`${seam.row}:${seam.col}:${seam.state}`)) continue;
      if (seam.state === "wrong") gameFx("wrong", stoneAt(seam.row, seam.col), { silent: true });
      else if (!complete) gameFx("combo", stoneAt(seam.row, seam.col), { count: 1, silent: true });
    }
    if (rowsRight > was.rows && !complete) {
      soundCue("numpyramid.row");
      const top = npRowsRight(board!.givens, fullValues, board!.rows)[0] ?? 0;
      gameFx("combo", box.current?.querySelectorAll<HTMLElement>(".np-row")[top] ?? null, { count: rowsRight, silent: true });
    } else if (wrongSeams > was.wrong) soundCue("numpyramid.crack");
    else if (rightSeams > was.right && !complete) soundCue("numpyramid.seam");
  }, [stage, rightSeams, wrongSeams, rowsRight, seamKeys, complete, locked]);

  // Stage 2: a stone set on the pyramid drops in with the kit (its own `numpyramid.place` cue plays).
  const [fresh, setFresh] = useState<number | null>(null);
  useEffect(() => {
    if (fresh === null) return;
    gameFx("drop", box.current?.querySelector(`[data-np-cell="${fresh}"] .np-block`) ?? null, { silent: true });
  }, [fresh, placements]);

  // Stage 2: a completed board's gold sweep runs from the bottom row up, a rising note with each row (the kit's
  // stars, one step higher a row). Only when completed here, never on a restore.
  const wasComplete = useRef({ stage, complete });
  const sweepTimers = useRef<number[]>([]);
  useEffect(() => {
    const was = wasComplete.current;
    wasComplete.current = { stage, complete };
    if (!board || !complete || (was.stage === stage && was.complete) || locked) return;
    if (was.stage !== stage) return;
    // The notes outlive a later re-render (the submit locks the stage at once); only unmounting stops them.
    sweepTimers.current = Array.from({ length: board.rows }, (_, i) => window.setTimeout(() => gameFx("stars", null, { count: i + 1, inGame: true }), i * NP_GOLD_ROW_MS));
  }, [stage, complete, board, locked]);
  useEffect(() => () => sweepTimers.current.forEach((t) => window.clearTimeout(t)), []);
  const fullWrongKey = fullWrong ? `${stage}:${npEncodeRound(stage, [placements])}` : "";
  useEffect(() => {
    if (fullWrongKey && !locked && !submitted.current) wrongMoveFlash(box.current?.querySelector("[data-game-arena]") ?? box.current);
  }, [fullWrongKey, locked]);

  const updatePlacements = (next: NpPlacements) => {
    const boards = [...allPlacements]; boards[stage] = next; setAllPlacements(boards);
  };
  const advance = (nextPlacements: NpPlacements) => {
    const boards = [...allPlacements]; boards[stage] = nextPlacements; setAllPlacements(boards);
    setSelected(null); setDrag(null);
    // Skip (or Finish) on a pyramid not complete: its own flat swish, never the stage-complete sound.
    if (board && !npComplete(board.givens, board.tray, nextPlacements, board.rows)) soundCue("numpyramid.skip");
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
  // The Number overhaul's layout pass (Joe, 15 Nov 2026): the tray in balanced rows (npTrayRows), never a tile alone
  // on a row. The board's size reserves the full tray's rows, so it never jumps as tiles are placed.
  const trayWidth = size.width - 16;
  const trayRows = Math.max(1, npTrayRows(board.tray.length, trayWidth).length);
  const looseTray = board.tray.map((_, tray) => tray).filter((tray) => !placedTray.has(tray));
  const looseRows = npTrayRows(looseTray.length, trayWidth);
  const trayPer = Math.max(1, looseRows[0] ?? 1);
  const trayW = Math.max(NP_TRAY_MIN_W, Math.min(64, Math.floor((trayWidth - (trayPer - 1) * NP_TRAY_GAP) / trayPer)));
  const heightFit = Math.floor((size.height - 132 - trayRows * 50 - (board.rows - 1) * 4) / board.rows);
  // Batch W: in a live round the width-limited bricks grow into the spare height (up to 1.15 × their width), never shorter than main's.
  const mainH = Math.max(44, Math.min(Math.round(cellW * 0.82), heightFit));
  const cellH = framed ? Math.max(mainH, Math.min(Math.round(cellW * 1.15), heightFit)) : mainH;
  const fontSize = Math.round(Math.min(cellH * 0.52, cellW * (framed ? 0.42 : 0.38)));

  const drop = (tray: number, from: number | null, cell: number | null) => {
    if (busy) return;
    const next: NpPlacements = { ...placements };
    if (from !== null) delete next[from];
    if (cell !== null) {
      const occupant = next[cell];
      const swap = occupant !== undefined && occupant !== tray && from !== null;
      if (swap) next[from] = occupant;
      next[cell] = tray;
      soundCue(swap ? "numpyramid.swap" : "numpyramid.place");
      setFresh(cell);
    } else if (from !== null) soundCue("numpyramid.unplace");
    updatePlacements(next);
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
      else {
        if (selected?.tray !== d.tray) soundCue("numpyramid.pick");
        setSelected(selected?.tray === d.tray ? null : { tray: d.tray, from: d.from });
      }
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
    <div ref={box} data-polish="numpyramid" data-bw-live={framed ? "" : undefined} data-play-area data-stage-column="1" className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 py-0.5 select-none" style={NO_TOUCH} onPointerMove={move} onPointerUp={(e) => (drag ? end(e) : tapEmpty(e))} onPointerCancel={() => setDrag(null)}>
      {column && <div className="np-spacer" aria-hidden />}
      {/* A skip moves on quietly; a completed pyramid's moment is the shared NumberStage's, with its own sound. */}
      <StageProgress stage={stage} total={NP_SET_SIZE} quiet={stage > 0 && !!data.pyramids[stage - 1] && !npComplete(data.pyramids[stage - 1]!.givens, data.pyramids[stage - 1]!.tray, allPlacements[stage - 1] ?? {}, data.pyramids[stage - 1]!.rows) || NUMBER_STAGE_MOMENT_SOUND} />
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
        <Button type="button" variant="ghost" size="sm" className="np-skip h-11 min-w-11" disabled={busy} onClick={() => advance(placements)}>{stage >= NP_SET_SIZE - 1 ? "Finish" : "Skip"}</Button>
      </div>
      <div data-game-arena="board" className="flex min-h-0 w-full flex-1 items-center justify-center">
        <NumberStage type="numpyramid" index={stage} exit={holding ? "clear" : null} className="justify-center">
        <div className="relative" style={NO_TOUCH}>
          <Pyramid rows={board.rows} givens={board.givens} values={filled.map((v, i) => (drag?.from === i ? null : v))} seams={drag ? undefined : seams} cellW={cellW} cellH={cellH} fontSize={fontSize} lit={lit} gold={complete} plinth animate={false} />
          {/* The pick-up layer sits above the placed blocks (.np-block is z-index 1): below them, taps on a
              placed tile never reached it, so tiles could not be double-tapped back or dragged to another cell. */}
          <div className="absolute inset-0 flex flex-col items-center" style={{ gap: 4, zIndex: 3 }}>
            {Array.from({ length: board.rows }, (_, r) => <div key={r} className="flex" style={{ gap: 4 }}>
              {Array.from({ length: r + 1 }, (_, c) => { const cell = npIndex(r, c); const tray = placements[cell]; return <div key={c} data-np-cell={board.givens[cell] == null ? cell : undefined} className={`rounded-md ${tray !== undefined && selected?.tray === tray ? "ring-2 ring-foreground" : ""}`} style={{ width: cellW, height: cellH }} onPointerDown={tray !== undefined ? (e) => start(e, tray, cell) : undefined} />; })}
            </div>)}
          </div>
        </div>
        </NumberStage>
      </div>
      {column && <div className="np-spacer" aria-hidden />}
      <div data-np-tray data-game-controls="tray" className={`${column ? "" : "mt-auto "}np-quarry flex w-full shrink-0 flex-col items-center justify-start gap-1.5 p-2`} style={{ ...NO_TOUCH, minHeight: trayRows * 50 + 10 }}>
        {looseRows.map((count, row) => {
          const from = looseRows.slice(0, row).reduce((a, b) => a + b, 0);
          return (
            <div key={row} data-np-tray-row={count} className="flex justify-center gap-1.5">
              {looseTray.slice(from, from + count).map((tray) => <div key={tray} className={`${tileClass(tray)} ${drag?.tray === tray ? "opacity-30" : ""}`} style={{ width: trayW, height: 44, fontSize: 22 }} onPointerDown={(e) => start(e, tray, null)}>{board.tray[tray]}</div>)}
            </div>
          );
        })}
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
    // The Number overhaul's reveal: the board's own box (flex-filled, min-height 0), so the pyramid is sized to the space
    // the reveal really has, never to a parent that grows with what it holds.
    const host = root.current;
    if (!host) return;
    const read = () => setSpace({ w: host.clientWidth, h: host.clientHeight });
    const ro = new ResizeObserver(read);
    ro.observe(host); read();
    return () => ro.disconnect();
  }, []);
  return [root, space] as const;
}

/** One pyramid's reveal state (the Number overhaul). */
export interface NpRevealBoard {
  mark: BoardMark;
  mine: (number | null)[];
  solution: (number | null)[] | null;
  /** Placed stones right (true) or wrong (false), by cell. */
  marks: Record<number, boolean>;
  wrong: number;
  empty: number;
  /** The stones the player didn't have right: wrong or empty (for the solution's outline). */
  fix: Set<number>;
  missed: Set<number>;
}

/** Each pyramid's reveal state from the stored answer (solutions where the reveal has them). */
export function npRevealBoards(puzzle: NumberPyramidPuzzleData, myAnswer: string | null): NpRevealBoard[] {
  const decoded = npDecodeRound(myAnswer ?? "");
  return puzzle.pyramids.map((board, index) => {
    const solution = puzzle.solutions?.[index] ?? null;
    const placements = npDecode(decoded.boards[index] ?? "", board.givens, board.tray.length);
    const mine = npFilled(board.givens, board.tray, placements);
    const complete = npComplete(board.givens, board.tray, placements, board.rows);
    const marks: Record<number, boolean> = {};
    const fix = new Set<number>();
    const missed = new Set<number>();
    let wrong = 0;
    // Without a solution the reveal can still judge the sums: a stone in a broken sum is wrong, the rest unmarked.
    const broken = solution ? null : new Set(npBrokenCells(board.givens, mine, board.rows));
    board.givens.forEach((g, cell) => {
      if (g != null) return;
      if (mine[cell] == null) {
        missed.add(cell);
        fix.add(cell);
        return;
      }
      const ok = solution ? mine[cell] === solution[cell] : !broken!.has(cell);
      if (solution || !ok) marks[cell] = ok;
      if (!ok) { wrong++; fix.add(cell); }
    });
    const placed = board.givens.filter((g, cell) => g == null && mine[cell] != null).length;
    return { mark: complete ? "right" : placed ? "wrong" : "open", mine, solution, marks, wrong, empty: missed.size, fix, missed };
  });
}

function npRevealNote(b: NpRevealBoard, side: RevealSide): string {
  if (b.mark === "right") return "Complete";
  if (side === "solution") return "The solution";
  if (b.mark === "open") return "Not reached";
  const parts = [b.wrong ? `${b.wrong} wrong` : null, b.empty ? `${b.empty} empty` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Not complete";
}

function Reveal({ puzzle, myAnswer, myMsRemaining, timeLimitMs }: PuzzleRevealProps) {
  const [dev, setDev] = useState(false);
  useEffect(() => setDev(devDiagnosticsOn()), []);
  const [root, space] = useHostSpace({ w: 343, h: 440 });
  const data = puzzle.type === "numpyramid" ? puzzle : null;
  const boards = data ? npRevealBoards(data, myAnswer) : [];
  // The Number overhaul: one pyramid at a time, big, opening on the first not complete.
  const [index, setIndex] = useRevealBoard(boards.map((b) => b.mark));
  const [side, setSide] = useState<RevealSide>("solution");
  if (!data || !boards.length) return null;
  const cur = boards[index]!;
  const board = data.pyramids[index]!;
  const both = cur.mark !== "right" && cur.solution !== null;
  const view: RevealSide = both ? side : "yours";
  // Brick sizes for one pyramid at the reveal's full width, in the height left by the tabs, switch, note and facts.
  const rows = board.rows;
  const gap = 4;
  const pyramidW = Math.min(space.w, 420) - 12;
  const widthFit = Math.floor((pyramidW - (rows - 1) * gap) / rows);
  // Under the pyramid: the tabs (44 + 12), the switch (44 + 10), the note (24 + 10) and the facts (two rows on a small
  // phone, 52 + 12).
  const room = space.h - 56 - (both ? 54 : 0) - 34 - 64 - (dev ? 16 : 0);
  // Stage 2 (inside the shared reveal layout of #422): the stones keep their shape when the height is the limit (a
  // 375 × 667 phone), narrowing with it rather than squashing flat.
  const heightFit = Math.floor((room - (rows - 1) * gap) / rows);
  const cellW = Math.max(24, Math.min(68, widthFit, Math.round(Math.max(22, heightFit) / 0.86)));
  const cellH = Math.max(22, Math.min(58, heightFit, Math.round(cellW * 0.86)));
  const fontSize = Math.max(14, Math.min(26, Math.floor(Math.min(cellH * 0.56, cellW * 0.44))));
  const done = boards.filter((b) => b.mark === "right").length;
  const wrongTotal = boards.reduce((n, b) => n + b.wrong, 0);
  const used = myMsRemaining === undefined ? null : Math.max(0, (timeLimitMs - myMsRemaining) / 1000);
  return (
    <div ref={root} className="np-rv flex w-full min-h-0 flex-1 flex-col items-center gap-3" data-np-reveal>
      <RevealBoards noun="Pyramid" marks={boards.map((b) => b.mark)} index={index} onIndex={(i) => { setIndex(i); setSide("solution"); }}>
        {both ? <RevealView value={view} onChange={setSide} /> : null}
        <div aria-label={`Pyramid ${index + 1}, ${view === "solution" ? "solution" : "yours"}`} data-np-reveal-view={view}>
          {view === "solution" ? (
            <Pyramid rows={rows} givens={board.givens} values={cur.solution!} cellW={cellW} cellH={cellH} gap={gap} fontSize={fontSize} animate={false} fix={cur.fix} />
          ) : (
            <Pyramid rows={rows} givens={board.givens} values={cur.mine} cellW={cellW} cellH={cellH} gap={gap} fontSize={fontSize} marks={cur.marks} missed={cur.missed} animate={false} gold={cur.mark === "right"} />
          )}
        </div>
        <p className="np-rv-note" data-mark={view === "yours" ? cur.mark : "right"} data-np-reveal-note>{npRevealNote(cur, view)}</p>
      </RevealBoards>
      <RevealFacts
        facts={[
          { label: "Complete", value: `${done} of ${boards.length}`, ...(done === boards.length ? { tone: "good" as const } : {}) },
          { label: "Wrong stones", value: wrongTotal, ...(wrongTotal ? { tone: "miss" as const } : {}) },
          used !== null && { label: "Time", value: `${used.toFixed(1)} s` },
        ]}
      />
      {dev && <p className="font-mono text-[10px] text-muted-foreground">dev · every solution shown</p>}
    </div>
  );
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
