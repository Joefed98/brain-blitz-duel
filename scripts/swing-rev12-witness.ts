/**
 * Grappler's expansion (swingRev 12): a strong-play witness search. A beam search over hold / let go
 * / reel every few ticks, ranked by stars, then feature points (combos, gems, speed gates, ledges),
 * then distance, with one extra move standing on a set-route ledge: a kick off it and the release
 * (found by trying each delay) that lands on the next ledge of its section. Used to record the
 * swing-rev12-check witnesses (runs that reach 190–200 through the server replay):
 *
 *   bun scripts/swing-rev12-witness.ts [count] [beam] > scripts/fixtures/swing-rev12-witness.json
 */
import { gzipSync } from "node:zlib";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { swingCheckpoint, swingFeaturePoints, swingGameFor, swingMetres, SWING_INPUT_HOLD, SWING_INPUT_REEL, SWING_REV_EXPAND, type SwingState } from "../src/lib/arcade/swing";
import { encodeSwingRun, replaySwingRun } from "../src/lib/duel/swing";
import { SWING_V12_BANK } from "../src/lib/duel/swingBankV12.server";

const STEP = 3;
type Node = { state: SwingState; log: ArcadeInputEvent[]; rank: number };
const game = swingGameFor(SWING_REV_EXPAND);
const ev = (s: SwingState, k: number, a: number): ArcadeInputEvent => ({ t: s.tick + 1, k, a, b: 0, c: 0, d: 0 });

/** Standing on ledge i: kick off, hold for r ticks and let go so the flight lands on ledge `next` (the first r that does). */
function ledgeMacro(s: SwingState, next: number): { state: SwingState; log: ArcadeInputEvent[] } | null {
  for (let r = 1; r < 240; r++) {
    let t = s;
    const log: ArcadeInputEvent[] = [];
    // A press made while walking is held until the centre: press now and keep stepping until on the rope.
    log.push(ev(t, SWING_INPUT_HOLD, 1));
    t = game.step(t, log[0]!);
    let guard = 0;
    while (t.rope < 0 && !t.ended && guard++ < 30) t = game.step(t, null);
    if (t.rope < 0) return null;
    for (let i = 0; i < r && !t.ended; i++) t = game.step(t, null);
    const let_ = ev(t, SWING_INPUT_HOLD, 0);
    log.push(let_);
    t = game.step(t, let_);
    for (let i = 0; i < 110 && !t.ended && (t.ledgeOn ?? -1) < 0; i++) t = game.step(t, null);
    if (t.ledgeOn === next && !t.ended) return { state: t, log };
  }
  return null;
}

export function swingWitness(seed: number, width = 160): { log: ArcadeInputEvent[]; state: SwingState } | null {
  let beam: Node[] = [{ state: game.init(seed), log: [], rank: 0 }];
  let best: { score: number; state: SwingState; log: ArcadeInputEvent[] } | null = null;
  const rankOf = (s: SwingState) => (s.stars ?? 0) * 900 + swingFeaturePoints(s).total * 700 + s.x / 256 - s.y / 256 * 0.05;
  while (beam.length) {
    const bins = new Map<string, Node>();
    const add = (state: SwingState, log: ArcadeInputEvent[]) => {
      if (state.ended === 2) return;
      if (state.ended) {
        const score = game.score(state);
        if (!best || score > best.score) best = { score, state, log };
        return;
      }
      const f = swingFeaturePoints(state);
      const key = [state.stars ?? 0, f.total, state.chain ?? 0, Math.floor(state.x / 6144), Math.floor(state.y / 6144), state.rope, state.ledgeOn ?? -1, Math.floor(state.om / 100), Math.floor(state.len / 5120)].join(",");
      const rank = rankOf(state);
      const old = bins.get(key);
      if (!old || rank > old.rank) bins.set(key, { state, log, rank });
    };
    for (const node of beam) {
      const s = node.state;
      const on = s.ledgeOn ?? -1;
      if (on >= 0) {
        const l = s.ledges![on]!;
        const next = s.ledges!.findIndex((q) => q.section === l.section && q.order === l.order + 1);
        if (next >= 0) {
          const m = ledgeMacro(s, next);
          if (m) add(m.state, [...node.log, ...m.log]);
        }
      }
      for (const action of [-1, 0, 1, 2, 3]) {
        let state = s;
        const log = node.log.slice();
        for (let j = 0; j < STEP; j++) {
          const event = j === 0 && action !== -1 ? ev(state, action >= 2 ? SWING_INPUT_REEL : SWING_INPUT_HOLD, action >= 2 ? action - 2 : action) : null;
          if (event) log.push(event);
          state = game.step(state, event);
          if (state.ended) break;
        }
        add(state, log);
      }
    }
    beam = [...bins.values()].sort((a, b) => b.rank - a.rank).slice(0, width);
  }
  return best ? { log: (best as { log: ArcadeInputEvent[] }).log, state: (best as { state: SwingState }).state } : null;
}

if (import.meta.main) {
  const count = Number(process.argv[2] ?? 3);
  const width = Number(process.argv[3] ?? 160);
  const runs: { seed: number; score: number; raw: string }[] = [];
  for (const entry of SWING_V12_BANK.slice(0, count)) {
    const found = swingWitness(entry.seed, width);
    if (!found) continue;
    // Through the phone's encoder and the server's replay, as a room round would be.
    let s = game.init(entry.seed);
    const by = new Map(found.log.map((e) => [e.t, e]));
    const checkpoints: unknown[] = [];
    while (!game.isOver(s)) {
      s = game.step(s, by.get(s.tick + 1) ?? null);
      if (s.tick % 300 === 0) checkpoints.push(swingCheckpoint(s));
    }
    const raw = encodeSwingRun({ seed: entry.seed, claimedScore: game.score(s), events: found.log, endTick: s.tick, checkpoints } as never);
    const result = replaySwingRun(entry.seed, raw, SWING_REV_EXPAND);
    const f = swingFeaturePoints(result.state);
    console.error(entry.seed, "score", result.score, "flagged", Boolean(result.flagged), "m", swingMetres(result.state), "stars", result.state.stars, "combo", f.combo, "gems", f.gems, "gates", f.gates, "ledges", `${f.ledges}/${f.ledgeTotal}`);
    runs.push({ seed: entry.seed, score: result.score, raw: gzipSync(raw).toString("base64") });
  }
  console.log(JSON.stringify({ recorded: "scripts/swing-rev12-witness.ts on the swingRev 12 code", runs }));
}
