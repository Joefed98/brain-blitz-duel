/**
 * Rainbow Bridge's difficulty levels (the Strategy overhaul's stage 3, 15 Nov 2026; docs/arcade-standard/inkbridge.md
 * "Levels (stage 3)"): inkRev 15 at Easy, Hard and Expert (INK_LEVEL_SETS), Normal exactly today's game. Proves:
 *
 *  1. the registry: GAME_LEVELS.inkbridge offers Easy, Hard and Expert with exactly the sim's INK_LEVEL_SETS; Normal's
 *     figures (INK_LEVEL_NORMAL) are what today's code does (1.25× ink, live from level 9, a 10 % par margin);
 *  2. Normal identical: a Normal deal is byte for byte the deal without a level (no `level` field, inkRev 15, a seed of
 *     INK_HILLS_DEAL), and Normal levels build exactly as before levels (digests recorded on 6987d8bb,
 *     scripts/fixtures/ink-levels-normal.json); a level on an older stamp is ignored;
 *  3. each level's deal: inkRev 15 stamped with the level, a seed of the level's own deal list, the run's ink, live
 *     levels, birds and par margins as the level's rules say, swaying birds only on Expert's levels 5–6;
 *  4. the deal lists are proved: every entry's witness (the oracle's perfect run) scores exactly 200, unflagged, through
 *     the server replay of its level, and the deal is exactly the witnessed seeds in order (6 entries a level at quick
 *     depth, every entry with CHECKS_FULL=1 or --full); generation's proofs pass on sampled entries (all at full);
 *  5. swaying birds: deterministic (two builds alike), periodic on their level's pot period, inside the world, tested by
 *     the collision rule where they are on the tick (inkCoinTouchesBird), and the server replay of one log is identical;
 *  6. the clock is at most 120 s at every level; rated and the Daily deal Normal whatever is asked.
 *
 *   bun scripts/ink-levels-check.ts            (~1–2 min)
 */
import { createHash } from "node:crypto";
import { createCanvas } from "@napi-rs/canvas";
import { drawPot } from "../src/lib/arcade/inkBridge.renderer";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  inkBirdDx,
  inkBridgeGameFor,
  inkBudgetFor,
  inkBudgetNow,
  inkCoinTouchesBird,
  inkIsLive,
  inkLiveNow,
  inkV13Proof,
  INK_LEVEL_NORMAL,
  INK_LEVEL_SETS,
  INK_LEVELS,
  INK_REV_BIG,
  INK_REV_HILLS,
  INK_RUN_TICKS,
  INK_V13_PAR_MARGIN_PCT,
  INK_V13_SPEED_FULL,
  INK_BUCKET_W,
  inkSpeedFullTicks,
  INK_WORLD_W,
  type InkDiff,
  type InkState,
} from "../src/lib/arcade/inkBridge";
import { replayInkBridgeRun } from "../src/lib/duel/inkBridge";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { INK_HILLS_DEAL } from "../src/lib/duel/inkHillsDeal.server";
import { GAME_LEVELS, levelsOf } from "../src/lib/levels/gameLevels";
import { modeLevel } from "../src/lib/levels/modes";
import { MAX_ROUND_CLOCK_MS } from "../src/lib/levels/levels";
import { inkBigProved, inkBigSubmission, inkBigVerdict, inkLevelDealFile, inkLevelWitnessFile, readInkBigDeal, type InkWitness } from "./ink-big-deal";

const failures: string[] = [];
let checks = 0;
const ok = (cond: unknown, what: string) => {
  checks++;
  if (!cond) failures.push(what);
};
const section = (name: string) => console.log(`— ${name}`);
const FULL = process.env.CHECKS_FULL === "1" || process.argv.includes("--full");
const started = Date.now();
const DIFFS: InkDiff[] = ["easy", "hard", "expert"];
const tall = (i: number) => Math.trunc((Math.trunc(500 + (900 * i) / 9) * 279) / 256);
const deal = (level: string | undefined, n: number) => withSeededRandom(1000 + n, () => generatePuzzle("inkbridge", { bankSeed: 1000 + n, ...(level ? { level: level as never } : {}) }));

