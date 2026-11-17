/**
 * The Retro games' run summaries for the answer reveal (the Retro overhaul, stage 2, 15 Nov 2026; display only).
 *
 * Joe's brief: each Retro reveal shows the key numbers that explain the score in short plain words, and a short visual
 * summary of the run instead of dense text (docs/design/retro-overhaul.md "The answer reveal"). The summary is worked out
 * here by replaying the stored run exactly as the server's replay does (`makeStepper`, `replayToEnd`), watching the
 * sim's own counters tick by tick: nothing is scored, stored or sent, and the score shown stays the stored one.
 *
 * A summary is a timeline of the run's moments (where along the clock each gate, gold, clear or miss came), up to three
 * key numbers, and for the games whose board tells the story (Breaker's wall, Meteor's field, Blockzone's well) the final
 * frame, drawn by the reveal component with the game's own renderer.
 */
import { makeStepper, replayToEnd } from "./steppers";
import type { PuzzleData } from "@/lib/duel/types";

export type RetroMarkKind = "good" | "gold" | "miss";

export interface RetroMark {
  /** Where along the run it happened, 0 (the start) to 1 (the run's full length). */
  at: number;
  kind: RetroMarkKind;
}

export interface RetroStat {
  label: string;
  value: string;
}

export interface RetroSummary {
  type: string;
  marks: RetroMark[];
  /** Tempo: each note in the song's order, coloured by its judgement (the timeline's bands). */
  notes?: { at: number; kind: "perfect" | "good" | "ok" | "miss" }[];
  stats: RetroStat[];
  /** The legend's words for each mark kind this game uses (absent kinds aren't listed). */
  legend: Partial<Record<RetroMarkKind, string>>;
  /** Whether the final frame belongs in the summary (Breaker, Meteor, Blockzone). */
  picture: boolean;
  /** The run's final state (for the picture), and how far through the run it ended (0…1). */
  finalState: unknown;
  endedAt: number;
}

export { RETRO_SUMMARY_TYPES, hasRetroSummary } from "./retroSummaryTypes";
import { retroSummaryHasPicture } from "./retroSummaryTypes";

/** At most this many marks of one kind on the timeline (the rest are spread evenly, so the strip stays legible). */
const MAX_MARKS = 40;

