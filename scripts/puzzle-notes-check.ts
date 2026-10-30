/**
 * Joe's puzzle notes (28 Oct 2026, docs/puzzle-notes-oct-2026.md; src/lib/duel/puzzleNotes.ts). Proves:
 *   1. new deals carry Slider `wordSlideRev 4` and Tally `countRev 6`; pinPrePuzzleNotes(true) deals the standard's
 *      3 and 5, pinPreStandard(true) the live 2 and 4; the same seed deals the same puzzle;
 *   2. Slider: swap tokens change nothing on older stamps (grades identical with and without them); on rev 4 a swap
 *      needs exactly four locked rows that are words (server), swaps two tiles of the last row, counts as a move and
 *      is undone by Undo; the phone's replay agrees with the server's on honest logs; a swap finish grades correct;
 *   3. Tally: the second tray asks one of three kinds, each dealt; the stored count equals the scene's truth, every
 *      counted shape is at least half visible, shape trays hold no other shape of that kind counted, colour trays no
 *      look-alike filler; trays without `ask` count exactly as before; the help texts follow the dealt stamp.
 *
 *   bun scripts/puzzle-notes-check.ts
 */
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { pinPrePuzzleNotes, SLIDER_NOTES_REV, TALLY_NOTES_REV } from "../src/lib/duel/puzzleNotes";
import { pinPreStandard } from "../src/lib/duel/standard/stamps";
import { replayWordSlide, WS_SIZE } from "../src/lib/duel/wordSlide";
import { replayWordSlideFor } from "../src/lib/duel/wordSlide.server";
import { countUpCounts, countUpStageTruth } from "../src/lib/duel/attentionRev";
import { countUpSceneValid, countUpStageQuestion, countUpVisibleShare, TALLY_ASK_TRAY } from "../src/puzzles/countUp";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import type { CountUpPuzzleData, CountUpStage, PuzzleData, WordSlidePuzzleData } from "../src/lib/duel/types";

let fails = 0;
let passes = 0;
function ok(cond: boolean, what: string): void {
  if (cond) passes++;
  else {
    fails++;
    console.log(`FAIL ${what}`);
  }
}

const deal = <T extends PuzzleData>(type: PuzzleData["type"], seed: number) => withSeededRandom(seed, () => generatePuzzle(type)) as T;

/* 1. Stamps */
for (const seed of [1, 2, 3]) {
  ok(deal<WordSlidePuzzleData>("wordslide", seed).wordSlideRev === SLIDER_NOTES_REV, `wordslide ${seed}: deals wordSlideRev 4`);
  ok(deal<CountUpPuzzleData>("countup", seed).countRev === TALLY_NOTES_REV, `countup ${seed}: deals countRev 6`);
  ok(JSON.stringify(deal("countup", seed)) === JSON.stringify(deal("countup", seed)), `countup ${seed}: same seed, same puzzle`);
  ok(JSON.stringify(deal("wordslide", seed)) === JSON.stringify(deal("wordslide", seed)), `wordslide ${seed}: same seed, same puzzle`);
}
{
  const prev = pinPrePuzzleNotes(true);
  ok(deal<WordSlidePuzzleData>("wordslide", 4).wordSlideRev === 3, "pinned: wordSlideRev 3");
  const t = deal<CountUpPuzzleData>("countup", 4);
  ok(t.countRev === 5 && t.stages.every((s) => s.ask === undefined), "pinned: countRev 5, no ask");
  ok(PUZZLE_INSTRUCTIONS.wordslide.how.every((h) => !/swap/i.test(`${h.action} ${h.detail}`)), "pinned: Slider help has no swap line");
  ok(PUZZLE_INSTRUCTIONS.countup.how.some((h) => h.detail === "a shape and a colour."), "pinned: Tally help unchanged");
  pinPrePuzzleNotes(prev);
  const before = pinPreStandard(true);
  ok(deal<WordSlidePuzzleData>("wordslide", 4).wordSlideRev === 2, "standard pinned: wordSlideRev 2");
  ok(deal<CountUpPuzzleData>("countup", 4).countRev === 4, "standard pinned: countRev 4");
  pinPreStandard(before);
}
ok(PUZZLE_INSTRUCTIONS.wordslide.how.some((h) => /swap them/.test(h.detail)), "Slider help states the swap");
ok(PUZZLE_INSTRUCTIONS.countup.how.some((h) => h.detail === "a shape, a colour, or both."), "Tally help states the kinds");

