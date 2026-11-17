/**
 * bubble-levels-check (the Strategy overhaul, stage 3, 15–16 Nov 2026; docs/arcade-standard/bubble.md "Levels (stage
 * 3)"): Coral Pop's difficulty levels on bubbleRev 12. Proves:
 *
 *  1. The registry (GAME_LEVELS.bubble) offers Easy, Normal, Hard and Expert, with exactly the sim's frozen settings
 *     (BUB_LEVELS); a dealt Normal puzzle carries no level, a dealt Easy / Hard / Expert one carries its level and
 *     bubbleRev 12; rated play and the Daily are always Normal.
 *  2. Normal is today's game exactly: every revision's init states, a scripted run's checkpoints and final states and
 *     scores digest to the values recorded on the tree before levels (scripts/fixtures/bubble-levels-normal.json, the
 *     same digest scripts/bubble-levels-check.ts computes); a level asked of an older stamp plays that stamp unchanged.
 *  3. Each level's reef on 120 seeds: its exact bubble count, its colours (Expert's sixth colour, BUB_SIXTH, on Expert
 *     only), 6 chests on full rows, the queue's colours, the descent cadence (a descent every `every` shots), the aim
 *     trail's reach and the per-level full-at figures on the state; the checkpoint checksum tells the levels apart.
 *  4. The clock: 90 s at every level (at most 120 s).
 *  5. The server replay reads the stored level: a level run replays unflagged to its own score, and the same log
 *     replayed as Normal does not match.
 *  6. Clearable and 200: the recorded witness runs (scripts/bubble-levels-record.ts, the skill-band bot under human
 *     limits at Average, Elite and Flawless) replay through the server to their recorded scores; at every level some
 *     runs clear the reef, 200 is reached through the server on every new level (Elite or Flawless), the Elite level clears
 *     Expert and scores well there, and the bands step down Easy → Normal → Hard → Expert.
 *  7. The art: the sixth colour has its own colour, creature and symbol; the aim trail stops after two bounces (Easy),
 *     one (Hard), a short reach (Expert) and runs on as before at Normal.
 *
 *   bun scripts/bubble-levels-check.ts
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import * as bubble from "../src/lib/arcade/bubble";
import {
  BUB_ALL_COLOURS,
  BUB_CHEST,
  BUB_COLOUR_COUNT,
  BUB_LEVELS,
  BUB_PALETTE,
  BUB_REV_FAST,
  BUB_REV_STD,
  BUB_RUN_TICKS,
  BUB_SIXTH,
  BUB_SIXTH_COLOUR,
  BUB_COLS,
  BUB_V12_REEF,
  bubCheckpoint,
  bubColour,
  bubColoursOf,
  bubIsColour,
  bubReefFullRows,
  bubSymbol,
  bubbleGameFor,
  bubbleStdParts,
  isBubLevel,
  type BubLevel,
  type BubState,
} from "../src/lib/arcade/bubble";
import { bubCreature, drawBubbleAimTrail } from "../src/lib/arcade/bubble.renderer";
import { TICKS_PER_SECOND, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { puzzleTimeLimitMs } from "../src/lib/duel/catalogue";
import { encodeBubbleRun, replayBubbleRun } from "../src/lib/duel/bubble";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { gameLevelSettings, levelsOf } from "../src/lib/levels/gameLevels";
import { puzzleLevel, MAX_ROUND_CLOCK_MS } from "../src/lib/levels/levels";
import { modeLevel } from "../src/lib/levels/modes";
import { WITNESS_PATH, type LevelWitness } from "./bubble-levels-record";

let passes = 0;
const failures: string[] = [];
function ok(cond: boolean, message: string): void {
  if (cond) passes++;
  else failures.push(message);
}
const section = (title: string) => console.log(`— ${title}`);
const json = (v: unknown) => JSON.stringify(v);
const LEVELS: BubLevel[] = ["easy", "hard", "expert"];

/* ------------------------------------------------------------------ 1. the registry, the deal, the modes */
section("The registry, the deal and where levels apply");
{
  ok(json(levelsOf("bubble")) === json(["easy", "normal", "hard", "expert"]), "Coral Pop offers Easy, Normal, Hard and Expert");
  for (const level of LEVELS) ok(json(gameLevelSettings("bubble", level)) === json(BUB_LEVELS[level]), `${level}: the registry's settings are the sim's frozen ones (${json(BUB_LEVELS[level])})`);
  ok(gameLevelSettings("bubble", "normal") === null, "Normal has no settings (today's game)");
  const deal = (seed: number, level?: "easy" | "normal" | "hard" | "expert") => withSeededRandom(seed, () => generatePuzzle("bubble", level ? { level } : {}));
  for (const seed of [3, 17, 4242]) {
    const plain = deal(seed);
    ok(json(deal(seed, "normal")) === json(plain) && !("level" in (plain as object)), `seed ${seed}: a Normal deal is today's deal with no level field`);
    for (const level of LEVELS) {
      const p = deal(seed, level) as { bubbleRev?: number; level?: string };
      ok(puzzleLevel(p) === level && p.bubbleRev === BUB_REV_FAST, `seed ${seed}: a ${level} deal carries level ${level} on bubbleRev 12`);
    }
  }
  for (const level of ["easy", "hard", "expert"] as const) ok(modeLevel("rated", level) === "normal" && modeLevel("daily", level) === "normal", `rated play and the Daily play ${level} as Normal`);
  ok(modeLevel("practice", "expert") === "expert" && modeLevel("room", "hard") === "hard", "practice and rooms play the level asked for");
}

