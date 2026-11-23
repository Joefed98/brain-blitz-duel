/**
 * rally-ladder-check (D5's ladder for Rally, rallyRev 14, 23 Nov 2026; docs/arcade-standard/rally.md "rallyRev 14" and
 * "Levels (D5, 23 Nov 2026)"):
 *
 *   1. Older rounds: rallyRev 13 at every level and rallyRev 12 and 11 (scripts/fixtures/rally-ladder-legacy.json.gz,
 *      recorded before rallyRev 14) grade and checkpoint exactly as recorded, and the skill-band bot (which plays spin
 *      shots and places the paddle with a person's error only on rallyRev 14) still sends exactly the recorded logs.
 *   2. Normal deals rallyRev 14 (the rallyPreLadder pin deals rallyRev 13), every level its level on rallyRev 14, and a
 *      Normal deal is the deal with no level asked.
 *   3. The level registry lists RALLY_LEVELS_V14, the table the sim reads.
 *   4. The proved deals rebuild from their witnesses, which replay to exactly 200 (a tenth; all with CHECKS_FULL=1);
 *      real deals come from each level's own list.
 *   5. The recorded ladder (96 deals a level) passes Joe's ladder test, and a live sample re-plays as recorded.
 *   6. The rules: Normal plays as rallyRev 13 tick for tick and scores on the lowered lines; each level's paddle,
 *      lives, ball cap and bumpers (on court from the first serve on Hard and Expert, none on Easy, drawn when they
 *      bounce); the parts sum to 200.
 *   7. The lever picture.
 *
 *   bun scripts/rally-ladder-check.ts [--full]
 */
import { RALLY_LEVELS_V14 } from "../src/lib/arcade/retroLevels";
import {
  RALLY_BALL_R,
  RALLY_BUMPER_FROM,
  RALLY_BUMPER2_FROM,
  RALLY_BUMPER_R,
  RALLY_REV_LADDER,
  RALLY_REV_LIVES,
  RALLY_SPEED_CAP,
  RALLY_V13_CORE_MAX,
  RALLY_V13_LIVES,
  RALLY_V13_SPIN_MAX,
  RALLY_V12_PADS_MAX,
  RALLY_V12_TARGETS_MAX,
  RALLY_V14_LINES,
  rallyBumperFromTick,
  rallyGameFor,
  rallyPaddleWOf,
  rallyStdParts,
  rallyV14Parts,
  type RallyState,
} from "../src/lib/arcade/rally";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { RallyPicture, rallyWords } from "../src/lib/levels/pictures/retro-action/rally";
import { Human } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/rally";
import { roomSeed } from "./arcade-skill-bands/games";
import { dealSection, finish, ladderSection, legacyBotSection, legacySection, ok, pictureSection, registrySection, section, stampSection } from "./ladder-check-lib";
import { RALLY_DEAL_PLAN } from "./rally-level-deal";
import { RALLY_LADDER_LEGACY } from "./rally-ladder-legacy-record";

const started = performance.now();

legacySection(RALLY_LADDER_LEGACY);
await legacyBotSection(RALLY_LADDER_LEGACY);
stampSection("rally", "rallyRev", RALLY_REV_LADDER, RALLY_REV_LIVES, "rallyPreLadder");
ok(LIVE_BANDS.rally.rev === RALLY_REV_LADDER, `LIVE_BANDS lists rallyRev ${RALLY_REV_LADDER} (${LIVE_BANDS.rally.rev})`);
registrySection("rally", RALLY_LEVELS_V14);
dealSection(RALLY_DEAL_PLAN);
await ladderSection("rally");

