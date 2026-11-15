/**
 * pattern-overhaul-iceslide-check (15 Nov 2026, the Pattern overhaul, stage 1, Skid): one assertion per change.
 *
 *  1. Deals: rooms and practice deal slideRev 5 (the same board as slideRev 4); `pinPrePatternNov15(true)` deals 4.
 *  2. Older stamps grade exactly as before: every case in scripts/fixtures/pattern-overhaul-iceslide-legacy.json.gz
 *     (slideRev 4 and 3, kit levels, spam and hand-made Undo / Reset answers, recorded before the change by
 *     scripts/pattern-overhaul-iceslide-record.ts) regrades to the same score, verdict and stored extra.
 *  3. slideRev 5: Undo and Reset give the slide back. A solve with undone slides stores and is scored on the standing
 *     slides (the clean line's score at the same time when they equal it); the same answers on slideRev 4 count every
 *     slide; unfinished credit is unchanged between the two stamps (the waste rule still counts every slide played).
 *     A slide into a wall is never a slide (it costs nothing on any stamp).
 *  4. The stage: the Slides pill counts the standing slides on slideRev 5, Par shown; the wall bump plays its sound and
 *     changes nothing; the near-exit glow's rule (oneSlideFromExit).
 *  5. The reveal: on slideRev 5 a Solution and a Yours column (the switch's labels), "your slides" the standing count
 *     under Yours only, the Yours board the player's own final cell; older stamps read as before.
 *  6. Help: the live help says Undo gives the slide back and where the arrow pad / swipe choice lives; the pinned help
 *     doesn't; at most four intro HOW lines.
 *  7. Art: every sprite exists as WebP with alpha, within budget, square; the stage, the intro example and the reveal
 *     draw them; no glow on the ball or the board.
 *  8. Sound: the new slots are manifest slots, fired by the stage, listed in the cue doc and pattern-elevenlabs.md.
 *
 *   bun scripts/pattern-overhaul-iceslide-check.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
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
const { generatePuzzle, gradeAnswer } = await import("../src/lib/duel/generate.server");
const { withSeededRandom } = await import("../src/lib/duel/random");
const { pinPrePatternNov15 } = await import("../src/lib/duel/patternNov15");
const { PUZZLE_INSTRUCTIONS } = await import("../src/lib/duel/instructions");
const { SLIDE_DIRS, oneSlideFromExit, replaySlide, slideBoard, slideOutcome } = await import("../src/lib/duel/slide");
const { iceSlidePuzzle } = await import("../src/puzzles/iceSlide");
const { IceBoard, ICE_SPRITES, iceSprite } = await import("../src/components/puzzles/pattern/iceSlideBoard");
const { SOUND_MANIFEST } = await import("../src/lib/fx/manifest");
const { SOLUTION_SWITCH_TYPES } = await import("../src/components/duel/SolutionSwitch");
const { casesFor, dealEra, markerAnswers } = await import("./pattern-overhaul-iceslide-record");
type SlidePuzzleData = import("../src/lib/duel/types").SlidePuzzleData;
type SlideDir = import("../src/lib/duel/types").SlideDir;

const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else failures.push(message);
};
const src = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const movesOf = (extra: unknown) => (extra as { moves?: number } | null)?.moves;

/* ---------------------------------------------------------------- 1. deals */
{
  for (const seed of [11, 4242, 90210]) {
    const live = withSeededRandom(seed, () => generatePuzzle("iceslide", { bankSeed: seed })) as SlidePuzzleData;
    check(live.slideRev === 5, `seed ${seed}: the live deal is slideRev ${live.slideRev}, not 5`);
    const before = pinPrePatternNov15(true);
    const old = withSeededRandom(seed, () => generatePuzzle("iceslide", { bankSeed: seed })) as SlidePuzzleData;
    pinPrePatternNov15(before);
    check(old.slideRev === 4, `seed ${seed}: the pinned deal is slideRev ${old.slideRev}, not 4`);
    check(same({ ...old, slideRev: 5 }, live), `seed ${seed}: slideRev 5 deals a different board from slideRev 4`);
  }
}

