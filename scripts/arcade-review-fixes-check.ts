/**
 * arcade-review-fixes-check (15 Nov 2026, phase 2 step 4: the Action, Retro, Cards & Board, Sports and Strategy game
 * reviews). One assertion per fix, each one that would have caught the bug:
 *   Orbit       the success layer's misses count up on a crash (the chain resets); the pops show the dealt stamp's points
 *   Gemstone    PAR SMASHED compares gems cleared with the gem par on the standard (match points before it)
 *   Thirteen    pyramidRev 3: a dead end waits for Undo (rev 1–2 replay exactly as recorded); the stuck note; one sound
 *               for a wrong pair; rooms deal rev 3; the witness scores 200 on rev 3
 *   Summit      the stuck end says why
 *   Mahjong     Reset fires on release over the button; a wrong second tile is a miss for the effects layer
 *   Coral Pop   the mine's blast rings the bubbles it pops (bubbleRev 11+)
 *   Curl Champ  Throw is greyed out while a stone travels
 *   Blockzone   the run's opening coin and a top-out's impact haptic, as every Retro game
 *   Pinball     the help says any press launches the ball
 *   Hover       the HUD names the gold stars it counts
 *   Grappler    every dealt course has 51 stretches (the HUD and reveal's count); the doc says so
 *   Crazy Golf  the desktop comment names the keys that work
 *   Intro demos the stop rule accepts the stamp rooms deal (and the stamp whose play it keeps), never an older one
 *
 *   bun scripts/arcade-review-fixes-check.ts
 */
import { readFileSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";

import { successFrame } from "../src/lib/arcade/success.renderer";
import { orbitPerfectPopText, orbitSlingPopText } from "../src/lib/arcade/orbit.renderer";
import { MAHJONG_FX, matchupParSmashed } from "../src/lib/arcade/arcadeFxGames.renderer";
import { matchupGameFor, matchupParRaw, type MatchupState } from "../src/lib/arcade/matchup";
import { mahjongGameFor, type MahjongState } from "../src/lib/arcade/mahjong";
import { PY_INPUT_TAP, PY_INPUT_UNDO, PY_REV, PY_RUN_TICKS, pyDeadEnd, pyramidGameFor, pyStuck, type PyState } from "../src/lib/arcade/cards/pyramid";
import { pyDeadEndLines } from "../src/lib/arcade/cards/pyramid.renderer";
import { tpStuckLines } from "../src/lib/arcade/cards/tripeaks.renderer";
import { bubMineBlastCells } from "../src/lib/arcade/bubble.renderer";
import { bubCellX, bubCellY, bubMineNearest, BUB_COLS, BUB_V11_MINE_POPS } from "../src/lib/arcade/bubble";
import { hoverGoldHudText } from "../src/lib/arcade/hover.renderer";
import { swingGameFor, SWING_V17_PAR_STRETCHES } from "../src/lib/arcade/swing";
import { SWING_SLIDE_DEAL } from "../src/lib/duel/swingSlideDeal.server";
import { replayPyramidRun } from "../src/lib/duel/cards";
import { generateBurst, generateCross, generatePyramid, generateSkyline, generateWavefront } from "../src/lib/duel/arcade.server";
import { demoRevAccepted, SAME_PLAY_DEMO_REVS } from "../src/lib/duel/introDemo.functions";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { setDealPin } from "../src/lib/duel/dealEra";
import { SOUND_MANIFEST } from "../src/lib/fx/manifest";
import { fcNoMoves, fcNoMovesText, freecellGameFor, FC_REV_UNDO, type FcState } from "../src/lib/arcade/cards/freecell";
import { cardOf, NO_CARD } from "../src/lib/arcade/cards/cards";
import { pyramidFlawless } from "./cards/flawless";
import { pyRandomRun, type PyLegacyRun } from "./arcade-review-fixes-record";

const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else failures.push(message);
};
const read = (p: string) => readFileSync(p, "utf8");

