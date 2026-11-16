/**
 * The Action games' intro demos (the Action overhaul, stage 3, 15 Nov 2026): one shared place that deals each game's
 * intro example exactly as the practice deal function does (`practiceGenerateFn` with `example: true`), plays it with the
 * game's skill-band bot, encodes the run as the phone submits it, and judges the first DEMO_LENGTH_TICKS ticks the
 * intro shows. Used by scripts/action-demos-record.ts (writes scripts/fixtures/action-demos.json),
 * scripts/action-demos-save.ts (sends the stored runs through saveIntroDemoFn) and scripts/action-demos-check.ts.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { DEMO_LENGTH_TICKS, runAtTick } from "../src/lib/arcade/introDemo";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { bankedIntroExample } from "../src/lib/duel/puzzleBank.server";
import { INTRO_EXAMPLE_SEED } from "../src/lib/duel/puzzleDemo";
import { withSeededRandom } from "../src/lib/duel/random";
import { DEAL_PINS, type DealPin } from "../src/lib/duel/dealEra";
import { splitPuzzle } from "../src/lib/duel/secrets";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { GAMES, type GameSpec } from "./arcade-skill-bands/games";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";
import type { SkillBot } from "./arcade-skill-bands/bot";
import { orbitRev3Game, orbitStartForPuzzle } from "../src/lib/arcade/orbitRev3";
import { replayOrbitRun } from "../src/lib/duel/orbit";
import type { ArcadeGame } from "../src/lib/arcade/engine";

/** The six Action games and the field of their stored puzzle that carries the stamp. */
export const ACTION_DEMO_GAMES = [
  { type: "flip", stamp: "flipRev" },
  { type: "swing", stamp: "swingRev" },
  { type: "ricochet", stamp: "ricoRev" },
  { type: "bastion", stamp: "bastionRev" },
  { type: "skyline", stamp: "skylineRev" },
  { type: "orbit", stamp: "orbitRev" },
] as const satisfies readonly { type: PuzzleType; stamp: string }[];
export type ActionDemoType = (typeof ACTION_DEMO_GAMES)[number]["type"];
export const ACTION_DEMO_TYPES: readonly ActionDemoType[] = ACTION_DEMO_GAMES.map((g) => g.type);

export function stampField(type: ActionDemoType): string {
  return ACTION_DEMO_GAMES.find((g) => g.type === type)!.stamp;
}
export function stampOf(type: ActionDemoType, puzzle: PuzzleData): number | null {
  const v = (puzzle as unknown as Record<string, unknown>)[stampField(type)];
  return typeof v === "number" ? v : null;
}

/** The public half of the intro example, dealt exactly as practiceGenerateFn's `example: true` path deals it. */
export function introExample(type: ActionDemoType, pins: readonly string[] = []): PuzzleData {
  if (bankedIntroExample(type)) throw new Error(`${type}: a banked example (not expected for an engine game)`);
  for (const pin of pins) if (!Object.hasOwn(DEAL_PINS, pin)) throw new Error(`unknown deal pin ${pin} (DEAL_PINS in src/lib/duel/dealEra.ts)`);
  const options = pins.length ? { pins: pins as DealPin[] } : undefined;
  const made = withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(type, { unblockRow: null } as never, options));
  return splitPuzzle(made).pub as PuzzleData;
}

/** A stable digest of a puzzle (keys sorted), so the saver can tell the dev server dealt the same example. */
export function puzzleDigest(puzzle: unknown): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(sort) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sort((v as any)[k])])) : v;
  return createHash("sha256").update(JSON.stringify(sort(puzzle))).digest("hex").slice(0, 16);
}

export function specFor(type: ActionDemoType): GameSpec {
  const spec = GAMES.find((g) => g.type === type);
  if (!spec) throw new Error(`no skill-band spec for ${type}`);
  return spec;
}

export async function botFor(type: ActionDemoType): Promise<SkillBot> {
  const mod = await import(new URL(`./arcade-skill-bands/bots/${type}.ts`, import.meta.url).href);
  return mod.bot as SkillBot;
}

/**
 * The game (sim + score) for the stored puzzle. Orbit flies the course the puzzle carries (planets, holes, extras), as
 * the phone, the server and drawFinal do, so any Orbit stamp that keeps that shape (orbitRev 16 included) needs no
 * change here; every other game builds from its stamp and seed through the skill-band spec.
 */
