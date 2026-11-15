import { gameDisplayName } from "@/lib/duel/gameNames";
import { useContext, useEffect, useRef, useState } from "react";
import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { tallySprite } from "@/components/puzzles/attention/attentionArt";
import { tallySpread } from "@/lib/duel/attentionOverhaul";
import { RevealLegend, RevealStats, RevealTabs } from "@/components/puzzles/attention/RevealParts";
import { attnSound } from "@/components/puzzles/attention/attentionFx";
import { gameFx } from "@/lib/fx/kit";
import { FxCountUp } from "@/components/fx/GameFx";
import { fireTallyFinish } from "@/components/puzzles/countUpFx";
import { NumberEntry } from "@/components/puzzles/NumberEntry";
import { registerFxPreview, soundCue } from "@/components/puzzles/speedFx";
import { pick, randInt, shuffled } from "@/lib/duel/random";
import { StageProgress } from "@/components/puzzles/StageProgress";
import { GoalLineContext } from "@/components/duel/GameFrame";
import { useStageState } from "@/lib/duel/stageState";
import { STAGE_COUNT, joinStages, parseCount, splitStages } from "@/lib/duel/stagedRounds";
import {
  COUNTUP_STAGE_SIZES,
  COUNTUP_TIME_MS,
  type CountUpPuzzleData,
  type CountUpStage,
  type CountUpShape,
  type GlyphColour,
  type GlyphShape,
} from "@/lib/duel/types";

import { COUNT_DEPTH_REV, COUNT_TOPUP_REV } from "@/lib/duel/depth/tally";
import { dealtTopupRev } from "@/lib/duel/depthTopup";
import { ATTENTION_REWORK_TIME_MS, countUpCounts, countUpStageTruth, usesCountRev2 } from "@/lib/duel/attentionRev";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { useBeforePaint } from "@/components/puzzles/useBeforePaint";

type SceneShape = CountUpShape["shape"];
const SHAPES: SceneShape[] = ["circle", "square", "triangle", "star", "hexagon"];
const COLOURS: GlyphColour[] = ["RED", "BLUE", "GREEN", "PURPLE", "PINK", "ORANGE", "BROWN"];

/** Colours too alike to tell apart at a glance — never the near-miss pair. */
const TOO_CLOSE: [GlyphColour, GlyphColour][] = [
  ["RED", "ORANGE"],
  ["ORANGE", "BROWN"],
  ["BLUE", "PURPLE"],
];

function tooClose(a: GlyphColour, b: GlyphColour): boolean {
  return TOO_CLOSE.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

const PLURAL: Record<SceneShape, string> = {
  circle: "circles",
  square: "squares",
  triangle: "triangles",
  star: "stars",
  hexagon: "hexagons",
};

/** Display-only palette: the stored BROWN id is drawn and named as white. */
const TALLY_FILL: Partial<Record<GlyphColour, string>> = { BROWN: "var(--tally-white)" };
const TALLY_NAME: Partial<Record<GlyphColour, string>> = { BROWN: "white" };
export function tallyColourName(colour: GlyphColour): string {
  return TALLY_NAME[colour] ?? colour.toLowerCase();
}

export function countUpQuestion(colour: GlyphColour, shape: SceneShape): string {
  return `How many ${tallyColourName(colour)} ${PLURAL[shape]}?`;
}

/** The tray's question: a count, or on countRev 2's fourth tray a comparison of two colours. */
export function countUpStageQuestion(stage: CountUpStage): string {
  if (stage.compare) return `How many more ${tallyColourName(stage.compare.more)} than ${tallyColourName(stage.compare.less)}?`;
  // countRev 6's second tray: a shape alone or a colour alone.
  if (stage.ask === "shape") return `How many ${PLURAL[stage.targetShape]}?`;
  if (stage.ask === "colour") return `How many ${tallyColourName(stage.targetColour)} shapes?`;
  return countUpQuestion(stage.targetColour, stage.targetShape);
}

const STAR_POINTS = "12,2 14.9,8.9 22.4,9.5 16.7,14.4 18.5,21.7 12,17.8 5.5,21.7 7.3,14.4 1.6,9.5 9.1,8.9";

/**
 * Shared bevel for the tray items (Polish, 13 Oct 2026; display only). The gradient is
 * centred so it reads the same at any item rotation: a lit middle and a shaded rim.
 */
export function TallyDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className="pointer-events-none absolute">
      <defs>
        <radialGradient id="tally-bevel" cx="0.5" cy="0.5" r="0.62">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.38" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="0.72" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.32" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/** Same geometry as the shared glyph, with a thin dark outline, a bevel and a soft shadow. */
export function TallyGlyph({ shape, colour, size }: { shape: SceneShape; colour: GlyphColour; size: number }) {
  const fill = TALLY_FILL[colour] ?? GLYPH_COLOURS[colour];
  const common = { fill, stroke: "var(--tally-outline)", strokeWidth: 0.9, strokeLinejoin: "round" as const };
  const bevel = { fill: "url(#tally-bevel)" };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="tally-glyph shrink-0">
      {shape === "circle" && <circle cx="12" cy="12" r="9.5" {...common} />}
      {shape === "square" && <rect x="2.5" y="2.5" width="19" height="19" rx="2" {...common} />}
      {shape === "triangle" && <polygon points="12,2.5 22,21 2,21" {...common} />}
      {shape === "star" && <polygon points={STAR_POINTS} {...common} />}
      {shape === "hexagon" && <polygon points="12,2 20.7,7 20.7,17 12,22 3.3,17 3.3,7" {...common} />}
      {shape === "circle" && <circle cx="12" cy="12" r="9.1" {...bevel} />}
      {shape === "square" && <rect x="2.9" y="2.9" width="18.2" height="18.2" rx="1.7" {...bevel} />}
      {shape === "triangle" && <polygon points="12,3.4 21.3,20.6 2.7,20.6" {...bevel} />}
      {shape === "star" && <polygon points={STAR_POINTS} {...bevel} />}
      {shape === "hexagon" && <polygon points="12,2.5 20.3,7.3 20.3,16.7 12,21.5 3.7,16.7 3.7,7.3" {...bevel} />}
    </svg>
  );
}