/* ------------------------------------------------------------------ 2. Normal is today's game */
section("Normal and every older stamp: exactly as before levels");
{
  const recorded = JSON.parse(readFileSync("scripts/fixtures/bubble-levels-normal.json", "utf8")) as Record<string, string>;
  const digest = bubbleDigest(bubble);
  for (const [rev, hash] of Object.entries(recorded)) ok(digest[rev] === hash, `bubbleRev ${rev}: init states, a scripted run and its score digest as recorded before levels`);
  ok(bubbleGameFor(BUB_REV_FAST, "normal") === bubbleGameFor(BUB_REV_FAST) && bubbleGameFor(BUB_REV_FAST, undefined) === bubbleGameFor(BUB_REV_FAST), "Normal (or no level) plays bubbleRev 12 itself");
  ok(bubbleGameFor(BUB_REV_FAST, "classic") === bubbleGameFor(BUB_REV_FAST), "anything that is not a level plays Normal");
  for (const rev of [null, 2, 4, 5, 8, 9, 10, BUB_REV_STD]) for (const level of LEVELS) ok(bubbleGameFor(rev, level) === bubbleGameFor(rev), `bubbleRev ${rev}: asking for ${level} plays the stamp unchanged`);
  for (let seed = 1; seed <= 40; seed++) {
    const s = bubbleGameFor(BUB_REV_FAST).init(seed) as BubState;
    ok(s.lv === undefined && s.every === undefined && s.colours === undefined && s.trail === undefined && s.banksFull === undefined && s.coreFull === undefined && s.speedFullLeft === undefined && s.startCount === BUB_V12_REEF, `seed ${seed}: a Normal state carries no level field and the 86-bubble reef`);
  }
}