/* ---------------------------------------------------------------- 2. older stamps grade as before */
interface LegacyCase { era: "rev4" | "rev3"; seed: number; label: string; answer: string; msLeft: number; score: number; isCorrect: boolean; extra: unknown }
const fixture = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/pattern-overhaul-iceslide-legacy.json.gz", import.meta.url))).toString()) as {
  puzzles: { era: "rev4" | "rev3"; seed: number; puzzle: SlidePuzzleData }[];
  cases: LegacyCase[];
};
{
  check(fixture.cases.length >= 40, `the legacy fixture holds only ${fixture.cases.length} cases`);
  check(fixture.cases.some((c) => /undo|reset/.test(c.label)) && fixture.cases.some((c) => c.era === "rev3"), "the legacy fixture lacks Undo / Reset answers or slideRev 3");
  check(fixture.puzzles.every((x) => x.puzzle.slideRev === (x.era === "rev4" ? 4 : 3)), "the legacy fixture's stamps aren't slideRev 4 and 3");
  for (const { era, seed, puzzle } of fixture.puzzles) {
    const redealt = dealEra(era, seed);
    check(same(redealt, puzzle), `${era} seed ${seed}: the pinned deal changed`);
    const rebuilt = casesFor(era, seed, puzzle).map((c) => c.answer);
    const stored = fixture.cases.filter((c) => c.era === era && c.seed === seed).map((c) => c.answer);
    check(same(rebuilt, stored), `${era} seed ${seed}: the answers no longer rebuild the same`);
  }
  let diffs = 0;
  for (const c of fixture.cases) {
    const p = fixture.puzzles.find((x) => x.era === c.era && x.seed === c.seed)!.puzzle;
    const g2 = gradeAnswer(p, c.answer, c.msLeft);
    if (g2.score !== c.score || g2.isCorrect !== c.isCorrect || !same(g2.extra ?? null, c.extra)) {
      diffs++;
      if (diffs <= 5) failures.push(`${c.era} seed ${c.seed} ${c.label}: ${c.score}/${c.isCorrect} became ${g2.score}/${g2.isCorrect}`);
    }
  }
  check(diffs === 0, `${diffs} legacy cases grade differently`);
}