/* Orbit */
{
  const src = read("src/lib/arcade/orbit.renderer.ts");
  check(!src.includes("misses:1-state.respawns") && (src.match(/misses:state\.respawns/g) ?? []).length === 2, "Orbit: both success layers count misses up with the respawns");
  // The success layer resets its chain only when misses rise: a crash (respawns + 1) must reset it.
  const ctx = createCanvas(100, 100).getContext("2d") as unknown as CanvasRenderingContext2D;
  const opts = (tick: number, count: number, respawns: number) => ({ id: "orbit-check", tick, count, misses: respawns, colour: "#fff", width: 100, height: 100, point: { x: 1, y: 1 } });
  successFrame(ctx, opts(1, 0, 0));
  successFrame(ctx, opts(2, 1, 0));
  const before = successFrame(ctx, opts(3, 2, 0)).chain;
  const after = successFrame(ctx, opts(4, 2, 1)).chain;
  check(before === 2 && after === 0, `Orbit: a crash resets the capture chain (${before} → ${after})`);
  check(orbitSlingPopText({ std: 1 }) === "SLINGSHOT! +3" && orbitSlingPopText({}) === "SLINGSHOT! +4", "Orbit: the slingshot pop shows 3 on the standard, 4 on orbitRev 12");
  check(!/\+/.test(orbitPerfectPopText({ std: 1 }, 3)) && orbitPerfectPopText({}, 3).endsWith("+1"), "Orbit: the perfect-orbit pop shows no number on the standard (11/21 a point), +1 every third on orbitRev 12");
}

/* Gemstone */
{
  const s = matchupGameFor(12).init(7) as MatchupState;
  check(Boolean(s.std), "Gemstone: matchupRev 12 is on the standard");
  const par = matchupParRaw(s);
  check(matchupParSmashed({ ...s, gemsCleared: par, raw: 0 }) && !matchupParSmashed({ ...s, gemsCleared: par - 1, raw: 10 ** 9 }), `Gemstone: PAR SMASHED fires on ${par} gems cleared, never on match points`);
  const old = matchupGameFor(8).init(7) as MatchupState;
  const oldPar = matchupParRaw(old);
  check(!old.std && matchupParSmashed({ ...old, raw: oldPar }) && !matchupParSmashed({ ...old, raw: oldPar - 1 }), "Gemstone: older revisions keep comparing match points");
}