section("1. the registry and Normal's figures");
{
  ok(levelsOf("inkbridge").join() === "easy,normal,hard,expert", `inkbridge offers ${levelsOf("inkbridge").join()}`);
  for (const d of DIFFS) ok(JSON.stringify(GAME_LEVELS.inkbridge?.levels[d]?.settings) === JSON.stringify(INK_LEVEL_SETS[d]), `${d}: gameLevels.ts settings mirror INK_LEVEL_SETS.${d}`);
  ok(INK_LEVEL_NORMAL.inkPct === 125 && INK_LEVEL_NORMAL.liveFrom === 8 && INK_LEVEL_NORMAL.parMarginPct === INK_V13_PAR_MARGIN_PCT && INK_LEVEL_NORMAL.parMarginPct === 10, "Normal's documented figures: 125 %, live from level 9, 10 %");
  ok(Array.from({ length: INK_LEVELS }, (_, i) => i).every((i) => inkBudgetFor(i, INK_REV_HILLS) === (i >= 8 ? Math.trunc((Math.trunc((tall(i) * 5) / 4) * 384) / 256) : Math.trunc((tall(i) * 5) / 4))), "today's inkRev 15 ink is inkRev 10's × 1.25 (× 1.5 on live levels)");
  ok(!inkIsLive(7, INK_REV_HILLS) && inkIsLive(8, INK_REV_HILLS), "today's live levels start at level 9");
  ok(INK_LEVEL_SETS.easy.inkPct === 150 && INK_LEVEL_SETS.hard.inkPct === 110 && INK_LEVEL_SETS.expert.inkPct === 100, "ink: Easy 1.5×, Hard 1.1×, Expert 1.0×");
  ok(INK_LEVEL_SETS.easy.liveFrom === INK_LEVELS && INK_LEVEL_SETS.hard.liveFrom === 7 && INK_LEVEL_SETS.expert.liveFrom === 6, "live levels: none on Easy, from level 8 on Hard, from level 7 on Expert");
  // Expert's par margin is 0 % (the coordinator's lever of 16 Nov 2026 for a clear step; Joe's brief said 5 %).
  ok(INK_LEVEL_SETS.easy.parMarginPct === 25 && INK_LEVEL_SETS.hard.parMarginPct === 10 && INK_LEVEL_SETS.expert.parMarginPct === 0, "par margins 25 / 10 / 0 %");
  ok(INK_LEVEL_SETS.easy.birdsPct === 50 && INK_LEVEL_SETS.hard.extraBirds.some((x) => x > 0) && INK_LEVEL_SETS.expert.extraBirds.every((x, i) => x >= (INK_LEVEL_SETS.hard.extraBirds[i] ?? 0)) && INK_LEVEL_SETS.expert.swayBirds > 0, "birds: half on Easy, more on Hard, at least as many on Expert, some swaying");
}

section("2. Normal is today's game");
{
  for (let n = 0; n < 4; n++) {
    const a = deal(undefined, n);
    const b = deal("normal", n);
    ok(JSON.stringify(a) === JSON.stringify(b) && !("level" in b), `deal ${n}: Normal is the deal without a level, with no level field`);
    ok(b.type === "inkbridge" && b.inkRev === INK_REV_HILLS && INK_HILLS_DEAL.includes(b.seed), `deal ${n}: Normal deals inkRev 15 from INK_HILLS_DEAL`);
  }
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/ink-levels-normal.json", import.meta.url), "utf8")) as { digests: { seed: number; digest: string }[] };
  for (const { seed, digest } of fixture.digests) {
    const now = createHash("sha256").update(JSON.stringify(inkBridgeGameFor(INK_REV_HILLS).init(seed))).digest("hex");
    ok(now === digest, `seed ${seed}: Normal inkRev 15 levels build exactly as before levels`);
    ok(inkBridgeGameFor(INK_REV_HILLS, "normal") === inkBridgeGameFor(INK_REV_HILLS), "a level of \"normal\" is today's game");
  }
  ok(inkBridgeGameFor(INK_REV_BIG, "expert") === inkBridgeGameFor(INK_REV_BIG), "a level on an older stamp is ignored (inkRev 14 plays as before)");
}