/* ---------------------------------------------------------------- 3. slideRev 5: Undo gives the slide back */
{
  let solvesWithUndo = 0;
  let rev4Higher = 0;
  let unfinished = 0;
  for (const { era, puzzle } of fixture.puzzles) {
    if (era !== "rev4") continue;
    const p5 = { ...puzzle, slideRev: 5 } as SlidePuzzleData;
    const board = slideBoard(puzzle);
    const line = (puzzle.solution ?? "").split("") as SlideDir[];
    const clean = gradeAnswer(p5, line.join(""), 30_000);
    check(clean.isCorrect && movesOf(clean.extra) === line.length, "slideRev 5: the clean line doesn't count its own length");
    for (const m of markerAnswers(puzzle)) {
      const r = replaySlide(board, m.answer.split("") as SlideDir[]);
      const g5 = gradeAnswer(p5, m.answer, m.msLeft);
      const g4 = gradeAnswer(puzzle, m.answer, m.msLeft);
      check(movesOf(g5.extra) === r.net, `${m.label}: slideRev 5 stores ${movesOf(g5.extra)} slides, ${r.net} stand`);
      check(movesOf(g4.extra) === r.moves, `${m.label}: slideRev 4 stores ${movesOf(g4.extra)} slides, not every slide played (${r.moves})`);
      check((g5.extra as { slidesPlayed?: number }).slidesPlayed === r.moves, `${m.label}: slideRev 5 doesn't keep every slide played on record`);
      check(!("slidesPlayed" in ((g4.extra ?? {}) as object)), `${m.label}: slideRev 4's stored extra gained slidesPlayed`);
      if (r.solved) {
        solvesWithUndo++;
        const sameTime = gradeAnswer(p5, line.join(""), m.msLeft);
        if (r.net === line.length) check(g5.score === sameTime.score, `${m.label}: slideRev 5 scores ${g5.score}, the clean line ${sameTime.score} (an undone slide still costs)`);
        if (r.moves > r.net) {
          rev4Higher++;
          check(g5.score >= g4.score, `${m.label}: slideRev 5 scores ${g5.score} below slideRev 4's ${g4.score}`);
        }
      } else {
        unfinished++;
        check(g5.score === g4.score, `${m.label}: unfinished credit changed between slideRev 4 (${g4.score}) and 5 (${g5.score})`);
      }
    }
  }
  check(solvesWithUndo >= 12, `only ${solvesWithUndo} solves with undone slides tried`);
  check(rev4Higher >= 12, `slideRev 4 counted more slides than 5 on only ${rev4Higher} of them`);
  check(unfinished >= 6, `only ${unfinished} unfinished answers with Undo / Reset tried`);
  // Wandering and undoing never earns unfinished credit (the waste rule counts every slide played).
  for (const { era, puzzle } of fixture.puzzles) {
    if (era !== "rev4") continue;
    const p5 = { ...puzzle, slideRev: 5 } as SlidePuzzleData;
    const board = slideBoard(puzzle);
    const line = (puzzle.solution ?? "").split("") as SlideDir[];
    const half = line.slice(0, Math.ceil(line.length / 2));
    const wander: string[] = [];
    let s = { cell: puzzle.start, mask: 0 };
    for (let k = 0; k < 30; k++) {
      const d = SLIDE_DIRS[k % 4]!;
      const o = slideOutcome(board, s.cell, s.mask, d);
      if (!o.path.length || o.cell === puzzle.exit) continue;
      wander.push(d);
      s = { cell: o.cell, mask: o.mask };
    }
    const plain = gradeAnswer(p5, half.join(""), 0).score;
    const padded = gradeAnswer(p5, [...wander, "Y", ...half].join(""), 0).score;
    check(padded <= plain, `slideRev 5: wandering then Reset scores ${padded}, above the plain half line's ${plain}`);
  }
  // The counts themselves; a wall bump is not a slide.
  const tiny = { type: "iceslide", walls: [], holes: [], start: 0, exit: 143 } as unknown as SlidePuzzleData;
  const tb = slideBoard(tiny);
  check(slideOutcome(tb, 0, 0, "U").path.length === 0 && slideOutcome(tb, 0, 0, "L").path.length === 0, "a slide into the edge moves the ball");
  const r = replaySlide(tb, "ULRXDY".split("") as SlideDir[]);
  check(r.moves === 2 && r.net === 0 && r.cell === 0, `replay: ${r.moves} played / ${r.net} standing at ${r.cell} (want 2 / 0 at 0)`);
  const r2 = replaySlide(tb, "RXD".split("") as SlideDir[]);
  check(r2.moves === 2 && r2.net === 1 && same(r2.standing, [r2.paths[1]]), "replay: the standing route isn't the slides left after Undo");
}

