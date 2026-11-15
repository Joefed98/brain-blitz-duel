/**
 * speed-overhaul-check (~5 s, no browser): the Speed overhaul, stage 1 (15 Nov 2026; docs/design/speed-art/README.md,
 * docs/design/game-reviews/speed.md).
 *
 *   1. Tenfall tenRev 6: resets cost on a finished run too (5 per reset after the first 4), never below 131; tenRev 5
 *      and older score exactly as before; rooms deal 6, the pinned era 5; a scripted best run grades as its formula.
 *   2. Pull! clayRev 10: the quick-hit window is full within 0.4 s and gone at 0.6 s; clayRev 8 / 9 keep 0.25 s and
 *      0.37 s; the same inputs play identically on 9 and 10 (the same hits, birds and clays), never score lower on 10,
 *      and the round maximum is still 200; rooms deal 10, the pinned era 9.
 *   3. The help states the new rules for the dealt stamps and the old ones under the pin.
 *   4. The Blender sprites: every one in the data file, its WebP on disk with the hash its URL names, the set modest
 *      in size; the gophers, the hedgehog and the charms inside their circle; the clay and bird frames at their hit
 *      boxes' proportions (the bounds rule).
 *   5. Ascend's bigger discs never touch: within 44–60 px and the closest pair's distance less the gap.
 *   6. Screens: "Chain broken" on the chain strip, never over the board; Flash's "Done" moment with no flash count in
 *      play; Pull!'s two pills (clays, streak), the rest on the reveal; Tenfall's chute mouth.
 *   7. The ElevenLabs list: every Speed game, one unique file per row, each a slot name the stage-2 wiring will use.
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import {
  CLAY_INPUT_SHOT,
  CLAY_FLYING,
  CLAY_QUICK_STEPS,
  CLAY_REV_DEPTH,
  CLAY_REV_WIDE,
  CLAY_CONFIG,
  CLAY_BIRD_RX,
  CLAY_BIRD_RY,
  clayGameFor,
  clayQuickCredit,
  clayWideQuickCredit,
  type ClayState,
} from "../src/lib/arcade/clayShoot";
import { TEN_DROP_RESET_REV, TEN_DROP_STANDARD_REV, TD_RESET_FINISH_FLOOR, TD_RUN_TICKS, tenDropScore } from "../src/lib/arcade/tenDrop";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { standardNumberHelp } from "../src/lib/duel/standard/numberText";
import { pinPreSpeedOverhaul } from "../src/lib/duel/speedOverhaul";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { SPEED_ART } from "../src/lib/fx/speedArt.data";
import { ascendDiscSize, ASCEND_DISC_GAP, ASCEND_DISC_MAX, ASCEND_DISC_MIN } from "../src/puzzles/numberHunt";
import { playTenDropPerfect } from "./tendrop-depth-player";
import type { PuzzleData } from "../src/lib/duel/types";

const ROOT = join(import.meta.dir, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else failures.push(message);
};
const quiet = <T>(fn: () => T): T => {
  const log = console.log;
  const warn = console.warn;
  console.log = () => {};
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.log = log;
    console.warn = warn;
  }
};
const stamp = (type: "tendrop" | "clayshoot", field: string) => (generatePuzzle(type) as unknown as Record<string, number>)[field];

/* ------------------------------------------------------------------ 1. Tenfall tenRev 6 */
{
  const R5 = TEN_DROP_STANDARD_REV;
  const R6 = TEN_DROP_RESET_REV;
  check(R6 === 6 && R5 === 5, `Tenfall: the stamps are 5 and 6 (${R5}, ${R6})`);
  // All ten at 50 s (3000 ticks), 3 gold: 150 + 30 + 6 = 186; with 10 resets tenRev 6 takes 5 × (10 − 4) = 30.
  check(tenDropScore(10, 3000, R5, 10, 3) === 186, `Tenfall tenRev 5: resets still free on a finish (${tenDropScore(10, 3000, R5, 10, 3)})`);
  check(tenDropScore(10, 3000, R6, 10, 3) === 156, `Tenfall tenRev 6: 10 resets cost 30 on a finish (${tenDropScore(10, 3000, R6, 10, 3)})`);
  check(tenDropScore(10, 3000, R6, 4, 3) === 186, "Tenfall tenRev 6: the first 4 resets stay free");
  check(tenDropScore(10, 600, R6, 0, 10) === 200, "Tenfall tenRev 6: a flawless run is still 200");
  check(tenDropScore(10, TD_RUN_TICKS - 1, R6, 40, 0) === TD_RESET_FINISH_FLOOR, `Tenfall tenRev 6: a finish never drops below ${TD_RESET_FINISH_FLOOR} (${tenDropScore(10, TD_RUN_TICKS - 1, R6, 40, 0)})`);
  check(TD_RESET_FINISH_FLOOR > tenDropScore(9, 600, R6, 0, 9, 9 * 5000), "Tenfall tenRev 6: the poorest finish beats the best unfinished run");
  for (const [n, resets] of [[0, 0], [5, 6], [9, 2]] as const) {
    check(tenDropScore(n, 3000, R6, resets, 2, 18_000) === tenDropScore(n, 3000, R5, resets, 2, 18_000), `Tenfall: an unfinished run (${n}) scores as tenRev 5`);
  }
  for (const rev of [0, 1, 2, 3, 4]) check(tenDropScore(10, 3000, rev, 10, 3) === tenDropScore(10, 3000, rev, 0, 3) || rev >= 4, `Tenfall tenRev ${rev}: unchanged`);
  check(tenDropScore(10, 2700, 4, 0, 0) === 175, "Tenfall tenRev 4: unchanged");
  check(stamp("tendrop", "tenRev") === R6, `Tenfall: rooms deal tenRev 6 (${stamp("tendrop", "tenRev")})`);
  const was = pinPreSpeedOverhaul(true);
  check(stamp("tendrop", "tenRev") === R5, "Tenfall: the pinned era deals tenRev 5");
  pinPreSpeedOverhaul(was);
  for (const seed of [11, 4242, 90210]) {
    const p = { type: "tendrop", seed, tenRev: R6, puzzleScoreRev: 3, speedPar: 1 } as unknown as PuzzleData;
    const run = playTenDropPerfect(seed, R6);
    const g = quiet(() => gradeAnswer(p, run.raw, 0));
    const s = run.state;
    check(g.score === tenDropScore(s.cleared, s.clearTick, R6, s.resets, s.goldTens ?? 0, s.earlyTicks ?? 0), `Tenfall seed ${seed}: the server grades tenRev 6 by its formula (${g.score})`);
  }
}