export function gameForPuzzle(type: ActionDemoType, puzzle: PuzzleData): ArcadeGame<any, any> {
  if (type === "orbit") {
    const start = orbitStartForPuzzle(puzzle as never);
    if (!start) throw new Error(`orbit: no course on the puzzle (orbitRev ${stampOf(type, puzzle)})`);
    return { ...orbitRev3Game, init: start } as ArcadeGame<any, any>;
  }
  return specFor(type).gameFor(stampOf(type, puzzle), (puzzle as { seed: number }).seed);
}

const CHECKPOINT_EVERY = 300;

/** One bot run on the puzzle, encoded as the phone submits it (events, checkpoints, the client counters after "~"). */
export function playDemoRun(type: ActionDemoType, puzzle: PuzzleData, bot: SkillBot, level: SkillLevel, humanSeed: number): { raw: string; score: number } {
  const spec = specFor(type);
  const rev = stampOf(type, puzzle);
  const seed = (puzzle as { seed: number }).seed;
  const game = gameForPuzzle(type, puzzle);
  const out = bot({ game, seed, rev, human: new Human(type, humanSeed, level), fixes: true });
  let state = game.init(seed);
  const checkpoints: unknown[] = [];
  const events = out.events ?? [];
  const taps = out.taps ?? [];
  const byTick = new Map(events.map((e) => [e.t, e]));
  const tapSet = new Set(taps);
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    state = game.step(state, spec.taps ? tapSet.has(t) : (byTick.get(t) ?? null));
    if (state.tick % CHECKPOINT_EVERY === 0) checkpoints.push(spec.checkpoint(state));
  }
  const score = game.score(state);
  const body = { seed, claimedScore: score, events, inputs: taps, taps: [], endTick: state.tick, checkpoints };
  return { raw: appendClientCounters(spec.encode(body, rev, seed), arcadeCounters(type, state, score)), score };
}

/** The server's replay of a run on the puzzle (the same function drawFinal and grading call). */
export function serverReplay(type: ActionDemoType, puzzle: PuzzleData, raw: string): { score: number; state: any; flagged?: boolean } {
  const seed = (puzzle as { seed: number }).seed;
  if (type === "orbit") {
    const p = puzzle as Extract<PuzzleData, { type: "orbit" }>;
    return replayOrbitRun(seed, raw, p.orbitRev, p.planets, p.holes, p.extras) as never;
  }
  return specFor(type).replay(seed, raw, stampOf(type, puzzle));
}

/** The intro's frame at `tick`: the stored run stopped there (runAtTick), replayed by the server's replay. */
export function demoFrame(type: ActionDemoType, puzzle: PuzzleData, raw: string, tick: number) {
  const r = serverReplay(type, puzzle, runAtTick(raw, tick));
  return { ...r, counters: arcadeCounters(type, r.state, r.score) };
}

export { DEMO_LENGTH_TICKS };

export const ACTION_DEMO_FIXTURE = "scripts/fixtures/action-demos.json";
/** Strong levels only (scripts/arcade-skill-bands/human.ts), best first, and the human seeds each is tried on. */
export const DEMO_LEVELS: readonly SkillLevel[] = ["perfect", "elite", "near"];
export const DEMO_HUMAN_SEEDS = [1, 2, 3, 4] as const;
/** A demo shows a good run: the whole stored run scores at least this (out of 200). */
export const DEMO_MIN_SCORE = 170;

export interface ActionDemoEntry {
  type: ActionDemoType;
  /** The stamp the run was recorded on (the puzzle's stamp field). */
  stamp: number;
  level: SkillLevel;
  humanSeed: number;
  /** The server replay's score for the whole run, and at the intro window's last tick. */
  score: number;
  windowScore: number;
  /** What the window shows (judgeWindow). */
  moments: Record<string, number>;
  /** puzzleDigest(puzzle): the saver refuses a dev server whose example differs. */
  digest: string;
  /** The public half of the intro example (what saveIntroDemoFn stores). */
  puzzle: PuzzleData;
  /** The run string, as the phone submits it. */
  run: string;
}
export interface ActionDemoFile {
  note: string;
  demos: Partial<Record<ActionDemoType, ActionDemoEntry>>;
}