/**
 * countRev 7 (the Attention overhaul): a tray spread on its own grid in a box of the grid's shape (cols : rows), every
 * shape a Blender-rendered token sized as a share of the box's width, so no two shapes touch at any size. With
 * `onMark`, a tap marks a shape as counted (a small dot stays on it); marks are a display aid only.
 */
export function SpreadField({
  stage,
  width,
  height,
  marks,
  onMark,
  highlight,
}: {
  stage: CountUpStage;
  width: number;
  height: number;
  marks?: readonly number[];
  onMark?: (index: number) => void;
  highlight?: (item: CountUpShape) => boolean;
}) {
  const aspect = stage.cols / stage.rows;
  const w = Math.max(0, Math.floor(Math.min(width, height * aspect)));
  const h = Math.floor(w / aspect);
  return (
    <div className="tally-tray tally-spread relative shrink-0 overflow-hidden rounded-lg" style={{ width: w, height: h }} data-tally-spread="" data-tally-grid={`${stage.cols}x${stage.rows}`}>
      {stage.shapes.map((item, index) => {
        const px = (item.size / 100) * w;
        const lit = highlight?.(item) ?? false;
        const marked = marks?.includes(index) ?? false;
        const style = { left: `${item.x}%`, top: `${item.y}%`, width: px, height: px };
        const token = (
          <img
            src={tallySprite(item.shape, item.colour)}
            alt=""
            draggable={false}
            className="tally-token pointer-events-none h-full w-full select-none"
            style={{ transform: `rotate(${item.rotation}deg)` }}
          />
        );
        const extras = (
          <>
            {marked ? <span aria-hidden="true" className="tally-mark" data-tally-mark="" /> : null}
            {lit ? <span aria-hidden="true" className="tally-lit" /> : null}
          </>
        );
        return onMark ? (
          <button
            key={index}
            type="button"
            className="tally-spot absolute -translate-x-1/2 -translate-y-1/2 p-0"
            style={style}
            aria-label={`${tallyColourName(item.colour)} ${item.shape}${marked ? ", marked" : ""}`}
            aria-pressed={marked}
            data-tally-shape={index}
            onClick={() => onMark(index)}
          >
            {token}
            {extras}
          </button>
        ) : (
          <span key={index} className="tally-spot absolute -translate-x-1/2 -translate-y-1/2" style={style} data-tally-shape={index} data-tally-lit={lit ? "" : undefined}>
            {token}
            {extras}
          </span>
        );
      })}
    </div>
  );
}