/* Thirteen (pyramid) */
{
  const legacy = JSON.parse(read("scripts/fixtures/arcade-review-fixes-pyramid-legacy.json")) as PyLegacyRun[];
  let same = 0;
  for (const run of legacy) {
    const r = replayPyramidRun(run.seed, run.raw, run.rev);
    if (r.score === run.score && r.state.ended === run.ended && r.removed === run.removed && r.replayTick === run.replayTick && !r.flagged) same++;
    else failures.push(`Thirteen: rev ${run.rev} ${run.kind} seed ${run.seed} replays to ${r.score}/${r.state.ended}, recorded ${run.score}/${run.ended}`);
  }
  check(same === legacy.length && legacy.some((r) => r.ended === 3), `Thirteen: ${same} of ${legacy.length} rev 1–2 runs replay exactly as recorded (stuck ends included)`);
  check(PY_REV === 3 && generatePyramid().pyramidRev === 3, "Thirteen: rooms deal pyramidRev 3");
  {
    const was = setDealPin("preGameReviewNov15", true);
    const pinned = generatePyramid().pyramidRev;
    setDealPin("preGameReviewNov15", was);
    check(pinned === 2, `Thirteen: the game reviews' era pin deals pyramidRev 2 (${pinned})`);
  }
  for (const seed of [0, 1, 77, 4000, 10000, 123456789]) {
    const { raw } = pyramidFlawless(seed, 15, 3);
    const r = replayPyramidRun(seed, raw, 3);
    check(r.score === 200 && !r.flagged, `Thirteen: seed ${seed}'s witness scores 200 on rev 3 through the server replay (${r.score})`);
  }
  // A dead end on rev 3: the same random player as rev 2 runs on, scoring what rev 2 scored at its stuck end.
  let stuckSeen = 0;
  for (let i = 0; i < 12; i++) {
    const seed = 4000 + i * 37;
    const v2 = pyRandomRun(seed, 2, 1);
    if (v2.state.ended !== 3) continue;
    stuckSeen++;
    const v3 = pyRandomRun(seed, 3, 1);
    check(v3.state.ended === 2 && v3.state.tick === PY_RUN_TICKS, `Thirteen rev 3 seed ${seed}: a dead end carries on to the buzzer (ended ${v3.state.ended} at ${v3.state.tick})`);
    check(replayPyramidRun(seed, v3.raw, 3).score === replayPyramidRun(seed, v2.raw, 2).score, `Thirteen rev 3 seed ${seed}: a dead end left alone scores what rev 2 scored`);
  }
  check(stuckSeen >= 4, `Thirteen: ${stuckSeen} random rev-2 runs ended stuck (the case is exercised)`);
  // Undo out of a dead end, then the deal's witness from the start position still clears.
  {
    const game = pyramidGameFor(3);
    const seed = 4000;
    // The random player's first dead end on rev 3 (stopped there; the same taps end a rev-2 run).
    let s: PyState = pyRandomRun(seed, 3, 1, 0, (st) => pyStuck(st)).state;
    let t = s.tick;
    const tap = (k: number, a: number) => {
      s = game.step(s, { k, a, b: 0, c: 0, d: 0, t: ++t } as never);
    };
    const wasStuck = pyStuck(s) && s.ended === 0 && pyDeadEnd(s) === "wait";
    check(wasStuck, "Thirteen rev 3: a random player's dead end waits");
    check(pyDeadEndLines(s)?.join(" ") === "NO MOVES UNDO OR RESET", "Thirteen rev 3: the waiting dead end says NO MOVES / UNDO OR RESET");
    while (s.hist.length > 0) tap(PY_INPUT_UNDO, 0);
    check(s.ended === 0 && s.pos === 0 && s.removed === 0 && !pyStuck(s), "Thirteen rev 3: Undo goes back out of the dead end to the deal");
    const o = pyRandomRun(seed, 2, 1).state;
    check(o.ended === 3 && pyDeadEndLines(o)?.join(" ") === "NO MOVES LEFT", "Thirteen rev 2: the same player's dead end still ends the run, and says NO MOVES / LEFT");
  }
  const sounds = read("src/lib/fx/gameSounds.ts");
  check(/state\.sel !== prev\.sel && state\.rejects === prev\.rejects\) effectCue\("pyramid\.select"\)/.test(sounds), "Thirteen: a refused pair plays only its refusal, not the select sound too");
  const how = PUZZLE_INSTRUCTIONS.pyramid.how.map((l) => `${l.action} ${l.detail}`).join(" ");
  check(/Stuck\?/.test(how) && /Undo or Reset/.test(how), "Thirteen: the help says a dead end waits for Undo or Reset");
}

/* Summit */
check(tpStuckLines({ ended: 3 })?.join(" ") === "NO PLAYS LEFT" && tpStuckLines({ ended: 2 }) === null && tpStuckLines({ ended: 0 }) === null, "Summit: only a stuck end says NO PLAYS / LEFT");