/** Input events (taps included) at or before `tick` in a run string. */
export function inputsBy(raw: string, tick: number): number {
  const field = (String(raw).split("~")[0] ?? "").split("|")[2] ?? "";
  return field.split(",").filter((p) => p && Number.parseInt(p.split(":")[0] ?? "", 10) <= tick).length;
}

const bits = (n: number | undefined) => {
  let v = n ?? 0;
  let c = 0;
  while (v) {
    c += v & 1;
    v >>>= 1;
  }
  return c;
};

/**
 * Judges the intro's window (ticks 1–DEMO_LENGTH_TICKS, what the intro loops): the run is still going at its end, the
 * player made no slip in it (no crash, miss, hit, lost life or base hit), and it shows the game's main moments.
 */
export function judgeWindow(type: ActionDemoType, puzzle: PuzzleData, raw: string): { ok: boolean; why: string[]; moments: Record<string, number> } {
  const game = gameForPuzzle(type, puzzle);
  const end = demoFrame(type, puzzle, raw, DEMO_LENGTH_TICKS);
  const s = end.state;
  const why: string[] = [];
  const need = (cond: boolean, text: string) => {
    if (!cond) why.push(text);
  };
  const moments: Record<string, number> = { inputs: inputsBy(raw, DEMO_LENGTH_TICKS), score: end.score };
  need(s.tick === DEMO_LENGTH_TICKS, `the window ends at tick ${s.tick}`);
  need(!game.isOver(s), "the run is over inside the window");
  need(end.score > 0, "nothing scored in the window");
  if (type === "flip") {
    // Count the gravity flips the window shows (the runner's side changing), sampled every 10 ticks.
    let flips = 0;
    let side = demoFrame(type, puzzle, raw, 1).state.side;
    for (let t = 10; t <= DEMO_LENGTH_TICKS; t += 10) {
      const now = demoFrame(type, puzzle, raw, t).state.side;
      if (now !== side) flips++;
      side = now;
    }
    Object.assign(moments, { flips, crashes: s.saves ?? 0, sweet: bits(s.sweetGot) });
    need((s.saves ?? 0) === 0 && (s.respawns ?? 0) === 0, "a crash in the window");
    need(flips >= 3, `only ${flips} flips`);
  } else if (type === "swing") {
    Object.assign(moments, { restarts: s.restarts ?? 0, caught: s.caught ?? 0, streak: s.streak ?? 0, gates: s.gatesLit ?? 0 });
    need((s.restarts ?? 0) === 0 && (s.caught ?? 0) === 0, "a miss in the window");
    need(moments.inputs! >= 6, `only ${moments.inputs} grabs and releases`);
  } else if (type === "ricochet") {
    Object.assign(moments, { hits: s.hits, rides: s.rides ?? 0, climbedPx: Math.floor((s.best ?? 0) / 256) });
    need(s.hits === 0, "a hit in the window");
    need(moments.inputs! >= 6, `only ${moments.inputs} leaps`);
  } else if (type === "bastion") {
    Object.assign(moments, { base: s.base, armour: s.destroyedHp ?? 0, weakSpots: s.weak ?? 0, fastReloads: s.fast ?? 0 });
    // bastionRev 4 (the levels): the dealt level's whole base (Normal's 4; rev 3's 3).
    need(s.base === (s.rev >= 4 ? 4 : 3), "a base hit in the window");
    need((s.destroyedHp ?? 0) >= 4, `only ${s.destroyedHp ?? 0} armour destroyed`);
  } else if (type === "skyline") {
    Object.assign(moments, { floors: s.placed ?? 0, perfects: s.perfects ?? 0, livesLost: s.livesLost ?? 0 });
    need((s.livesLost ?? 0) === 0, "a life lost in the window");
    need((s.placed ?? 0) >= 8, `only ${s.placed ?? 0} floors`);
  } else if (type === "orbit") {
    const slips = Math.max(0, 1 - (s.respawns ?? 1)) + (s.autoRespawns ?? 0);
    Object.assign(moments, { captured: s.captured ?? 0, slips, checkpoint: s.checkpoint >= 0 ? 1 : 0 });
    need(slips === 0, "a crash in the window");
    need((s.captured ?? 0) >= 3, `only ${s.captured ?? 0} planets caught`);
  }
  return { ok: why.length === 0, why, moments };
}