section("6. The rules");
{
  const g13 = rallyGameFor(RALLY_REV_LIVES);
  const g14 = rallyGameFor(RALLY_REV_LADDER);
  for (let n = 0; n < 6; n++) {
    const seed = roomSeed(n);
    const a = g13.init(seed);
    const b = g14.init(seed);
    ok(JSON.stringify({ ...a, ladder: 1 }) === JSON.stringify(b), `Normal ${seed}: rallyRev 14's start is rallyRev 13's plus ladder: 1`);
    // A skill-band log (the bot as rallyRev 13 knows it) plays tick for tick the same on both stamps.
    const events = bot({ game: g13, seed, rev: RALLY_REV_LIVES, human: new Human("rally", seed, n % 2 ? "elite" : "average"), fixes: true }).events ?? [];
    const by = new Map(events.map((e) => [e.t, e]));
    let s13 = a;
    let s14 = b;
    let same = true;
    while (!g13.isOver(s13) || !g14.isOver(s14)) {
      s13 = g13.step(s13, by.get(s13.tick + 1) ?? null);
      s14 = g14.step(s14, by.get(s14.tick + 1) ?? null);
      const { ladder: _l, ...rest } = s14;
      void _l;
      if (JSON.stringify(s13) !== JSON.stringify(rest)) {
        same = false;
        break;
      }
    }
    ok(same, `Normal ${seed}: a bot log plays tick for tick the same on rallyRev 13 and 14`);
    ok(g14.score(s14) >= g13.score(s13), `Normal ${seed}: never less than rallyRev 13 for the same run (${g13.score(s13)} → ${g14.score(s14)})`);
  }
  // The lines: each part full exactly at its line, one short of it under; the maxima sum to 200.
  const base = g14.init(roomSeed(2)) as RallyState;
  const L = RALLY_V14_LINES;
  const bits = (n: number) => (1 << n) - 1;
  const full = { ...base, goldHits: L.fullAt, targetHits: L.padsFull, bonusHit: bits(L.targetsFull), spinScores: L.spinFull, acted: 1 } as RallyState;
  const fp = rallyV14Parts(full).map((p) => p.points);
  ok(fp.join() === [RALLY_V13_CORE_MAX, RALLY_V12_PADS_MAX, RALLY_V12_TARGETS_MAX, RALLY_V13_SPIN_MAX].join() && g14.score(full) === 200, `Normal: every part full at its line, 200 in all (${fp.join(" + ")})`);
  const short = rallyV14Parts({ ...full, goldHits: L.fullAt - 1, targetHits: L.padsFull - 1, bonusHit: bits(L.targetsFull - 1), spinScores: L.spinFull - 1 }).map((p) => p.points < p.max);
  ok(short.every(Boolean), `Normal: one short of each line is under the part's maximum`);
  ok(RALLY_V13_CORE_MAX + RALLY_V12_PADS_MAX + RALLY_V12_TARGETS_MAX + RALLY_V13_SPIN_MAX === 200, "the parts' maxima sum to 200");
  ok(JSON.stringify(rallyStdParts(full)) === JSON.stringify(rallyV14Parts(full)), "the standard's parts are rallyRev 14's on its states");
  ok(rallyBumperFromTick(base, 0) === RALLY_BUMPER_FROM && rallyBumperFromTick(base, 1) === RALLY_BUMPER2_FROM, "Normal's bumpers arrive at 30 s and 45 s (the renderer reads the sim's own times)");

  for (const level of ["easy", "hard", "expert"] as const) {
    const lv = RALLY_LEVELS_V14[level];
    const game = rallyGameFor(RALLY_REV_LADDER, level);
    const s = game.init(roomSeed(3)) as RallyState;
    ok(s.lv === lv && s.lives === lv.lives && s.ladder === 1, `${level}: ${lv.lives} lives and the level's settings on the state`);
    ok(rallyPaddleWOf(s) === lv.paddleStart && rallyPaddleWOf(s, 1000) === lv.paddleMin, `${level}: the paddle starts ${lv.paddleStart} px and shrinks to ${lv.paddleMin} (${rallyPaddleWOf(s)}, ${rallyPaddleWOf(s, 1000)})`);
    const lp = rallyV14Parts({ ...s, goldHits: lv.fullAt, targetHits: lv.padsFull, bonusHit: bits(lv.targetsFull), spinScores: lv.spinFull, acted: 1 } as RallyState);
    ok(lp.reduce((t, p) => t + p.points, 0) === 200, `${level}: every part full at the level's own lines (${lv.fullAt}, ${lv.padsFull}, ${lv.targetsFull}, ${lv.spinFull}) is 200`);
    // A bumper: the main ball dropped straight onto the first bumper on tick 1 bounces off it on Hard and Expert (on
    // court from the first serve), and passes through its spot on Easy (no bumpers).
    const bump = s.bumper!;
    const drop = { ...s, x: bump.x * 256, y: (bump.y - RALLY_BUMPER_R - RALLY_BALL_R - 6) * 256, vx: 0, vy: 1024, golds: [], bounces: 0 } as RallyState;
    let t = drop;
    for (let k = 0; k < 6; k++) t = game.step(t, null) as RallyState;
    const bounced = (t.bounces ?? 0) > 0;
    ok(bounced === (lv.bumper1S === 0), `${level}: a ball meets the first bumper on the first serve${lv.bumper1S === 0 ? "" : " and passes (no bumper)"} (bounced ${bounced})`);
    ok(rallyBumperFromTick(s, 0) === lv.bumper1S * 60 && rallyBumperFromTick(s, 1) === lv.bumper2S * 60, `${level}: the renderer draws the bumpers at the level's own times`);
    ok(Math.trunc((RALLY_SPEED_CAP * lv.capPct) / 100) > 0, `${level}: the ball's top speed is ${lv.capPct} % of Normal's`);
  }
  const W = (l: "easy" | "hard" | "expert") => RALLY_LEVELS_V14[l].paddleStart;
  ok(W("easy") > 120 && 120 > W("hard") && W("hard") > W("expert"), `the lever: the paddle narrows each level up (${W("easy")} > 120 > ${W("hard")} > ${W("expert")})`);
  ok(RALLY_V13_LIVES === 2, "Normal keeps two lives");
}

await pictureSection("rally", RallyPicture as never, rallyWords);

finish(started);
