import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useRef, useState } from "react";
import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { fireTallyFinish } from "@/components/puzzles/countUpFx";
import { NumberEntry } from "@/components/puzzles/NumberEntry";
import { registerFxPreview, soundCue } from "@/components/puzzles/speedFx";
import { pick, randInt, shuffled } from "@/lib/duel/random";
import { StageProgress } from "@/components/puzzles/StageProgress";
import { useStageState } from "@/lib/duel/stageState";
import { STAGE_COUNT, countStagePoints, joinStages, parseCount, splitStages } from "@/lib/duel/stagedRounds";
import {
  COUNTUP_STAGE_SIZES,
  COUNTUP_TIME_MS,
  type CountUpPuzzleData,
  type CountUpStage,
  type CountUpShape,
  type GlyphColour,
  type GlyphShape,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

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

const STAR_POINTS = "12,2 14.9,8.9 22.4,9.5 16.7,14.4 18.5,21.7 12,17.8 5.5,21.7 7.3,14.4 1.6,9.5 9.1,8.9";

/**
 * Shared bevel for the tray items (Polish, 13 Oct 2026; display only). The gradient is
 * centred so it reads the same at any item rotation: a lit middle and a shaded rim.
 */
function TallyDefs() {
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
function TallyGlyph({ shape, colour, size }: { shape: SceneShape; colour: GlyphColour; size: number }) {
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
  highlight?: { shape: SceneShape; colour: GlyphColour };
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
        const lit =
          highlight !== undefined &&
          item.shape === highlight.shape &&
          item.colour === highlight.colour;
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

/** Fixed intro example — three gold stars among other shapes, every time. */
const EXAMPLE_SHAPES: CountUpShape[] = [
  { shape: "star", colour: "GOLD", x: 18, y: 24, size: 30, rotation: 5, layer: 1 },
  { shape: "circle", colour: "BLUE", x: 42, y: 18, size: 38, rotation: 0, layer: 2 },
  { shape: "star", colour: "GOLD", x: 68, y: 34, size: 32, rotation: 20, layer: 3 },
  { shape: "triangle", colour: "GREEN", x: 84, y: 20, size: 34, rotation: 18, layer: 4 },
  { shape: "square", colour: "PURPLE", x: 30, y: 58, size: 42, rotation: 32, layer: 5 },
  { shape: "star", colour: "PINK", x: 54, y: 62, size: 28, rotation: 8, layer: 6 },
  { shape: "star", colour: "GOLD", x: 78, y: 74, size: 36, rotation: 28, layer: 7 },
  { shape: "circle", colour: "RED", x: 16, y: 80, size: 40, rotation: 0, layer: 8 },
  { shape: "triangle", colour: "BLUE", x: 46, y: 84, size: 32, rotation: 14, layer: 9 },
];

function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="font-display text-base font-bold">How many gold stars?</p>
      <Field shapes={EXAMPLE_SHAPES} height={140} size={20} cols={8} rows={6} />
      <p className="font-mono text-sm text-muted-foreground">
        answer <span className="font-bold text-primary">3</span>
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey = "countup" }: PuzzleStageProps) {
  const data = puzzle.type === "countup" ? puzzle : null;
  const [stage, setStage] = useStageState<number>(stateKey, "countStage", () => 0);
  const [answers, setAnswers] = useStageState<string[]>(stateKey, "countAnswers", () => ["", "", ""]);
  const done = useRef(false);
  const spaceRef = useRef<HTMLDivElement>(null);
  const [space, setSpace] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const node = spaceRef.current;
    if (!node) return;
    const measure = () => setSpace({ width: node.clientWidth, height: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const draft = joinStages(answers);
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
    if (stage > 0 && stage < STAGE_COUNT) soundCue("countup.trayIn");
  }, [stage]);

  const current = data?.stages[Math.min(stage, STAGE_COUNT - 1)];
  if (!data || !current) return null;
  const { cols, rows } = current;
  // The board is sized from the visible slot, capped so small grids stay readable.
  const cellSize = Math.max(0, Math.min(64, Math.floor(Math.min(
    (space.width - 2 - (cols - 1) * 4) / cols,
    (space.height - 2 - (rows - 1) * 4) / rows,
  ))));

  const submitStage = (value: string) => {
    if (done.current) return;
    const next = answers.map((a, i) => (i === stage ? value : a));
    setAnswers(next);
    if (stage >= STAGE_COUNT - 1) {
      done.current = true;
      // Finish effect fires synchronously, then the answers are submitted exactly as before.
      fireTallyFinish(spaceRef.current?.querySelector(".tally-tray") ?? null, next.map((a) => parseCount(a)));
      onSubmit(joinStages(next));
    } else {
      setStage(stage + 1);
    }
  };

  return (
    <div data-polish="countup" data-stage-column="2" className="flex min-h-0 flex-1 flex-col gap-2">
      <NumberEntry
        label={`${stage + 1} / 3 · ${countUpQuestion(current.targetColour, current.targetShape)}`}
        resetKey={`stage-${stage}`}
        locked={locked || done.current}
        maxLength={2}
        placeholder="How many?"
        keypad
        compactKeypad
        onSubmit={submitStage}
      >
        <StageProgress stage={stage} />
        <div ref={spaceRef} className="-mx-1 flex min-h-0 w-[calc(100%+0.5rem)] flex-1 items-center justify-center overflow-hidden">
          {cellSize > 0 && (
            <Field key={stage} shapes={current.shapes} cols={cols} rows={rows} size={Math.min(28, cellSize - 8)} cellSize={cellSize} play />
          )}
        </div>
      </NumberEntry>
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "countup") return null;
  const parts = splitStages(myAnswer);
  // Compact rows (Polish, 13 Oct 2026): a small tray beside each question, so all three
  // stages fit one phone screen. The answer line renders the same text as before.
  return (
    <div data-polish-reveal="countup" className="flex w-full flex-col gap-2">
      {puzzle.stages.map((stage, i) => {
        const truth = puzzle.counts?.[i] ?? null;
        const given = parseCount(parts[i] ?? "");
        const exact = truth !== null && given === truth;
        const near = truth !== null && !exact && countStagePoints(i, given, truth) > 0;
        return (
          <div key={i} className="tally-reveal-row flex w-full items-center gap-3 rounded-2xl bg-card px-2.5 py-2">
            <div className="w-[112px] shrink-0">
              <Field
                shapes={stage.shapes}
                cols={stage.cols}
                rows={stage.rows}
                highlight={{ shape: stage.targetShape, colour: stage.targetColour }}
                height={Math.round(9.7 * stage.rows)}
                size={10}
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="font-display text-sm font-bold leading-snug">{countUpQuestion(stage.targetColour, stage.targetShape)}</p>
              <p className="font-mono text-base font-bold leading-snug">
                <span className="text-primary">Answer {truth ?? "—"}</span>
                <span className={exact ? "text-primary" : near ? "text-foreground" : "text-warn"}>
                  {" · "}you {given ?? "—"} {exact ? "✓" : near ? "~" : "✗"}
                </span>
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface Slot {
  shape: SceneShape;
  colour: GlyphColour;
}

/** Target count range per stage, scaled to the field's size. */
const STAGE_COUNTS: [number, number][] = [[6, 10], [8, 12], [10, 14]];

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
    .filter((item) => item.shape === stage.targetShape && item.colour === stage.targetColour)
    .every((item) => countUpVisibleShare(item, stage.shapes) >= 0.5);
}

function buildStage(total: number, [min, max]: [number, number]): { stage: CountUpStage; count: number } {
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

export function buildCountUp(): CountUpPuzzleData {
  const built = COUNTUP_STAGE_SIZES.map((total, i) => buildStage(total, STAGE_COUNTS[i]!));
  return { type: "countup", stages: built.map((b) => b.stage), counts: built.map((b) => b.count) };
}

export const countUpPuzzle: PuzzleDefinition = {
  key: "countup",
  name: gameDisplayName("countup"),
  category: "attention",
  timeLimitMs: COUNTUP_TIME_MS,
  generate: buildCountUp,
  check: (answer, puzzle) => {
    if (puzzle.type !== "countup") return false;
    const parts = splitStages(answer);
    const counts = puzzle.counts ?? [];
    return counts.length === STAGE_COUNT && counts.every((c, i) => parseCount(parts[i] ?? "") === c);
  },
  IntroExample,
  Stage,
  Reveal,
};