/* 2. Slider */
const board = deal<WordSlidePuzzleData>("wordslide", 7);
const words = board.words!;
const turned = [...words[4]!.slice(1), words[4]![0]].join(""); // the last word turned one step
const grid = [...words.slice(0, 4).join(""), ...turned];
const swapsToFix: string[] = [];
{
  // Swap the last row back into its word, one tile at a time.
  const row = [...turned];
  for (let i = 0; i < WS_SIZE; i++) {
    if (row[i] === words[4]![i]) continue;
    const j = row.findIndex((ch, k) => k > i && ch === words[4]![i]);
    [row[i], row[j]] = [row[j]!, row[i]!];
    swapsToFix.push(`S${i}${j}`);
  }
}
const locks = ["L0", "L1", "L2", "L3"];
for (const rev of [0, 1, 2, 3]) {
  const p = { ...board, grid, wordSlideRev: rev || undefined } as WordSlidePuzzleData;
  const a = gradeAnswer(p, [...locks, ...swapsToFix].join(","), 50_000);
  const b = gradeAnswer(p, locks.join(","), 50_000);
  // The stored answer is the raw string; everything graded from it must match.
  ok(JSON.stringify({ ...a, answer: "" }) === JSON.stringify({ ...b, answer: "" }), `wordSlideRev ${rev}: swap tokens ignored`);
  ok(!a.isCorrect, `wordSlideRev ${rev}: no swap finish`);
}
{
  const p = { ...board, grid, wordSlideRev: SLIDER_NOTES_REV } as WordSlidePuzzleData;
  const answer = [...locks, ...swapsToFix].join(",");
  const g = gradeAnswer(p, answer, 50_000);
  ok(g.isCorrect, "rev 4: swapping the last row into its word finishes");
  ok((g.extra as { moves?: number })?.moves === swapsToFix.length, `rev 4: each swap is a move (${swapsToFix.length})`);
  const server = replayWordSlideFor(p, answer.split(","));
  const phone = replayWordSlide(p.grid, answer.split(","), { swaps: true });
  ok(JSON.stringify(server) === JSON.stringify(phone), "rev 4: phone replay = server replay on an honest log");
  const three = replayWordSlideFor(p, ["L0", "L1", "L2", "S01"]);
  ok(three.grid.join("") === grid.join("") && three.moves === 0, "rev 4: three locks, no swap");
  const five = replayWordSlideFor(p, ["L0", "L1", "L2", "L3", "L4", "S01"]);
  ok(five.grid.join("") === grid.join("") && five.moves === 0, "rev 4: five locks, no swap");
  const undo = replayWordSlideFor(p, ["L0", "L1", "L2", "L3", "S01", "U"]);
  ok(undo.grid.join("") === grid.join("") && undo.moves === 2, "rev 4: Undo takes a swap back (two moves)");
  const one = replayWordSlideFor(p, ["L0", "L1", "L2", "L3", "S02"]);
  const expect = [...grid];
  [expect[20], expect[22]] = [grid[22]!, grid[20]!];
  ok(one.grid.join("") === expect.join(""), "rev 4: a swap swaps two tiles of the last row only");
  ok(replayWordSlideFor(p, ["L0", "L1", "L2", "L3", "S00"]).moves === 0, "rev 4: a tile never swaps with itself");
  // Locks on rows that are not words never open swaps on the server.
  const bad = [...grid];
  [bad[0], bad[1]] = [bad[1]!, bad[0]!];
  const pb = { ...p, grid: bad };
  const cheat = replayWordSlideFor(pb, ["L0", "L1", "L2", "L3", ...swapsToFix]);
  ok(cheat.grid.join("") === bad.join("") && cheat.moves === 0, "rev 4: a non-word lock opens no swap (server)");
  ok(!gradeAnswer(pb, ["L0", "L1", "L2", "L3", ...swapsToFix].join(","), 50_000).isCorrect, "rev 4: non-word locks, no finish");
  // The open row is the one unlocked row, and every locked row must be a word: with the turned last row locked
  // (not a word) and row 4 open, nothing swaps.
  const other = replayWordSlideFor(p, ["L0", "L1", "L2", "L4", "S01"]);
  ok(other.grid.join("") === grid.join("") && other.moves === 0, "rev 4: a locked non-word row opens no swap");
  const fixed = [...words.slice(0, 3).join(""), ...[...words[3]!].reverse(), ...words[4]!];
  const pf = { ...p, grid: fixed };
  const row4 = replayWordSlideFor(pf, ["L0", "L1", "L2", "L4", "S04"]);
  const e2 = [...fixed];
  [e2[15], e2[19]] = [fixed[19]!, fixed[15]!];
  ok(row4.grid.join("") === e2.join("") && row4.moves === 1, "rev 4: the swap row is the one unlocked row");
}

