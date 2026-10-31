/**
 * Records the Cards & Board rev-1 legacy fixture (31 Oct 2026; scripts/fixtures/cards-rev1-legacy.json) from a checkout
 * of main before Free Cell's and Full House's rev 2: FreeCell and Poker Squares runs on revision 1 (skill-band bots
 * weak, good and elite, and the flawless lines) with the score and final-state checksum main's server replay gives.
 * cards-check replays every one on today's tree and fails on any difference.
 *
 *   git worktree add ../main-cards origin/main && ln -s "$PWD/node_modules" ../main-cards/node_modules
 *   bun scripts/cards-legacy-record.ts ../main-cards
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const imp = (p: string) => import(`${root}/${p}`) as Promise<any>;
console.error = () => {};

const { Human } = await imp("scripts/arcade-skill-bands/human.ts");
const cards = await imp("src/lib/duel/cards.ts");
const fc = await imp("src/lib/arcade/cards/freecell.ts");
const ps = await imp("src/lib/arcade/cards/pokerSquares.ts");
const flawless = await imp("scripts/cards/flawless.ts");
const fcBot = (await imp("scripts/arcade-skill-bands/bots/freecell.ts")).bot;
const psBot = (await imp("scripts/arcade-skill-bands/bots/pokersquares.ts")).bot;

const runs: { type: string; seed: number; label: string; raw: string; score: number; checksum: number; tick: number }[] = [];
const add = (type: string, seed: number, label: string, raw: string) => {
  const r = type === "freecell" ? cards.replayFreecellRun(seed, raw, 1) : cards.replayPokerSquaresRun(seed, raw, 1);
  const cp = type === "freecell" ? fc.fcCheckpoint(r.state) : ps.psCheckpoint(r.state);
  runs.push({ type, seed, label, raw, score: r.score, checksum: cp.checksum, tick: r.state.tick });
};
for (const seed of [0, 3, 17, 42, 150, 299]) {
  for (const level of ["weak", "good", "elite"]) {
    const game = fc.freecellGameFor(1);
    const { events } = fcBot({ game, seed, rev: 1, human: new Human("freecell", seed, level), fixes: true });
    add("freecell", seed, `${level} bot`, cards.encodeFreecellRun({ seed, claimedScore: 0, events, endTick: 0, checkpoints: [] }));
  }
  add("freecell", seed, "par line", flawless.freecellFlawless(seed).raw);
}
for (const seed of [1, 9, 77, 4242, 123456789, 987654]) {
  for (const level of ["weak", "good", "great"]) {
    const game = ps.pokerSquaresGameFor(1);
    const { events } = psBot({ game, seed, rev: 1, human: new Human("pokersquares", seed, level), fixes: true });
    add("pokersquares", seed, `${level} bot`, cards.encodePokerSquaresRun({ seed, claimedScore: 0, events, endTick: 0, checkpoints: [] }));
  }
  add("pokersquares", seed, "target grid", flawless.pokerSquaresFlawless(seed).raw);
}
const out = new URL("./fixtures/cards-rev1-legacy.json", import.meta.url);
writeFileSync(out, JSON.stringify({ recorded: "main b154694, before freecellRev 2 and pokerSquaresRev 2", runs }) + "\n");
console.log(`recorded ${runs.length} runs: ${runs.map((r) => r.score).join(" ")}`);