function Field({
  shapes,
  highlight,
  height,
  size = 22,
  play = false,
  cellSize,
  cols,
  rows,
}: {
  cols: number;
  rows: number;
  shapes: CountUpShape[];
  highlight?: (item: CountUpShape) => boolean;
  height?: number;
  size?: number;
  play?: boolean;
  cellSize?: number;
}) {
  return (
    <div
       className={`tally-tray relative w-full overflow-hidden rounded-lg border ${play ? "tally-tray-in" : ""}`}
       style={{ height: play ? "100%" : height }}
    >
      <TallyDefs />
      {shapes.map((item, index) => {
        const lit = highlight !== undefined && highlight(item);
        return (
          <span
            key={index}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
            style={{
              left: `${item.x}%`, top: `${item.y}%`, zIndex: item.layer, transform: `translate(-50%,-50%) rotate(${item.rotation}deg)`,
              padding: lit ? 3 : 0,
              boxShadow: lit ? `inset 0 0 0 2px ${GLYPH_COLOURS.GOLD}` : undefined,
            }}
          >
            <TallyGlyph shape={item.shape} colour={item.colour} size={play ? item.size : Math.min(item.size, size)} />
          </span>
        );
      })}
    </div>
  );
}


/** The Attention overhaul's still: a small spread tray (countRev 7) with one pink star already marked as counted. */
const EXAMPLE_SPREAD: CountUpStage = {
  cols: 3,
  rows: 3,
  targetShape: "star",
  targetColour: "PINK",
  shapes: [
    { shape: "star", colour: "PINK", x: 17, y: 18, size: 22, rotation: 5, layer: 0 },
    { shape: "circle", colour: "BLUE", x: 50, y: 15, size: 22, rotation: 0, layer: 1 },
    { shape: "star", colour: "PINK", x: 82, y: 20, size: 21, rotation: 18, layer: 2 },
    { shape: "triangle", colour: "GREEN", x: 15, y: 50, size: 22, rotation: 12, layer: 3 },
    { shape: "square", colour: "PURPLE", x: 50, y: 52, size: 21, rotation: -10, layer: 4 },
    { shape: "star", colour: "BROWN", x: 83, y: 48, size: 22, rotation: 8, layer: 5 },
    { shape: "circle", colour: "RED", x: 18, y: 84, size: 21, rotation: 0, layer: 6 },
    { shape: "star", colour: "PINK", x: 50, y: 82, size: 22, rotation: -14, layer: 7 },
    { shape: "hexagon", colour: "BLUE", x: 82, y: 83, size: 21, rotation: 0, layer: 8 },
  ],
};

