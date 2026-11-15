/**
 * Records Moon Climb's ricoRev 3 deals and runs before ricoRev 4 (the bigger ninja, 15 Nov 2026), for
 * ricochet-overhaul-check section 9: every ricoRev 3 tower and witness (a digest per seed) and runs at every skill
 * level, each with its replayed score and state digest. Run on the commit before ricoRev 4 (14ce058d); never re-record
 * over it.
 *
 *   bun scripts/ricochet-big-legacy-record.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { moonCheckpoint, moonDeal, moonGame, NINJA_CHECKPOINT_INTERVAL, NINJA_INPUT_TAP } from "../src/lib/arcade/ricochetNinja";
import { encodeMoonRun, replayMoonRun } from "../src/lib/duel/ricochet";
import { ALL_LEVELS, Human } from "./arcade-skill-bands/human";
import { bot as ricoBot } from "./arcade-skill-bands/bots/ricochet";

const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);
const OUT = "scripts/fixtures/ricochet-big-legacy.json";

function moonRaw(seed: number, events: ArcadeInputEvent[]): string {
  const at = new Map(events.map((e) => [e.t, e]));
  let s = moonGame.init(seed);
  const cps = [];
  while (!moonGame.isOver(s)) {
    s = moonGame.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % NINJA_CHECKPOINT_INTERVAL === 0) cps.push(moonCheckpoint(s));
  }
  return encodeMoonRun({ seed, claimedScore: moonGame.score(s), events, endTick: s.tick, checkpoints: cps });
}

const deals: Record<string, string> = {};
for (const seed of [...Array.from({ length: 40 }, (_, i) => i), ...Array.from({ length: 20 }, (_, i) => 10000 + i)]) {
  const d = moonDeal(seed);
  deals[String(seed)] = digest({ tower: d.tower, witness: d.witness, metres: d.witnessMetres });
}
const runs: { seed: number; level: string; raw: string; score: number; digest: string }[] = [];
for (const seed of [7, 503, 10007, 2024, 99]) {
  for (const level of ["random", ...ALL_LEVELS]) {
    let ev: ArcadeInputEvent[];
    if (level === "random") {
      ev = [];
      let x = seed | 1;
      for (let t = 5; t <= moonGame.runTicks; ) {
        x = Math.imul(x ^ (x >>> 13), 0x5bd1e995) >>> 0;
        ev.push({ t, k: NINJA_INPUT_TAP, a: (x % 3) - 1, b: 0, c: 0, d: 0 });
        t += 10 + (x % 51);
      }
    } else ev = ricoBot({ game: moonGame as any, seed, rev: 3, human: new Human("ricochet", seed, level as any), fixes: true }).events ?? [];
    const raw = moonRaw(seed, ev);
    const out = replayMoonRun(seed, raw);
    runs.push({ seed, level, raw, score: out.score, digest: digest(out.state) });
  }
}
writeFileSync(OUT, JSON.stringify({ recorded: "ricoRev 3 on 14ce058d, before ricoRev 4 (15 Nov 2026)", deals, runs }) + "\n");
console.log(`recorded ${Object.keys(deals).length} deals and ${runs.length} runs to ${OUT}`);
