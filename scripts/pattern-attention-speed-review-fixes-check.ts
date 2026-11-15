/**
 * pattern-attention-speed-review-fixes-check (15 Nov 2026, phase 2 step 4): one assertion for each fix made from
 * the Pattern, Attention and Speed game reviews (docs/design/game-reviews/). Every fix is on the phone (display,
 * input, sound or help text); no grader, deal or stamp changed. No browser.
 *
 *   bun scripts/pattern-attention-speed-review-fixes-check.ts
 */
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

const win = new Window({ url: "http://localhost/", width: 390, height: 700 });
const g = globalThis as Record<string, unknown>;
for (const key of ["window", "document", "navigator", "Node", "Element", "HTMLElement", "SVGElement", "Text", "Event", "CustomEvent", "getComputedStyle", "MutationObserver"]) {
  if (g[key] === undefined) g[key] = key === "window" ? win : (win as unknown as Record<string, unknown>)[key];
}
g["ResizeObserver"] ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const React = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const { PUZZLE_INSTRUCTIONS } = await import("../src/lib/duel/instructions");
const { PATTERN_STD_HELP } = await import("../src/lib/duel/standard/patternText");
const { decodeMoves, replayUnblock } = await import("../src/lib/duel/unblock");
const { unblockPuzzle, safeReplay } = await import("../src/puzzles/unblock");
const { tapPose } = await import("../src/lib/duel/blockParty");
const { flowDrawStep } = await import("../src/lib/duel/flow");
const { laserGemsShown } = await import("../src/puzzles/laser");
const { scanSubmitAllowed, SCAN_SUBMIT_HOLD_MS } = await import("../src/puzzles/symbolScan");
const { spotTapIgnored } = await import("../src/puzzles/spotTheDifference");
const { tallyColourName, countUpQuestion } = await import("../src/puzzles/countUp");
const { mazeStraightFill } = await import("../src/lib/duel/maze");
const { ascendTapSilent, ascendRevealDone, numberHuntPuzzle } = await import("../src/puzzles/numberHunt");
const { replayAscend } = await import("../src/lib/duel/tapLog");
const { chainWindowShrinksAfter, chainWindowTier } = await import("../src/lib/duel/chain");
const { whackSparkEnabled } = await import("../src/lib/arcade/whack.renderer");
const { WHACK_STATUS_HIT, WHACK_STATUS_WRONG, WHACK_STATUS_UP } = await import("../src/lib/arcade/whack");

const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else failures.push(message);
};
const src = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const helpText = (type: keyof typeof PUZZLE_INSTRUCTIONS) => {
  const ins = PUZZLE_INSTRUCTIONS[type];
  return { how: ins.how.map((line) => `${line.action} ${line.detail}`).join(" | "), score: ins.score, intro: ins.how.filter((l) => !l.helpOnly) };
};

/* ------------------------------------------------------------------ PATTERN */

// Gridlock: the reveal replays Undo (-1:0) and Reset (-2:0) as the grader does: "your moves" is the grader's count and
// the "Yours" board is the board the player left, never the start.
{
  const vehicles = [{ id: 0, axis: "h" as const, len: 2, row: 2, col: 0 }];
  const answer = "0:3,-1:0,0:5"; // slide, undo, slide out: the grader counts 2 slides played
  const graded = replayUnblock(vehicles, decodeMoves(answer));
  check(graded.solved && graded.moves === 2, `Gridlock: the test answer grades ${JSON.stringify(graded)}`);
  check(decodeMoves(answer).length === 3, "Gridlock: the test answer no longer holds an undo marker");
  const shown = safeReplay(vehicles, answer);
  check(shown?.moves === 2, `Gridlock: the reveal counts ${shown?.moves} moves, the grader 2 (undo markers counted)`);
  check(shown?.vehicles.find((v) => v.id === 0)?.col === 5, "Gridlock: the reveal's Yours board isn't the board the player left");
  const html = renderToStaticMarkup(
    React.createElement(unblockPuzzle.Reveal, {
      timeLimitMs: 60_000,
      puzzle: { type: "unblock", vehicles, minMoves: 1, solution: "0:5" },
      myAnswer: answer,
      myCorrect: true,
      myMsRemaining: 30_000,
    } as never),
  );
  check(/your moves: <span[^>]*>2<\/span>/.test(html), `Gridlock: the reveal line doesn't say 2 moves: ${html.match(/your moves:[^·]*/)?.[0]}`);
  const help = helpText("unblock");
  check(!/gold mark/i.test(help.how), "Gridlock: the help still names the bar's gold mark");
  // Changed with Joe's approval, 15 Nov 2026 (routine consequence of the Pattern overhaul): unblockRev 4 gives the move
  // back on Undo, so the live help says so (pattern-overhaul-unblock-check holds the old line under the pin).
  check(/Undo/.test(help.how) && /give the move back/.test(help.how), "Gridlock: the help doesn't say Undo gives the move back");
  check(help.intro.length <= 4, "Gridlock: more than four intro HOW lines");
}