function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="font-display text-base font-bold">How many pink stars?</p>
      <SpreadField stage={EXAMPLE_SPREAD} width={170} height={170} marks={[0]} />
      <p className="text-center text-sm text-muted-foreground">
        Tap a shape to mark it counted. Answer <span className="font-bold text-primary">3</span>
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey = "countup" }: PuzzleStageProps) {
  const data = puzzle.type === "countup" ? puzzle : null;
  const [stage, setStage] = useStageState<number>(stateKey, "countStage", () => 0);
  const trays = data && usesCountRev2(data) ? data.stages.length : STAGE_COUNT;
  const [answers, setAnswers] = useStageState<string[]>(stateKey, "countAnswers", () => Array.from({ length: trays }, () => ""));
  const done = useRef(false);
  const spaceRef = useRef<HTMLDivElement>(null);
  const [space, setSpace] = useState({ width: 0, height: 0 });
  useBeforePaint(() => {
    const node = spaceRef.current;
    if (!node) return;
    const measure = () => setSpace({ width: node.clientWidth, height: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const draft = joinStages(answers, trays);
  useEffect(() => {
    onDraftAnswer?.(draft);
  }, [draft, onDraftAnswer]);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  useEffect(
    () => registerFxPreview("countup", () => fireTallyFinish(spaceRef.current?.querySelector(".tally-tray") ?? null, answersRef.current.map((a, i) => parseCount(a) ?? i + 7))),
    [],
  );
  // The next tray slides onto the shelf (CSS, display only).
  useEffect(() => {
    if (stage > 0 && stage < trays) {
      soundCue("countup.trayIn");
      // The Attention overhaul: the next tray slides in from the right as the last one goes (the tray, never the arena).
      const tray = spaceRef.current?.querySelector("[data-tally-spread]");
      if (tray) gameFx("slide", tray, { from: { x: (tray as HTMLElement).clientWidth, y: 0 }, silent: true });
    }
  }, [stage, trays]);

  // countRev 7: shapes tapped as counted on this tray (cleared when the next tray comes in; never sent).
  const [marks, setMarks] = useState<number[]>([]);
  useEffect(() => setMarks([]), [stage]);
  const spread = tallySpread(data);
  const mark = (index: number) => {
    if (locked || done.current) return;
    attnSound(marks.includes(index) ? "countup.unmark" : "countup.mark", { volume: 0.5 });
    gameFx("tap", spaceRef.current?.querySelector(`[data-tally-shape="${index}"]`), { silent: true });
    setMarks((m) => (m.includes(index) ? m.filter((i) => i !== index) : [...m, index]));
  };

  // Polish batch S: on a live round the goal line shows "Stage n of N", so the question drops its count.
  const framed = useContext(GoalLineContext) !== null;
  const current = data?.stages[Math.min(stage, trays - 1)];
  if (!data || !current) return null;
  const { cols, rows } = current;
  // The board is sized from the visible slot, capped so small grids stay readable.
  const cellSize = Math.max(0, Math.min(64, Math.floor(Math.min(
    (space.width - 2 - (cols - 1) * 4) / cols,
    (space.height - 2 - (rows - 1) * 4) / rows,
  ))));

  const submitStage = (value: string) => {
    if (done.current) return;
    if (stage < trays - 1) attnSound("countup.trayOut", { volume: 0.5 });
    const next = Array.from({ length: trays }, (_, i) => (i === stage ? value : (answers[i] ?? "")));
    setAnswers(next);
    if (stage >= trays - 1) {
      done.current = true;
      // Finish effect fires synchronously, then the answers are submitted exactly as before.
      fireTallyFinish(spaceRef.current?.querySelector(".tally-tray") ?? null, next.map((a) => parseCount(a)));
      onSubmit(joinStages(next, trays));
    } else {
      setStage(stage + 1);
    }
  };

  return (
    <div data-polish="countup" data-stage-column="2" className="flex min-h-0 flex-1 flex-col gap-2">
      <NumberEntry
        label={framed ? countUpStageQuestion(current) : `${stage + 1} / ${trays} · ${countUpStageQuestion(current)}`}
        resetKey={`stage-${stage}`}
        locked={locked || done.current}
        maxLength={2}
        placeholder="How many?"
        keypad
        compactKeypad
        onSubmit={submitStage}
        onKey={(_key, el) => {
          attnSound("countup.key", { volume: 0.45 });
          gameFx("tap", el, { silent: true });
        }}
      >
        <StageProgress stage={stage} total={trays} />
        <div ref={spaceRef} data-tally-space="" className="-mx-1 flex min-h-0 w-[calc(100%+0.5rem)] flex-1 items-center justify-center overflow-hidden">
          {spread ? (
            space.width > 0 && <SpreadField key={stage} stage={current} width={space.width - 4} height={space.height - 4} marks={marks} onMark={mark} />
          ) : (
            cellSize > 0 && <Field key={stage} shapes={current.shapes} cols={cols} rows={rows} size={Math.min(28, cellSize - 8)} cellSize={cellSize} play />
          )}
        </div>
      </NumberEntry>
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  const [shown, setShown] = useState<number | null>(null);
  return puzzle.type === "countup" ? <TallyReveal puzzle={puzzle} myAnswer={myAnswer} shown={shown} setShown={setShown} /> : null;
}

function TallyReveal({ puzzle, myAnswer, shown, setShown }: { puzzle: CountUpPuzzleData; myAnswer: string | null | undefined; shown: number | null; setShown: (n: number) => void }) {
  const revealRef = useRef<HTMLDivElement>(null);
  const rev2 = usesCountRev2(puzzle);
  const parts = splitStages(myAnswer, rev2 ? puzzle.stages.length : STAGE_COUNT);
  const trays = puzzle.stages.map((stage, i) => {
    const truth = rev2 ? countUpStageTruth(stage) : (puzzle.counts?.[i] ?? null);
    const given = parseCount(parts[i] ?? "");
    const exact = truth !== null && given === truth;
    // Near misses that still score: one or two off on stored rounds, only one off on countRev 2.
    const near = truth !== null && given !== null && !exact && Math.abs(given - truth) <= (rev2 ? 1 : 2);
    return { stage, truth, given, exact, near };
  });
  // The Attention overhaul's reveal (15 Nov 2026): one tray at a time, large, the shapes that count ringed gold; the
  // right count against yours in big numbers; a tab for each tray. The first tray you got wrong opens first.
  const open = shown ?? Math.max(0, trays.findIndex((t) => !t.exact));
  const tray = trays[open]!;
  const right = trays.filter((t) => t.exact).length;
  const off = tray.truth !== null && tray.given !== null ? Math.abs(tray.given - tray.truth) : null;
  const verdict = tray.given === null ? "No answer" : tray.exact ? "Exact" : off === 1 ? `So close: ${tray.truth}, you said ${tray.given}` : `Off by ${off}`;
  // The Attention overhaul (stage 2): the counted shapes light one by one while the right count ticks up; one off
  // pulses its verdict softly. Display only, when a tray opens.
  useEffect(() => {
    const lit = Array.from(revealRef.current?.querySelectorAll("[data-tally-lit]") ?? []);
    const step = Math.max(18, Math.min(60, 600 / Math.max(1, lit.length)));
    const timers = lit.map((el, i) =>
      window.setTimeout(() => {
        el.setAttribute("data-lit-on", "");
        attnSound("countup.revealTick", { volume: 0.35, rate: 1 + Math.min(i, 20) * 0.02 });
      }, i * step),
    );
    const near = off === 1 ? window.setTimeout(() => {
      attnSound("countup.soClose", { volume: 0.6 });
      gameFx("nearMiss", revealRef.current?.querySelector('[data-attn-stat="verdict"]'), { inGame: false, silent: true, noHaptic: true });
    }, lit.length * step + 120) : 0;
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(near);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={revealRef} data-polish-reveal="countup" className="attn-rv" data-attn-reveal="countup">
      <RevealTabs
        label="Trays"
        value={open}
        onChange={setShown}
        options={trays.map((t, i) => ({ value: i, label: `Tray ${i + 1}`, tone: t.exact ? "good" : "bad" }))}
      />
      <p className="text-center font-display text-base font-bold leading-snug" data-tally-question="">{countUpStageQuestion(tray.stage)}</p>
      <div className="tally-reveal-tray flex w-full justify-center" data-tally-reveal-tray={open + 1}>
        {tallySpread(puzzle) ? (
          <SpreadField stage={tray.stage} width={340} height={300} highlight={(item) => countUpCounts(tray.stage, item)} />
        ) : (
          <div className="w-full max-w-[340px]">
            <Field shapes={tray.stage.shapes} cols={tray.stage.cols} rows={tray.stage.rows} highlight={(item) => countUpCounts(tray.stage, item)} height={260} size={26} />
          </div>
        )}
      </div>
      <RevealLegend items={[{ mark: "found", label: "Counts" }]} />
      <RevealStats
        game="countup"
        items={[
          { id: "answer", label: "Right count", value: tray.truth === null ? "—" : <FxCountUp key={open} value={tray.truth} silent />, tone: "good" },
          { id: "you", label: "You said", value: tray.given ?? "—", tone: tray.exact ? "good" : "bad" },
          { id: "verdict", label: "This tray", value: <span className="text-base">{verdict}</span>, tone: tray.exact ? "good" : tray.near ? undefined : "bad" },
        ]}
      />
      <p className="text-center text-sm font-semibold text-muted-foreground" data-tally-right="">
        {right} of {trays.length} trays exact
      </p>
    </div>
  );
}

interface Slot {
  shape: SceneShape;
  colour: GlyphColour;
}

/**
 * Target count range per stage, scaled to the field's size. countRev 1 (13 Oct
 * 2026, stamped by moveLimits.server.ts): seven values per tray around the same
 * middles (was 6–10, 8–12, 10–14), so a blind guess is rarely exact or one off.
 * Generation only: stored rounds keep their stored scenes and grade unchanged.
 */
export const COUNTUP_STAGE_COUNTS_REV1: [number, number][] = [[5, 11], [7, 13], [9, 15]];
/**
 * countRev 2 (14 Oct 2026): thirteen values per tray around nearly the same middles, so a
 * blind guess is within one of the answer about one tray in four (with seven values it was
 * three in seven) and two off now scores nothing.
 */
export const COUNTUP_STAGE_COUNTS_REV2: [number, number][] = [[3, 15], [5, 17], [7, 19]];

const SCENE_W = 300;
const SCENE_H = 260;
const VISIBILITY_SAMPLES = 17;

function insideScene(item: CountUpShape): boolean {
  const radius = Math.ceil(item.size * Math.SQRT1_2);
  const x = (item.x / 100) * SCENE_W;
  const y = (item.y / 100) * SCENE_H;
  return x - radius >= 0 && x + radius <= SCENE_W && y - radius >= 0 && y + radius <= SCENE_H;
}

/** Conservative circular masks: if this passes, at least half the glyph's footprint is unobscured. */
export function countUpVisibleShare(item: CountUpShape, shapes: CountUpShape[]): number {
  const radius = item.size / 2;
  const cx = (item.x / 100) * SCENE_W;
  const cy = (item.y / 100) * SCENE_H;
  const above = shapes.filter((other) => other.layer > item.layer);
  let total = 0;
  let visible = 0;
  for (let row = 0; row < VISIBILITY_SAMPLES; row += 1) {
    for (let col = 0; col < VISIBILITY_SAMPLES; col += 1) {
      const dx = ((col + 0.5) / VISIBILITY_SAMPLES * 2 - 1) * radius;
      const dy = ((row + 0.5) / VISIBILITY_SAMPLES * 2 - 1) * radius;
      if (dx * dx + dy * dy > radius * radius) continue;
      total += 1;
      const px = cx + dx;
      const py = cy + dy;
      const covered = above.some((other) => {
        const ox = (other.x / 100) * SCENE_W;
        const oy = (other.y / 100) * SCENE_H;
        const otherRadius = other.size / 2;
        return (px - ox) ** 2 + (py - oy) ** 2 <= otherRadius ** 2;
      });
      if (!covered) visible += 1;
    }
  }
  return total ? visible / total : 0;
}

export function countUpSceneValid(stage: CountUpStage): boolean {
  return stage.shapes.every(insideScene) && stage.shapes
    .filter((item) => countUpCounts(stage, item))
    .every((item) => countUpVisibleShare(item, stage.shapes) >= 0.5);
}

/** One shape at a random spot inside the scene, sized up to `maxSize`. */
function placeShape(slot: Slot, layer: number, maxSize: number): CountUpShape {
  const size = randInt(28, maxSize);
  const bound = Math.ceil(size * Math.SQRT1_2);
  const xMargin = Math.ceil((bound / SCENE_W) * 100) + 1;
  const yMargin = Math.ceil((bound / SCENE_H) * 100) + 1;
  return { shape: slot.shape, colour: slot.colour, x: randInt(xMargin, 100 - xMargin), y: randInt(yMargin, 100 - yMargin), size, rotation: randInt(0, 359), layer };
}

function shapesApart(a: CountUpShape, b: CountUpShape): boolean {
  return Math.hypot(((a.x - b.x) / 100) * SCENE_W, ((a.y - b.y) / 100) * SCENE_H) >= (0.62 * (a.size + b.size)) / 2;
}

/**
 * countRev 2 layout: fillers underneath at random, then each counted shape on top, re-placed
 * (up to 60 times) until it sits clear enough of the counted shapes before it.
 */
function spacedLayout(slots: Slot[], total: number, counts: (slot: Slot) => boolean, countedMax: number): CountUpShape[] {
  const ordered = shuffled(slots.slice(0, total));
  const fill = ordered.filter((slot) => !counts(slot));
  const counted = ordered.filter(counts);
  const shapes: CountUpShape[] = fill.map((slot, index) => placeShape(slot, index, 56));
  const top: CountUpShape[] = [];
  for (const [index, slot] of counted.entries()) {
    let item = placeShape(slot, total + index, countedMax);
    for (let tries = 0; tries < 60 && !top.every((other) => shapesApart(item, other)); tries += 1) item = placeShape(slot, total + index, countedMax);
    top.push(item);
  }
  return [...shapes, ...top];
}

function buildStage(total: number, [min, max]: [number, number], spaced = false): { stage: CountUpStage; count: number } {
  const targetShape = pick(SHAPES);
  const targetColour = pick(COLOURS);
  const count = randInt(min, max);

  // Two near-miss populations with similar counts, so a rough impression fails.
  const otherShape = pick(SHAPES.filter((s) => s !== targetShape));
  const otherColour = pick(COLOURS.filter((c) => c !== targetColour && !tooClose(c, targetColour)));
  const near = () => Math.max(2, count + pick([-2, -1, 1, 2]));
  const nearA = near();
  const nearB = near();

  const slots: Slot[] = [];
  for (let i = 0; i < count; i++) slots.push({ shape: targetShape, colour: targetColour });
  for (let i = 0; i < nearA; i++) slots.push({ shape: otherShape, colour: targetColour });
  for (let i = 0; i < nearB; i++) slots.push({ shape: targetShape, colour: otherColour });

  while (slots.length < total) {
    const shape = pick(SHAPES);
    const colour = pick(COLOURS);
    if (shape === targetShape && colour === targetColour) continue; // never inflate the answer
    if (shape === targetShape && tooClose(colour, targetColour)) continue;
    slots.push({ shape, colour });
  }

  if (spaced) {
    // countRev 2's wider counts (up to 19 on a tray) need the spaced layout to keep every target visible.
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const shapes = spacedLayout(slots, total, (slot) => slot.shape === targetShape && slot.colour === targetColour, 48);
      const stage = { cols: 10, rows: 10, shapes, targetShape, targetColour } satisfies CountUpStage;
      if (countUpSceneValid(stage)) return { stage, count };
    }
  }
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const shapes: CountUpShape[] = shuffled(slots.slice(0, total)).map((slot, index) => {
      const target = slot.shape === targetShape && slot.colour === targetColour;
      const size = randInt(28, 64);
      const bound = Math.ceil(size * Math.SQRT1_2);
      const xMargin = Math.ceil((bound / SCENE_W) * 100) + 1;
      const yMargin = Math.ceil((bound / SCENE_H) * 100) + 1;
      return {
        shape: slot.shape,
        colour: slot.colour,
        x: randInt(xMargin, 100 - xMargin),
        y: randInt(yMargin, 100 - yMargin),
        size,
        rotation: randInt(0, 359),
        layer: target ? total + index : index,
      };
    });
    const stage = { cols: 10, rows: 10, shapes, targetShape, targetColour } satisfies CountUpStage;
    if (countUpSceneValid(stage)) return { stage, count };
  }
  throw new Error(`${gameDisplayName("countup")} scene generation exhausted visibility attempts`);
}

/** countRev 2 tray 4: shapes on the tray, the larger colour's count, and the gap to the smaller. */
export const COUNTUP_COMPARE_SIZE = 50;
/** The smaller colour's count and the gap (the answer), each drawn evenly: thirteen answers, 1–13. */
export const COUNTUP_COMPARE_LESS: [number, number] = [3, 6];
export const COUNTUP_COMPARE_GAP: [number, number] = [1, 13];

/** "How many more red than blue?": every shape of each colour counts, whatever its kind. */
function buildCompareStage(total: number): { stage: CountUpStage; count: number } {
  const more = pick(COLOURS);
  const less = pick(COLOURS.filter((c) => c !== more && !tooClose(c, more)));
  const lessCount = randInt(COUNTUP_COMPARE_LESS[0], COUNTUP_COMPARE_LESS[1]);
  const moreCount = lessCount + randInt(COUNTUP_COMPARE_GAP[0], COUNTUP_COMPARE_GAP[1]);
  // Fillers never use a colour that could be mistaken for either counted one.
  const fillers = COLOURS.filter((c) => c !== more && c !== less && !tooClose(c, more) && !tooClose(c, less));
  const slots: Slot[] = [];
  for (let i = 0; i < moreCount; i++) slots.push({ shape: pick(SHAPES), colour: more });
  for (let i = 0; i < lessCount; i++) slots.push({ shape: pick(SHAPES), colour: less });
  while (slots.length < total) slots.push({ shape: pick(SHAPES), colour: pick(fillers) });
  const compare = { more, less };
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const shapes = spacedLayout(slots, total, (slot) => slot.colour === more || slot.colour === less, 40);
    const stage = { cols: 10, rows: 10, shapes, targetShape: "circle", targetColour: more, compare } satisfies CountUpStage;
    if (countUpSceneValid(stage)) return { stage, count: moreCount - lessCount };
  }
  throw new Error(`${gameDisplayName("countup")} comparison tray exhausted visibility attempts`);
}

/** countRev 6 (puzzleNotes.ts): the second tray's question kind, seeded (rooms deal it once, on the server). */
export const TALLY_ASK_TRAY = 1;
export const TALLY_ASK_KINDS = ["both", "shape", "colour"] as const;

/**
 * countRev 6's "shape" or "colour" tray, on the second tray's size and count range: the asked-for shapes (any
 * colour, or any kind in the asked colour), a near-miss population just off the question (another shape, or a
 * colour that is never a look-alike), and fillers that are neither.
 */
function buildAskStage(total: number, [min, max]: [number, number], ask: "shape" | "colour"): { stage: CountUpStage; count: number } {
  const targetShape = pick(SHAPES);
  const targetColour = pick(COLOURS);
  const count = randInt(min, max);
  const near = Math.max(2, count + pick([-2, -1, 1, 2]));
  const asked = (slot: Slot) => (ask === "shape" ? slot.shape === targetShape : slot.colour === targetColour);
  const slots: Slot[] = [];
  if (ask === "shape") {
    for (let i = 0; i < count; i++) slots.push({ shape: targetShape, colour: pick(COLOURS) });
    const otherShape = pick(SHAPES.filter((x) => x !== targetShape));
    for (let i = 0; i < near; i++) slots.push({ shape: otherShape, colour: pick(COLOURS) });
    while (slots.length < total) {
      const slot = { shape: pick(SHAPES), colour: pick(COLOURS) };
      if (!asked(slot)) slots.push(slot);
    }
  } else {
    for (let i = 0; i < count; i++) slots.push({ shape: pick(SHAPES), colour: targetColour });
    const otherColour = pick(COLOURS.filter((c) => c !== targetColour && !tooClose(c, targetColour)));
    for (let i = 0; i < near; i++) slots.push({ shape: pick(SHAPES), colour: otherColour });
    // Fillers never take the asked colour or one that could be mistaken for it.
    const fillers = COLOURS.filter((c) => c !== targetColour && !tooClose(c, targetColour));
    while (slots.length < total) slots.push({ shape: pick(SHAPES), colour: pick(fillers) });
  }
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const shapes = spacedLayout(slots, total, asked, 48);
    const stage = { cols: 10, rows: 10, shapes, targetShape, targetColour, ask } satisfies CountUpStage;
    if (countUpSceneValid(stage)) return { stage, count };
  }
  throw new Error(`${gameDisplayName("countup")} ${ask} tray exhausted visibility attempts`);
}

/**
 * countRev 6: the second tray's question is one of three kinds, seeded; "both" keeps the tray countRev 5 dealt, the
 * other two rebuild it (same size and count range). generate.server.ts calls this once the stamp is dealt.
 */
export function varyTallyTray(puzzle: CountUpPuzzleData): CountUpPuzzleData {
  const ask = pick([...TALLY_ASK_KINDS]);
  if (ask === "both") return puzzle;
  const built = buildAskStage(COUNTUP_STAGE_SIZES[TALLY_ASK_TRAY], COUNTUP_STAGE_COUNTS_REV2[TALLY_ASK_TRAY]!, ask);
  const stages = puzzle.stages.map((stage, i) => (i === TALLY_ASK_TRAY ? built.stage : stage));
  const counts = puzzle.counts ? puzzle.counts.map((c, i) => (i === TALLY_ASK_TRAY ? built.count : c)) : puzzle.counts;
  return { ...puzzle, stages, ...(counts ? { counts } : {}) };
}

export function buildCountUp(): CountUpPuzzleData {
  const built = COUNTUP_STAGE_SIZES.map((total, i) => buildStage(total, COUNTUP_STAGE_COUNTS_REV2[i]!, true));
  // countRev 2 (14 Oct 2026): a fourth, comparison tray and a 60 s clock stored on the puzzle.
  built.push(buildCompareStage(COUNTUP_COMPARE_SIZE));
  return {
    type: "countup",
    stages: built.map((b) => b.stage),
    counts: built.map((b) => b.count),
    // countRev 3 (25 Oct 2026, depth/tally.ts): the same trays, scored to {max}.
    // The puzzle top-up (26 Oct 2026): countRev 4, the same trays, the depth climb retuned (depth/tally.ts).
    countRev: dealtTopupRev(COUNT_TOPUP_REV, COUNT_DEPTH_REV),
    timeLimitMs: ATTENTION_REWORK_TIME_MS,
  };
}

export const countUpPuzzle: PuzzleDefinition = {
  key: "countup",
  name: gameDisplayName("countup"),
  category: "attention",
  timeLimitMs: COUNTUP_TIME_MS,
  generate: buildCountUp,
  check: (answer, puzzle) => {
    if (puzzle.type !== "countup") return false;
    if (usesCountRev2(puzzle)) {
      const parts4 = splitStages(answer, puzzle.stages.length);
      return puzzle.stages.every((stage, i) => parseCount(parts4[i] ?? "") === countUpStageTruth(stage));
    }
    const parts = splitStages(answer);
    const counts = puzzle.counts ?? [];
    return counts.length === STAGE_COUNT && counts.every((c, i) => parseCount(parts[i] ?? "") === c);
  },
  IntroExample,
  Stage,
  Reveal,
};
