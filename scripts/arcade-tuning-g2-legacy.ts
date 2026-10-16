/**
 * Old-round records for taller worlds batch 2 (Oct 2026: Tempo, Slice, Coral
 * Pop, Mixed Signals and Pull! get taller worlds). Real runs on every revision
 * rooms ever stamped for the five games (unstamped included), recorded as
 * score + FNV-1a of the replayed final state together with the encoded log:
 *
 *  - Tempo, Slice and Coral Pop: the skill-band bots (scripts/arcade-skill-bands)
 *    through the server encode + replay path, as arcade-tuning-g1-legacy does.
 *  - Mixed Signals and Pull! (engine games): the puzzle-fairness kits
 *    (scripts/puzzle-fairness/kits-engine.ts) build the answer the phone submits
 *    and the server's own replay (replayColourClashRun / replayClayRun) scores it.
 *
 * Two runs per level on each game's then-live revision, one per level on every
 * older one. arcade-tuning-g2-check replays every log on today's code and must
 * reach the same score and the same state, so stored rounds provably replay and
 * score exactly as before.
 *
 *   bun scripts/arcade-tuning-g2-legacy.ts <root> > scripts/fixtures/arcade-tuning-g2-legacy.json   (root = a checkout of main before the change)
 *
 * With --after it records the same way on the taller revisions with today's
 * code, two runs per level, so any later change that moves a taller-world round
 * shows up the same way:
 *
 *   bun scripts/arcade-tuning-g2-legacy.ts "$PWD" --after > scripts/fixtures/arcade-tuning-g2-runs.json
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";

/** Each skill-band game, its revisions before the taller worlds (null = unstamped), the last being the one rooms stamped. */
export const TUNING_G2_GAMES: readonly (readonly [string, readonly (number | null)[]])[] = [
  ["beat", [null, 2, 3, 4, 5]],
  ["slice", [null, 2, 3, 4, 5]],
  ["bubble", [null, 2, 3, 4]],
];
/** The engine games: Mixed Signals by clashVariantOf key (0 open stream … 4 clashRev 4), Pull! by clayRev. */
export const TUNING_G2_ENGINE: readonly (readonly [string, readonly (number | null)[]])[] = [
  ["stroop", [0, 1, 2, 3, 4]],
  ["clayshoot", [null, 2, 3, 4, 5]],
];
/** The taller revisions (--after). Mixed Signals' entry is its variant key (5 = clashRev 5). */
export const TUNING_G2_AFTER: readonly (readonly [string, readonly (number | null)[]])[] = [
  ["beat", [6]],
  ["slice", [6]],
  ["bubble", [5]],
];
export const TUNING_G2_AFTER_ENGINE: readonly (readonly [string, readonly (number | null)[]])[] = [
  ["stroop", [5]],
  ["clayshoot", [6]],
];
const LEVELS = ["average", "good", "great", "near"] as const;

export interface TuningG2Record {
  type: string;
  /** The stored revision (Mixed Signals: its clashVariantOf key). */
  rev: number | null;
  level: string;
  seed: number;
  score: number;
  stateHash: number;
  /** The encoded run, gzip + base64. */
  raw: string;
}

/** The stored Mixed Signals puzzle fields for a variant key (clashVariantOf's inverse). */
export function clashPuzzleFor(variant: number, seed: number): Record<string, unknown> {
  if (variant >= 3) return { type: "stroop", seed, queue: 52, clashRev: variant };
  if (variant === 2) return { type: "stroop", seed, queue: 52 };
  if (variant === 1) return { type: "stroop", seed, queue: 18 };
  return { type: "stroop", seed };
}

/** The room seed the n-th engine sample stores (fixed, so the fixture reproduces). */
export const engineSeedFor = (n: number): number => 7001 + n * 37;

if (import.meta.main) {
  const root = process.argv[2] ?? ".";
  const after = process.argv.includes("--after");
  const out: TuningG2Record[] = [];
  const { GAME_BY_TYPE } = await import(`${root}/scripts/arcade-skill-bands/games.ts`);
  const { Human } = await import(`${root}/scripts/arcade-skill-bands/human.ts`);
  for (const [type, revs] of after ? TUNING_G2_AFTER : TUNING_G2_GAMES) {
    const spec = GAME_BY_TYPE.get(type);
    const { bot } = await import(`${root}/scripts/arcade-skill-bands/bots/${type}.ts`);
    revs.forEach((rev, index) => {
      const perLevel = index === revs.length - 1 ? 2 : 1;
      for (const level of LEVELS)
        for (let n = 0; n < perLevel; n++) {
          const seed = spec.seedFor(n + index * 7);
          const game = spec.gameFor(rev, seed);
          const human = new Human(spec.type, seed, level);
          const res = bot({ game, seed, rev, human });
          let state = game.init(seed);
          const checkpoints: unknown[] = [];
          const byTick = new Map((res.events ?? []).map((e: any) => [e.t, e]));
          const taps = new Set(res.taps ?? []);
          while (!game.isOver(state) && state.tick < game.runTicks) {
            const t = state.tick + 1;
            state = game.step(state, spec.taps ? taps.has(t) : (byTick.get(t) ?? null));
            if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
          }
          const claimed = game.score(state);
          const raw = spec.encode({ seed, claimedScore: claimed, events: res.events ?? [], inputs: res.taps ?? [], taps: [], endTick: state.tick, checkpoints }, rev, seed);
          const result = spec.replay(seed, raw, rev);
          if (result.flagged) throw new Error(`${type} rev ${rev} ${level} ${n}: the run is flagged`);
          if (result.score !== claimed) throw new Error(`${type} rev ${rev} ${level} ${n}: bot ${claimed}, replay ${result.score}`);
          out.push({ type, rev, level, seed, score: result.score, stateHash: fnv(JSON.stringify(result.state)), raw: gzipSync(raw).toString("base64") });
        }
    });
  }
  const { KITS } = await import(`${root}/scripts/puzzle-fairness/kits.ts`);
  const { runPlay } = await import(`${root}/scripts/puzzle-fairness/run.ts`);
  const { replayColourClashRun } = await import(`${root}/src/lib/duel/colourClash.ts`);
  const { replayClayRun } = await import(`${root}/src/lib/duel/clayShoot.ts`);
  for (const [type, revs] of after ? TUNING_G2_AFTER_ENGINE : TUNING_G2_ENGINE) {
    const kit = KITS[type];
    revs.forEach((rev, index) => {
      const perLevel = index === revs.length - 1 ? 2 : 1;
      for (const level of LEVELS)
        for (let n = 0; n < perLevel; n++) {
          const seed = engineSeedFor(n + index * 7);
          const puzzle = type === "stroop" ? clashPuzzleFor(rev!, seed) : { type: "clayshoot", seed, ...(rev === null ? {} : { clayRev: rev }) };
          const raw: string = runPlay(kit, puzzle as never, seed, level).answer;
          const result = type === "stroop" ? replayColourClashRun(seed, raw, rev!) : replayClayRun(seed, raw, rev);
          if (result.flagged) throw new Error(`${type} rev ${rev} ${level} ${n}: the run is flagged`);
          out.push({ type, rev, level, seed, score: result.score, stateHash: fnv(JSON.stringify(result.state)), raw: gzipSync(raw).toString("base64") });
        }
    });
  }
  console.log(JSON.stringify({ recorded: after ? "the taller worlds batch 2 code" : "code on main before taller worlds batch 2 (c1352fa)", runs: out }));
}
