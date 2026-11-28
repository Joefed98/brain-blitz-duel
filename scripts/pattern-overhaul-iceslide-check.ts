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
 *  9. The effects (stage 2, iceSlideFx.ts on the effects kit): the bump's 3 px nudge toward the wall, the stop's settle
 *     (the kit's drop, silent), thin ice cracking open, both portal ends flaring, the ball spinning down a hole, the
 *     exit's near miss one slide away at par (the kit's), each on its piece's own art and only on its moment (none on
 *     the first draw, Undo, a fall or the exit); the next slide is taken during an effect; reduced motion a 120 ms
 *     crossfade; transform and opacity only; the kit's silent win on a solved reveal's result card.
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
  // Changed with Joe's approval, 15 Nov 2026 (routine consequence of the Pattern overhaul): stage 2 adds the bump's
  // nudge on the ball's art (a second comment line and setBallFx) between the sound and the return.
  check(/if \(!outcome\.path\.length\) \{\s*(?:\/\/[^\n]*\n\s*)+soundCue\("iceslide\.bump"\);\s*setBallFx\(\{ kind: "bump", dir, key: \+\+ballFxKey\.current \}\);\s*return;\s*\}/.test(stage), "a slide into a wall doesn't play the bump and stop there");
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
  // The reveal redesign (Joe, 15 Nov 2026): two labelled columns (the switch shows one large board at a time), the par
  // route as arrow chips, the player's own final board with a red ring where the ball fell, the numbers from the
  // stored grade as pills; the same layout reads every stamp's stored figures.
  const base = { type: "iceslide", walls: [24], holes: [], start: 0, exit: 11, minMoves: 1, par: 1, solution: "R" } as unknown as SlidePuzzleData;
  const reveal = (puzzle: SlidePuzzleData, answer: string, correct: boolean, extra?: unknown, msLeft = 20_000) =>
    renderToStaticMarkup(React.createElement(iceSlidePuzzle.Reveal, { timeLimitMs: 90_000, puzzle, myAnswer: answer, myCorrect: correct, myMsRemaining: msLeft, myExtra: extra ?? null } as never));
  const split = (html: string) => ({
    solution: html.slice(html.indexOf("data-ice-solution="), html.indexOf("data-ice-yours=")),
    yours: html.slice(html.indexOf("data-ice-yours=")),
  });
  const pill = (html: string, id: string) => new RegExp(`(?<=data-hud-pill="${id}">)[\\s\\S]*?</b></span>`).exec(html)?.[0] ?? "";
  const pillValue = (html: string, id: string) => {
    const m = pill(html, id).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return m;
  };
  check(SOLUTION_SWITCH_TYPES.has("iceslide"), "Skid isn't on the answer reveal's Solution / Yours switch");
  const solved = "DXR"; // one slide down, undone, then the line: 1 standing, 2 played
  for (const rev of [5, 4]) {
    const h = reveal({ ...base, slideRev: rev } as SlidePuzzleData, solved, true);
    const { solution, yours } = split(h);
    check(/>Solution</.test(h) && />Yours</.test(h), `slideRev ${rev}: the reveal has no Solution and Yours columns`);
    check((h.match(/data-reveal-board=""/g) ?? []).length === 2, `slideRev ${rev}: each column isn't its own reveal-fit board`);
    check(/Shortest route · 1 slide</.test(solution) && /data-ice-chips="solution"/.test(solution), `slideRev ${rev}: the Solution column lost its route line or its arrow chips`);
    check(!/data-hud-pill="you"/.test(solution) && !/Your slides/.test(solution), `slideRev ${rev}: the player's count shows under Solution`);
    check(/data-ice-chips="yours"/.test(yours) && /data-ice-chips="yours-par"/.test(yours), `slideRev ${rev}: Yours lacks the slides-vs-par arrow chips`);
    check(!/×/.test(h), `slideRev ${rev}: a stray "×" in the reveal`);
    // With no stored grade the phone's replay stands in: rev 5 counts the slide standing, older stamps every slide.
    check(pillValue(yours, "you") === `You ${rev >= 5 ? 1 : 2}`, `slideRev ${rev}: the You pill reads "${pillValue(yours, "you")}"`);
    check(pillValue(yours, "par") === "Par 1", `slideRev ${rev}: the Par pill reads "${pillValue(yours, "par")}"`);
    check(pillValue(yours, "time") === "Time left 20 s", `slideRev ${rev}: a solve's Time left pill reads "${pillValue(yours, "time")}"`);
    check((yours.match(/class="ice-art ice-chip"/g) ?? []).length === 2, `slideRev ${rev}: the chips aren't your standing slide and the par route's`);
  }
  // Unfinished: the ball where the player left it, the slides standing on the board.
  const ballCell = (part: string) => {
    const cells = part.split(/class="ice-(?:tile|rock)/).slice(1);
    return cells.findIndex((c) => c.startsWith('"') && c.includes('aria-label="Ball"'));
  };
  const u5 = split(reveal({ ...base, slideRev: 5 } as SlidePuzzleData, "D", false)).yours;
  check(ballCell(u5) === 12, `slideRev 5: the Yours board's ball isn't where the player left it (cell ${ballCell(u5)})`);
  check(!/data-hud-pill="time"/.test(u5), "an unfinished reveal shows Time left");
  // A fall: ringed red on the Yours board only, with its key, and the Falls pill.
  const holed = { ...base, walls: [], holes: [24], slideRev: 5 } as unknown as SlidePuzzleData;
  const f = split(reveal(holed, "D", false));
  check(/data-reveal-fell="24"/.test(f.yours) && /where you fell/.test(f.yours), "a fall isn't ringed on the Yours board with its key");
  check(!/data-reveal-fell/.test(f.solution), "the solution board shows a fall ring");
  check(pillValue(f.yours, "falls") === "Fall 1", `the Falls pill reads "${pillValue(f.yours, "falls")}"`);
  const clean = split(reveal({ ...base, slideRev: 5 } as SlidePuzzleData, "R", true)).yours;
  check(!/data-reveal-fell/.test(clean) && !/where you fell/.test(clean) && !/data-hud-pill="falls"/.test(clean), "a clean run shows a fall mark");
  // The key numbers are the stored grade's: real deals graded through the server, on the new stamp and the old.
  let compared = 0;
  for (const { era, puzzle } of fixture.puzzles) {
    for (const p of era === "rev4" ? [{ ...puzzle, slideRev: 5 } as SlidePuzzleData, puzzle] : [puzzle]) {
      for (const m of markerAnswers(puzzle).slice(0, 4)) {
        const graded = gradeAnswer(p, m.answer, m.msLeft);
        const extra = graded.extra as { moves?: number; falls?: number; movesFromExit?: number | null };
        const y = split(reveal(p, m.answer, graded.isCorrect, extra, m.msLeft)).yours;
        compared++;
        check(pillValue(y, "you") === `You ${extra.moves}`, `${era} ${m.label}: You pill "${pillValue(y, "you")}", stored ${extra.moves}`);
        check(pillValue(y, "par") === `Par ${p.minMoves}`, `${era} ${m.label}: Par pill "${pillValue(y, "par")}", stored ${p.minMoves}`);
        if ((extra.falls ?? 0) > 0) check(pillValue(y, "falls").endsWith(` ${extra.falls}`), `${era} ${m.label}: Falls pill isn't the stored ${extra.falls}`);
        if (!graded.isCorrect && typeof extra.movesFromExit === "number")
          check(pillValue(y, "away").startsWith(`From the exit ${extra.movesFromExit} slide`), `${era} ${m.label}: From the exit pill "${pillValue(y, "away")}", stored ${extra.movesFromExit}`);
      }
    }
  }
  check(compared >= 40, `only ${compared} stored grades compared with the reveal`);
  // The reveal's styles keep one board at a time large under the switch.
  const css = src("src/polish-pattern/iceslide.css");
  check(/\[data-solution-view\] \.ice-reveal-board \{ width: min\(100cqw, 380px\); \}/.test(css), "the switched reveal board isn't drawn the row's width");
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
  // Joe's additions (15 Nov 2026): the pad's arrows named apart from the chevron tiles; the intro example says the same.
  check(/Swipe or tap an arrow/.test(live) && /Chevron tiles turn you/.test(live) && /holes send you back to the start/.test(live), `the live help doesn't name the arrow pad and the chevron tiles: ${live}`);
  check(/Arrows turn you;/.test(pinned) && !/Chevron tiles/.test(pinned), "the pinned help changed its older lines");
  const example = renderToStaticMarkup(React.createElement(iceSlidePuzzle.IntroExample!));
  check(/Swipe or tap an arrow/.test(example) && /Undo gives a slide back/.test(example) && /par slides/.test(example), "the intro example's text doesn't describe the new play");
  check(/data\.type === "iceslide" && demo\?\.puzzle\.type === "iceslide" && \(demo\.puzzle\.slideRev \?\? 0\) < 5\) return null/.test(src("src/lib/duel/introDemo.functions.ts")), "an intro demo recorded before slideRev 5 isn't stopped");
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
    // Changed with Joe's approval, 15 Nov 2026 (routine consequence of the Pattern overhaul): the richness pass gives
    // the rink (the whole 12 × 12 sheet, not a piece) real depth, scratches and bubbles, so it has its own 120 KB
    // budget; every piece keeps 25 KB and the game its 400 KB total.
    const limit = n === "rink" ? 120_000 : 25_000;
    check(info.bytes <= limit, `${n}.webp is ${info.bytes} bytes (over ${limit / 1000} KB)`);
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

