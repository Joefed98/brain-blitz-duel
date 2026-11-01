/**
 * Records the 1 Nov 2026 tuning's legacy fixture (scripts/fixtures/tuning-nov1-legacy.json) from a checkout of main
 * before Cue Ball's poolRev 3, Free Cell's freecellRev 3 and Five Hands' fiveHandsRev 2: runs on the revisions main
 * dealt (poolRev 2, freecellRev 2, fiveHandsRev 1; skill-band bots at four levels and the flawless lines) with the
 * score and final-state checksum main's server replay gives. cards-check and pool-check replay every one on today's
 * tree and fail on any difference.
 *
 *   git worktree add ../main-tune origin/main && ln -s "$PWD/node_modules" ../main-tune/node_modules
 *   bun scripts/tuning-nov1-legacy-record.ts ../main-tune
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const root = resolve(process.argv[2] ?? ".");
const imp = (p: string) => import(`${root}/${p}`) as Promise<any>;
console.error = () => {};

const { Human } = await imp("scripts/arcade-skill-bands/human.ts");
const cards = await imp("src/lib/duel/cards.ts");
const poolRun = await imp("src/lib/duel/pool.ts");
const poolSim = await imp("src/lib/arcade/pool.ts");
const bankV2 = await imp("src/lib/duel/poolBankV2.server.ts");
const fc = await imp("src/lib/arcade/cards/freecell.ts");
const fh = await imp("src/lib/arcade/cards/fiveHands.ts");
const flawless = await imp("scripts/cards/flawless.ts");
const fcBot = (await imp("scripts/arcade-skill-bands/bots/freecell.ts")).bot;
const fhBot = (await imp("scripts/arcade-skill-bands/bots/fivehands.ts")).bot;
const poolBot = (await imp("scripts/arcade-skill-bands/bots/pool.ts")).bot;

type Run = { type: string; rev: number; seed: number; label: string; raw: string; score: number; checksum: number; tick: number };
const runs: Run[] = [];
const LEVELS = ["weak", "average", "great", "elite"];

for (const seed of [0, 5, 42, 299]) {
  for (const level of LEVELS) {
    const game = fc.freecellGameFor(2);
    const { events } = fcBot({ game, seed, rev: 2, human: new Human("freecell", seed, level), fixes: true });
    const raw = cards.encodeFreecellRun({ seed, claimedScore: 0, events, endTick: 0, checkpoints: [] });
    const r = cards.replayFreecellRun(seed, raw, 2);
    runs.push({ type: "freecell", rev: 2, seed, label: `${level} bot`, raw, score: r.score, checksum: fc.fcCheckpoint(r.state).checksum, tick: r.state.tick });
  }
}
for (const seed of [1, 9, 77, 4242, 123456789]) {
  for (const level of LEVELS) {
    const game = fh.fiveHandsGameFor(1);
    const { events } = fhBot({ game, seed, rev: 1, human: new Human("fivehands", seed, level), fixes: true });
    const raw = cards.encodeFiveHandsRun({ seed, claimedScore: 0, events, endTick: 0, checkpoints: [] });
    const r = cards.replayFiveHandsRun(seed, raw, 1);
    runs.push({ type: "fivehands", rev: 1, seed, label: `${level} bot`, raw, score: r.score, checksum: fh.fhCheckpoint(r.state).checksum, tick: r.state.tick });
  }
  const raw = flawless.fiveHandsFlawless(seed).raw;
  const r = cards.replayFiveHandsRun(seed, raw, 1);
  runs.push({ type: "fivehands", rev: 1, seed, label: "witness", raw, score: r.score, checksum: fh.fhCheckpoint(r.state).checksum, tick: r.state.tick });
}
for (const n of [0, 7, 23, 41]) {
  const seed = bankV2.poolBankV2SeedFor(n);
  for (const level of LEVELS) {
    const game = poolSim.poolGameFor(2);
    const { events } = poolBot({ game, seed, rev: 2, human: new Human("pool", seed, level), fixes: true });
    const raw = poolRun.encodePoolRun({ seed, claimedScore: 0, events, endTick: 0, checkpoints: [] });
    const r = poolRun.replayPoolRun(seed, raw, 2);
    runs.push({ type: "pool", rev: 2, seed, label: `${level} bot`, raw, score: r.score, checksum: poolSim.poolCheckpoint(r.state).checksum, tick: r.state.tick });
  }
}
const head = execSync("git rev-parse --short HEAD", { cwd: root, encoding: "utf8" }).trim();
const out = new URL("./fixtures/tuning-nov1-legacy.json", import.meta.url);
writeFileSync(out, JSON.stringify({ recorded: `main ${head}, before poolRev 3, freecellRev 3 and fiveHandsRev 2`, runs }) + "\n");
console.log(`recorded ${runs.length} runs: ${runs.map((r) => `${r.type}:${r.score}`).join(" ")}`);
