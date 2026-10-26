/**
 * Old-round records for expansion E9 (26 Oct 2026, docs/expansions/e9.md: Rally rallyRev 10, Fission burstRev 8,
 * Flightpath bullRev 8). Real skill-band runs on every revision rooms ever stamped for the three games
 * (unstamped included), played by the skill-band bots through the server encode + replay path of the code at
 * <root>, recorded as score + FNV-1a of the replayed final state together with the encoded log: two runs per
 * level on the revision rooms dealt before the expansion, one per level on every older one. expansion-e9-check
 * replays every log on today's code and must reach the same score and the same state, so stored rounds
 * provably replay and score exactly as before.
 *
 *   bun scripts/expansion-e9-legacy.ts <root> | gzip > scripts/fixtures/expansion-e9-legacy.json.gz   (root = a checkout of main before the change)
 *
 * With --after it records the same way on the expansion revisions with today's code (two runs per level, the
 * weak and elite levels included), plus each game's first flawless run (the band tool's fixed bot) that reaches 200 (`top`):
 *
 *   bun scripts/expansion-e9-legacy.ts "$PWD" --after | gzip > scripts/fixtures/expansion-e9-runs.json.gz
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";

/** Each game and its revisions before the expansion (null = unstamped), the last being the one rooms dealt. */
export const E9_BEFORE: readonly (readonly [string, readonly (number | null)[]])[] = [
  ["rally", [null, 2, 3, 4, 5, 6, 7, 8]],
  ["burst", [null, 2, 3, 4, 5, 6]],
  ["bullseye", [null, 2, 3, 4, 5, 6]],
];
/** The expansion revisions (--after). */
export const E9_AFTER: readonly (readonly [string, readonly (number | null)[]])[] = [
  ["rally", [10]],
  ["burst", [8]],
  ["bullseye", [8]],
];

export interface E9Record {
  type: string;
  rev: number | null;
  level: string;
  seed: number;
  score: number;
  stateHash: number;
  /** The encoded run, gzip + base64. */
  raw: string;
}

function record(spec: any, bot: any, Human: any, type: string, rev: number | null, level: string, seed: number, fixes = false): E9Record {
  const game = spec.gameFor(rev, seed);
  const res = bot({ game, seed, rev, human: new Human(spec.type, seed, level), fixes });
  let state = game.init(seed);
  const checkpoints: unknown[] = [];
  const byTick = new Map((res.events ?? []).map((e: any) => [e.t, e]));
  while (!game.isOver(state) && state.tick < game.runTicks) {
    state = game.step(state, byTick.get(state.tick + 1) ?? null);
    if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
  }
  const claimed = game.score(state);
  const raw = spec.encode({ seed, claimedScore: claimed, events: res.events ?? [], endTick: state.tick, checkpoints }, rev, seed);
  const result = spec.replay(seed, raw, rev);
  if (result.flagged) throw new Error(`${type} rev ${rev} ${level} ${seed}: the run is flagged`);
  if (result.score !== claimed) throw new Error(`${type} rev ${rev} ${level} ${seed}: bot ${claimed}, replay ${result.score}`);
  return { type, rev, level, seed, score: result.score, stateHash: fnv(JSON.stringify(result.state)), raw: gzipSync(raw).toString("base64") };
}

if (import.meta.main) {
  const root = process.argv[2] ?? ".";
  const after = process.argv.includes("--after");
  const { GAME_BY_TYPE } = await import(`${root}/scripts/arcade-skill-bands/games.ts`);
  const { Human } = await import(`${root}/scripts/arcade-skill-bands/human.ts`);
  const levels = after ? ["weak", "average", "good", "great", "near", "elite"] : ["average", "good", "great", "near"];
  const runs: E9Record[] = [];
  const top: E9Record[] = [];
  for (const [type, revs] of after ? E9_AFTER : E9_BEFORE) {
    const spec = GAME_BY_TYPE.get(type);
    const { bot } = await import(`${root}/scripts/arcade-skill-bands/bots/${type}.ts`);
    revs.forEach((rev, index) => {
      const perLevel = index === revs.length - 1 ? 2 : 1;
      for (const level of levels) for (let n = 0; n < perLevel; n++) runs.push(record(spec, bot, Human, type, rev, level, spec.seedFor(n + index * 7)));
    });
    if (after) {
      // The first flawless run (the band tool's error-free level on its fixed bot) from seed index 300 on (past the
      // tuning seeds, short of the fresh ones) that reaches 200.
      for (let n = 300; n < 3000; n++) {
        const run = record(spec, bot, Human, type, revs[0]!, "perfect", spec.seedFor(n), true);
        if (run.score >= 200) {
          top.push(run);
          break;
        }
      }
    }
  }
  process.stdout.write(JSON.stringify(after ? { runs, top } : { runs }));
}