/* ------------------------------------------------------------------ 3. each level's reef */
section("Each level's reef, colours, chests, queue, descents and trail");
{
  for (const level of LEVELS) {
    const set = BUB_LEVELS[level];
    const game = bubbleGameFor(BUB_REV_FAST, level);
    const want = bubColoursOf({ colours: set.colours });
    let good = 0;
    let seenAll = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const s = game.init(seed * 31 + 7) as BubState;
      const onReef = new Set(s.grid.filter((v) => bubIsColour(v)));
      const inQueue = new Set(s.queue.filter((v) => bubIsColour(v)));
      const chests = s.grid.reduce((n, v, i) => (v === BUB_CHEST ? n + (Math.floor(i / BUB_COLS) < bubReefFullRows(set.reef) ? 1 : 100) : n), 0);
      const fine =
        s.startCount === set.reef &&
        s.grid.filter((v) => v !== 0).length === set.reef &&
        [...onReef].every((v) => want.includes(v)) &&
        [...inQueue].every((v) => want.includes(v)) &&
        chests === 6 &&
        s.every === set.every &&
        s.colours === set.colours &&
        s.trail === set.trail &&
        s.banksFull === set.banksFull &&
        s.coreFull === set.coreFull &&
        s.speedFullLeft === set.speedFullLeft &&
        s.fast === 1 &&
        s.std === 1;
      if (fine) good++;
      if (want.every((v) => onReef.has(v) || inQueue.has(v))) seenAll++;
    }
    ok(good === 120, `${level}: every reef has ${set.reef} bubbles in ${set.colours} colours, 6 chests on full rows, its cadence, trail and full-at figures (${good} of 120)`);
    ok(seenAll === 120, `${level}: every colour of the level turns up (${seenAll} of 120)`);
    ok(want.includes(BUB_SIXTH) === (set.colours === 6), `${level}: the sixth colour only with six colours`);
    // The cadence: shots straight up into the reef descend it once every `every` shots.
    let s = { ...(game.init(99) as BubState), acted: 1 };
    let shots = 0;
    let cadence = true;
    while (shots < 2 * set.every && !game.isOver(s)) {
      s = game.step(s, { t: s.tick + 1, k: 2, a: ((shots * 811) % 3000) - 1500, b: -4000, c: 2, d: 0 }) as BubState;
      while (s.flightColour !== 0 && !game.isOver(s)) s = game.step(s, null) as BubState;
      shots++;
      if (!s.cleared && s.descents !== Math.floor(s.shots / set.every)) cadence = false;
    }
    ok(cadence && s.descents >= 1 && s.shots === shots, `${level}: the reef descends once every ${set.every} shots (${shots} shots, ${s.descents} descents)`);
    // The checksum tells the level apart from Normal and from the other levels.
    const sums = new Set([bubbleGameFor(BUB_REV_FAST), ...LEVELS.map((l) => bubbleGameFor(BUB_REV_FAST, l))].map((g) => bubCheckpoint(g.init(5) as BubState).checksum));
    ok(sums.size === 4, `${level}: each level's checkpoint checksum differs`);
  }
  const normal = bubbleGameFor(BUB_REV_FAST).init(11) as BubState;
  ok(!normal.grid.includes(BUB_SIXTH) && !normal.queue.includes(BUB_SIXTH), "Normal never holds the sixth colour");
}

/* ------------------------------------------------------------------ 4. the clock */
section("The clock");
{
  for (const level of [undefined, ...LEVELS]) {
    const game = bubbleGameFor(BUB_REV_FAST, level);
    ok(game.runTicks === BUB_RUN_TICKS && BUB_RUN_TICKS <= 120 * TICKS_PER_SECOND, `${level ?? "normal"}: a 90 s run (at most 120 s)`);
    const p = withSeededRandom(1, () => generatePuzzle("bubble", level ? { level } : {}));
    ok(puzzleTimeLimitMs(p) - 3000 <= MAX_ROUND_CLOCK_MS, `${level ?? "normal"}: the dealt clock is at most 120 s of play`);
  }
}

