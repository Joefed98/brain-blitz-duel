/**
 * Recorded runs for Grappler's 200 expansion (swingRev 13, docs/expansions/x200-swing.md), replayed by
 * swing-x200-check.
 *
 * Old rounds (scripts/fixtures/swing-x200-legacy.json, recorded on main before the expansion, 5ea3e48, whose swing
 * code is today's main's): real skill-band runs on the revisions rooms stamped just before it (swingRev 9, 10 and 11;
 * every older one is in scripts/fixtures/arcade-tuning-g3-legacy.json), played by the skill-band bots through the
 * server encode + replay path of the code at <root>, kept as score + FNV-1a of the replayed final state with the
 * encoded log. Two runs per level on swingRev 11, one on 9 and 10:
 *
 *   bun scripts/swing-x200-legacy.ts <root> > scripts/fixtures/swing-x200-legacy.json   (root = main before the change)
 *
 * With --after it records swingRev 13 runs with today's code (two a tier, weak to elite, on room courses) plus the
 * best of the elite tier's runs on the first `--best=<n>` room courses (default 120), the stored run that must reach
 * 200 through the server replay:
 *
 *   bun scripts/swing-x200-legacy.ts "$PWD" --after > scripts/fixtures/swing-x200-runs.json
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";

/** The revisions before swingRev 13, the last being the one rooms stamped. */
export const SWING13_BEFORE: readonly (readonly [string, readonly (number | null)[]])[] = [["swing", [9, 10, 11]]];
/** The expansion revision (--after). */
export const SWING13_AFTER: readonly (readonly [string, readonly (number | null)[]])[] = [["swing", [13]]];

export interface Swing13Record {
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
  const bestOf = Number(process.argv.find((a) => a.startsWith("--best="))?.slice(7) ?? 120);
  const { GAME_BY_TYPE } = await import(`${root}/scripts/arcade-skill-bands/games.ts`);
  const { Human } = await import(`${root}/scripts/arcade-skill-bands/human.ts`);
  const levels = after ? ["weak", "average", "good", "great", "near", "elite"] : ["average", "good", "great", "near"];
  const out: Swing13Record[] = [];
  const play = (spec: any, bot: any, rev: number | null, level: string, seed: number): Swing13Record => {
    const game = spec.gameFor(rev, seed);
    const human = new Human(spec.type, seed, level);
    const res = bot({ game, seed, rev, human });
    let state = game.init(seed);
    const checkpoints: unknown[] = [];
    const byTick = new Map((res.events ?? []).map((e: any) => [e.t, e]));
    while (!game.isOver(state) && state.tick < game.runTicks) {
      state = game.step(state, byTick.get(state.tick + 1) ?? null);
      if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
    }
    const claimed = game.score(state);
    const raw = spec.encode({ seed, claimedScore: claimed, events: res.events ?? [], inputs: [], taps: [], endTick: state.tick, checkpoints }, rev, seed);
    const result = spec.replay(seed, raw, rev);
    if (result.flagged) throw new Error(`rev ${rev} ${level} ${seed}: the run is flagged`);
    if (result.score !== claimed) throw new Error(`rev ${rev} ${level} ${seed}: bot ${claimed}, replay ${result.score}`);
    return { type: spec.type, rev, level, seed, score: result.score, stateHash: fnv(JSON.stringify(result.state)), raw: gzipSync(raw).toString("base64") };
  };
  for (const [type, revs] of after ? SWING13_AFTER : SWING13_BEFORE) {
    const spec = GAME_BY_TYPE.get(type);
    const { bot } = await import(`${root}/scripts/arcade-skill-bands/bots/${type}.ts`);
    revs.forEach((rev, index) => {
      const perLevel = index === revs.length - 1 ? 2 : 1;
      for (const level of levels)
        for (let n = 0; n < perLevel; n++) {
          const seed = spec.seedForRev?.(n + index * 7, rev) ?? spec.seedFor(n + index * 7);
          out.push(play(spec, bot, rev, level, seed));
        }
    });
    if (after) {
      // The best elite run on the first room courses: the stored run reaching the maximum.
      let best: Swing13Record | null = null;
      for (let n = 0; n < bestOf && (!best || best.score < 200); n++) {
        const rec = play(spec, bot, revs[0]!, "elite", spec.seedForRev(n, revs[0]));
        if (!best || rec.score > best.score) best = { ...rec, level: `elite-best@${n}` };
      }
      if (best) out.push(best);
    }
  }
  console.log(JSON.stringify({ recorded: after ? "the swingRev 13 code" : "code on main before swingRev 13 (5ea3e48)", runs: out }));
}