// The sims' states, read only (each game's own fields, checked by retro-summary-check).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type S = any;
interface Tracker {
  kind: RetroMarkKind;
  count: (s: S) => number;
}
interface Plan {
  trackers: Tracker[];
  legend: Partial<Record<RetroMarkKind, string>>;
  stats: (end: S, run: RunFacts) => RetroStat[];
}
interface RunFacts {
  start: S;
  /** Per-game maxima seen along the run (best streaks, biggest clears). */
  peak: { streak?: number; clear?: number };
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const bits = (v: number) => {
  let n = 0;
  for (let x = v >>> 0; x; x &= x - 1) n++;
  return n;
};

const PLANS: Record<string, Plan> = {
  hover: {
    trackers: [
      { kind: "good", count: (s) => num(s.gates) },
      { kind: "gold", count: (s) => num(s.stars) },
      { kind: "miss", count: (s) => num(s.shieldBreaks) + (s.crashed ? 1 : 0) },
    ],
    legend: { good: "gate", gold: "gold star", miss: "crash or shield" },
    stats: (s) => [
      { label: "Gates passed", value: `${num(s.gates)}` },
      { label: "Gold stars", value: s.totalStars ? `${num(s.stars)} of ${num(s.totalStars)}` : `${num(s.stars)}` },
      { label: "Shields used", value: `${num(s.shieldBreaks)}` },
    ],
  },
  breaker: {
    trackers: [
      { kind: "good", count: (s) => (Array.isArray(s.bricks) ? s.bricks.filter((hp: number) => hp <= 0).length : 0) },
      { kind: "gold", count: (s) => num(s.goldBroken) },
      { kind: "miss", count: (s) => num(s.losses) },
    ],
    legend: { good: "brick", gold: "gold brick", miss: "ball lost" },
    stats: (s, run) => {
      const total = Array.isArray(run.start.bricks) ? run.start.bricks.filter((hp: number) => hp > 0).length : 0;
      const left = Array.isArray(s.bricks) ? s.bricks.filter((hp: number) => hp > 0).length : 0;
      return [
        { label: "Bricks broken", value: total ? `${total - left} of ${total}` : `${total - left}` },
        { label: "Gold bricks", value: `${num(s.goldBroken)}` },
        { label: "Balls lost", value: `${num(s.losses)}` },
      ];
    },
  },
  rally: {
    trackers: [
      { kind: "good", count: (s) => num(s.targetHits) + bits(num(s.bonusHit)) },
      { kind: "gold", count: (s) => num(s.goldHits) },
      { kind: "miss", count: (s) => (s.lives !== undefined ? -num(s.lives) : s.dead ? 1 : 0) },
    ],
    legend: { gold: "gold return", good: "pad or target", miss: "missed ball" },
    stats: (s) => [
      { label: "Gold returns", value: `${num(s.goldHits)}` },
      { label: "Pads and targets", value: `${num(s.targetHits) + bits(num(s.bonusHit))}` },
      { label: "Spin shots", value: `${num(s.spinScores)}` },
    ],
  },
  wavefront: {
    trackers: [
      { kind: "good", count: (s) => num(s.wavesCleared) },
      { kind: "gold", count: (s) => (s.bossKilled ? 1 : 0) + num(s.midKilled ? 1 : 0) },
      { kind: "miss", count: (s) => -num(s.lives) },
    ],
    legend: { good: "wave cleared", gold: "boss down", miss: "life lost" },
    stats: (s, run) => [
      { label: "Waves cleared", value: `${num(s.wavesCleared)}` },
      { label: "Ships down", value: `${num(s.shapesDown)}` },
      { label: "Lives left", value: `${Math.max(0, num(s.lives))} of ${num(run.start.lives)}` },
    ],
  },
  burst: {
    trackers: [
      { kind: "good", count: (s) => num(s.cleared) },
      { kind: "gold", count: (s) => bits(num(s.goldHit)) },
      { kind: "miss", count: (s) => -num(s.lives) },
    ],
    legend: { good: "wave cleared", gold: "golden atom", miss: "life lost" },
    stats: (s) => [
      { label: "Waves cleared", value: `${num(s.cleared)}` },
      { label: "Atoms popped", value: `${num(s.hits)}` },
      { label: "Golden atoms", value: `${bits(num(s.goldHit))}` },
    ],
  },
  beat: {
    trackers: [{ kind: "gold", count: (s) => num(s.fevers) }],
    legend: { gold: "fever" },
    stats: (s) => [
      { label: "Perfect", value: `${num(s.perfect)}` },
      { label: "Best streak", value: `${num(s.maxCombo)}` },
      { label: "Missed", value: `${num(s.misses)}` },
    ],
  },
  snake: {
    trackers: [
      { kind: "good", count: (s) => num(s.eaten) },
      { kind: "gold", count: (s) => num(s.goldsEaten) },
      { kind: "miss", count: (s) => (s.dead ? 1 : 0) },
    ],
    legend: { good: "star", gold: "gold star", miss: "crash" },
    stats: (s) => [
      { label: "Stars eaten", value: `${num(s.eaten)}` },
      { label: "Gold stars", value: `${num(s.goldsEaten)}` },
      { label: "Comet length", value: `${Array.isArray(s.body) ? s.body.length : 0}` },
    ],
  },
  cross: {
    trackers: [
      { kind: "good", count: (s) => num(s.crossings) },
      { kind: "gold", count: (s) => num(s.closeCalls) },
      { kind: "miss", count: (s) => -num(s.lives) },
    ],
    legend: { good: "crossing", gold: "close call", miss: "hit" },
    stats: (s, run) => [
      { label: "Crossings", value: `${num(s.crossings)}` },
      { label: "Best no-stop streak", value: `${run.peak.streak ?? 0}` },
      { label: "Hits", value: `${Math.max(0, num(run.start.lives) - num(s.lives))}` },
    ],
  },
  pinball: {
    trackers: [
      { kind: "good", count: (s) => num(s.ramps) + num(s.locksMade) },
      { kind: "gold", count: (s) => num(s.laneSets) + num(s.multiballs) + num(s.jackpots) },
      { kind: "miss", count: (s) => num(s.lost) },
    ],
    legend: { good: "ramp or lock", gold: "J-O-U-L-Z, multiball or jackpot", miss: "ball drained" },
    stats: (s) => [
      { label: "J-O-U-L-Z sets", value: `${num(s.laneSets)}` },
      { label: "Ramps", value: `${num(s.ramps)}` },
      { label: "Multiballs", value: `${num(s.multiballs)}` },
    ],
  },
  blockfall: {
    trackers: [
      { kind: "good", count: (s) => num(s.lines) - 2 * num(s.doubles) - 3 * num(s.triples) - 4 * num(s.quads) },
      { kind: "gold", count: (s) => num(s.doubles) + num(s.triples) + num(s.quads) },
      { kind: "miss", count: (s) => (s.ended === 2 ? 1 : 0) },
    ],
    legend: { good: "single line", gold: "multi-line clear", miss: "top-out" },
    stats: (s, run) => [
      { label: "Lines", value: `${num(s.lines)}` },
      { label: "Best clear", value: run.peak.clear ? plural(run.peak.clear, "line") : "none" },
      { label: "Pieces", value: `${num(s.pieces)}` },
    ],
  },
};

const BEAT_KINDS = { 1: "perfect", 2: "good", 3: "ok", 4: "miss" } as const;

/**
 * The run summary of a stored Retro round, or null (not a Retro game, no stored run, or a run that can't be replayed).
 * Pure: the same stored run gives the same summary on every device.
 */
export function retroRunSummary(puzzle: PuzzleData, answer: string | null | undefined): RetroSummary | null {
  const plan = PLANS[puzzle.type];
  if (!plan || !answer) return null;
  let stepper;
  try {
    stepper = makeStepper(puzzle, answer);
  } catch {
    return null;
  }
  if (!stepper || stepper.needsDict) return null;
  const runTicks = Math.max(1, stepper.runTicks);
  const marks: Record<RetroMarkKind, RetroMark[]> = { good: [], gold: [], miss: [] };
  const peak: { streak?: number; clear?: number } = {};
  let start: S | null = null;
  let end;
  try {
    end = replayToEnd<S>(stepper, (state, tick, previous) => {
      if (!start) start = previous;
      for (const t of plan.trackers) {
        const d = t.count(state) - t.count(previous);
        for (let i = 0; i < d && i < 4; i++) marks[t.kind].push({ at: Math.min(1, tick / runTicks), kind: t.kind });
      }
      if (puzzle.type === "cross") peak.streak = Math.max(peak.streak ?? 0, num(state.streak));
      if (puzzle.type === "blockfall") {
        const cleared = num(state.lines) - num(previous.lines);
        if (cleared > 0) peak.clear = Math.max(peak.clear ?? 0, cleared);
      }
    });
  } catch {
    return null;
  }
  const facts: RunFacts = { start: start ?? stepper.init(), peak };
  const thin = (list: RetroMark[]) => (list.length <= MAX_MARKS ? list : Array.from({ length: MAX_MARKS }, (_, i) => list[Math.floor((i * list.length) / MAX_MARKS)]!));
  const used = (Object.keys(plan.legend) as RetroMarkKind[]).filter((k) => marks[k].length > 0);
  const legend: Partial<Record<RetroMarkKind, string>> = {};
  for (const k of used) legend[k] = plan.legend[k] ?? k;
  const summary: RetroSummary = {
    type: puzzle.type,
    marks: [...thin(marks.good), ...thin(marks.gold), ...thin(marks.miss)],
    stats: plan.stats(end.state, facts),
    legend,
    picture: retroSummaryHasPicture(puzzle.type),
    finalState: end.state,
    endedAt: Math.min(1, end.ticks / runTicks),
  };
  if (puzzle.type === "beat") {
    const chart = end.state.chart as { ticks?: number[] } | undefined;
    const judged = end.state.judged as number[] | undefined;
    if (chart?.ticks && judged) {
      summary.notes = chart.ticks
        .map((t, i) => ({ at: Math.min(1, t / runTicks), kind: BEAT_KINDS[judged[i] as 1 | 2 | 3 | 4] }))
        .filter((n): n is { at: number; kind: "perfect" | "good" | "ok" | "miss" } => !!n.kind);
    }
  }
  return summary;
}