/* ------------------------------------------------------------------ 5. the server replay reads the level */
section("The server replay reads the stored level");
{
  for (const level of LEVELS) {
    const game = bubbleGameFor(BUB_REV_FAST, level);
    let s = game.init(4242) as BubState;
    const events: ArcadeInputEvent[] = [];
    const checkpoints: ReturnType<typeof bubCheckpoint>[] = [];
    let i = 0;
    while (!game.isOver(s) && s.tick < BUB_RUN_TICKS) {
      let ev: ArcadeInputEvent | null = null;
      if (s.flightColour === 0 && s.tick % 40 === 0) {
        ev = { t: s.tick + 1, k: 2, a: ((i * 977) % 6000) - 3000, b: -2000 - ((i * 331) % 1800), c: i % 3, d: 0 };
        i++;
        events.push(ev);
      }
      s = game.step(s, ev) as BubState;
      if (s.tick % 300 === 0) checkpoints.push(bubCheckpoint(s));
    }
    const raw = encodeBubbleRun({ seed: 4242, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
    const r = replayBubbleRun(4242, raw, BUB_REV_FAST, level);
    ok(!r.flagged && r.score === game.score(s) && r.score >= 1, `${level}: a scripted run replays unflagged to its own score (${r.score})`);
    const quiet = console.error;
    console.error = () => {};
    const asNormal = replayBubbleRun(4242, raw, BUB_REV_FAST);
    console.error = quiet;
    ok(asNormal.flagged, `${level}: the same log replayed as Normal does not match (the level is read from the stored puzzle)`);
    const parts = bubbleStdParts(r.state) ?? [];
    ok(parts.reduce((n, p) => n + p.max, 0) === 200, `${level}: the parts still sum to 200`);
  }
}

/* ------------------------------------------------------------------ 6. clearable, 200 and the bands */
section("Clearable, 200 reachable, the step from level to level (recorded witness runs through the server)");
{
  const runs = JSON.parse(gunzipSync(readFileSync(WITNESS_PATH)).toString("utf8")) as LevelWitness[];
  let same = 0;
  for (const w of runs) {
    const r = replayBubbleRun(w.seed, w.raw, BUB_REV_FAST, w.level === "normal" ? undefined : w.level);
    if (!r.flagged && r.score === w.score && r.cleared === w.cleared) same++;
  }
  ok(same === runs.length && runs.length > 0, `every witness run replays unflagged to its recorded score (${same} of ${runs.length})`);
  const of = (level: string, skill: string) => runs.filter((w) => w.level === level && w.skill === skill);
  const avg = (xs: LevelWitness[]) => xs.reduce((n, w) => n + w.score, 0) / Math.max(1, xs.length);
  for (const level of ["easy", "normal", "hard", "expert"]) {
    const top = of(level, "perfect");
    ok(top.some((w) => w.cleared), `${level}: the reef is clearable (Flawless clears ${top.filter((w) => w.cleared).length} of ${top.length})`);
    ok(of(level, "elite").some((w) => w.cleared), `${level}: Elite under human limits clears the reef (${of(level, "elite").filter((w) => w.cleared).length} of ${of(level, "elite").length})`);
  }
  for (const level of LEVELS) {
    const at200 = runs.filter((w) => w.level === level && w.score === 200);
    ok(at200.length >= 1, `${level}: 200 is reached through the server replay (${at200.length} runs at 200)`);
  }
  const elite = ["easy", "normal", "hard", "expert"].map((l) => avg(of(l, "elite")));
  ok(elite[0]! > elite[1]! && elite[1]! > elite[2]! && elite[2]! > elite[3]!, `Elite's average steps down Easy → Normal → Hard → Expert (${elite.map((x) => x.toFixed(0)).join(" → ")})`);
  const average = ["easy", "normal", "hard", "expert"].map((l) => avg(of(l, "average")));
  ok(average[0]! > average[1]! && average[1]! > average[2]! && average[2]! > average[3]!, `Average's steps down too (${average.map((x) => x.toFixed(0)).join(" → ")})`);
  ok(of("easy", "average").some((w) => w.score >= 175), "Easy: an average player can earn a star (175+) on some seeds");
  ok(elite[3]! >= 120 && of("expert", "elite").some((w) => w.score >= 170), `Expert: Elite under human limits scores well (average ${elite[3]!.toFixed(0)}, best ${Math.max(...of("expert", "elite").map((w) => w.score))})`);
}

/* ------------------------------------------------------------------ 7. the art */
section("The sixth colour and the aim trail");
{
  ok(bubColour(BUB_SIXTH) === BUB_SIXTH_COLOUR && !BUB_PALETTE.includes(BUB_SIXTH_COLOUR) && BUB_PALETTE.length === BUB_COLOUR_COUNT, "the sixth colour has its own colour, outside the five-colour palette");
  const creatures = BUB_ALL_COLOURS.map(bubCreature);
  const symbols = BUB_ALL_COLOURS.map(bubSymbol);
  ok(new Set(creatures).size === 6 && creatures[5] === "seahorse", `six colours, six creatures (${creatures.join(", ")})`);
  ok(new Set(symbols).size === 6, `six colours, six symbols (${symbols.join(", ")})`);
  ok(isBubLevel("expert") && !isBubLevel("normal"), "only Easy, Hard and Expert are level games");
  // The trail: count the dots drawn and the bounces before the last one.
  const trail = (state: BubState, vx: number, vy: number) => {
    const dots: { x: number; y: number }[] = [];
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (t, k) => (k === "arc" ? (x: number, y: number) => dots.push({ x, y }) : k in t ? t[k as string] : () => undefined),
      set: (t, k, v) => ((t[k as string] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    drawBubbleAimTrail(ctx, { width: 390, height: 730 }, { vx, vy, fast: 0 }, state);
    let turns = 0;
    for (let i = 2; i < dots.length; i++) if (Math.sign(dots[i]!.x - dots[i - 1]!.x) !== Math.sign(dots[i - 1]!.x - dots[i - 2]!.x)) turns++;
    const reach = dots.length ? Math.hypot(dots[dots.length - 1]!.x - 195, dots[dots.length - 1]!.y - 690) : 0;
    return { dots: dots.length, turns, reach, top: dots.length ? Math.min(...dots.map((d) => d.y)) : 999 };
  };
  const steep = [1480, -411] as const; // a shallow aim (the gun's speed, as the stage previews it) bouncing several times on its way up
  const normalTrail = trail(bubbleGameFor(BUB_REV_FAST).init(1) as BubState, ...steep);
  const easyTrail = trail(bubbleGameFor(BUB_REV_FAST, "easy").init(1) as BubState, ...steep);
  const hardTrail = trail(bubbleGameFor(BUB_REV_FAST, "hard").init(1) as BubState, ...steep);
  const expertTrail = trail(bubbleGameFor(BUB_REV_FAST, "expert").init(1) as BubState, ...steep);
  ok(normalTrail.turns >= 3, `Normal's trail runs on through every bounce, as before (${normalTrail.turns} bounces)`);
  ok(easyTrail.turns === 2, `Easy's trail shows two bounces (${easyTrail.turns})`);
  ok(hardTrail.turns === 1, `Hard's trail shows one bounce (${hardTrail.turns})`);
  ok(expertTrail.turns === 0 && expertTrail.dots > 3 && expertTrail.dots < hardTrail.dots, `Expert's trail is short, with no bounce (${expertTrail.dots} dots)`);
}

/* ------------------------------------------------------------------ the digest */

/** Init states, a scripted run's checkpoints and its final state and score for revisions null…12 (Normal). */
export function bubbleDigest(mod: typeof bubble): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rev of [null, 2, 3, 4, 5, 8, 9, 10, 11, 12]) {
    const g = mod.bubbleGameFor(rev);
    const h = createHash("sha256");
    for (let seed = 1; seed <= 40; seed++) {
      let s = g.init(seed * 7919);
      h.update(JSON.stringify(s));
      let i = 0;
      while (!g.isOver(s) && s.tick < 5400) {
        let ev: ArcadeInputEvent | null = null;
        if (s.flightColour === 0 && s.tick % 37 === 0) {
          ev = { t: s.tick + 1, k: 2, a: ((i * 977 + seed * 131) % 6000) - 3000, b: -1500 - ((i * 331) % 2400), c: i % 3, d: 0 };
          i++;
        }
        s = g.step(s, ev);
        if (s.tick % 300 === 0) h.update(JSON.stringify(mod.bubCheckpoint(s)));
      }
      h.update(JSON.stringify(s) + ":" + g.score(s));
    }
    out[String(rev)] = h.digest("hex");
  }
  return out;
}

console.log(`\nbubble-levels-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  process.exit(1);
}
