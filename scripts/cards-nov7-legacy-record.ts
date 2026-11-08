/**
 * Records the 7 Nov 2026 cards partial-credit batch's legacy fixture (scripts/fixtures/cards-nov7-legacy.json) from a
 * checkout of main before Thirteen's pyramidRev 2, Summit's tripeaksRev 3 and Free Cell's freecellRev 5: runs on the
 * revisions main dealt (pyramidRev 1, tripeaksRev 2, freecellRev 4; skill-band bots at four levels and the flawless
 * lines) with the score, final-state checksum and tick main's server replay gives. cards-nov7-check replays every one
 * on today's tree and fails on any difference.
 *
 *   git worktree add ../main-cards origin/main && ln -s "$PWD/node_modules" ../main-cards/node_modules
 *   bun scripts/cards-nov7-legacy-record.ts ../main-cards
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
const tp = await imp("src/lib/arcade/cards/tripeaks.ts");
const py = await imp("src/lib/arcade/cards/pyramid.ts");
const flawless = await imp("scripts/cards/flawless.ts");
const fcBot = (await imp("scripts/arcade-skill-bands/bots/freecell.ts")).bot;
const tpBot = (await imp("scripts/arcade-skill-bands/bots/tripeaks.ts")).bot;
const pyBot = (await imp("scripts/arcade-skill-bands/bots/pyramid.ts")).bot;

type Run = { type: string; rev: number; seed: number; label: string; raw: string; score: number; checksum: number; tick: number };
const runs: Run[] = [];
const LEVELS = ["weak", "average", "great", "elite"];

for (const seed of [0, 5, 42, 299]) {
  for (const level of LEVELS) {
    const game = fc.freecellGameFor(4);
    const { events } = fcBot({ game, seed, rev: 4, human: new Human("freecell", seed, level), fixes: true });
    const raw = cards.encodeFreecellRun({ seed, claimedScore: 0, events, endTick: 0, checkpoints: [] });
    const r = cards.replayFreecellRun(seed, raw, 4);
    runs.push({ type: "freecell", rev: 4, seed, label: `${level} bot`, raw, score: r.score, checksum: fc.fcCheckpoint(r.state).checksum, tick: r.state.tick });
  }
  const raw = flawless.freecellFlawless(seed, 20, 4).raw;
  const r = cards.replayFreecellRun(seed, raw, 4);
  runs.push({ type: "freecell", rev: 4, seed, label: "par line", raw, score: r.score, checksum: fc.fcCheckpoint(r.state).checksum, tick: r.state.tick });
}
for (const seed of [0, 3, 17, 150, 299]) {
  for (const level of LEVELS) {
    const game = tp.tripeaksGameFor(2);
    const { events } = tpBot({ game, seed, rev: 2, human: new Human("tripeaks", seed, level), fixes: true });
    const raw = cards.encodeTripeaksRun({ seed, claimedScore: 0, events, endTick: 0, checkpoints: [] });
    const r = cards.replayTripeaksRun(seed, raw, 2);
    runs.push({ type: "tripeaks", rev: 2, seed, label: `${level} bot`, raw, score: r.score, checksum: tp.tpCheckpoint(r.state).checksum, tick: r.state.tick });
  }
  const raw = flawless.tripeaksFlawless(seed, 15, 2).raw;
  const r = cards.replayTripeaksRun(seed, raw, 2);
  runs.push({ type: "tripeaks", rev: 2, seed, label: "stock-par line", raw, score: r.score, checksum: tp.tpCheckpoint(r.state).checksum, tick: r.state.tick });
}
for (const seed of [1, 9, 77, 4242, 123456789]) {
  for (const level of LEVELS) {
    const game = py.pyramidGameFor(1);
    const { events } = pyBot({ game, seed, rev: 1, human: new Human("pyramid", seed, level), fixes: true });
    const raw = cards.encodePyramidRun({ seed, claimedScore: 0, events, endTick: 0, checkpoints: [] });
    const r = cards.replayPyramidRun(seed, raw, 1);
    runs.push({ type: "pyramid", rev: 1, seed, label: `${level} bot`, raw, score: r.score, checksum: py.pyCheckpoint(r.state).checksum, tick: r.state.tick });
  }
  const raw = flawless.pyramidFlawless(seed).raw;
  const r = cards.replayPyramidRun(seed, raw, 1);
  runs.push({ type: "pyramid", rev: 1, seed, label: "witness", raw, score: r.score, checksum: py.pyCheckpoint(r.state).checksum, tick: r.state.tick });
}
const head = execSync("git rev-parse --short HEAD", { cwd: root, encoding: "utf8" }).trim();
const out = new URL("./fixtures/cards-nov7-legacy.json", import.meta.url);
writeFileSync(out, JSON.stringify({ recorded: `main ${head}, before pyramidRev 2, tripeaksRev 3 and freecellRev 5`, runs }) + "\n");
console.log(`recorded ${runs.length} runs: ${runs.map((r) => `${r.type}:${r.score}`).join(" ")}`);
