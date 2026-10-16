/**
 * Old-round records for taller worlds batch 3 (Oct 2026: Grappler, Orbit and
 * Ball Tracker get taller worlds). Real skill-band runs on every revision rooms
 * ever stamped for the three games (Grappler and Ball Tracker unstamped
 * included; Orbit from orbitRev 4, the first with black holes, since its rev
 * 1–3 paths are proved by orbit-legacy-replay-check and orbit-rev3-replay-check), played
 * by the skill-band bots through the server encode + replay path of the code
 * at <root>, recorded as score + FNV-1a of the replayed final state together
 * with the encoded log. Two runs per level on each game's then-live revision,
 * one per level on every older one. arcade-tuning-g3-check replays every log
 * on today's code and must reach the same score and the same state, so stored
 * rounds provably replay and score exactly as before.
 *
 *   bun scripts/arcade-tuning-g3-legacy.ts <root> > scripts/fixtures/arcade-tuning-g3-legacy.json   (root = a checkout of main before the change)
 *
 * With --after it records the same way on the taller revisions (swingRev 9,
 * orbitRev 8, btRev 4) with today's code, two runs per level, so
 * any later change that moves a taller-world round shows up the same way:
 *
 *   bun scripts/arcade-tuning-g3-legacy.ts "$PWD" --after > scripts/fixtures/arcade-tuning-g3-runs.json
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";

/** Each game, its revisions before the taller worlds (null = unstamped), the last being the one rooms stamped. */
export const TUNING_G3_GAMES: readonly (readonly [string, readonly (number | null)[]])[] = [
  ["swing", [null, 2, 3, 4, 5, 6, 7, 8]],
  ["orbit", [4, 5, 6, 7]],
  ["balltrack", [null, 2, 3]],
];
/** The taller revisions (--after). */
export const TUNING_G3_AFTER: readonly (readonly [string, readonly (number | null)[]])[] = [
  ["swing", [9]],
  ["orbit", [8]],
  ["balltrack", [4]],
];
const LEVELS = ["average", "good", "great", "near"] as const;

export interface TuningG3Record {
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
  const out: TuningG3Record[] = [];
  for (const [type, revs] of after ? TUNING_G3_AFTER : TUNING_G3_GAMES) {
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
  console.log(JSON.stringify({ recorded: after ? "the taller worlds batch 3 code" : "code on main before taller worlds batch 3 (82b7bab)", runs: out }));
}
