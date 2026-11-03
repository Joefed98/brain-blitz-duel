/**
 * Records the 3 Nov 2026 Cards & Board batch's legacy fixture (scripts/fixtures/cards-nov3-legacy.json) from a checkout
 * of main before Five Hands' fiveHandsRev 3, Free Cell's freecellRev 4 and Summit's tripeaksRev 2: runs on the
 * revisions main dealt (fiveHandsRev 2, freecellRev 3, tripeaksRev 1; skill-band bots at four levels and the flawless
 * lines) with the score and final-state checksum main's server replay gives. cards-check replays every one on today's
 * tree and fails on any difference.
 *
 *   git worktree add ../main-cards origin/main && ln -s "$PWD/node_modules" ../main-cards/node_modules
 *   bun scripts/cards-nov3-legacy-record.ts ../main-cards
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
const fc = await imp("src/lib/arcade/cards/freecell.ts");
const fh = await imp("src/lib/arcade/cards/fiveHands.ts");
const tp = await imp("src/lib/arcade/cards/tripeaks.ts");
const flawless = await imp("scripts/cards/flawless.ts");
const fcBot = (await imp("scripts/arcade-skill-bands/bots/freecell.ts")).bot;
const fhBot = (await imp("scripts/arcade-skill-bands/bots/fivehands.ts")).bot;
const tpBot = (await imp("scripts/arcade-skill-bands/bots/tripeaks.ts")).bot;

type Run = { type: string; rev: number; seed: number; label: string; raw: string; score: number; checksum: number; tick: number };
const runs: Run[] = [];
const LEVELS = ["weak", "average", "great", "elite"];

for (const seed of [0, 5, 42, 299]) {
  for (const level of LEVELS) {
    const game = fc.freecellGameFor(3);
    const { events } = fcBot({ game, seed, rev: 3, human: new Human("freecell", seed, level), fixes: true });
    const raw = cards.encodeFreecellRun({ seed, claimedScore: 0, events, endTick: 0, checkpoints: [] });
    const r = cards.replayFreecellRun(seed, raw, 3);
    runs.push({ type: "freecell", rev: 3, seed, label: `${level} bot`, raw, score: r.score, checksum: fc.fcCheckpoint(r.state).checksum, tick: r.state.tick });
  }
  const raw = flawless.freecellFlawless(seed, 20, 3).raw;
  const r = cards.replayFreecellRun(seed, raw, 3);
  runs.push({ type: "freecell", rev: 3, seed, label: "par line", raw, score: r.score, checksum: fc.fcCheckpoint(r.state).checksum, tick: r.state.tick });
}
for (const seed of [1, 9, 77, 4242, 123456789]) {
  for (const level of LEVELS) {
    const game = fh.fiveHandsGameFor(2);
    const { events } = fhBot({ game, seed, rev: 2, human: new Human("fivehands", seed, level), fixes: true });
    const raw = cards.encodeFiveHandsRun({ seed, claimedScore: 0, events, endTick: 0, checkpoints: [] });
    const r = cards.replayFiveHandsRun(seed, raw, 2);
    runs.push({ type: "fivehands", rev: 2, seed, label: `${level} bot`, raw, score: r.score, checksum: fh.fhCheckpoint(r.state).checksum, tick: r.state.tick });
  }
  const raw = flawless.fiveHandsFlawless(seed, 20, 2).raw;
  const r = cards.replayFiveHandsRun(seed, raw, 2);
  runs.push({ type: "fivehands", rev: 2, seed, label: "witness", raw, score: r.score, checksum: fh.fhCheckpoint(r.state).checksum, tick: r.state.tick });
}
for (const seed of [0, 3, 17, 150, 299]) {
  for (const level of LEVELS) {
    const game = tp.tripeaksGameFor(1);
    const { events } = tpBot({ game, seed, rev: 1, human: new Human("tripeaks", seed, level), fixes: true });
    const raw = cards.encodeTripeaksRun({ seed, claimedScore: 0, events, endTick: 0, checkpoints: [] });
    const r = cards.replayTripeaksRun(seed, raw, 1);
    runs.push({ type: "tripeaks", rev: 1, seed, label: `${level} bot`, raw, score: r.score, checksum: tp.tpCheckpoint(r.state).checksum, tick: r.state.tick });
  }
  const raw = flawless.tripeaksFlawless(seed).raw;
  const r = cards.replayTripeaksRun(seed, raw, 1);
  runs.push({ type: "tripeaks", rev: 1, seed, label: "clearing line", raw, score: r.score, checksum: tp.tpCheckpoint(r.state).checksum, tick: r.state.tick });
}
const head = execSync("git rev-parse --short HEAD", { cwd: root, encoding: "utf8" }).trim();
const out = new URL("./fixtures/cards-nov3-legacy.json", import.meta.url);
writeFileSync(out, JSON.stringify({ recorded: `main ${head}, before fiveHandsRev 3, freecellRev 4 and tripeaksRev 2`, runs }) + "\n");
console.log(`recorded ${runs.length} runs: ${runs.map((r) => `${r.type}:${r.score}`).join(" ")}`);