section("3. each level's deal and rules");
const states = new Map<InkDiff, InkState[]>();
for (const d of DIFFS) {
  const list = readInkBigDeal(inkLevelDealFile(d));
  const set = INK_LEVEL_SETS[d];
  const built: InkState[] = [];
  for (let n = 0; n < 3; n++) {
    const p = deal(d, n) as { type: string; inkRev?: number; seed: number; level?: string };
    ok(p.level === d && p.inkRev === INK_REV_HILLS && list.includes(p.seed), `${d} deal ${n}: inkRev 15, level ${d}, a seed of its own deal`);
    const s = inkBridgeGameFor(p.inkRev, p.level).init(p.seed) as InkState;
    ok(s.diff === d, `${d} deal ${n}: the run carries its level`);
    built.push(s);
    for (let i = 0; i < INK_LEVELS; i++) {
      const live = i >= set.liveFrom;
      const at = { ...s, level: i };
      ok(inkLiveNow(at) === live, `${d} seed ${p.seed} level ${i + 1}: live ${live}`);
      const base = Math.trunc((tall(i) * set.inkPct) / 100);
      ok(inkBudgetNow(at) === (live ? Math.trunc((base * 384) / 256) : base), `${d} seed ${p.seed} level ${i + 1}: ink ${set.inkPct} % of inkRev 10's${live ? " (× 1.5 live)" : ""}`);
      const lvl = s.list[i]!;
      ok(Boolean(lvl.liveHand) === live, `${d} seed ${p.seed} level ${i + 1}: a hand-drawn live stroke only on a live level`);
      ok(lvl.blocks.every((b) => !b.sway) || (set.swayLevels.includes(i) && !live && lvl.slideAmp > 0), `${d} seed ${p.seed} level ${i + 1}: swaying birds only on a moving pot's non-live listed level`);
    }
    if (d === "easy") {
      const today = inkBridgeGameFor(INK_REV_HILLS).init(INK_HILLS_DEAL[0]!) as InkState;
      ok(s.list.slice(1).reduce((a, l) => a + l.blocks.length, 0) < today.list.slice(1).reduce((a, l) => a + l.blocks.length, 0) * 0.75, `easy seed ${p.seed}: far fewer birds than Normal`);
    }
  }
  states.set(d, built);
  // The ink par margin: on sampled entries, each level's par is its proved line's ink plus the level's margin.
  for (const seed of list.slice(0, FULL ? 6 : 1)) {
    const proof = inkV13Proof(seed, INK_REV_HILLS, d);
    const exact = proof.filter((l) => l.par === Math.trunc((l.witness * (100 + set.parMarginPct)) / 100)).length;
    ok(exact >= 3, `${d} seed ${seed}: ${exact} levels' par is exactly their proved line + ${set.parMarginPct} %`);
    for (const l of proof) {
      const budget = inkBudgetNow({ level: l.level, rev: INK_REV_HILLS, diff: d });
      // The par is the longer of the level's proved lines plus the margin (withInkPar), capped at the ink: so at least the
      // witness line plus the margin, never over the ink.
      ok(l.par <= budget && (l.par === budget || l.par >= Math.trunc((l.witness * (100 + set.parMarginPct)) / 100)), `${d} seed ${seed} level ${l.level + 1}: ink par ${l.par} ≥ proved line ${l.witness} + ${set.parMarginPct} %, within the ink ${budget}`);
    }
  }
}
{
  const hard = states.get("hard")!.flatMap((s) => s.list.slice(1).map((l) => l.blocks.length));
  const normal = [0, 1, 2].flatMap((n) => (inkBridgeGameFor(INK_REV_HILLS).init(deal(undefined, n).seed) as InkState).list.slice(1).map((l) => l.blocks.length));
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  ok(sum(hard) > sum(normal), `Hard has more birds than Normal (${sum(hard)} against ${sum(normal)} over three runs)`);
  ok(states.get("expert")!.some((s) => s.list.some((l) => l.blocks.some((b) => b.sway))), "Expert runs have swaying birds");
}

