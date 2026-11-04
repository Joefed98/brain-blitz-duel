/**
 * flip-deal-check (3 Nov 2026, the Action polish; docs/arcade-standard/flip.md "flipRev 12"): Roofbound flipRev 12 is
 * flipRev 11's game exactly, dealt only on the courses proved to reach 200.
 *
 *  1. Wiring: rooms deal flipRev 12 on a seed from FLIP_DEAL; LIVE_BANDS, the arcade-standard entry and playRevOf (12 →
 *     11's play, flipRev 8's) follow; the intro demo plays one recorded on flipRev 11 or 12.
 *  2. The same game: flipGameFor(12) is flipGameFor(11) (the same sim, states, score and checksum), the replay and the
 *     world height are 11's, and bot logs at every level score and end identically on both stamps.
 *  3. The deal: src/lib/duel/flipDeal.server.ts is what `bun scripts/flip-deal.ts` builds (byte for byte), every seed in
 *     it has a stored witness route that scores exactly 200 through the server replay on flipRev 12 with every part at
 *     its maximum, and the four witness courses that land only seven of the eight sweet spots are left out.
 *
 *   bun scripts/flip-deal-check.ts      # ~20 s
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human } from "./arcade-skill-bands/human";
import { entry, flipTakesAll } from "./arcade-standard/flip";
import { buildFlipDeal, flipDealSource, FLIP_DEAL_FILE } from "./flip-deal";
import { encodeFlipLog, FLIP_WITNESS_FIXTURE, type FlipWitness } from "./flip-x200-record";
import { flipTap } from "./flip-x200-plan";
import { playRevOf } from "./scoring-targets-revs";
import { flipCheckpoint, flipGameFor, flipWorldHFor, FLIP_REV_DEAL, FLIP_REV_FLOW, FLIP_V11_BAND_CURVE, type FlipState } from "../src/lib/arcade/flip";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { replayFlipRun } from "../src/lib/duel/flip";
import { FLIP_DEAL, flipDealSeed } from "../src/lib/duel/flipDeal.server";
import { generatePuzzle } from "../src/lib/duel/generate.server";

const failures: string[] = [];
let passes = 0;
function ok(cond: unknown, message: string): void {
  if (cond) passes++;
  else if (failures.length < 80) failures.push(message);
}
const section = (name: string) => console.log(`— ${name}`);

section("1. wiring");
{
  for (let k = 0; k < 30; k++) {
    const p = generatePuzzle("flip" as any) as any;
    ok(p.flipRev === FLIP_REV_DEAL && FLIP_DEAL.includes(p.seed), `deal ${k}: flipRev 12 on a proved course (${p.flipRev}, ${p.seed})`);
  }
  ok(new Set(Array.from({ length: 4000 }, (_, n) => flipDealSeed(n * 7919 + 3))).size === FLIP_DEAL.length, "room seeds reach every course in the deal");
  ok(LIVE_BANDS.flip.rev === FLIP_REV_DEAL && LIVE_BANDS.flip.curve === FLIP_V11_BAND_CURVE, "LIVE_BANDS reads flipRev 12 on flipRev 11's core line");
  ok(entry.rev === FLIP_REV_DEAL && entry.before === FLIP_REV_FLOW, "the arcade-standard entry is flipRev 12, after 11");
  ok(playRevOf("flip", FLIP_REV_DEAL) === playRevOf("flip", FLIP_REV_FLOW) && playRevOf("flip", FLIP_REV_DEAL) === 8, "playRevOf maps flipRev 12 to flipRev 11's play (flipRev 8's)");
  const demo = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
  ok(/demo\.puzzle\.flipRev !== FLIP_REV_FLOW && demo\.puzzle\.flipRev !== FLIP_REV_DEAL\) return null/.test(demo), "the intro demo plays one recorded on flipRev 11 or 12");
}

section("2. the same game as flipRev 11");
{
  ok(flipGameFor(FLIP_REV_DEAL) === flipGameFor(FLIP_REV_FLOW) && flipWorldHFor(FLIP_REV_DEAL) === flipWorldHFor(FLIP_REV_FLOW), "flipRev 12 is flipRev 11's game and world");
  const spec = GAME_BY_TYPE.get("flip")!;
  const { bot } = await import("./arcade-skill-bands/bots/flip");
  const game = flipGameFor(FLIP_REV_DEAL);
  for (const level of ["weak", "average", "good", "near", "elite"] as const)
    for (let n = 0; n < 3; n++) {
      const seed = FLIP_DEAL[n * 17]!;
      const out = bot({ game, seed, rev: FLIP_REV_DEAL, human: new Human("flip", seed, level), fixes: true } as any);
      const events = (out.events ?? []) as { t: number }[];
      const by = new Map(events.map((e) => [e.t, e]));
      let s = game.init(seed) as FlipState;
      const checkpoints: unknown[] = [];
      while (!game.isOver(s) && s.tick < game.runTicks) {
        s = game.step(s, (by.get(s.tick + 1) as any) ?? null) as FlipState;
        if (s.tick % 300 === 0) checkpoints.push(flipCheckpoint(s));
      }
      const body = { seed, claimedScore: game.score(s), events, inputs: [], taps: [], endTick: s.tick, checkpoints };
      const raw = spec.encode(body as any, FLIP_REV_DEAL, seed);
      const a = replayFlipRun(seed, raw, FLIP_REV_DEAL);
      const b = replayFlipRun(seed, spec.encode(body as any, FLIP_REV_FLOW, seed), FLIP_REV_FLOW);
      if (n === 0) console.log(`  ${level}: ${a.score}`);
      ok(!a.flagged && a.score > 0 && a.score === b.score && JSON.stringify(a.state) === JSON.stringify(b.state), `${level} on course ${seed}: the same score and end state on both stamps (${a.score} / ${b.score})`);
    }
}

section("3. the deal");
{
  const built = buildFlipDeal();
  ok(readFileSync(FLIP_DEAL_FILE, "utf8") === flipDealSource(built.kept, built.total), `${FLIP_DEAL_FILE} is what scripts/flip-deal.ts builds`);
  ok(FLIP_DEAL.length === 256 && built.dropped.length === 4, `256 courses dealt, 4 left out (${FLIP_DEAL.length}, ${built.dropped.join("; ")})`);
  const witnesses = new Map((JSON.parse(gunzipSync(readFileSync(FLIP_WITNESS_FIXTURE)).toString()) as FlipWitness[]).map((w) => [w.seed, w]));
  let at200 = 0;
  for (const seed of FLIP_DEAL) {
    const w = witnesses.get(seed);
    if (!w) {
      ok(false, `course ${seed}: no stored witness`);
      continue;
    }
    const { raw, state } = encodeFlipLog(FLIP_REV_DEAL, seed, w.taps.map(flipTap));
    const r = replayFlipRun(seed, raw, FLIP_REV_DEAL);
    if (!r.flagged && r.score === 200 && flipTakesAll(state)) at200++;
    else ok(false, `course ${seed}: its witness scores ${r.score}${r.flagged ? " (flagged)" : ""}`);
  }
  ok(at200 === FLIP_DEAL.length, `every dealt course's witness scores 200 through the server replay with every part at its maximum (${at200} of ${FLIP_DEAL.length})`);
}

console.log(
  failures.length === 0
    ? `PASS flip-deal-check: ${passes} checks`
    : `FAIL flip-deal-check: ${failures.length} of ${passes + failures.length} checks failed\n${failures.map((f) => `  ✗ ${f}`).join("\n")}`,
);
process.exit(failures.length ? 1 : 0);