// Tessellate: a single tap turns; a double tap (its first tap already turned) only flips.
{
  const start = { rot: 1, flip: false };
  const one = tapPose(start, false);
  check(one.rot === 2 && one.flip === false, `Tessellate: a single tap gives ${JSON.stringify(one)}`);
  const double = tapPose(tapPose(start, false), true);
  check(double.rot === start.rot && double.flip === true, `Tessellate: a double tap gives ${JSON.stringify(double)}, not a flip only`);
  const stage = src("src/components/puzzles/BlockPartyPuzzle.tsx");
  check(stage.includes("tapPose(state, Boolean(double))"), "Tessellate: the stage doesn't take its pose from tapPose");
  check(stage.includes("lastTap.current = double ? null"), "Tessellate: a third quick tap could flip back");
  const help = helpText("blockparty");
  check(/flip/i.test(help.how), "Tessellate: the help doesn't mention flipping");
  check(help.intro.length <= 4, "Tessellate: more than four intro HOW lines");
}

// Chroma Lines: touching a finished pair's dot leaves it alone; the path restarts only on the drag's first step.
{
  // 9 × 9: pair 0 joins cells 0 and 2 through 1.
  const pairs = [{ a: 0, b: 2 }, { a: 80, b: 78 }];
  const finished = [[0, 1, 2], []];
  const still = flowDrawStep(finished, 0, 0, pairs, [], 0);
  check(still.paths === finished && !still.moved, "Chroma Lines: a touch on the dot changed the finished path");
  const drag = flowDrawStep(finished, 0, 9, pairs, [], 0);
  check(drag.moved && JSON.stringify(drag.paths[0]) === "[0,9]", `Chroma Lines: a drag off the dot gives ${JSON.stringify(drag.paths[0])}`);
  const stage = src("src/puzzles/flow.tsx");
  const dotBranch = stage.slice(stage.indexOf("A dot starts its own path afresh"), stage.indexOf("…and the loose end"));
  check(dotBranch.length > 0 && !dotBranch.includes("setPaths"), "Chroma Lines: touching a dot still rewrites its path at once");
}

// Lightbender: the Gems pill keeps the best shot's count after the beam fades.
{
  check(laserGemsShown(4, 0) === 4 && laserGemsShown(2, 5) === 5, "Lightbender: the Gems count falls back when the beam fades");
  const stage = src("src/puzzles/laser.tsx");
  check(!stage.includes("value: `${litGems.length}/${gems.length}`") && !stage.includes("value: `${litGems.length} / ${gems.length}`"), "Lightbender: a Gems pill still counts only the beam on screen");
}

// Heave: the help names par only while the screen shows it.
// Changed with Joe's approval, 15 Nov 2026 (routine consequence of the Pattern overhaul): Heave now shows Pushes and
// Par during play (pushPar.ts), so the help names par again; the assertion keeps the rule "par in the help only when
// the stage shows it" (pattern-overhaul-push-check proves the pill).
check(/\bpar\b/i.test(PATTERN_STD_HELP.push) === src("src/puzzles/push.tsx").includes(`parPills("Pushes"`), "Heave: the help names par but the screen doesn't show it (or the other way round)");

