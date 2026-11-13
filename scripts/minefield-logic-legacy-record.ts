/**
 * Records Minefield's legacy fixture (scripts/fixtures/minefield-logic-legacy.json) from a checkout of main before
 * minesRev 2 (13 Nov 2026, Minefield to Logic with 20 mines): minesRev 1 runs (skill-band bots at four levels, the
 * oracle's perfect line, an idle run) with the score and final-state checksum main's server replay gives, and a digest
 * of the first 100 room seeds' rev-1 boards. minefield-logic-check replays every run on today's tree and fails on any
 * difference.
 *
 *   git worktree add ../main-mines origin/main && ln -s "$PWD/node_modules" ../main-mines/node_modules
 *   bun scripts/minefield-logic-legacy-record.ts ../main-mines
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const root = resolve(process.argv[2] ?? ".");
const imp = (p: string) => import(`${root}/${p}`) as Promise<any>;
console.error = () => {};

const { Human } = await imp("scripts/arcade-skill-bands/human.ts");
const sim = await imp("src/lib/arcade/minesweeper.ts");
const duel = await imp("src/lib/duel/minesweeper.ts");
const oracles = await imp("scripts/cards-board-oracles.ts");
const bot = (await imp("scripts/arcade-skill-bands/bots/minesweeper.ts")).bot;
const { roomSeed } = await imp("scripts/arcade-skill-bands/games.ts");

type Run = { seed: number; label: string; raw: string; score: number; checksum: number; tick: number; revealed: number; hits: number };
const runs: Run[] = [];
const push = (seed: number, label: string, raw: string) => {
  const r = duel.replayMinesweeperRun(seed, raw, 1);
  runs.push({ seed, label, raw, score: r.score, checksum: sim.minesCheckpoint(r.state).checksum, tick: r.state.tick, revealed: r.revealed, hits: r.hits });
};
for (const n of [0, 3, 17, 42, 59]) {
  const seed = roomSeed(n);
  for (const level of ["weak", "average", "great", "elite"]) {
    const { events } = bot({ game: sim.minesweeperGameFor(1), seed, rev: 1, human: new Human("minesweeper", seed, level) });
    push(seed, `${level} bot`, duel.encodeMinesweeperRun({ seed, claimedScore: 0, events: events ?? [], endTick: 0, checkpoints: [] }));
  }
  push(seed, "oracle", oracles.encodeOracle(seed, oracles.minesOracle(seed), "minesweeper"));
  push(seed, "idle", oracles.encodeOracle(seed, [], "minesweeper"));
}
const boards = createHash("sha256");
for (let n = 0; n < 100; n++) {
  const b = sim.minesBoard(roomSeed(n));
  boards.update(`${n}:${b.start}:${b.tries}:${b.mines.join("")};`);
}
const commit = execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim();
writeFileSync(
  "scripts/fixtures/minefield-logic-legacy.json",
  JSON.stringify({ recordedOn: commit, boardsDigest: boards.digest("hex"), runs }, null, 1) + "\n",
);
console.log(`recorded ${runs.length} minesRev 1 runs and the rev-1 board digest on ${commit}`);