/* ------------------------------------------------------------------ 2. Pull! clayRev 10 */
{
  check(CLAY_REV_WIDE === 10 && CLAY_REV_DEPTH === 9, "Pull!: the stamps are 9 and 10");
  check([0, 15].every((t) => clayQuickCredit(t) === CLAY_QUICK_STEPS) && clayQuickCredit(22) === 0, "Pull! clayRev 9: 0.25 s full, 0.37 s none (unchanged)");
  check([0, 15, 24].every((t) => clayWideQuickCredit(t) === CLAY_QUICK_STEPS), "Pull! clayRev 10: full credit within 0.4 s (24 ticks)");
  check(clayWideQuickCredit(36) === 0 && clayWideQuickCredit(80) === 0, "Pull! clayRev 10: none at 0.6 s (36 ticks)");
  for (let t = 0; t < 60; t++) check(clayWideQuickCredit(t) >= clayQuickCredit(t), `Pull!: the wider window never gives less credit (${t} ticks)`);
  for (let t = 24; t < 36; t++) check(clayWideQuickCredit(t + 1) <= clayWideQuickCredit(t), `Pull! clayRev 10: the credit falls evenly (${t})`);
  check(stamp("clayshoot", "clayRev") === CLAY_REV_WIDE, `Pull!: rooms deal clayRev 10 (${stamp("clayshoot", "clayRev")})`);
  const was = pinPreSpeedOverhaul(true);
  check(stamp("clayshoot", "clayRev") === CLAY_REV_DEPTH, "Pull!: the pinned era deals clayRev 9");
  pinPreSpeedOverhaul(was);
  check(roundMaxFor("clayshoot") === 200, "Pull!: the round maximum is still 200");
  // The same scripted shots on 9 and 10: each clay shot `delay` ticks after its launch, at where the next tick puts it.
  const g9 = clayGameFor(CLAY_REV_DEPTH);
  const g10 = clayGameFor(CLAY_REV_WIDE);
  let better = 0;
  for (let seed = 1; seed <= 24; seed++) {
    const delay = 8 + (seed % 5) * 6;
    let a: ClayState = g9.init(seed);
    let b: ClayState = g10.init(seed);
    check(b.qw === 1 && !a.qw, `Pull! seed ${seed}: only clayRev 10 carries the wider window`);
    while (!g9.isOver(a)) {
      let shot = null as null | { t: number; k: number; a: number; b: number; c: number; d: number };
      for (let i = 0; i < a.status.length; i++) {
        if (a.status[i] !== CLAY_FLYING || a.tick - a.schedule.launch[i]! !== delay) continue;
        shot = { t: a.tick + 1, k: CLAY_INPUT_SHOT, a: Math.round((a.x[i]! + a.schedule.vx[i]!) / 256), b: Math.round((a.y[i]! + a.vy[i]!) / 256), c: 0, d: 0 };
        break;
      }
      a = g9.step(a, shot);
      b = g10.step(b, shot);
    }
    while (!g10.isOver(b)) b = g10.step(b, null);
    check(a.hits === b.hits && a.goldHits === b.goldHits && (a.birdHits ?? 0) === (b.birdHits ?? 0) && a.status.join() === b.status.join(), `Pull! seed ${seed}: the same play on 9 and 10`);
    check(g10.score(b) >= g9.score(a), `Pull! seed ${seed}: clayRev 10 never scores lower (${g9.score(a)} → ${g10.score(b)})`);
    check(g10.score(b) <= 200, `Pull! seed ${seed}: at most 200`);
    if (g10.score(b) > g9.score(a)) better++;
  }
  check(better > 0, `Pull!: shots between 0.25 s and 0.6 s earn more on clayRev 10 (${better} of 24 seeds)`);
}

