/**
 * D6's Strategy levels (23–27 Nov 2026; the polish plan's difficulty spec and Joe's ladder test), proved on the real
 * sims and the server's own replay and grade:
 *
 *  Gemstone (matchupRev 14, Normal's scoring stamp and the levels; the lever is the gem colours, 5 / 6 / 7 / 8): rooms
 *  deal matchupRev 14 at Normal and every level, the levels before under the pins byte for byte, the registry mirroring
 *  MATCHUP_V14_LEVELS, each level's board holding exactly its colours, Normal playing matchupRev 13's game on its own
 *  figures, the eighth gem's own cut, the recorded flawless run at 200 with every part full.
 *
 *  Tilt (tiltRev 13's levels; the lever is the marbles steered at once): the registry mirroring TILT_LEVELS_V13, every
 *  level deal tiltRev 13 from its own proved list (the oracle held to HUMAN_LIMITS at exactly 200 through the server
 *  replay; the list rebuilds byte for byte), the levels before under the pins, each level's marbles and the clock.
 *
 *  Ball Tracker (btRev 9, Normal's scoring stamp and the levels; the lever is the marble colours and their cups, 3 / 4 /
 *  5 / 5): the registry mirroring BT_D6_LEVELS, every level course proved at 200 on btRev 9 and holding exactly its
 *  colours, Normal on btRev 8's bank and play with its own figures, the stamp before under the pins, the fifth colour's
 *  own star.
 *
 *  Rainbow Bridge (inkRev 16, Normal's scoring stamp and the levels; the lever is the pot's width, 110 / 64 / 48 / 42 px):
 *  inkRev 15's world at every level exactly, every dealt seed's witness at 200 on inkRev 16, each level's figures,
 *  the stamp before under the pins.
 *
 *  Difficulty is not judged here (Joe, 27 Nov 2026: a person playtests the levels and Joe tunes them): every deal at
 *  every level is proved completable, nothing more.
 *   bun scripts/d6-strategy-levels-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import type { PuzzleType } from "../src/lib/duel/types";
import { puzzleTimeLimitMs } from "../src/lib/duel/catalogue";
import { GAME_LEVELS } from "../src/lib/levels/gameLevels";
import { MAX_ROUND_CLOCK_MS } from "../src/lib/levels/levels";
import { pinPreBalltrackD6, pinPreD6Levels, pinPreInkD6, pinPreMatchupD6, pinPreTiltThree } from "../src/lib/duel/d6Normal";
import { inkBridgeGameFor, INK_BUCKET_W, INK_D6_FIGURES, INK_LEVEL_SETS, INK_REV_D6, INK_REV_HILLS, INK_RUN_TICKS } from "../src/lib/arcade/inkBridge";
import { inkBigVerdict, inkLevelWitnessFile, INK_HILLS_WITNESS } from "./ink-big-deal";
import {
  matchupD6GameFor,
  matchupGameFor,
  matchupGemShape,
  matchupHintSwap,
  matchupIce2GameFor,
  matchupKindOfColour,
  matchupStdParts,
  MATCHUP_D6_MARK,
  MATCHUP_KIND8,
  MATCHUP_REV_D6,
  MATCHUP_REV_ICE2,
  MATCHUP_TREASURE,
  MATCHUP_V14_LEVELS,
  type MatchupState,
} from "../src/lib/arcade/matchup";
import { pearlCutPoints } from "../src/lib/arcade/matchupPearl.renderer";
import { replayMatchupRun } from "../src/lib/duel/matchup";
import { tiltLevelGameV13, TILT_LEVELS_V13, TILT_REV_BIG, TILT_REV_THREE, type TiltLevel } from "../src/lib/arcade/tilt";
import { TILT_DEAL_LEVELS_V13 } from "../src/lib/duel/tiltDealLevelsV13.server";
import { btTraysAt, makeBallTrackGame, BT_COLOUR_FIVE, BT_D6_LEVELS, BT_D6_NORMAL_FULL, BT_PALETTE, BT_REV_D6, BT_REV_STD, type BtCourse } from "../src/lib/arcade/ballTrack";
import { btStarPath } from "../src/lib/arcade/ballTrackColours.renderer";
import { btD6LevelDeal } from "../src/lib/duel/ballTrackLevelsD6.server";
import { decodeInputEvents } from "../src/lib/arcade/engine";
import { replayedBtD6 } from "./balltrack-d6-deal";

console.error = () => {};
let failed = 0;
let passed = 0;
function check(ok: boolean, label: string): void {
  if (ok) passed++;
  else {
    failed++;
    console.log(`  FAIL ${label}`);
  }
}
type L = "easy" | "hard" | "expert";
const LEVELS: L[] = ["easy", "hard", "expert"];
const dealAt = (type: PuzzleType, level: L | "normal", n: number): any => withSeededRandom(n * 7919 + 13, () => generatePuzzle(type, level === "normal" ? { bankSeed: n } : { bankSeed: n, level }));
const reg = GAME_LEVELS as unknown as Record<string, { levels: Record<string, { settings: Record<string, unknown> }> }>;
const pinned = <T,>(pin: (on: boolean) => boolean, fn: () => T): T => {
  const was = pin(true);
  try {
    return fn();
  } finally {
    pin(was);
  }
};

/* ---------------------------------------------------------------- Gemstone */
console.log("1. Gemstone matchupRev 14: the gem colours");
{
  const colours: Record<L | "normal", number> = { easy: 5, normal: 6, hard: 7, expert: 8 };
  for (const l of [...LEVELS, "normal"] as const) {
    check(MATCHUP_V14_LEVELS[l].colours === colours[l], `gemstone ${l}: ${colours[l]} colours`);
    for (let n = 0; n < 4; n++) {
      const p = dealAt("matchup", l, n);
      check(p.matchupRev === MATCHUP_REV_D6 && (l === "normal" ? !("level" in p) : p.level === l), `gemstone ${l} ${n}: matchupRev 14${l === "normal" ? ", no level" : `, level ${l}`}`);
    }
    // The board and queues hold exactly the level's colours.
    const kinds = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const s = matchupD6GameFor(l).init(seed) as MatchupState;
      check(s.ice2 === MATCHUP_D6_MARK, `gemstone ${l} seed ${seed}: the state carries matchupRev 14's mark`);
      for (const k of s.cells) kinds.add(k);
      for (const q of s.queues) for (const k of q) kinds.add(k);
    }
    const plain = [...kinds].filter((k) => k !== MATCHUP_TREASURE).sort((a, b) => a - b);
    const want = Array.from({ length: colours[l] }, (_, c) => matchupKindOfColour(c)).sort((a, b) => a - b);
    check(plain.join() === want.join(), `gemstone ${l}: the board and queues hold exactly ${colours[l]} colours (${plain.join()})`);
  }
  for (const l of LEVELS) {
    const mirror = reg.matchup!.levels[l]!.settings as { colours: number; goals: number[]; ice: number; hintS: number };
    const own = MATCHUP_V14_LEVELS[l];
    check(mirror.colours === own.colours && JSON.stringify(mirror.goals) === JSON.stringify(own.ladder) && mirror.ice === own.ice && mirror.hintS === own.hintS && Object.keys(mirror).length === 4, `gemstone ${l}: the registry mirrors MATCHUP_V14_LEVELS`);
  }
  // Normal plays matchupRev 13's game exactly (the same init but for the mark), on its own figures.
  for (const seed of [1, 7, 99]) {
    const a = matchupIce2GameFor("normal").init(seed) as MatchupState;
    const b = matchupD6GameFor("normal").init(seed) as MatchupState;
    check(JSON.stringify({ ...b, ice2: a.ice2 }) === JSON.stringify(a), `gemstone normal seed ${seed}: matchupRev 14 starts as matchupRev 13 but for its mark`);
  }
  check(matchupGameFor(MATCHUP_REV_D6, "expert") === matchupD6GameFor("expert") && matchupGameFor(MATCHUP_REV_ICE2, "expert") === matchupIce2GameFor("expert"), "gemstone: matchupRev 14 plays its own game, matchupRev 13 keeps its own");
  check(JSON.stringify(MATCHUP_V14_LEVELS.normal.full) === JSON.stringify({ gems: 320, treasure: 2, goals: 4, ice: 7, big: 2 }), "gemstone normal: the parts full at 320 gems, 2 treasures, 4 goals, 7 ice cells, 2 big lines");
  // The levels before: matchupPreD6 deals matchupRev 13 everywhere; d6PreLevels only the levels.
  pinned(pinPreMatchupD6, () => check(LEVELS.every((l) => dealAt("matchup", l, 0).matchupRev === MATCHUP_REV_ICE2) && dealAt("matchup", "normal", 0).matchupRev === MATCHUP_REV_ICE2, "matchupPreD6: Gemstone deals matchupRev 13 at every level"));
  pinned(pinPreD6Levels, () => check(LEVELS.every((l) => dealAt("matchup", l, 0).matchupRev === MATCHUP_REV_ICE2) && dealAt("matchup", "normal", 0).matchupRev === MATCHUP_REV_D6, "d6PreLevels: Gemstone's levels deal matchupRev 13, Normal matchupRev 14"));
  // The eighth gem: its own cut, a teardrop (pointed top, round base), no other gem's.
  {
    const pts = pearlCutPoints(0, 0, 10);
    const top = Math.min(...pts.map((p) => p[1]));
    const bottom = Math.max(...pts.map((p) => p[1]));
    const widest = (band: (y: number) => boolean) => Math.max(0, ...pts.filter((p) => band(p[1])).map((p) => Math.abs(p[0])));
    check(matchupGemShape(MATCHUP_KIND8) === "pearl" && Array.from({ length: 6 }, (_, k) => matchupGemShape(k)).every((s) => s !== "pearl"), "gemstone: the eighth gem's shape is the pearl, no other gem's");
    check(pts.length === 18 && top < -8 && bottom > 8 && widest((y) => y < top + 2) < 1 && widest((y) => y > 0) > 6, "gemstone: the pearl's cut is a teardrop (a point at the top, a round base)");
  }
  // The recorded flawless run on matchupRev 14 replays to 200 with every part full; the recorder re-records it.
  {
    const rec = JSON.parse(readFileSync(new URL("./fixtures/d6-gemstone-perfect.json", import.meta.url), "utf8")) as { seed: number; raw: string };
    const run = replayMatchupRun(rec.seed, gunzipSync(Buffer.from(rec.raw, "base64")).toString(), MATCHUP_REV_D6);
    const parts = Object.values(matchupStdParts(run.state as MatchupState)) as number[];
    check(!run.flagged && run.score === 200 && parts.reduce((a, b) => a + b, 0) === 200, `gemstone: the recorded flawless matchupRev 14 run replays to 200 with every part full (${run.score})`);
    const r = Bun.spawnSync(["bun", "scripts/d6-gemstone-perfect-record.ts", "--check"], { stdout: "pipe", stderr: "pipe" });
    const out = r.stdout.toString().trim().split("\n").pop() ?? "";
    check(r.exitCode === 0 && out.startsWith("PASS"), `gemstone: the flawless run re-records byte for byte (${out})`);
  }
  for (const l of [...LEVELS, "normal"] as const) check(puzzleTimeLimitMs(dealAt("matchup", l, 0)) <= MAX_ROUND_CLOCK_MS + 3000, `gemstone ${l}: the dealt clock is within 120 s`);
  // Completable at every level (rooms deal any seed): every deal opens with a legal swap (a stuck board reshuffles in
  // play), and a flawless run at each level scores exactly 200 through the server replay.
  for (const l of [...LEVELS, "normal"] as const) {
    let open = 0;
    for (let seed = 1; seed <= 60; seed++) if (matchupHintSwap(matchupD6GameFor(l).init(seed) as MatchupState)) open++;
    check(open === 60, `gemstone ${l}: every deal opens with a legal swap (${open} of 60 seeds)`);
  }
  {
    const rec = JSON.parse(readFileSync(new URL("./fixtures/d6-gemstone-levels.json", import.meta.url), "utf8")) as { levels: Record<L, { seed: number; raw: string }> };
    for (const l of LEVELS) {
      const w = rec.levels[l];
      const run = replayMatchupRun(w.seed, gunzipSync(Buffer.from(w.raw, "base64")).toString(), MATCHUP_REV_D6, l);
      check(!run.flagged && run.score === 200, `gemstone ${l}: a recorded flawless run scores 200 through the server replay (${run.score})`);
    }
  }
}

