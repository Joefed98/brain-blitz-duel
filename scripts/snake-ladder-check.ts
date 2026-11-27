/**
 * snake-ladder-check (D5's ladder for Meteor, snakeRev 16, 23 Nov 2026; docs/arcade-standard/snake.md "snakeRev 16" and
 * "Levels (D5, 23 Nov 2026)"):
 *
 *   1. Older rounds: snakeRev 15 at every level and snakeRev 14, 13 and 12 (scripts/fixtures/snake-ladder-legacy.json.gz,
 *      recorded before snakeRev 16) grade and checkpoint exactly as recorded, and the skill-band bot still sends exactly
 *      the recorded logs on them.
 *   2. Normal deals snakeRev 16 (the snakePreLadder pin deals snakeRev 15), every level its level on snakeRev 16, and a
 *      Normal deal is the deal with no level asked.
 *   3. The level registry lists SNAKE_LEVELS_V16, the table the sim reads.
 *   4. The proved deals rebuild from their witnesses, which replay to exactly 200 (a tenth; all with CHECKS_FULL=1) and
 *      keep the human limits (swipes at least 0.15 s apart); real deals come from each level's own list.
 *   5. The recorded ladder (96 deals a level), reported as measured (no targets, Joe 27 Nov 2026), and a live sample re-plays as recorded.
 *   6. The rules: Normal plays as snakeRev 15 tick for tick and scores on the lowered lines; Easy has no rocks and no
 *      shower; Hard and Expert start with their rocks down (never touching a star, gold star, lane, mouth, the shower or
 *      another rock, clear of the comet's way out) and drop more on the clock whatever the comet's length, up to the
 *      level's most; walls and pace as the table says; the parts sum to 200.
 *   7. The lever picture.
 *
 *   bun scripts/snake-ladder-check.ts [--full]
 */
import { SNAKE_LEVELS_V16 } from "../src/lib/arcade/retroLevels";
import {
  SNAKE_REV_GRACE,
  SNAKE_REV_LADDER,
  SNAKE_ROCK_WARN_TICKS,
  SNAKE_STD_CAPS,
  SNAKE_STD_CORE_MAX,
  SNAKE_V16_LINES,
  snakeColsOf,
  snakeCol,
  snakeGameFor,
  snakeRockSpan,
  snakeRow,
  snakeStdScore,
  snakeStepTicksOf,
  snakeTarget,
  snakeV16GoldFull,
  snakeV16Parts,
  type SnakeState,
} from "../src/lib/arcade/snake";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { SnakePicture, snakeWords } from "../src/lib/levels/pictures/retro-action/snake";
import { Human, HUMAN_LIMITS } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/snake";
import { roomSeed } from "./arcade-skill-bands/games";
import { dealSection, finish, ladderSection, legacyBotSection, legacySection, ok, pictureSection, registrySection, section, stampSection } from "./ladder-check-lib";
import { closestSwipes, SNAKE_ORACLE_GAP } from "./snake-oracle";
import { SNAKE_DEAL_PLAN } from "./snake-level-deal";
import { SNAKE_LADDER_LEGACY } from "./snake-ladder-legacy-record";

const started = performance.now();

legacySection(SNAKE_LADDER_LEGACY);
await legacyBotSection(SNAKE_LADDER_LEGACY);
stampSection("snake", "snakeRev", SNAKE_REV_LADDER, SNAKE_REV_GRACE, "snakePreLadder");
ok(LIVE_BANDS.snake.rev === SNAKE_REV_LADDER, `LIVE_BANDS lists snakeRev ${SNAKE_REV_LADDER} (${LIVE_BANDS.snake.rev})`);
registrySection("snake", SNAKE_LEVELS_V16);
dealSection(SNAKE_DEAL_PLAN, (w) => {
  const gap = closestSwipes(w.events as ArcadeInputEvent[]);
  return [gap >= SNAKE_ORACLE_GAP, `${w.level} ${w.seed}: closest swipes ${gap} ticks apart`];
});
await ladderSection("snake");

