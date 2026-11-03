/**
 * Records scripts/fixtures/sports-nov3-legacy.json from a checkout of main before Home Run's homerunRev 4 and Cue Ball's
 * poolRev 4 (3 Nov 2026): homerunRev 3 runs (the skill-band bots at every level and the random swiper on rev 3's deal,
 * plus edge logs carrying rev 4's spot and tap kinds 3 and 4, which rev 3 must ignore) and poolRev 3 runs (bots at four
 * levels on the poolRev 3 bank), each with the score, final checksum and end tick main's server replay gives.
 * homerun-check and pool-check replay every one on today's tree and fail on any difference. Never re-record over it.
 *
 *   git worktree add ../main-sports origin/main && ln -s "$PWD/node_modules" ../main-sports/node_modules
 *   bun scripts/sports-nov3-legacy-record.ts ../main-sports
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const root = resolve(process.argv[2] ?? ".");
const imp = (p: string) => import(`${root}/${p}`) as Promise<any>;

const { Human, ALL_LEVELS } = await imp("scripts/arcade-skill-bands/human.ts");
const hrSim = await imp("src/lib/arcade/homerun.ts");
const hrRun = await imp("src/lib/duel/homerun.ts");
const hrDeal = await imp("src/lib/duel/homerunDealV3.server.ts");
const hrBots = await imp("scripts/arcade-skill-bands/bots/homerun.ts");
const engine = await imp("src/lib/arcade/engine.ts");
const poolRun = await imp("src/lib/duel/pool.ts");
const poolSim = await imp("src/lib/arcade/pool.ts");
const bankV3 = await imp("src/lib/duel/poolBankV3.server.ts");
const poolBot = (await imp("scripts/arcade-skill-bands/bots/pool.ts")).bot;

type Run = { type: string; rev: number; seed: number; label: string; raw: string; score: number; checksum: number; tick: number };
const runs: Run[] = [];

const hrGame = hrSim.homerunGameFor(3);
const hrPush = (seed: number, label: string, events: any[]) => {
  const raw = hrRun.encodeHomerunRun({ seed, claimedScore: 0, events, endTick: 0, checkpoints: [] });
  const r = hrRun.replayHomerunRun(seed, raw, 3);
  runs.push({ type: "homerun", rev: 3, seed, label, raw, score: r.score, checksum: hrSim.homerunCheckpoint(r.state).checksum, tick: r.state.tick });
};
for (let n = 0; n < 5; n++) {
  const seed = hrDeal.HOMERUN_DEAL_V3[n * 53]!;
  for (const level of ALL_LEVELS) hrPush(seed, level, hrBots.bot({ game: hrGame, seed, rev: 3, human: new Human("homerun", seed, level), fixes: true }).events ?? []);
  hrPush(seed, "random", hrBots.randomBot({ game: hrGame, seed, rev: 3, human: new Human("homerun", seed, "weak"), fixes: true }).events ?? []);
}
// Edge logs: rev 4's spot (kind 3) and tap (kind 4) events around every pitch, plus a real swing on half of them.
for (let n = 0; n < 4; n++) {
  const seed = hrDeal.HOMERUN_DEAL_V3[250 + n]!;
  const events: any[] = [];
  for (let i = 0; i < 10; i++) {
    const t = 96 + i * 348;
    events.push({ t: t - 80, k: 3, a: 60 + ((i * 41 + n * 13) % 270), b: 40 + ((i * 29 + n * 7) % 220), c: 0, d: 0 });
    events.push({ t: t + 30 + ((i + n) % 9), k: 4, a: 0, b: 0, c: 0, d: 0 });
    if ((i + n) % 2) engine.recordInput(events, { t: t + 40 + ((n * 5 + i * 3) % 12), k: 1, a: 450 + ((i * 37) % 110), b: -400 + ((i * 113 + n * 71) % 800), c: 0, d: 0 }, hrSim.HOMERUN_INPUT_RANGES_V3);
  }
  events.sort((x: any, y: any) => x.t - y.t);
  hrPush(seed, `edges ${n}`, events);
}

for (const n of [0, 9, 31, 47]) {
  const seed = bankV3.poolBankV3SeedFor(n);
  for (const level of ["weak", "average", "great", "elite"]) {
    const game = poolSim.poolGameFor(3);
    const { events } = poolBot({ game, seed, rev: 3, human: new Human("pool", seed, level), fixes: true });
    const raw = poolRun.encodePoolRun({ seed, claimedScore: 0, events, endTick: 0, checkpoints: [] });
    const r = poolRun.replayPoolRun(seed, raw, 3);
    runs.push({ type: "pool", rev: 3, seed, label: `${level} bot`, raw, score: r.score, checksum: poolSim.poolCheckpoint(r.state).checksum, tick: r.state.tick });
  }
}
const head = execSync("git rev-parse --short HEAD", { cwd: root, encoding: "utf8" }).trim();
const out = new URL("./fixtures/sports-nov3-legacy.json", import.meta.url);
writeFileSync(out, JSON.stringify({ recorded: `main ${head}, before homerunRev 4 and poolRev 4`, runs }) + "\n");
console.log(`recorded ${runs.length} runs: ${runs.map((r) => `${r.type}:${r.score}`).join(" ")}`);