// The ✓ / ✗ between a count and its unit ("17 ✗ moves · par 34") read as a typo, app-wide.
{
  const files = ["src/puzzles/sortTubes.tsx", "src/puzzles/tower.tsx", "src/puzzles/gravityMaze.tsx", "src/components/puzzles/pattern/topsyBoard.tsx", "src/puzzles/pipes.tsx", "src/puzzles/push.tsx", "src/puzzles/flow.tsx", "src/puzzles/unblock.tsx", "src/puzzles/lightsOut.tsx"];
  for (const file of files) {
    const text = src(file);
    check(!/\{[\w.]+\} \{myCorrect \? "✓" : "✗"\}/.test(text), `${file}: a ✓ / ✗ still sits between a count and its unit`);
    check(!/`✗ \$\{/.test(text), `${file}: a count line still starts with ✗`);
    check(!/\{myCorrect \? "✓" : "✗"\} your/.test(text), `${file}: "✗ your …" is still drawn`);
  }
  check(src("src/puzzles/sortTubes.tsx").includes("pours used"), "Polypotions: the pours line doesn't say \"of N pours used\"");
}

/* ---------------------------------------------------------------- ATTENTION */

// Eagle Eye: Submit needs a mark and waits 400 ms after each grid appears.
{
  check(SCAN_SUBMIT_HOLD_MS === 400, `Eagle Eye: Submit waits ${SCAN_SUBMIT_HOLD_MS} ms`);
  check(!scanSubmitAllowed(false, 0, false), "Eagle Eye: Submit works with no marks");
  check(!scanSubmitAllowed(false, 3, true), "Eagle Eye: Submit works while the grid has just appeared");
  check(scanSubmitAllowed(false, 1, false) && !scanSubmitAllowed(true, 1, false), "Eagle Eye: Submit's rule is wrong once ready");
  const stage = src("src/puzzles/symbolScan.tsx");
  check(stage.includes("disabled={!scanSubmitAllowed(frozen, selected.length, holding)}"), "Eagle Eye: the button isn't disabled by the rule");
}

// Double Take: re-tapping a wrong square is ignored silently.
check(spotTapIgnored([12], [], [], 12) && !spotTapIgnored([12], [], [], 13), "Double Take: a repeat tap on a wrong square isn't ignored");

// Tally: the stored BROWN id is drawn and named white everywhere a player sees it.
{
  check(tallyColourName("BROWN") === "white", "Tally: BROWN isn't named white");
  check(!/brown/i.test(countUpQuestion("BROWN", "circle")), "Tally: a question names brown");
  check(/white/.test(helpText("countup").how) && !/brown/i.test(helpText("countup").how), "Tally: the help's colour list doesn't match the drawn white");
}

// Labyrinth: a fast drag's skipped squares along a straight line are filled in, one step each.
{
  check(JSON.stringify(mazeStraightFill(0, 3, 19)) === "[1,2,3]", `Labyrinth: row fill gives ${JSON.stringify(mazeStraightFill(0, 3, 19))}`);
  check(JSON.stringify(mazeStraightFill(60, 3, 19)) === "[41,22,3]", `Labyrinth: column fill gives ${JSON.stringify(mazeStraightFill(60, 3, 19))}`);
  check(JSON.stringify(mazeStraightFill(5, 6, 19)) === "[6]", "Labyrinth: a neighbour isn't a single step");
  check(mazeStraightFill(0, 20, 19) === null && mazeStraightFill(4, 4, 19) === null, "Labyrinth: a diagonal jump is filled in");
  check(src("src/puzzles/mazeDash.tsx").includes("mazeStraightFill("), "Labyrinth: the stage doesn't fill skipped squares");
}

// Bomb Defusal: the help describes the game as it plays (nothing explodes live; Reset retries).
{
  const help = helpText("bomb").how;
  check(!/One wrong step and it explodes/i.test(help), "Bomb Defusal: the help still says one wrong step explodes");
  check(/Reset/.test(help) && /DEFUSE/.test(help), "Bomb Defusal: the help doesn't say Reset and DEFUSE");
}

// Matchmaker: a miss plays one wrong sound (no reject cue on top of playWrong).
check(src("src/puzzles/pairMatch.tsx").includes("wrongMoveFlash(card ?? null, false)"), "Matchmaker: a miss still plays the reject cue as well as wrong");

/* -------------------------------------------------------------------- SPEED */

// Ascend: a re-tap on a done disc is one the server ignores: not logged, so silent; the reveal greys unreached discs.
{
  const spots = Array.from({ length: 24 }, (_, i) => ({ x: 4 * i, y: 50, n: 10 + i * 3 }));
  const puzzle = { type: "numhunt" as const, spots, layouts: [spots, spots, spots, spots], tapRev: 1 };
  const honest = [{ n: 10, t: 500 }, { n: 13, t: 900 }];
  const withRetap = [...honest, { n: 10, t: 1200 }];
  const replay = replayAscend(puzzle, withRetap);
  check(replay.outcomes.at(-1) === "ignored" && ascendTapSilent(replay.outcomes.at(-1)), "Ascend: a re-tap on a done disc isn't silent");
  check(!ascendTapSilent("correct") && !ascendTapSilent("wrong"), "Ascend: a right or wrong tap is silenced");
  const a = replayAscend(puzzle, honest);
  check(a.reached === replay.reached && a.errors === replay.errors && a.finishedAt === replay.finishedAt, "Ascend: dropping an ignored tap changes the replay");
  check(ascendRevealDone(1, 2) && !ascendRevealDone(2, 2) && !ascendRevealDone(0, 0), "Ascend: the reveal's gold rule is wrong");
  const html = renderToStaticMarkup(React.createElement(numberHuntPuzzle.Reveal, { puzzle: { ...puzzle, tapRev: undefined }, myAnswer: "3,0,0", myCorrect: false, timeLimitMs: 60_000 } as never));
  const done = (html.match(/data-disc="done"/g) ?? []).length;
  check(done === 3, `Ascend: the reveal draws ${done} discs gold for 3 reached`);
  const help = helpText("numhunt").how;
  check(!/Untapped numbers/.test(help) && !/is gone/.test(help) && /All the numbers/.test(help), "Ascend: the help still says untapped numbers move and tapped ones vanish");
}

// Don't Break the Chain: FASTER shows when the window actually shrinks, on every stamp's bands.
{
  const shrinks = (puzzle?: object) => Array.from({ length: 45 }, (_, i) => i).filter((made) => chainWindowShrinksAfter(made, puzzle as never));
  check(JSON.stringify(shrinks()) === "[13,26]", `Chain: the live bands shrink after ${JSON.stringify(shrinks())}`);
  const legacy = { type: "chain", rulesVersion: 1, boards: Array.from({ length: 5 }, () => []), cycle: [] };
  check(JSON.stringify(shrinks(legacy)) === "[10,18]", `Chain: the 25-link bands shrink after ${JSON.stringify(shrinks(legacy))}`);
  check(chainWindowTier(12) === 0 && chainWindowTier(13) === 1 && chainWindowTier(26) === 2 && chainWindowTier(39) === 2, "Chain: the ring tier doesn't follow the windows");
  const stage = src("src/puzzles/chainTap.tsx");
  check(!stage.includes("rules.fasterAt.includes(made)"), "Chain: FASTER still follows the fixed 10 / 20 / 30 links");
}

// Bonk: every correct hit gets the success spark, red hats as well as gold.
{
  check(whackSparkEnabled([WHACK_STATUS_UP, WHACK_STATUS_HIT], 1), "Bonk: a correct hit gets no spark");
  check(!whackSparkEnabled([WHACK_STATUS_WRONG], 0) && !whackSparkEnabled([], -1), "Bonk: a wrong hit or no hit gets a spark");
  const art = src("src/lib/arcade/whack.renderer.ts");
  check(!art.includes("state.schedule.kind[lastHit] === 0 });"), "Bonk: the spark still needs a gold-hat target");
}

if (failures.length) {
  console.log(`FAIL pattern-attention-speed-review-fixes-check: ${failures.length} failed, ${passes} passed`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`pattern-attention-speed-review-fixes-check: all ${passes} assertions pass`);