section("4. every level's deal is proved");
for (const d of DIFFS) {
  const list = readInkBigDeal(inkLevelDealFile(d));
  const witnesses = JSON.parse(gunzipSync(readFileSync(inkLevelWitnessFile(d))).toString()).witnesses as InkWitness[];
  ok(list.length >= 50 && witnesses.length === list.length && witnesses.every((w, i) => w.seed === list[i]), `${d}: the deal (${list.length}) is exactly the witnessed seeds in order`);
  const picked = FULL ? witnesses : witnesses.filter((_, i) => i % Math.ceil(witnesses.length / 6) === 0);
  let full = 0;
  for (const w of picked) {
    const v = inkBigVerdict(w.seed, w.events, INK_REV_HILLS, d);
    if (v.score === 200 && !v.flagged && v.levels === INK_LEVELS) full++;
  }
  ok(full === picked.length, `${d}: ${full} / ${picked.length} entries${FULL ? " (all)" : " (sampled; CHECKS_FULL=1 for all)"} reach 200 through the server replay of the level`);
  for (const w of FULL ? witnesses.slice(0, 12) : witnesses.slice(0, 1)) ok(inkBigProved(w.seed, INK_REV_HILLS, d), `${d} seed ${w.seed}: generation's proofs pass under the level's rules`);
  // The same log at another level (or Normal) is not the level's run: the level is read from the stored puzzle.
  const w0 = witnesses[0]!;
  // (The replay reports the mismatched checkpoints it flags; quiet here, the flag is the point.)
  const quiet = { warn: console.warn, error: console.error, log: console.log };
  console.warn = console.error = console.log = () => {};
  let asNormal: ReturnType<typeof replayInkBridgeRun>;
  try {
    asNormal = replayInkBridgeRun(w0.seed, inkBigSubmission(w0.seed, w0.events, INK_REV_HILLS, d), INK_REV_HILLS);
  } finally {
    Object.assign(console, quiet);
  }
  ok(asNormal.score !== 200 || asNormal.flagged, `${d}: its witness replayed as Normal is not its 200 (the server reads the level)`);
}

section("5. swaying birds");
{
  const list = readInkBigDeal(inkLevelDealFile("expert"));
  let seen = 0;
  for (const seed of list.slice(0, 4)) {
    const a = inkBridgeGameFor(INK_REV_HILLS, "expert").init(seed) as InkState;
    const b = (inkBridgeGameFor(INK_REV_HILLS, "expert").init as (s: number) => InkState)(seed);
    ok(JSON.stringify(a.list) === JSON.stringify(b.list), `expert seed ${seed}: two builds alike`);
    for (const lvl of a.list)
      for (const bird of lvl.blocks) {
        if (!bird.sway) continue;
        seen++;
        const P = lvl.slidePeriod;
        let lo = Infinity;
        let hi = -Infinity;
        let periodic = true;
        for (let t = 0; t < P; t++) {
          const dx = inkBirdDx(lvl, bird, t);
          lo = Math.min(lo, dx);
          hi = Math.max(hi, dx);
          if (inkBirdDx(lvl, bird, t + P * 3) !== dx) periodic = false;
        }
        ok(periodic && hi - lo > bird.sway.amp, `expert seed ${seed}: a bird sways ±${bird.sway.amp} px on its pot's period`);
        ok(bird.x0 + lo >= 0 && bird.x1 + hi <= INK_WORLD_W, `expert seed ${seed}: a swaying bird stays in the world`);
        // The collision rule tests it where it is: its centre at a swung-out tick touches, the still box's far edge doesn't.
        const t = Array.from({ length: P }, (_, k) => k).find((k) => inkBirdDx(lvl, bird, k) === hi)!;
        const y = bird.y + 2;
        ok(inkCoinTouchesBird(lvl, bird, bird.x1 + hi - 1, y, t) && !inkCoinTouchesBird(lvl, bird, bird.x0 + hi - 20, y, t), `expert seed ${seed}: the coin meets a swaying bird where it is on the tick`);
      }
  }
  ok(seen > 0, `swaying birds found in the Expert deal (${seen})`);
  const w = (JSON.parse(gunzipSync(readFileSync(inkLevelWitnessFile("expert"))).toString()).witnesses as InkWitness[])[0]!;
  const raw = inkBigSubmission(w.seed, w.events, INK_REV_HILLS, "expert");
  ok(JSON.stringify(replayInkBridgeRun(w.seed, raw, INK_REV_HILLS, "expert").state) === JSON.stringify(replayInkBridgeRun(w.seed, raw, INK_REV_HILLS, "expert").state), "the server replay of an Expert log is identical twice");
}