/* ---------------------------------------------------------------- Tilt */
console.log("2. Tilt tiltRev 13's levels: the marbles steered at once");
{
  const two: Record<L, readonly number[]> = { easy: [], hard: [1, 2, 3], expert: [1, 2, 3, 4] };
  for (const l of LEVELS) {
    const own = TILT_LEVELS_V13[l] as unknown as Record<string, unknown>;
    const mirror = reg.tilt!.levels[l]!.settings;
    check(mirror["mazes"] === TILT_LEVELS_V13[l].sizes.length && Object.keys(mirror).every((k) => k === "mazes" || JSON.stringify(mirror[k]) === JSON.stringify(own[k])) && Object.keys(own).every((k) => k in mirror), `tilt ${l}: the registry mirrors TILT_LEVELS_V13`);
    check(JSON.stringify(TILT_LEVELS_V13[l].twoMazes) === JSON.stringify(two[l]), `tilt ${l}: two marbles on mazes ${two[l].join(", ") || "none"}`);
    check(TILT_DEAL_LEVELS_V13[l].length >= 60, `tilt ${l}: ${TILT_DEAL_LEVELS_V13[l].length} proved seeds (at least 60)`);
    for (let n = 0; n < 4; n++) {
      const p = dealAt("tilt", l, n);
      check(p.tiltRev === TILT_REV_THREE && p.level === l && TILT_DEAL_LEVELS_V13[l].includes(p.seed), `tilt ${l} ${n}: tiltRev 13, a proved seed, level ${l}`);
      const s = tiltLevelGameV13(l as TiltLevel).init(p.seed) as any;
      check(s.lv13 === 1 && s.list.length === TILT_LEVELS_V13[l].sizes.length, `tilt ${l} ${n}: plays the level's ${TILT_LEVELS_V13[l].sizes.length} mazes`);
    }
    check(puzzleTimeLimitMs(dealAt("tilt", l, 0)) <= MAX_ROUND_CLOCK_MS + 3000, `tilt ${l}: the dealt clock is within 120 s`);
  }
  pinned(pinPreD6Levels, () => check(LEVELS.every((l) => dealAt("tilt", l, 0).tiltRev === TILT_REV_BIG), "d6PreLevels: Tilt's levels deal tiltRev 12's levels"));
  pinned(pinPreTiltThree, () => check(LEVELS.every((l) => dealAt("tilt", l, 0).tiltRev === TILT_REV_BIG), "tiltPreThree: Tilt's levels deal tiltRev 12's levels"));
  // The lists: every witness re-proved at 200 with every part full through the server replay; the file rebuilds.
  const r = Bun.spawnSync(["bun", "scripts/tilt-level-deal-v13.ts", "--check"], { stdout: "pipe", stderr: "pipe" });
  const out = r.stdout.toString().trim().split("\n").pop() ?? "";
  check(r.exitCode === 0 && out.startsWith("PASS"), `tilt: every D6 level witness re-proved at 200 and the deal file rebuilds (${out})`);
}