/* ------------------------------------------------------------------ 3. Help texts */
{
  const clay = () => PUZZLE_INSTRUCTIONS.clayshoot.score;
  check(/within 0\.4 s of its launch \(none after 0\.6 s\)/.test(clay()), `Pull!: the help states the 0.4 s window ("${clay()}")`);
  check(/, finished or not/.test(standardNumberHelp("tendrop")), "Tenfall: the help says resets cost finished or not");
  const was = pinPreSpeedOverhaul(true);
  check(/a quarter of a second/.test(clay()) && !/0\.4 s/.test(clay()), "Pull!: the pinned era keeps clayRev 9's words");
  check(!/finished or not"?\]/.test(standardNumberHelp("tendrop")) && !/each costs \d+, finished or not/.test(standardNumberHelp("tendrop")), "Tenfall: the pinned era keeps tenRev 5's words");
  pinPreSpeedOverhaul(was);
}

/* ------------------------------------------------------------------ 4. Sprites */
{
  const expected = [
    "flash-wait", "flash-gold", "flash-frame", "ascend-board", "ascend-disc", "ascend-disc-done", "chain-board",
    "bonk-lawn", "bonk-burrow", "bonk-gopher-gold", "bonk-gopher-red", "bonk-hedgehog", "tenfall-board",
    "tenfall-tile-digit", "tenfall-tile-op", "tenfall-tile-minus", "tenfall-tile-gold", "tenfall-tile-refused",
    "pull-sky", "pull-clay-orange", "pull-clay-gold", "pull-bird-0", "pull-bird-1", "pull-bird-2",
    ...["circle", "square", "triangle"].flatMap((s) => ["red", "blue", "green", "yellow", "purple", "orange"].map((c) => `chain-${s}-${c}`)),
  ];
  const art = SPEED_ART as Record<string, { url: string; w: number; h: number; bytes: number; reach?: number }>;
  for (const name of expected) check(name in art, `sprite ${name}: in speedArt.data.ts`);
  let total = 0;
  for (const [name, e] of Object.entries(art)) {
    const file = join(ROOT, "public", "speed-art", `${name}.webp`);
    if (!existsSync(file)) {
      check(false, `sprite ${name}: public/speed-art/${name}.webp is missing`);
      continue;
    }
    const bytes = readFileSync(file);
    total += bytes.length;
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 10);
    check(e.url === `/speed-art/${name}.webp?v=${hash}`, `sprite ${name}: its URL names its bytes' hash`);
    check(e.bytes === bytes.length, `sprite ${name}: its recorded size`);
    check(bytes.length < 90_000, `sprite ${name}: ${bytes.length} bytes (under 90 KB)`);
  }
  check(total < 700_000, `the sprites total ${Math.round(total / 1024)} KB (under 700 KB)`);
  // Bounds (rule 3): every visible pixel of a round target inside its circle (reach ≤ 1).
  // (The charms are squares and triangles in their square box, the drawn charm's footprint; only the round ones here.)
  for (const [name, e] of Object.entries(art)) {
    if (e.reach === undefined || !/^(bonk-|ascend-disc|chain-circle-)/.test(name)) continue;
    check(e.reach <= 1, `sprite ${name}: drawn inside its circle (reach ${e.reach})`);
  }
  for (const name of ["bonk-gopher-gold", "bonk-gopher-red", "bonk-hedgehog"]) check((art[name]?.reach ?? 2) <= 1 && art[name]!.w === art[name]!.h, `${name}: square and inside the 0.3-cell target circle`);
  const ratio = (n: string) => (art[n] ? art[n]!.w / art[n]!.h : 0);
  const clayRatio = (2 * CLAY_CONFIG.clayRadius) / (2 * CLAY_CONFIG.clayRadius * 0.55);
  for (const n of ["pull-clay-orange", "pull-clay-gold"]) check(Math.abs(ratio(n) - clayRatio) < 0.03, `${n}: the clay footprint's proportions (${ratio(n).toFixed(3)} vs ${clayRatio.toFixed(3)})`);
  const birdRatio = (CLAY_BIRD_RX + 2) / (CLAY_BIRD_RY + 2);
  for (const n of ["pull-bird-0", "pull-bird-1", "pull-bird-2"]) check(Math.abs(ratio(n) - birdRatio) < 0.02, `${n}: the bird's hit box + 2 px proportions`);
  check(Math.abs(ratio("tenfall-board") - 360 / 520) < 0.01, "tenfall-board: the sim's 360 × 520 world");
  check(Math.abs(ratio("pull-sky") - 360 / 680) < 0.01, "pull-sky: the taller 360 × 680 sky");
  check(Math.abs(ratio("tenfall-tile-digit") - 80 / 68) < 0.01, "tenfall tiles: the 80 × 68 sprite box (the 76 × 64 tile at (2, 2))");
}