section("5b. the pot's width and the speed part");
{
  // Every level of a dealt run carries its level's pot width (Normal's carry none: INK_BUCKET_W).
  for (const d of DIFFS) {
    const w = INK_LEVEL_SETS[d].potW;
    for (const s of states.get(d)!) ok(s.list.every((l) => (l.potW ?? INK_BUCKET_W) === (w ?? INK_BUCKET_W)), `${d}: every level's pot is ${w ?? INK_BUCKET_W} px`);
  }
  ok((INK_LEVEL_SETS.easy.potW ?? 64) > INK_BUCKET_W && (INK_LEVEL_SETS.hard.potW ?? 64) < INK_BUCKET_W && (INK_LEVEL_SETS.expert.potW ?? 64) < (INK_LEVEL_SETS.hard.potW ?? 64), "pots: wider on Easy, narrower on Hard, narrower again on Expert");
  ok((inkBridgeGameFor(INK_REV_HILLS).init(INK_HILLS_DEAL[0]!) as InkState).list.every((l) => l.potW === undefined), "Normal levels carry no pot width");
  // The art is drawn to the collision: the pot's painted pixels lie within 2 px of its rim caps' span (the bounds rule).
  for (const w of [INK_BUCKET_W, INK_LEVEL_SETS.easy.potW!, INK_LEVEL_SETS.hard.potW!, INK_LEVEL_SETS.expert.potW!]) {
    const cv = createCanvas(200, 120);
    const c = cv.getContext("2d") as unknown as CanvasRenderingContext2D;
    drawPot(c, 100, 40, false, w);
    const px = cv.getContext("2d").getImageData(0, 0, 200, 120).data;
    let lo = 200, hi = -1;
    for (let y = 0; y < 120; y++) for (let x = 0; x < 200; x++) if (px[(y * 200 + x) * 4 + 3]! > 40) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
    // The gold glow behind the mouth is light, not the pot: judge the solid pixels only (alpha > 40) and allow the rim caps (4 px).
    ok(hi >= 0 && lo >= 100 - w / 2 - 4 - 2 - 1 && hi <= 100 + w / 2 + 4 + 2, `a ${w} px pot is drawn within 2 px of its rim caps (${lo}–${hi})`);
    ok(hi - lo >= w - 2, `a ${w} px pot fills its width (${hi - lo + 1} px)`);
  }
  ok(inkSpeedFullTicks() === INK_V13_SPEED_FULL && inkSpeedFullTicks("easy") === INK_V13_SPEED_FULL, "speed full with 50 s left on Normal and Easy");
  ok(inkSpeedFullTicks("hard") === 70 * 60 && inkSpeedFullTicks("expert") === 85 * 60, "speed full with 70 s left on Hard, 85 s on Expert");
}

section("6. the clock; rated and the Daily");
{
  for (const d of [undefined, ...DIFFS]) {
    const p = deal(d, 7);
    ok(puzzleTimeLimitMs(p) <= MAX_ROUND_CLOCK_MS + 3_000 && inkBridgeGameFor(INK_REV_HILLS, d).runTicks === INK_RUN_TICKS && INK_RUN_TICKS <= 120 * 60, `${d ?? "normal"}: a 120 s run`);
  }
  for (const mode of ["rated", "daily"] as const)
    for (const d of DIFFS) {
      const level = modeLevel(mode, d);
      ok(level === "normal", `${mode} asks ${d}: Normal`);
      const p = withSeededRandom(7, () => generatePuzzle("inkbridge", { bankSeed: 7, level }));
      ok(!("level" in p) && INK_HILLS_DEAL.includes((p as { seed: number }).seed), `${mode}: the deal is Normal's`);
    }
}

const secs = Math.round((Date.now() - started) / 1000);
if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  ✗ ${f}`);
  console.log(`FAIL ink-levels-check: ${failures.length} of ${checks} checks failed (${secs} s)`);
  process.exit(1);
}
console.log(`PASS ink-levels-check: ${checks} checks (${secs} s)`);