/* ---------------------------------------------------------------- Ball Tracker */
console.log("3. Ball Tracker btRev 9: the marble colours and their cups");
{
  const colours: Record<L, number> = { easy: 3, hard: 5, expert: 5 };
  const lists: Record<L, readonly BtCourse[]> = { easy: btD6LevelDeal("easy"), hard: btD6LevelDeal("hard"), expert: btD6LevelDeal("expert") };
  for (const l of LEVELS) {
    const own = BT_D6_LEVELS[l];
    const mirror = reg.balltrack!.levels[l]!.settings;
    const flat: Record<string, unknown> = { colours: own.colours, balls: own.balls, dropTicks: own.dropTicks, moves: own.moves, golds: own.golds, boosts: own.boosts, homeFull: own.full.home, goldFull: own.full.gold, comboFull: own.full.combo, boostFull: own.full.boost };
    check(Object.keys(mirror).length === Object.keys(flat).length && Object.keys(flat).every((k) => JSON.stringify(mirror[k]) === JSON.stringify(flat[k])), `balltrack ${l}: the registry mirrors BT_D6_LEVELS`);
    check(own.colours === colours[l], `balltrack ${l}: ${colours[l]} colours`);
    check(lists[l].length === 60, `balltrack ${l}: 60 proved courses (${lists[l].length})`);
    // Every course: exactly the level's colours in its queue and its cups in every layout, its own figures, its marbles and pace.
    let shaped = 0;
    for (const c of lists[l]) {
      const kinds = new Set(c.balls);
      const layouts = [0, ...(c.moves ?? []).map((m) => m.tick)].map((t) => btTraysAt(c, t).filter((x) => x >= 0).sort((a, b) => a - b).join());
      const want = Array.from({ length: own.colours }, (_, k) => k).join();
      if (kinds.size === own.colours && [...kinds].every((k) => k >= 0 && k < own.colours) && layouts.every((x) => x === want) && c.balls.length === own.balls && c.drop === own.dropTicks && (c.moves?.length ?? 0) === own.moves && JSON.stringify(c.full) === JSON.stringify(own.full)) shaped++;
    }
    check(shaped === lists[l].length, `balltrack ${l}: every course has ${own.colours} colours, ${own.balls} marbles every ${own.dropTicks} ticks, ${own.moves} cup moves and the level's figures (${shaped} of ${lists[l].length})`);
    // Every witness replays through btRev 9's server path to exactly 200.
    const witness = JSON.parse(readFileSync(new URL(`./fixtures/balltrack-d6-witness-${l}.json`, import.meta.url), "utf8")) as string[];
    let proved = 0;
    for (let i = 0; i < lists[l].length; i++) {
      const r = replayedBtD6(lists[l][i]!, i + 1, decodeInputEvents(witness[i] ?? ""));
      if (r.score === 200 && !r.flagged) proved++;
    }
    check(witness.length === lists[l].length && proved === lists[l].length, `balltrack ${l}: every course's witness replays to 200 on btRev 9 (${proved} of ${lists[l].length})`);
    for (let n = 0; n < 4; n++) {
      const p = dealAt("balltrack", l, n);
      check(p.btRev === BT_REV_D6 && p.level === l && lists[l].some((c) => JSON.stringify(c) === JSON.stringify(p.course)), `balltrack ${l} ${n}: btRev 9, a proved course, level ${l}`);
    }
    check(puzzleTimeLimitMs(dealAt("balltrack", l, 0)) <= MAX_ROUND_CLOCK_MS + 3000, `balltrack ${l}: the dealt clock is within 120 s`);
  }
  // Normal: btRev 9 on btRev 8's bank courses (4 colours), btRev 8's play exactly, on Normal's own figures.
  for (let n = 0; n < 4; n++) {
    const p = dealAt("balltrack", "normal", n);
    check(p.btRev === BT_REV_D6 && !("level" in p) && !p.course.full && new Set(p.course.balls).size === 4, `balltrack normal ${n}: btRev 9 on a bank course of 4 colours, no level`);
    const a = makeBallTrackGame(p.course, BT_REV_STD).init(p.seed) as any;
    const b = makeBallTrackGame(p.course, BT_REV_D6).init(p.seed) as any;
    check(JSON.stringify({ ...b, d6: undefined }) === JSON.stringify({ ...a, d6: undefined }) && JSON.stringify(b.d6) === JSON.stringify(BT_D6_NORMAL_FULL), `balltrack normal ${n}: btRev 9 starts as btRev 8 but for Normal's figures`);
  }
  check(JSON.stringify(BT_D6_NORMAL_FULL) === JSON.stringify({ home: 28, gold: 5, combo: 18, boost: 28 }), "balltrack normal: the parts full at 28 marbles home, 5 gold, 18 combos and 28 boosted");
  {
    const p = dealAt("balltrack", "normal", 0);
    const g = makeBallTrackGame(p.course, BT_REV_D6);
    const s = { ...(g.init(p.seed) as any), acted: 1, home: 28, golds: 5, combos: 18, boosts: 28 };
    check(g.score(s) === 200 && g.score({ ...s, home: 27 }) < 200, "balltrack normal: 28 home, 5 gold, 18 combos and 28 boosted score exactly 200, one marble fewer less");
  }
  pinned(pinPreBalltrackD6, () => check(dealAt("balltrack", "normal", 0).btRev === BT_REV_STD && LEVELS.every((l) => dealAt("balltrack", l, 0).btRev === BT_REV_STD), "balltrackPreD6: Ball Tracker deals btRev 8, Normal and the levels before"));
  pinned(pinPreD6Levels, () => check(LEVELS.every((l) => dealAt("balltrack", l, 0).btRev === BT_REV_STD) && dealAt("balltrack", "normal", 0).btRev === BT_REV_D6, "d6PreLevels: Ball Tracker's levels deal btRev 8's courses, Normal btRev 9"));
  // The fifth colour: a purple star, its own path (ten points), no other colour's.
  {
    const pts: [string, number, number][] = [];
    const ctx = { moveTo: (x: number, y: number) => pts.push(["m", x, y]), lineTo: (x: number, y: number) => pts.push(["l", x, y]), closePath: () => {} } as unknown as CanvasRenderingContext2D;
    btStarPath(ctx, 0, 0, 10);
    check(BT_PALETTE.length === 5 && BT_COLOUR_FIVE === 4 && pts.length === 10 && Math.min(...pts.map((p) => p[2])) <= -9.9, "balltrack: the fifth colour is drawn as its own ten-point star");
  }
}