section("6. The rules");
{
  const g15 = snakeGameFor(SNAKE_REV_GRACE);
  const g16 = snakeGameFor(SNAKE_REV_LADDER);
  // Normal: snakeRev 15's world exactly, plus the marker; a bot log plays tick for tick the same.
  for (let n = 0; n < 6; n++) {
    const seed = roomSeed(n);
    const a = g15.init(seed);
    const b = g16.init(seed);
    ok(JSON.stringify({ ...a, ladder: 1 }) === JSON.stringify(b), `Normal ${seed}: snakeRev 16's start is snakeRev 15's plus ladder: 1`);
    const human = new Human("snake", seed, n % 2 ? "elite" : "average", HUMAN_LIMITS);
    const events = bot({ game: g15, seed, rev: SNAKE_REV_GRACE, human, fixes: true }).events ?? [];
    const by = new Map(events.map((e) => [e.t, e]));
    let s15 = a;
    let s16 = b;
    let same = true;
    while (!g15.isOver(s15) || !g16.isOver(s16)) {
      s15 = g15.step(s15, by.get(s15.tick + 1) ?? null);
      s16 = g16.step(s16, by.get(s16.tick + 1) ?? null);
      const { ladder: _l, ...rest } = s16;
      void _l;
      if (JSON.stringify(s15) !== JSON.stringify(rest)) {
        same = false;
        break;
      }
    }
    ok(same, `Normal ${seed}: a bot log plays tick for tick the same on snakeRev 15 and 16`);
    const p = snakeV16Parts(s16);
    const expect = (max: number, got: number, of: number) => Math.floor((max * Math.min(got, of)) / of);
    ok(
      p.gold === expect(SNAKE_STD_CAPS.gold, s16.goldLeft ?? 0, snakeV16GoldFull(s16)) && p.combo === expect(SNAKE_STD_CAPS.combo, s16.comboPts ?? 0, SNAKE_V16_LINES.comboFull) && p.lane === expect(SNAKE_STD_CAPS.lane, s16.laneRides ?? 0, SNAKE_V16_LINES.laneFull),
      `Normal ${seed}: snakeRev 16 scores the same run on the lowered lines (gold ${p.gold}, combos ${p.combo}, lanes ${p.lane})`,
    );
    ok(g16.score(s16) >= g15.score(s15), `Normal ${seed}: never less than snakeRev 15 for the same run (${g15.score(s15)} → ${g16.score(s16)})`);
  }
  // The lines: each part full exactly at its line, one short of it under.
  const base = g16.init(roomSeed(1)) as SnakeState;
  const full = { ...base, eaten: SNAKE_V16_LINES.fullAt, goldsEaten: 0, goldLeft: snakeV16GoldFull(base), comboPts: SNAKE_V16_LINES.comboFull, laneRides: SNAKE_V16_LINES.laneFull, warpPts: SNAKE_V16_LINES.warpFull, acted: 1 } as SnakeState;
  const fp = snakeV16Parts(full);
  ok(fp.core === SNAKE_STD_CORE_MAX && fp.gold === SNAKE_STD_CAPS.gold && fp.combo === SNAKE_STD_CAPS.combo && fp.lane === SNAKE_STD_CAPS.lane && fp.warp === SNAKE_STD_CAPS.warp && snakeStdScore(full) === 200, `Normal: every part full at its line, 200 in all (${JSON.stringify(fp)})`);
  const short = snakeV16Parts({ ...full, goldLeft: snakeV16GoldFull(base) - 1, comboPts: SNAKE_V16_LINES.comboFull - 1, laneRides: SNAKE_V16_LINES.laneFull - 1 });
  ok(short.gold < SNAKE_STD_CAPS.gold && short.combo < SNAKE_STD_CAPS.combo && short.lane < SNAKE_STD_CAPS.lane, `Normal: one short of each line is under the part's maximum (${JSON.stringify(short)})`);
  ok(SNAKE_STD_CORE_MAX + SNAKE_STD_CAPS.gold + SNAKE_STD_CAPS.combo + SNAKE_STD_CAPS.lane + SNAKE_STD_CAPS.warp === 200, "the parts' maxima sum to 200");

  for (const level of ["easy", "hard", "expert"] as const) {
    const lv = SNAKE_LEVELS_V16[level];
    const game = snakeGameFor(SNAKE_REV_LADDER, level);
    let clean = 0;
    const seeds = Array.from({ length: 60 }, (_, i) => roomSeed(200 + i));
    for (const seed of seeds) {
      const s = game.init(seed) as SnakeState;
      const lf = { ...s, eaten: lv.fullAt, goldLeft: snakeV16GoldFull(s), comboPts: lv.comboFull, laneRides: lv.laneFull, warpPts: lv.warpFull };
      const parts = snakeV16Parts(lf);
      const fullOk = parts.core + parts.gold + parts.combo + parts.lane + parts.warp === 200;
      const cols = snakeColsOf(s);
      const near = (a: number, b: number) => Math.abs(snakeRow(a, cols) - snakeRow(b, cols)) <= 1 && Math.abs(snakeCol(a, cols) - snakeCol(b, cols)) <= 1;
      const rocks = s.rocks ?? [];
      const spans = (s.rockSlots ?? []).flatMap((slot) => snakeRockSpan(s, slot.cell));
      const stars = new Set(s.queue);
      const golds = (s.golds ?? []).map((g) => g.cell);
      const head = s.body[0]!;
      const rocksOk =
        rocks.length === lv.rocksAtStart &&
        rocks.every((r, i) => !stars.has(r) && !golds.includes(r) && snakeRow(r, cols) !== s.laneRow && snakeCol(r, cols) !== s.laneCol && snakeCol(r, cols) !== s.laneCol2) &&
        rocks.every((r, i) => rocks.every((q, j) => i === j || !near(r, q))) &&
        rocks.every((r) => (s.warps ?? []).every((m) => !near(r, m)) && (s.showerCells ?? []).every((c) => !near(r, c)) && spans.every((c) => !near(r, c))) &&
        rocks.every((r) => !(Math.abs(snakeCol(r, cols) - snakeCol(head, cols)) <= 1 && snakeRow(r, cols) >= snakeRow(head, cols) - 8 && snakeRow(r, cols) <= snakeRow(head, cols) + 3));
      const slotsOk =
        lv.rockEvery === 0
          ? (s.rockSlots ?? []).length === 0
          : (s.rockSlots ?? []).every((slot, i) => slot.tick === lv.rockFrom * 60 + i * lv.rockEvery * 60) && (s.rockSlots ?? []).length >= lv.rockMax - lv.rocksAtStart;
      const showerOk = lv.shower ? (s.showerCells ?? []).length === 3 : (s.showerCells ?? []).length === 0;
      const metaOk = s.lv === lv && s.grace === Math.max(0, lv.lives - 1) && s.ladder === 1 && snakeStepTicksOf(s) === lv.stepStart;
      if (fullOk && rocksOk && slotsOk && showerOk && metaOk) clean++;
      else ok(false, `${level} ${seed}: rules (lines ${fullOk}, rocks ${rocksOk}, slots ${slotsOk}, shower ${showerOk}, settings ${metaOk})`);
    }
    ok(clean === seeds.length, `${level}: ${clean} of ${seeds.length} seeds start as the table says (${lv.rocksAtStart} rocks down, ${lv.rockMax} at most, every ${lv.rockEvery} s from ${lv.rockFrom} s, shower ${lv.shower ? "on" : "off"}, lines and 200)`);
    // Walls on Hard and Expert, wrap on Easy: a head on the top row heading up.
    const s0 = game.init(seeds[0]!) as SnakeState;
    const top = { ...s0, body: [snakeColsOf(s0) >> 1, (snakeColsOf(s0) >> 1) + snakeColsOf(s0)], dir: 0, nextDir: 0 };
    ok((snakeTarget(top, 0) < 0) === Boolean(lv.walls), `${level}: the edges are ${lv.walls ? "walls" : "wrapping"}`);
    if (lv.rockEvery > 0) {
      // A timed rock falls for a comet that has eaten nothing: step to the first slot's shadow with the comet at rest.
      const slot = s0.rockSlots![0]!;
      const at = { ...s0, tick: slot.tick - SNAKE_ROCK_WARN_TICKS - 1, sinceMove: 0 } as SnakeState;
      const next = game.step(at, null) as SnakeState;
      ok(next.rockWarn === slot.cell && next.eaten === 0, `${level}: the first timed rock's shadow shows whatever the comet's length (warn ${next.rockWarn}, slot ${slot.cell})`);
      // The most: with the level's most rocks already down, no more shadows.
      const many = { ...at, rocks: Array.from({ length: lv.rockMax }, (_, i) => -1000 - i) } as SnakeState;
      const capped = game.step(many, null) as SnakeState;
      ok((capped.rockWarn ?? -1) < 0, `${level}: no rock falls past the level's most (${lv.rockMax})`);
      // On Normal the same moment drops nothing for a comet that has eaten nothing (rocks are earned there).
      const n0 = g16.init(seeds[0]!) as SnakeState;
      const nslot = n0.rockSlots![0]!;
      const nn = g16.step({ ...n0, tick: nslot.tick - SNAKE_ROCK_WARN_TICKS - 1, sinceMove: 0 }, null) as SnakeState;
      ok((nn.rockWarn ?? -1) < 0, `Normal: a rock is still earned by growing (no shadow for a comet of 3)`);
    }
  }
  ok(SNAKE_LEVELS_V16.easy.rockMax === 0 && SNAKE_LEVELS_V16.easy.shower === 0 && SNAKE_LEVELS_V16.hard.rocksAtStart > 0 && SNAKE_LEVELS_V16.expert.rocksAtStart > SNAKE_LEVELS_V16.hard.rocksAtStart, "the lever: no rocks on Easy, rocks down from the start on Hard, more on Expert");
}

await pictureSection("snake", SnakePicture as never, snakeWords);

finish(started);
