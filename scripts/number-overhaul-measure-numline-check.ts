/**
 * number-overhaul-measure-numline-check (15 Nov 2026, the Number overhaul's stage 1 for Brimful and Ballpark; fast,
 * no browser). Both games change look and input only, so:
 *
 *   1. Brimful's reveal draws each puzzle's best line as jug pictures: measureLineStates gives the jugs after each
 *      move, starting from the board's start, every step exactly measureApply's, ending on the target (all four
 *      boards of 40 live deals), and the reveal no longer lists moves as chips.
 *   2. Brimful's stage moment: a solved board leaves through NumberStage's "clear" (no extra `correct` on advance), a
 *      board out of moves through a quiet "fail" slide with its one `wrong` (measureRev 4); the glass is the sprite.
 *   3. Ballpark's edge bump: numlineEdgeOf names the end a touch lies beyond, nothing on the line itself, and a bump
 *      plays `numline.edge` once per end, never in place of the marker's clamp.
 *   4. Ballpark's place plays one sound (exactly one duelz-sound cue, `numline.place`); a finished line (not the
 *      last) clears through NumberStage before the next comes in.
 *   5. Neither game's deal changed: live deals equal the pre-overhaul era's (pinPreNumberOverhaul) on 30 seeds each.
 *   6. The art, the sound slots and their cue-sheet rows exist.
 *
 *   bun scripts/number-overhaul-measure-numline-check.ts
 */
import { existsSync, readFileSync } from "node:fs";

import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { decodeMeasureActions, measureApply, measureLineStates, measureSolved } from "../src/lib/duel/measure";
import { pinPreNumberOverhaul } from "../src/lib/duel/numberOverhaul";
import { SOUND_MANIFEST } from "../src/lib/fx/manifest";
import type { MeasurePuzzleData } from "../src/lib/duel/types";

const failures: string[] = [];
let passes = 0;
const ok = (cond: unknown, label: string) => {
  if (cond) passes++;
  else {
    failures.push(label);
    console.log(`FAIL ${label}`);
  }
};
const src = (path: string) => readFileSync(path, "utf8");
const between = (text: string, from: string, to: string) => {
  const a = text.indexOf(from);
  if (a < 0) return "";
  const b = text.indexOf(to, a + from.length);
  return text.slice(a, b < 0 ? undefined : b);
};

/* ------------------------------------------------------------------ 1. Brimful's best-line pictures */
{
  let boards = 0;
  for (let seed = 0; seed < 40; seed++) {
    const p = withSeededRandom(seed, () => generatePuzzle("measure", { bankSeed: seed })) as MeasurePuzzleData;
    p.boards.forEach((board, i) => {
      const raw = p.solutions?.[i];
      if (!raw) return ok(false, `Brimful ${seed}/${i}: the deal carries its best line`);
      const actions = decodeMeasureActions(raw, board.caps.length);
      const states = measureLineStates(board, raw);
      ok(states.length === actions.length + 1, `Brimful ${seed}/${i}: one picture a move plus the start (${states.length} for ${actions.length})`);
      ok(JSON.stringify(states[0]!.amounts) === JSON.stringify(board.start) && states[0]!.action === null, `Brimful ${seed}/${i}: the first picture is the start`);
      let amounts = [...board.start];
      let same = true;
      actions.forEach((a, k) => {
        const next = measureApply(board, amounts, a);
        if (!next || JSON.stringify(next) !== JSON.stringify(states[k + 1]?.amounts)) same = false;
        if (next) amounts = next;
      });
      ok(same, `Brimful ${seed}/${i}: every picture is measureApply's jugs after its move`);
      ok(measureSolved(board, states[states.length - 1]!.amounts), `Brimful ${seed}/${i}: the last picture reaches the target`);
      boards++;
    });
  }
  ok(boards === 160, `Brimful: 160 boards' best lines drawn (${boards})`);
  // A refused move ends the pictures there (never a made-up state).
  const board = { caps: [3, 5], start: [0, 0], tap: true, goal: "amount" as const, target: 4 };
  ok(measureLineStates(board, "E0").length === 1, "Brimful: a refused first move leaves only the start");
  const reveal = between(src("src/puzzles/measure.tsx"), "function Reveal(", "export const measurePuzzle");
  ok(/<BestLine board=\{board\} raw=\{puzzle\.solutions\[index\]!\} \/>/.test(reveal), "Brimful: the reveal draws the best line as jug pictures");
  ok(!/StepChips|routeSteps/.test(src("src/puzzles/measure.tsx")), "Brimful: the reveal no longer lists the moves as chips");
}

