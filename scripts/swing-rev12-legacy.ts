/**
 * Old-round records for Grappler's expansion (swingRev 12, 25 Oct 2026, docs/expansions/e7-swing.md).
 * Real skill-band runs on the revisions rooms stamped just before it (swingRev 9, 10 and 11; every
 * older one is in scripts/fixtures/arcade-tuning-g3-legacy.json), played by the skill-band bots
 * through the server encode + replay path of the code at <root>, recorded as score + FNV-1a of the
 * replayed final state with the encoded log. Two runs per level on swingRev 11, one on 9 and 10.
 * swing-rev12-check replays every log on today's code and must reach the same score and state.
 *
 *   bun scripts/swing-rev12-legacy.ts <root> > scripts/fixtures/swing-rev12-legacy.json   (root = main before the change)
 *
 * With --after it records swingRev 12 runs (two a level) with today's code:
 *
 *   bun scripts/swing-rev12-legacy.ts "$PWD" --after > scripts/fixtures/swing-rev12-runs.json
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";

/** The revisions before swingRev 12, the last being the one rooms stamped. */
export const SWING12_BEFORE: readonly (readonly [string, readonly (number | null)[]])[] = [
  ["swing", [9, 10, 11]],
];
/** The expansion revision (--after). */
export const SWING12_AFTER: readonly (readonly [string, readonly (number | null)[]])[] = [
  ["swing", [12]],
];
const LEVELS = ["average", "good", "great", "near"] as const;

export interface Swing12Record {
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
  const out: Swing12Record[] = [];
  for (const [type, revs] of after ? SWING12_AFTER : SWING12_BEFORE) {
    const spec = GAME_BY_TYPE.get(type);
    const { bot } = await import(`${root}/scripts/arcade-skill-bands/bots/${type}.ts`);
    revs.forEach((rev, index) => {
      const perLevel = index === revs.length - 1 ? 2 : 1;
      for (const level of LEVELS)
        for (let n = 0; n < perLevel; n++) {
          const seed = spec.seedForRev?.(n + index * 7, rev) ?? spec.seedFor(n + index * 7);
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
  console.log(JSON.stringify({ recorded: after ? "the swingRev 12 code" : "code on main before swingRev 12 (5ea3e48)", runs: out }));
}