/* ---------------------------------------------------------------- 9. the effects (stage 2) */
{
  // Real timers and React's own scheduling (the slide's steps are timers: an act scope would fold them into one render).
  (g as Record<string, unknown>)["IS_REACT_ACT_ENVIRONMENT"] = false;
  // The page's own events (Bun's globals are another realm's: happy-dom refuses them).
  g["CustomEvent"] = (win as unknown as Record<string, unknown>)["CustomEvent"];
  g["Event"] = (win as unknown as Record<string, unknown>)["Event"];
  for (const key of ["PointerEvent", "MouseEvent", "KeyboardEvent", "requestAnimationFrame", "cancelAnimationFrame", "localStorage", "matchMedia"]) {
    if (g[key] === undefined) g[key] = (win as unknown as Record<string, unknown>)[key];
  }
  const { createRoot } = await import("react-dom/client");
  const { forceGameFxVariant, setGameFxSink } = await import("../src/lib/fx/kit");
  const { ICE_FX_MAX_MS } = await import("../src/components/puzzles/pattern/iceSlideFx");
  const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

  // Every animation started, recorded (happy-dom has no Web Animations engine).
  type Rec = { el: Element; frames: Keyframe[]; options: KeyframeAnimationOptions };
  const recs: Rec[] = [];
  const proto = (win as unknown as { HTMLElement: { prototype: Record<string, unknown> } }).HTMLElement.prototype;
  const realAnimate = proto["animate"];
  proto["animate"] = function (this: Element, frames: Keyframe[], options: KeyframeAnimationOptions) {
    recs.push({ el: this, frames, options: typeof options === "number" ? { duration: options } : options });
    return { cancel() {}, addEventListener() {}, finished: Promise.resolve(), onfinish: null };
  };
  proto["setPointerCapture"] ??= () => {};
  proto["hasPointerCapture"] ??= () => false;
  proto["releasePointerCapture"] ??= () => {};
  const kit: { kind: string; variant: string; sound: string | null }[] = [];
  setGameFxSink((r) => kit.push({ kind: r.kind, variant: r.variant, sound: r.sound?.slot ?? null }));
  const cues: string[] = [];
  win.addEventListener("duelz-sound", (e) => cues.push(String((e as unknown as CustomEvent).detail?.cue)));
  const allowed = new Set(["transform", "opacity", "offset", "easing", "composite"]);
  const onlyTransformOpacity = () => recs.every((r) => r.frames.every((f) => Object.keys(f).every((k) => allowed.has(k))));
  const isArt = (r: Rec, sel: string) => (r.el as Element).matches?.(sel);

  // A hand-made 12 × 12 rink: the ball at 13 with a block at 12 (Left bumps), thin ice at 15 and a portal 17 ↔ 41 on
  // the way right (it ends at 47), the exit at 59 one slide below (par 2), a hole at 37 below the start.
  const puzzle = {
    ...fixture.puzzles.find((x) => x.era === "rev4")!.puzzle,
    slideRev: 5,
    walls: [12],
    holes: [37],
    arrows: [],
    thin: [15],
    portals: [[17, 41]],
    gems: [],
    start: 13,
    exit: 59,
    par: 2,
    minMoves: 2,
  } as unknown as SlidePuzzleData;
  const drafts: string[] = [];
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host as unknown as Element);
  const mount = async (key: string) => {
    {
      root.render(
        React.createElement(iceSlidePuzzle.Stage, {
          key,
          puzzle,
          phaseStartedAt: 0,
          now: 0,
          locked: false,
          onSubmit: () => {},
          onDraftAnswer: (a: string) => drafts.push(a),
          stateKey: `fx-${key}`,
        } as never),
      );
    }
    await sleep(60);
  };
  const press = (label: string) => {
    const named = [...host.querySelectorAll("button")].find((b) => !b.getAttribute("aria-label") && b.textContent?.trim() === label);
    if (named) return void (named as unknown as { click(): void }).click();
    const btn = host.querySelector(`button[aria-label="${label}"]`);
    if (!btn) throw new Error(`no ${label} button`);
    btn?.dispatchEvent(new win.PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }) as unknown as Event);
    btn?.dispatchEvent(new win.PointerEvent("pointerup", { bubbles: true, pointerId: 1 }) as unknown as Event);
  };
  const clear = () => {
    recs.length = 0;
    kit.length = 0;
    cues.length = 0;
  };
  forceGameFxVariant("full");
  await mount("a");
  check(recs.length === 0 && kit.length === 0, `fx: the first draw plays an effect (${recs.length}, ${JSON.stringify(kit)})`);

  // A slide straight into the block: the dull tap and a 3 px nudge toward it on the ball's own art; then Up at once,
  // while the nudge still runs, is taken (a real slide).
  clear();
  press("Left");
  await sleep(30);
  // The next slide while the nudge still runs (it lasts 150 ms).
  press("Up");
  await sleep(20);
  const bump = recs.find((r) => isArt(r, ".ice-ball > .ice-art"));
  check(cues[0] === "iceslide.bump" && !!bump, `fx: a slide into a wall isn't the bump (${cues}, ${recs.length})`);
  check(!!bump && JSON.stringify(bump.frames.map((f) => f.transform)) === JSON.stringify(["translate(0, 0)", "translate(-3px, 0px)", "translate(0, 0)"]), `fx: the bump isn't a 3 px nudge toward the wall (${JSON.stringify(bump?.frames)})`);
  check(drafts.at(-1) === "U" && cues.includes("iceslide.slide"), `fx: the next slide during the bump wasn't taken (${drafts.at(-1)}, ${cues})`);
  // The slide ends against the top edge: the thump and the kit's drop on the ball's art, silent (its own slot plays).
  await sleep(500);
  check(cues.includes("iceslide.stop") && kit.some((k) => k.kind === "drop" && k.variant === "full" && k.sound === null), `fx: the stop isn't the kit's silent drop with the thump (${JSON.stringify(kit)}, ${cues})`);
  check(recs.some((r) => isArt(r, ".ice-ball > .ice-art") && String(r.frames[0]!.transform).includes("translateY(-8px)")), "fx: the settle isn't on the ball's art");
  // Undo gives the slide back: no settle, no bump, no sound of a slide.
  clear();
  press("Undo");
  await sleep(50);
  check(drafts.at(-1) === "UX", `fx: Undo wasn't taken (${drafts.at(-1)})`);
  check(kit.length === 0 && recs.length === 0 && !cues.some((c) => c.startsWith("iceslide.")), `fx: Undo plays an effect (${JSON.stringify(kit)}, ${cues})`);

  // Right: the thin ice cracks open, both ends of the portal flare, the ball settles at 47, one slide from the exit at par.
  clear();
  press("Right");
  await sleep(1200);
  check(cues.includes("iceslide.crack") && recs.some((r) => isArt(r, ".ice-broken > .ice-art") && String(r.frames[0]!.transform).startsWith("scale(0.35)")), `fx: thin ice doesn't crack open on its art (${cues})`);
  const flares = recs.filter((r) => isArt(r, ".ice-portal > .ice-art"));
  const glows = recs.filter((r) => isArt(r, ".ice-portal-glow"));
  check(cues.includes("iceslide.portal") && flares.length === 2 && glows.length === 2, `fx: the portal doesn't flare at both ends (${flares.length}, ${glows.length})`);
  check(kit.some((k) => k.kind === "drop") && cues.includes("iceslide.stop"), "fx: the slide's stop doesn't settle");
  check(cues.includes("iceslide.nearExit") && kit.some((k) => k.kind === "nearMiss" && k.sound === null) && recs.some((r) => isArt(r, ".ice-exit > .ice-art")), `fx: one slide from the exit at par isn't the kit's near miss on the exit (${JSON.stringify(kit)})`);
  // Down onto the exit: no settle (the exit shatters as before).
  clear();
  press("Down");
  await sleep(600);
  check(!kit.some((k) => k.kind === "drop") && !cues.includes("iceslide.stop") && cues.includes("iceslide.solve"), `fx: the exit plays the stop's settle, or no shatter (${JSON.stringify(kit)}, ${cues})`);

  // A fresh rink: Down from the start into the hole spins the ball down; no settle.
  await mount("b");
  clear();
  press("Down");
  await sleep(700);
  const fall = recs.find((r) => isArt(r, ".ice-fall"));
  check(cues.includes("iceslide.fall") && !!fall && String(fall.frames.at(-1)!.transform).includes("rotate(160deg)") && fall.frames.at(-1)!.opacity === 0, `fx: the hole doesn't spin the ball down (${cues})`);
  check(!kit.some((k) => k.kind === "drop") && !cues.includes("iceslide.stop"), "fx: a fall settles");
  check(recs.every((r) => Number(r.options.duration ?? 0) <= Math.max(ICE_FX_MAX_MS, 900)), "fx: an effect runs longer than 900 ms");
  check(onlyTransformOpacity(), "fx: an effect animates something other than transform and opacity");
  check(!recs.some((r) => (r.el as Element).tagName === "BUTTON" || (r.el as Element).matches?.("[data-game-arena], [data-game-stage], .ice-board, .ice-board-grid, .ice-tile, .ice-stage-square")), "fx: an effect moves a control, the board, a cell or the arena");

  // Reduced motion: every change a 120 ms crossfade, no movement.
  forceGameFxVariant("reduced");
  await mount("c");
  clear();
  press("Left");
  press("Right");
  await sleep(1200);
  await mount("d");
  press("Down");
  await sleep(700);
  // 120 ms each (the kit's near miss keeps its own 160 ms reduced flicker).
  const nearMissReduced = (r: Rec) => r.frames[0]!.opacity === 0.6 && isArt(r, ".ice-exit > .ice-art");
  check(recs.length >= 5 && recs.every((r) => r.frames.every((f) => f.transform === undefined) && Number(r.options.duration) <= (nearMissReduced(r) ? 160 : 120)), `fx: reduced motion still moves something, or longer than 120 ms (${JSON.stringify(recs.map((r) => [r.frames, r.options.duration]))})`);
  check(kit.some((k) => k.kind === "drop" && k.variant === "reduced") && kit.some((k) => k.kind === "nearMiss" && k.variant === "reduced"), `fx: the reduced settle and near miss aren't the kit's (${JSON.stringify(kit)})`);
  check(recs.some((r) => isArt(r, ".ice-fall")) && recs.some((r) => isArt(r, ".ice-broken > .ice-art")) && recs.some((r) => isArt(r, ".ice-portal > .ice-art")), "fx: reduced motion doesn't show the fall, the crack or the portal");
  root.unmount();

  // The reveal: a solve calls the template's win (onWin) once; never on an unfinished one. // Changed with Joe's approval, 27 Nov 2026
  forceGameFxVariant("full");
  const card = document.createElement("div");
  card.className = "answer-reveal-content";
  card.innerHTML = '<div data-verdict-row=""></div><div class="x"></div>';
  document.body.appendChild(card);
  const rroot = createRoot(card.querySelector(".x") as unknown as Element);
  const p5 = { ...fixture.puzzles.find((x) => x.era === "rev4")!.puzzle, slideRev: 5 };
  let wins = 0; // Changed with Joe's approval, 27 Nov 2026
  clear();
  rroot.render(React.createElement(iceSlidePuzzle.Reveal, { puzzle: p5, myAnswer: "", myCorrect: false, myMsRemaining: 0, myExtra: null, onWin: () => wins++ } as never)); // Changed with Joe's approval, 27 Nov 2026
  await sleep(60);
  check(wins === 0 && !kit.some((k) => k.kind === "win"), "fx: an unfinished reveal plays the win"); // Changed with Joe's approval, 27 Nov 2026
  rroot.render(React.createElement(iceSlidePuzzle.Reveal, { puzzle: p5, myAnswer: "", myCorrect: true, myMsRemaining: 30_000, myExtra: null, onWin: () => wins++ } as never)); // Changed with Joe's approval, 27 Nov 2026
  await sleep(60);
  check(wins === 1 && !kit.some((k) => k.kind === "win"), `fx: the solved reveal doesn't call the template's win once (${wins})`); // Changed with Joe's approval, 27 Nov 2026
  rroot.unmount();

  forceGameFxVariant(null);
  setGameFxSink(null);
  proto["animate"] = realAnimate;

  // Only iceSlideFx.ts (and the kit) start animations; the CSS animates transform and opacity only.
  for (const file of ["src/puzzles/iceSlide.tsx", "src/components/puzzles/pattern/iceSlideBoard.tsx"]) check(!/\.animate\(/.test(src(file)), `fx: ${file} animates outside iceSlideFx.ts`);
  const fxSrc = src("src/components/puzzles/pattern/iceSlideFx.ts");
  check(/from "@\/lib\/fx\/kit"/.test(fxSrc) && /gameFx\("drop"/.test(fxSrc) && /gameFx\("nearMiss"/.test(fxSrc), "fx: the settle and the near miss aren't the kit's");
  const css = src("src/polish-pattern/iceslide.css");
  for (const [, name, body] of css.matchAll(/@keyframes ([\w-]+) \{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)) {
    const props = [...body!.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    check(props.every((p) => p === "transform" || p === "opacity"), `fx: keyframes ${name} animate ${props.join(", ")}`);
  }
  check(!/ice-near-exit|ice-portal-flare|ice-break-open|@keyframes ice-fall/.test(css), "fx: the old CSS effects (filter animations) are still there");
}

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`pattern-overhaul-iceslide-check: ${failures.length} failure(s), ${passes} passed`);
  process.exit(1);
}
console.log(`pattern-overhaul-iceslide-check: all ${passes} assertions pass`);