/* ---------------------------------------------------------------- Rainbow Bridge */
console.log("4. Rainbow Bridge inkRev 16: the pot's width, each part on its level's figures");
{
  const FULL = process.env.CHECKS_FULL === "1" || process.argv.includes("--full");
  const pots: Record<L, number> = { easy: 110, hard: 48, expert: 42 };
  for (const l of LEVELS) {
    check(INK_LEVEL_SETS[l].potW === pots[l] && reg.inkbridge!.levels[l]!.settings["potW"] === pots[l], `inkbridge ${l}: the pot ${pots[l]} px (Normal's ${INK_BUCKET_W}), the registry the same`);
    for (let n = 0; n < 4; n++) {
      const p = dealAt("inkbridge", l, n);
      check(p.inkRev === INK_REV_D6 && p.level === l, `inkbridge ${l} ${n}: inkRev 16, level ${l}`);
    }
    // The world is inkRev 15's exactly: the same init but for the D6 mark.
    for (const seed of [3, 77]) {
      const a = inkBridgeGameFor(INK_REV_HILLS, l).init(seed) as any;
      const b = inkBridgeGameFor(INK_REV_D6, l).init(seed) as any;
      check(JSON.stringify({ ...b, d6: undefined }) === JSON.stringify(a) && b.d6 === 1, `inkbridge ${l} seed ${seed}: inkRev 16 starts as inkRev 15 but for its mark`);
    }
    // Every dealt seed is proved at 200 on inkRev 16: its inkRev 15 witness (the oracle's perfect run) replays to 200 there.
    const witnesses = JSON.parse(gunzipSync(readFileSync(inkLevelWitnessFile(l))).toString()).witnesses as { seed: number; events: any[] }[];
    const picked = FULL ? witnesses : witnesses.filter((_, i) => i % 6 === 0);
    let full = 0;
    for (const w of picked) {
      const v = inkBigVerdict(w.seed, w.events, INK_REV_D6, l);
      if (v.score === 200 && !v.flagged) full++;
    }
    check(full === picked.length, `inkbridge ${l}: ${full} of ${picked.length} dealt seeds' witnesses reach 200 on inkRev 16${FULL ? " (all)" : " (sampled; CHECKS_FULL=1 for all)"}`);
    check(puzzleTimeLimitMs(dealAt("inkbridge", l, 0)) <= MAX_ROUND_CLOCK_MS + 3000, `inkbridge ${l}: the dealt clock is within 120 s`);
  }
  {
    const witnesses = JSON.parse(gunzipSync(readFileSync(INK_HILLS_WITNESS)).toString()).witnesses as { seed: number; events: any[] }[];
    const picked = FULL ? witnesses : witnesses.filter((_, i) => i % 10 === 0);
    let full = 0;
    for (const w of picked) if (inkBigVerdict(w.seed, w.events, INK_REV_D6, null).score === 200) full++;
    check(full === picked.length, `inkbridge normal: ${full} of ${picked.length} dealt seeds' witnesses reach 200 on inkRev 16`);
  }
  for (let n = 0; n < 4; n++) {
    const p = dealAt("inkbridge", "normal", n);
    check(p.inkRev === INK_REV_D6 && !("level" in p), `inkbridge normal ${n}: inkRev 16, no level`);
  }
  check(JSON.stringify(INK_D6_FIGURES.normal) === JSON.stringify({ parFull: 9000, tricksFull: 4, cloversFull: 2, speedFullLeftS: 40 }), "inkbridge normal: ink par full at nine levels' worth, every trick shot and clover, speed with 40 s left");
  check(INK_D6_FIGURES.easy.tricksFull === INK_LEVEL_SETS.easy.tricksFullAt && INK_D6_FIGURES.easy.cloversFull === INK_LEVEL_SETS.easy.cloversFullAt && INK_D6_FIGURES.easy.speedFullLeftS === INK_LEVEL_SETS.easy.speedFullLeftS && INK_D6_FIGURES.easy.parFull === 10_000, "inkbridge easy: its stage-3 figures kept");
  {
    const g = inkBridgeGameFor(INK_REV_D6, null);
    const s = { ...(g.init(5) as any), acted: 1, levels: 10, inkPar: 9000, tricks: 4, shamrocks: 2, endedTick: INK_RUN_TICKS - 40 * 60 };
    check(g.score(s) === 200 && g.score({ ...s, tricks: 3 }) < 200 && g.score({ ...s, inkPar: 8999 }) < 200, "inkbridge normal: 10 levels, 9,000 ink par, 4 tricks, 2 clovers and 40 s left score exactly 200, any part short less");
  }
  pinned(pinPreInkD6, () => check(dealAt("inkbridge", "normal", 0).inkRev === INK_REV_HILLS && LEVELS.every((l) => dealAt("inkbridge", l, 0).inkRev === INK_REV_HILLS), "inkPreD6: Rainbow Bridge deals inkRev 15, Normal and the levels"));
  pinned(pinPreD6Levels, () => check(LEVELS.every((l) => dealAt("inkbridge", l, 0).inkRev === INK_REV_HILLS) && dealAt("inkbridge", "normal", 0).inkRev === INK_REV_D6, "d6PreLevels: Rainbow Bridge's levels deal inkRev 15, Normal inkRev 16"));
}

if (failed) {
  console.log(`FAIL d6-strategy-levels-check: ${failed} of ${failed + passed} checks failed`);
  process.exit(1);
}
console.log(`PASS d6-strategy-levels-check: ${passed} checks`);