/* ---------------------------------------------------------------- 4. the stage */
{
  const stage = src("src/puzzles/iceSlide.tsx");
  check(/const slidesShown = countedSlides\(replay, overhaul\)/.test(stage) && /usesPatternNov15\(data, "iceslide"\)/.test(stage), "the stage's count isn't the standing slides on slideRev 5");
  check(/parPills\("Slides", slidesShown, par\)/.test(stage), "the stage no longer shows Slides and Par pills on the standing count");
  check(/if \(!outcome\.path\.length\) \{\s*\/\/[^\n]*\n\s*soundCue\("iceslide\.bump"\);\s*return;\s*\}/.test(stage), "a slide into a wall doesn't play the bump and stop there");
  const p5 = { ...fixture.puzzles.find((x) => x.era === "rev4")!.puzzle, slideRev: 5 };
  const html = renderToStaticMarkup(React.createElement(iceSlidePuzzle.Stage, { puzzle: p5, phaseStartedAt: 0, now: 0, locked: false, onSubmit: () => {} } as never));
  // Outside the game frame (no pills) the stage's own summary line shows the same count.
  check(/moves <span[^>]*>0<\/span>/.test(html), "the stage's summary line doesn't show the slide count");
  // oneSlideFromExit: one slide right reaches the exit on an open row; a fall or a wall doesn't.
  const open = slideBoard({ walls: [], holes: [], start: 0, exit: 11 } as never);
  check(oneSlideFromExit(open, { cell: 0, mask: 0 }), "oneSlideFromExit: an open row to the exit reads as not one slide away");
  const holed = slideBoard({ walls: [], holes: [5], start: 0, exit: 11 } as never);
  check(!oneSlideFromExit(holed, { cell: 0, mask: 0 }), "oneSlideFromExit: a slide through a hole reads as reaching the exit");
  check(!oneSlideFromExit(open, { cell: 11, mask: 0 }), "oneSlideFromExit: the exit itself reads as one slide away");
  check(/slidesShown \+ 1 <= par && oneSlideFromExit\(board, replay\)/.test(stage), "the near-exit glow isn't limited to one slide from the exit at par");
}