/* ------------------------------------------------------------------ 5. Ascend's discs */
{
  let seed = 7;
  const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
  for (let n = 0; n < 300; n++) {
    const spots = Array.from({ length: 24 }, () => ({ x: 5 + rnd() * 90, y: 5 + rnd() * 90 }));
    const w = 300 + rnd() * 300;
    const h = 300 + rnd() * 400;
    const size = ascendDiscSize(spots, w, h);
    let closest = Infinity;
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) closest = Math.min(closest, Math.hypot(((spots[i]!.x - spots[j]!.x) / 100) * w, ((spots[i]!.y - spots[j]!.y) / 100) * h));
    check(size >= ASCEND_DISC_MIN && size <= ASCEND_DISC_MAX, `Ascend: disc size ${size} within 44–60`);
    if (size > ASCEND_DISC_MIN) check(size + ASCEND_DISC_GAP <= closest + 1e-9, `Ascend: a ${size} px disc fits the closest pair (${closest.toFixed(1)} px)`);
  }
  check(ascendDiscSize([{ x: 10, y: 10 }, { x: 90, y: 90 }], 0, 0) === ASCEND_DISC_MIN, "Ascend: 44 until the board is measured");
}

/* ------------------------------------------------------------------ 6. Screens */
{
  const chain = read("src/puzzles/chainTap.tsx");
  const strip = chain.indexOf('data-chain-strip=""');
  const broken = chain.indexOf(">Chain broken<");
  const arena = chain.indexOf("data-game-arena=\"tall\"", strip);
  check(strip > 0 && broken > strip && arena > broken, "Chain: \"Chain broken\" sits on the chain strip, before the board");
  check(chain.split(">Chain broken<").length === 2, "Chain: \"Chain broken\" is drawn once (never over the board)");
  const flash = read("src/puzzles/reaction.tsx");
  check(/data-flash-done=""[\s\S]{0,300}>Done</.test(flash), "Flash: a clear \"Done\" moment at the end");
  const flashArena = flash.slice(flash.indexOf("function ReactionArena"), flash.indexOf("function LoggedStage"));
  check(flashArena.length > 0 && !/Flash \$\{|of \$\{flashes\.length\}|flashes left|flashes\.length/i.test(flashArena), "Flash: the flash count stays hidden in play");
  check(/className="flash-frame"/.test(flash), "Flash: the wooden frame round the screen");
  const clay = read("src/puzzles/clayShoot.tsx");
  const pills = clay.slice(clay.indexOf('testId="clayshoot"'), clay.indexOf('testId="clayshoot"') + 500);
  check(/id: "clays"/.test(pills) && /id: "streak"/.test(pills), "Pull!: the HUD is two pills, clays and streak");
  check(!/gold ·|birds · Streak|Doubles/.test(pills), "Pull!: gold, birds and doubles are off the HUD (on the reveal)");
  const td = read("src/lib/arcade/tenDrop.renderer.ts");
  check(/drawChuteMouth\(ctx, size\.width\)/.test(td) && /TD_CHUTE_PX = 6/.test(td), "Tenfall: tiles come out of the board's chute, below the counters");
  const bonk = read("src/lib/arcade/whack.renderer.ts");
  check(/paintLawn/.test(bonk) && !/drawImage\(burrow[^\n]*outside/.test(bonk), "Bonk: the lawn and the sixteen burrows only");
  // The arena scene round the board draws grass, flowers and stones, never anything shaped like a burrow.
  const scene = bonk.slice(bonk.indexOf("export function bonkArenaScene"));
  check(!/bonk-burrow|paintMeadow|WHACK_HOLES/.test(scene), "Bonk: nothing round the board looks like a burrow");
}

/* ------------------------------------------------------------------ 7. The ElevenLabs list */
{
  const doc = read("docs/sound-cues/speed-elevenlabs.md");
  const rows = doc.split("\n").filter((l) => /^\| (Flash|Ascend|Don't Break the Chain|Bonk|Tenfall|Pull!) \|/.test(l));
  const files = rows.map((l) => /`([a-z]+\.[A-Za-z-]+\.mp3)`/.exec(l)?.[1] ?? "");
  check(rows.length >= 30, `the list has a row for every action (${rows.length})`);
  check(files.every(Boolean) && new Set(files).size === files.length, "every row names one unique MP3");
  for (const game of ["Flash", "Ascend", "Don't Break the Chain", "Bonk", "Tenfall", "Pull!"]) check(rows.some((r) => r.startsWith(`| ${game} |`)), `the list covers ${game}`);
  for (const r of rows) check(/\| \d+ ms \|/.test(r), `every row gives a length: ${r.slice(0, 60)}`);
  const n = /(\d+) files in all/.exec(doc)?.[1];
  check(Number(n) === rows.length, `the list's count (${n}) matches its rows (${rows.length})`);
}

if (failures.length) {
  console.log(`speed-overhaul-check: FAIL (${failures.length} failed, ${passes} passed)`);
  for (const f of failures.slice(0, 40)) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`speed-overhaul-check: ${passes} checks passed`);
