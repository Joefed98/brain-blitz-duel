/**
 * Old-round records for taller worlds batch 1 (Oct 2026: Breaker, Rally,
 * Wavefront and Fission get taller worlds). Real skill-band runs on every
 * revision rooms ever stamped for the four games (unstamped included), played
 * by the skill-band bots through the server encode + replay path of the code
 * at <root>, recorded as score + FNV-1a of the replayed final state together
 * with the encoded log. Two runs per level on each game's then-live revision,
 * one per level on every older one. arcade-tuning-g1-check replays every log
 * on today's code and must reach the same score and the same state, so stored
 * rounds provably replay and score exactly as before.
 *
 *   bun scripts/arcade-tuning-g1-legacy.ts <root> > scripts/fixtures/arcade-tuning-g1-legacy.json   (root = a checkout of main before the change)
 *
 * With --after it records the same way on the taller revisions (brkRev 6,
 * rallyRev 6, wavRev 6, burstRev 4) with today's code, two runs per level, so
 * any later change that moves a taller-world round shows up the same way:
 *
 *   bun scripts/arcade-tuning-g1-legacy.ts "$PWD" --after > scripts/fixtures/arcade-tuning-g1-runs.json
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";

/** Each game, its revisions before the taller worlds (null = unstamped), the last being the one rooms stamped. */
export const TUNING_G1_GAMES: readonly (readonly [string, readonly (number | null)[]])[] = [
  ["breaker", [null, 2, 3, 4, 5]],
  ["rally", [null, 2, 3, 4, 5]],
  ["wavefront", [null, 2, 3, 4, 5]],
  ["burst", [null, 2, 3]],
];
/** The taller revisions (--after). */
export const TUNING_G1_AFTER: readonly (readonly [string, readonly (number | null)[]])[] = [
  ["breaker", [6]],
  ["rally", [6]],
  ["wavefront", [6]],
  ["burst", [4]],
];
const LEVELS = ["average", "good", "great", "near"] as const;

export interface TuningG1Record {
  type: string;
  rev: number | null;
  level: string;
  seed: number;
  score: number;
  stateHash: number;
  /** The encoded run, gzip + base64. */
  raw: string;
}

if (import.meta.main) {
  const root = process.argv[2] ?? ".";
  const after = process.argv.includes("--after");
  const { GAME_BY_TYPE } = await import(`${root}/scripts/arcade-skill-bands/games.ts`);
  const { Human } = await import(`${root}/scripts/arcade-skill-bands/human.ts`);
  const out: TuningG1Record[] = [];
  for (const [type, revs] of after ? TUNING_G1_AFTER : TUNING_G1_GAMES) {
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
  console.log(JSON.stringify({ recorded: after ? "the taller worlds batch 1 code" : "code on main before taller worlds batch 1 (dbf246e)", runs: out }));
}