/* 3. Tally */
const kinds = new Map<string, number>();
for (let seed = 1; seed <= 90; seed++) {
  const p = deal<CountUpPuzzleData>("countup", seed);
  p.stages.forEach((stage, i) => {
    ok(p.counts?.[i] === countUpStageTruth(stage), `countup ${seed}: tray ${i + 1} stored count = scene`);
    if (i !== TALLY_ASK_TRAY) ok(stage.ask === undefined, `countup ${seed}: tray ${i + 1} has no ask`);
  });
  const st = p.stages[TALLY_ASK_TRAY]!;
  const kind = st.ask ?? "both";
  kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
  ok(countUpSceneValid(st), `countup ${seed}: tray 2 scene valid`);
  ok(st.shapes.length === 80, `countup ${seed}: tray 2 holds 80 shapes`);
  const n = countUpStageTruth(st);
  ok(n >= 5 && n <= 17, `countup ${seed}: tray 2 count ${n} in 5–17`);
  for (const s of st.shapes) if (countUpCounts(st, s)) ok(countUpVisibleShare(s, st.shapes) >= 0.5, `countup ${seed}: counted shape visible`);
  const q = countUpStageQuestion(st);
  if (st.ask === "shape") ok(/^How many (circles|squares|triangles|stars|hexagons)\?$/.test(q), `countup ${seed}: shape question "${q}"`);
  if (st.ask === "colour") {
    ok(/^How many \w+ shapes\?$/.test(q), `countup ${seed}: colour question "${q}"`);
    const lookalike = ([["RED", "ORANGE"], ["ORANGE", "BROWN"], ["BLUE", "PURPLE"]] as const).find((pair) => (pair as readonly string[]).includes(st.targetColour));
    const near = lookalike ? lookalike.find((c) => c !== st.targetColour) : null;
    ok(!near || st.shapes.every((s) => s.colour !== near), `countup ${seed}: no look-alike of the asked colour`);
  }
}
for (const k of ["both", "shape", "colour"]) ok((kinds.get(k) ?? 0) >= 15, `Tally: tray 2 kind "${k}" dealt ${kinds.get(k) ?? 0} of 90`);
{
  // Trays without `ask` count exactly as before: the colour and the shape together.
  const stage: CountUpStage = {
    cols: 10, rows: 10, targetShape: "star", targetColour: "RED",
    shapes: [
      { shape: "star", colour: "RED", x: 10, y: 10, size: 30, rotation: 0, layer: 1 },
      { shape: "star", colour: "BLUE", x: 50, y: 50, size: 30, rotation: 0, layer: 2 },
      { shape: "circle", colour: "RED", x: 80, y: 80, size: 30, rotation: 0, layer: 3 },
    ],
  };
  ok(countUpStageTruth(stage) === 1, "no ask: colour and shape (1)");
  ok(countUpStageTruth({ ...stage, ask: "shape" }) === 2, "ask shape: every star (2)");
  ok(countUpStageTruth({ ...stage, ask: "colour" }) === 2, "ask colour: every red (2)");
}

console.log(`${passes} passed, ${fails} failed`);
if (fails) {
  console.log("FAIL puzzle-notes-check");
  process.exit(1);
}