/* ---------------------------------------------------------------- 5. the reveal */
{
  // A 12 × 12 rink with one wall: start top left, exit top right; the ball stops at the wall otherwise.
  const base = { type: "iceslide", walls: [24], holes: [], start: 0, exit: 11, minMoves: 1, par: 1, solution: "R" } as unknown as SlidePuzzleData;
  const reveal = (puzzle: SlidePuzzleData, answer: string, correct: boolean) =>
    renderToStaticMarkup(React.createElement(iceSlidePuzzle.Reveal, { timeLimitMs: 90_000, puzzle, myAnswer: answer, myCorrect: correct, myMsRemaining: 20_000 } as never));
  const solved = "DXR"; // one slide down, undone, then the line: 1 standing, 2 played
  const h5 = reveal({ ...base, slideRev: 5 } as SlidePuzzleData, solved, true);
  check(/>Solution</.test(h5) && />Yours</.test(h5), "slideRev 5: the reveal has no Solution and Yours columns");
  check(SOLUTION_SWITCH_TYPES.has("iceslide"), "Skid isn't on the answer reveal's Solution / Yours switch");
  const yours = h5.slice(h5.indexOf("data-ice-yours="));
  const solution = h5.slice(h5.indexOf("data-ice-solution="), h5.indexOf("data-ice-yours="));
  check(/your slides: <span[^>]*>1<\/span>/.test(yours), `slideRev 5: "your slides" isn't 1 under Yours: ${yours.match(/your slides:[^·]*/)?.[0]}`);
  check(!/your slides/.test(solution), "slideRev 5: the player's count shows under Solution");
  check(/shortest route · 1 slide</.test(solution), "slideRev 5: the Solution column lost its shortest-route line");
  const u5 = reveal({ ...base, slideRev: 5 } as SlidePuzzleData, "D", false);
  const uy = u5.slice(u5.indexOf("data-ice-yours="));
  // The ball rests on its final cell (row 1, col 0 = cell 12) in the Yours board.
  const ballCell = (part: string) => {
    const cells = part.split(/class="ice-(?:tile|rock)/).slice(1);
    return cells.findIndex((c) => c.startsWith('"') && c.includes('aria-label="Ball"')) ;
  };
  check(ballCell(uy) === 12, `slideRev 5: the Yours board's ball isn't where the player left it (cell ${ballCell(uy)})`);
  const h4 = reveal({ ...base, slideRev: 4 } as SlidePuzzleData, solved, true);
  check(!/>Yours</.test(h4) && /shortest route · 1 move</.test(h4) && /2 moves/.test(h4), "slideRev 4: the reveal no longer reads as before (one board, every slide played)");
}

/* ---------------------------------------------------------------- 6. help */
{
  const how = () => PUZZLE_INSTRUCTIONS.iceslide.how.map((l) => `${l.action} ${l.detail}`).join(" | ");
  const live = how();
  check(/Undo and Reset give the slide back/.test(live), `the live help doesn't say Undo gives the slide back: ${live}`);
  check(/game menu \(⋮\)/.test(live) && /Settings → Game controls/.test(live), "the live help doesn't say where the arrow pad / swipe choice lives");
  check(/Fewest slides/.test(live), "the help lost the par line");
  const before = pinPrePatternNov15(true);
  const pinned = how();
  pinPrePatternNov15(before);
  check(!/give the slide back/.test(pinned), "the pinned help says Undo gives the slide back");
  check(PUZZLE_INSTRUCTIONS.iceslide.how.filter((l) => !l.helpOnly).length <= 4, "more than four intro HOW lines");
}

/* ---------------------------------------------------------------- 7. art */
{
  const dir = new URL("../public/pattern-art/iceslide/", import.meta.url);
  const webpInfo = (name: string) => {
    const buf = readFileSync(new URL(`${name}.webp`, dir));
    const riff = buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP";
    const chunk = buf.toString("ascii", 12, 16);
    let alpha = false;
    let w = 0;
    let h = 0;
    if (chunk === "VP8X") {
      alpha = (buf[20]! & 0x10) !== 0;
      w = 1 + (buf[24]! | (buf[25]! << 8) | (buf[26]! << 16));
      h = 1 + (buf[27]! | (buf[28]! << 8) | (buf[29]! << 16));
    } else if (chunk === "VP8L") {
      const bits = buf.readUInt32LE(21);
      w = (bits & 0x3fff) + 1;
      h = ((bits >> 14) & 0x3fff) + 1;
      alpha = ((bits >> 28) & 1) === 1;
    }
    return { riff, alpha, w, h, bytes: buf.length };
  };
  let total = 0;
  for (const n of ICE_SPRITES) {
    if (!existsSync(new URL(`${n}.webp`, dir))) {
      failures.push(`${n}.webp is missing`);
      continue;
    }
    const info = webpInfo(n);
    total += info.bytes;
    check(info.riff && info.alpha, `${n}.webp isn't a WebP with alpha`);
    check(info.bytes <= 25_000, `${n}.webp is ${info.bytes} bytes (over 25 KB)`);
    check(info.w === info.h, `${n}.webp is ${info.w}×${info.h}, not its square cell's shape`);
    check(info.w >= (n === "rink" ? 640 : 90), `${n}.webp is only ${info.w} px`);
  }
  check(total <= 400_000, `the Skid sprites total ${total} bytes (over 400 KB)`);
  const p = fixture.puzzles.find((x) => x.era === "rev4")!.puzzle;
  const board = renderToStaticMarkup(React.createElement(IceBoard, {
    walls: [1], holes: [2], arrows: (["U", "D", "L", "R"] as SlideDir[]).map((dir, i) => ({ cell: 20 + i, dir })),
    portals: [[30, 40], [50, 60]], thin: [70, 71], broken: 2, start: 0, exit: 11, ball: 5,
  }));
  for (const n of ICE_SPRITES) check(board.includes(`src="${iceSprite(n)}"`), `the board doesn't draw ${n}`);
  const stage = renderToStaticMarkup(React.createElement(iceSlidePuzzle.Stage, { puzzle: { ...p, slideRev: 5 }, phaseStartedAt: 0, now: 0, locked: false, onSubmit: () => {} } as never));
  for (const n of ["rink", "block", "ball", "exit"] as const) check(stage.includes(iceSprite(n)), `the stage doesn't draw ${n}`);
  const intro = renderToStaticMarkup(React.createElement(iceSlidePuzzle.IntroExample!));
  for (const n of ["ball", "hole", "portal-a", "thin", "arrow-D", "exit"] as const) check(intro.includes(iceSprite(n)), `the intro example doesn't draw ${n}`);
  const rev = renderToStaticMarkup(React.createElement(iceSlidePuzzle.Reveal, { timeLimitMs: 90_000, puzzle: { ...p, slideRev: 5 }, myAnswer: "", myCorrect: false, myMsRemaining: 0 } as never));
  check(rev.includes(iceSprite("rink")) && rev.includes(iceSprite("ball")), "the reveal doesn't draw the sprites");
  // No glow on the ball or round the board (the overhaul's rule).
  const css = src("src/polish-pattern/iceslide.css") + src("src/polish-batch-p/batch-p.css") + src("src/polish-layout/polish-nov3-pattern.css");
  check(!/\.ice-ball[^{]*\{[^}]*box-shadow/.test(css), "a glow rule is still on the ball");
  check(!/ice-glint|ice-sheen|ice-base-0/.test(css), "the old CSS sheet's glints and sheen are still styled");
  const rink = /\.ice-board\.ice-rink \{[^}]*\}/.exec(src("src/polish-pattern/iceslide.css"))?.[0] ?? "";
  check(rink.length > 0 && !/rgba\((?!0, 0, 0,)/.test(rink), "a coloured glow is round the board");
}

/* ---------------------------------------------------------------- 8. sound */
{
  const manifest = SOUND_MANIFEST as unknown as Record<string, { url: string | null }>;
  for (const slot of ["iceslide.slide", "iceslide.slideLong", "iceslide.stop", "iceslide.bump", "iceslide.nearExit", "iceslide.portal", "iceslide.crack", "iceslide.fall", "iceslide.solve"]) {
    const e = manifest[slot];
    check(!!e, `${slot}: no manifest slot`);
    if (e?.url) check(existsSync(new URL(`../public${e.url}`, import.meta.url)), `${slot}: ${e.url} has no file`);
  }
  for (const slot of ["iceslide.stop", "iceslide.bump", "iceslide.nearExit"]) check(!!manifest[slot]?.url, `${slot}: no stand-in file`);
  const stage = src("src/puzzles/iceSlide.tsx") + src("src/components/puzzles/pattern/iceSlideBoard.tsx");
  for (const cue of ["iceslide.slide", "iceslide.slideLong", "iceslide.stop", "iceslide.bump", "iceslide.nearExit", "iceslide.portal", "iceslide.crack", "iceslide.fall", "iceslide.solve"])
    check(stage.includes(`"${cue}"`), `the stage never fires ${cue}`);
  check(/if \(stops\) soundCue\("iceslide\.stop"\)/.test(stage) && /const stops = !outcome\.fell && outcome\.cell !== board\.exit/.test(stage), "the stop's thump isn't limited to a ball coming to rest");
  const doc = src("docs/sound-cues/pattern-elevenlabs.md");
  const section = doc.slice(doc.indexOf("<!-- skid:start -->"), doc.indexOf("<!-- skid:end -->"));
  for (const slot of ["iceslide.slide", "iceslide.slideLong", "iceslide.stop", "iceslide.bump", "iceslide.nearExit", "iceslide.crack", "iceslide.portal", "iceslide.fall", "iceslide.solve"])
    check(section.includes(`\`${slot}\``), `pattern-elevenlabs.md's Skid section doesn't list ${slot}`);
  const cues = src("docs/sound-cues/pattern.md");
  for (const slot of ["iceslide.slideLong", "iceslide.stop", "iceslide.bump", "iceslide.nearExit"]) check(cues.includes(`\`${slot}\``), `docs/sound-cues/pattern.md doesn't list ${slot}`);
}

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`pattern-overhaul-iceslide-check: ${failures.length} failure(s), ${passes} passed`);
  process.exit(1);
}
console.log(`pattern-overhaul-iceslide-check: all ${passes} assertions pass`);