/* ------------------------------------------------------------------ 2. Brimful's stage moment and glass */
{
  const s = src("src/puzzles/measure.tsx");
  ok(/<NumberStage type="measure" index=\{stage\} exit=\{exit\}/.test(s), "Brimful: the board sits in the shared stage moment, keyed by board");
  ok(/const exit: StageExit = holding \? "clear" : boardOut && outOfMoves && stage < MEASURE_BOARDS - 1 \? "fail" : null;/.test(s), "Brimful: solved boards clear, boards out of moves fail");
  ok(!/playCorrect/.test(s) && !/<StageCorrect /.test(s), "Brimful: the stage moment is the board's one success sound (no extra correct, no CORRECT line)");
  const effect = between(s, "if (boardOut && stage < MEASURE_BOARDS - 1) {", "return () => clearTimeout(timer);");
  ok(effect.length > 0 && (effect.match(/play[A-Z]\w*\(\)/g) ?? []).join() === "playWrong()", "Brimful: out of moves plays one sound, the fail sound");
  ok(/quiet=\{exit === "fail"\}/.test(s), "Brimful: the fail slide adds no second sound");
  ok(/numberArt\("measure", "jug-front"\)/.test(s) && /className="mj-shell"/.test(s), "Brimful: the glass is the rendered shell in front of the water");
  ok(!/#F5B82E/.test(s), "Brimful: no bright yellow");
}

/* ------------------------------------------------------------------ 3–4. Ballpark: edge bump, one sound, stage moment */
{
  const g = globalThis as unknown as { window?: unknown };
  const cues: string[] = [];
  g.window = {
    dispatchEvent: (e: { type?: string; detail?: { cue?: string } }) => {
      if (e?.type === "duelz-sound") cues.push(String(e.detail?.cue));
      return true;
    },
    addEventListener() {},
    removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
  const { numlineEdgeOf, numlinePlaceSound } = await import("../src/puzzles/numline");
  // A 390 px box at x = 10, the tape inset 22 px each side: span 346, so the ends sit at x = 32 and x = 378.
  const left = 10;
  const span = 346;
  ok(numlineEdgeOf(31, left, span) === "lo" && numlineEdgeOf(0, left, span) === "lo", "Ballpark: a touch left of 0 bumps the low end");
  ok(numlineEdgeOf(379, left, span) === "hi" && numlineEdgeOf(500, left, span) === "hi", "Ballpark: a touch right of the top end bumps the high end");
  ok(numlineEdgeOf(32, left, span) === null && numlineEdgeOf(378, left, span) === null && numlineEdgeOf(200, left, span) === null, "Ballpark: the line itself (ends included) never bumps");
  numlinePlaceSound();
  ok(cues.length === 1 && cues[0] === "numline.place", `Ballpark: a place plays one cue (${cues.join(", ")})`);

  const s = src("src/puzzles/numline.tsx");
  const bump = between(s, "const bumpAt = (clientX: number) => {", "\n  };");
  ok(/numlineEdgeOf\(clientX/.test(bump) && /soundCue\("numline\.edge"\)/.test(bump) && /side !== edge\?\.side/.test(bump), "Ballpark: the bump plays numline.edge once per end");
  ok(/setMarker\(Math\.round\(shareAt\(event\.clientX\) \* NUMLINE_SCALE\)\);\n\s+bumpAt\(event\.clientX\);/.test(between(s, "const down = (event", "const up")), "Ballpark: a bump comes with the marker's clamp, never in its place");
  const place = between(s, "const place = () => {", "\n  };");
  ok(/numlinePlaceSound\(\)/.test(place) && !/soundCue\(/.test(place), "Ballpark: place calls only numlinePlaceSound");
  ok(/if \(next\.length < NUMLINE_TOTAL && next\.length % NUMLINE_ITEMS === 0\) setClearing\(stageIndex\);/.test(place), "Ballpark: a finished line (not the last) clears before the next");
  ok(/<NumberStage type="numline" index=\{shownStage\} exit=\{clearing !== null \? "clear" : null\}/.test(s), "Ballpark: the line sits in the shared stage moment");
  ok(!/soundCue\("numline\.line"\)/.test(s), "Ballpark: no second sound when the next line comes in");
  ok(/numberArt\("numline", "ruler"\)/.test(s) && /"pin-placed" : "pin"/.test(s), "Ballpark: the rule and the pins are the rendered pieces");
  ok(/variant="gold"/.test(between(s, 'data-game-controls="actions"', "</Button>")), "Ballpark: Place is the screen's one gold button");
  const css = src("src/polish-layout/batch-w-numline.css");
  ok(!/drop-shadow|text-shadow: 0 0 1|0 0 14px/.test(css), "Ballpark: nothing glows in the live round");
  // Changed the card's size, never its input: a touch on the card still never places (the review fix stands).
  ok(/if \(!numlinePointerAllowed\(event\.target/.test(s), "Ballpark: the number card still takes no input");
}

/* ------------------------------------------------------------------ 5. The deals are unchanged */
{
  const digest = (type: "measure" | "numline", seed: number) =>
    JSON.stringify(withSeededRandom(seed, () => generatePuzzle(type, type === "measure" ? { bankSeed: seed } : {})));
  for (const type of ["measure", "numline"] as const) {
    let same = 0;
    for (let seed = 0; seed < 30; seed++) {
      const live = digest(type, seed);
      const was = pinPreNumberOverhaul(true);
      const old = digest(type, seed);
      pinPreNumberOverhaul(was);
      if (live === old) same++;
    }
    ok(same === 30, `${type}: the overhaul leaves the deal exactly as before (${same} of 30)`);
  }
}

/* ------------------------------------------------------------------ 6. Art and sound slots */
{
  for (const f of ["measure/jug-front", "measure/shelf", "numline/ruler", "numline/pin", "numline/pin-placed"])
    ok(existsSync(`public/number/${f}.webp`), `art: public/number/${f}.webp`);
  for (const f of ["measure.py", "numline.py"]) ok(existsSync(`docs/design/number-overhaul/source/${f}`), `art: its Blender source ${f}`);
  const sheet = src("docs/sound-cues/cue-sheet.csv");
  for (const slot of ["measure.stageClear", "measure.fail", "numline.stageClear", "numline.edge"]) {
    ok(Boolean((SOUND_MANIFEST as Record<string, unknown>)[slot]), `sound: ${slot} in the manifest`);
    ok(sheet.includes(slot), `sound: ${slot} on the cue sheet`);
  }
}

console.log(`number-overhaul-measure-numline-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(`FAIL summary: ${failures.length} failed`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