/* Mahjong */
{
  const { mahjongReleaseInside } = await import("../src/puzzles/mahjong");
  const box = { getBoundingClientRect: () => ({ left: 0, right: 100, top: 0, bottom: 40 }) };
  check(mahjongReleaseInside({ type: "pointerup", clientX: 50, clientY: 20, currentTarget: box }), "Mahjong: a release over Reset resets");
  check(!mahjongReleaseInside({ type: "pointerup", clientX: 150, clientY: 20, currentTarget: box }) && !mahjongReleaseInside({ type: "pointercancel", clientX: 50, clientY: 20, currentTarget: box }) && !mahjongReleaseInside({ type: "lostpointercapture", clientX: 50, clientY: 20, currentTarget: box }), "Mahjong: a release off the button, a cancel or a lost capture resets nothing");
  const src = read("src/puzzles/mahjong.tsx");
  check(!/onPressStart=\{\(\) => send\(\{ k: MAHJONG_INPUT_BUTTON, a: MAHJONG_BUTTON_RESET/.test(src) && /onPressEnd=\{\(event\) => \{\s*if \(mahjongReleaseInside\(event\)\) send\(\{ k: MAHJONG_INPUT_BUTTON, a: MAHJONG_BUTTON_RESET/.test(src), "Mahjong: Reset no longer fires on touch-start");
  const s = mahjongGameFor(2).init(3) as MahjongState;
  const missCounts = (MAHJONG_FX.misses ?? []).map((m) => m.count({ ...s, misses: 5 } as MahjongState) - m.count(s));
  check(missCounts.includes(5), "Mahjong: a wrong second tile (the sim's misses) counts as a miss for the effects layer");
}

/* Coral Pop */
{
  const grid = new Array<number>(BUB_COLS * 8).fill(0);
  for (let i = 0; i < BUB_COLS * 5; i++) grid[i] = 1 + (i % 4);
  const landed = BUB_COLS * 5 + 3;
  const cells = bubMineBlastCells(grid, landed, BUB_V11_MINE_POPS, 2);
  const want = bubMineNearest(grid, landed, BUB_V11_MINE_POPS).map((i) => ({ x: bubCellX(Math.floor(i / BUB_COLS), i % BUB_COLS), y: bubCellY(Math.floor(i / BUB_COLS), 2) }));
  check(cells.length === BUB_V11_MINE_POPS && JSON.stringify(cells) === JSON.stringify(want), `Coral Pop: the mine's blast rings exactly the ${BUB_V11_MINE_POPS} bubbles it pops`);
  const src = read("src/lib/arcade/bubble.renderer.ts");
  check(/if \(kind === 2 && state\.minePops\) m\.blast\.cells = bubMineBlastCells/.test(src) && /if \(f\.cells\) \{/.test(src), "Coral Pop: bubbleRev 11's blast draws those rings, not a ring of cells");
}

/* Curl Champ */
{
  const { curlThrowLive } = await import("../src/puzzles/curling");
  check(curlThrowLive(300, true) && !curlThrowLive(300, false) && !curlThrowLive(null, true), "Curl Champ: Throw is live only with a weight set and no stone moving");
  check(/disabled=\{locked \|\| !curlThrowLive\(setWeight, aiming\)\}/.test(read("src/puzzles/curling.tsx")), "Curl Champ: the Throw button is disabled through it");
}

/* Blockzone */
{
  const sounds = read("src/lib/fx/gameSounds.ts");
  const body = sounds.slice(sounds.indexOf("export function blockfallSounds"), sounds.indexOf("export function alleyRollSounds"));
  check(/retroStart\("blockfall\.start"\)/.test(body) && /start\(running\)/.test(body) && "blockfall.start" in SOUND_MANIFEST, "Blockzone: the run starts with the Retro coin, as the other Retro games");
  check(/sfx\("blockfall\.topOut", "arc_retro_explode", 0\.8\); feel\("impact"\);/.test(body), "Blockzone: a top-out gives the impact haptic");
}

/* Pinball */
{
  const how = PUZZLE_INSTRUCTIONS.pinball.how.map((l) => l.detail).join(" ");
  check(!/tap to plunge/.test(how) && /any press/.test(how), "Pinball: the help says any press launches the ball, not a tap");
}

/* Hover */
check(hoverGoldHudText({ stars: 4, totalStars: 10 }) === "GOLD STARS 4/10" && /text: hoverGoldHudText\(state\)/.test(read("src/lib/arcade/hover.renderer.ts")), "Hover: the HUD names the gold stars it counts");

/* Grappler */
{
  const g = swingGameFor(17) as unknown as { init: (seed: number) => { sections?: unknown[] } };
  const counts = new Set(SWING_SLIDE_DEAL.slice(0, 20).map((seed) => g.init(seed).sections?.length ?? 0));
  check(counts.size === 1 && counts.has(51) && SWING_V17_PAR_STRETCHES === 45, `Grappler: every dealt course has 51 stretches (pars over 45): ${[...counts]}`);
  check(/every dealt course has \*\*51\*\*/.test(read("docs/arcade-standard/swing.md")), "Grappler: swing.md gives the course's 51 stretches");
}

/* Crazy Golf */
check(!/W\/S the power/.test(read("src/puzzles/minigolf.tsx")), "Crazy Golf: the desktop comment no longer names W/S");

/* Intro demos */
{
  const dealt = { wavefront: generateWavefront().wavRev, burst: generateBurst().burstRev, cross: generateCross().crossRev, skyline: generateSkyline().skylineRev } as const;
  for (const [game, rev] of Object.entries(dealt) as [keyof typeof SAME_PLAY_DEMO_REVS, number | undefined][]) {
    const pair = SAME_PLAY_DEMO_REVS[game] as readonly number[];
    check(demoRevAccepted(game, rev), `${game}: a demo recorded on the dealt stamp (${rev}) plays`);
    check(pair.length === 2 && pair[1] === rev && pair[0] === (rev ?? 0) - 1, `${game}: the accepted pair is the dealt stamp and the one before it (${pair})`);
    check(!demoRevAccepted(game, (rev ?? 0) - 2) && !demoRevAccepted(game, undefined) && !demoRevAccepted(game, (rev ?? 0) + 1), `${game}: an older (or unstamped) demo stays stopped`);
  }
  const src = read("src/lib/duel/introDemo.functions.ts");
  for (const [game, field] of [["wavefront", "wavRev"], ["burst", "burstRev"], ["cross", "crossRev"], ["skyline", "skylineRev"]] as const)
    check(src.includes(`!demoRevAccepted("${game}", demo.puzzle.${field})) return null`), `${game}: the stop rule reads demoRevAccepted`);
}

/* Free Cell: a dead end says so (15 Nov 2026, Joe; display only) */
{
  const live = freecellGameFor(5).init(7) as FcState;
  check(!fcNoMoves(live) && fcNoMovesText(live) === "", "Free Cell: a fresh deal has moves (no message)");
  // Every free cell full, every column top red and two reds deep (no run), nothing an Ace, home empty: nothing can move.
  const reds = [1, 2].flatMap((suit) => [3, 5, 7, 9, 11, 13].map((rank) => cardOf(suit, rank)));
  const stuck: FcState = { ...live, home: [0, 0, 0, 0], cells: reds.slice(0, 4), cols: Array.from({ length: 8 }, (_, c) => [cardOf(0, 13 - c), reds[4 + c] ?? cardOf(1, 2)]) };
  check(fcNoMoves(stuck), "Free Cell: a board where no card can move is a dead end");
  check(fcNoMovesText(stuck) === "No moves: Undo or Reset" && fcNoMovesText({ ...stuck, rev: 1 }) === "No moves left", "Free Cell: the dead-end words (Undo or Reset from freecellRev 2, 'No moves left' on rev 1)");
  check(FC_REV_UNDO === 2, "Free Cell: Undo arrives on freecellRev 2");
  check(!fcNoMoves({ ...stuck, cells: [NO_CARD, ...stuck.cells.slice(1)] }), "Free Cell: a free cell open means moves remain");
  check(!fcNoMoves({ ...stuck, ended: 2 }), "Free Cell: no message once the run has ended");
  check(/drawNoMoves\(ctx, state\)/.test(read("src/lib/arcade/cards/freecell.renderer.ts")), "Free Cell: the renderer draws the dead-end pill");
}

if (failures.length) {
  console.log(`FAIL arcade-review-fixes-check: ${failures.length} failed, ${passes} passed`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`PASS arcade-review-fixes-check: ${passes} checks`);
