/**
 * pattern-overhaul-unblock-check (15 Nov 2026, the Pattern overhaul, stage 1, Gridlock): one assertion per change.
 *
 *  1. Deals: rooms and practice deal unblockRev 4; `pinPrePatternNov15(true)` deals unblockRev 3.
 *  2. Older stamps grade exactly as before: every case in scripts/fixtures/pattern-overhaul-unblock-legacy.json.gz
 *     (unblockRev 3 and 2, kit levels, spam and hand-made Undo / Reset answers, recorded before the change by
 *     scripts/pattern-overhaul-unblock-record.ts) regrades to the same score, verdict and stored extra.
 *  3. unblockRev 4: Undo and Reset give the move back. A solve with undone slides counts only the slides left on the
 *     board (the stored moves and the par bonus equal the clean line's); the same answers on unblockRev 3 count every
 *     slide; unfinished credit is unchanged between the two stamps.
 *  4. The stage's Moves pill counts the board's slides on unblockRev 4.
 *  5. The reveal (Joe's reveal brief): the shortest solution large with the par route as move chips, the player's own
 *     final board under Yours (the gold car's blockers outlined on an unfinished one), the key numbers (Par, your moves
 *     and time left, from the stored grade) as pills, the player's own only under Yours; older stamps take the look and
 *     read their own counts.
 *  6. Help: the live help says Undo gives the move back (no "gold mark"); the pinned help keeps the old line.
 *  7. Art: every sprite exists as WebP with alpha, its size within budget and its shape its vehicle box's; the stage,
 *     the board (intro and reveal) and the lot draw them.
 *  8. Sound: unblock.slideLong, unblock.blocked and unblock.laneClear are manifest slots with a file, fired by the stage
 *     (the lane-cleared glint only when a move opens the gold car's lane short of the solve), and listed with the
 *     other Gridlock lines in docs/sound-cues/pattern-elevenlabs.md.
 *
 *   bun scripts/pattern-overhaul-unblock-check.ts
 */
import { existsSync, readFileSync, statSync } from "node:fs";
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
const { decodeMoves, encodeMoves, replayUnblock, applyMove } = await import("../src/lib/duel/unblock");
const { unblockPuzzle, laneBlockers } = await import("../src/puzzles/unblock");
const { UnblockBoard, UnblockPuzzle, goldLaneClear } = await import("../src/components/puzzles/UnblockPuzzle");
const { UNBLOCK_BODIES, unblockCarSprite, UNBLOCK_LOT_SPRITE } = await import("../src/components/puzzles/pattern/unblockArt");
const { SOUND_MANIFEST } = await import("../src/lib/fx/manifest");
const { casesFor, dealEra, markerAnswers } = await import("./pattern-overhaul-unblock-record");
type UnblockPuzzleData = import("../src/lib/duel/types").UnblockPuzzleData;
type UnblockVehicle = import("../src/lib/duel/types").UnblockVehicle;

const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else failures.push(message);
};
const src = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/* ---------------------------------------------------------------- 1. deals */
{
  for (const seed of [11, 4242, 90210]) {
    const live = withSeededRandom(seed, () => generatePuzzle("unblock", { bankSeed: seed })) as UnblockPuzzleData;
    check(live.unblockRev === 4, `seed ${seed}: the live deal is unblockRev ${live.unblockRev}, not 4`);
    const before = pinPrePatternNov15(true);
    const old = withSeededRandom(seed, () => generatePuzzle("unblock", { bankSeed: seed })) as UnblockPuzzleData;
    pinPrePatternNov15(before);
    check(old.unblockRev === 3, `seed ${seed}: the pinned deal is unblockRev ${old.unblockRev}, not 3`);
    check(same({ ...old, unblockRev: 4 }, live), `seed ${seed}: unblockRev 4 deals a different board from unblockRev 3`);
  }
}

/* ---------------------------------------------------------------- 2. older stamps grade as before */
interface LegacyCase { era: "rev3" | "rev2"; seed: number; label: string; answer: string; msLeft: number; score: number; isCorrect: boolean; extra: unknown }
const fixture = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/pattern-overhaul-unblock-legacy.json.gz", import.meta.url))).toString()) as {
  puzzles: { era: "rev3" | "rev2"; seed: number; puzzle: UnblockPuzzleData }[];
  cases: LegacyCase[];
};
{
  check(fixture.cases.length >= 40, `the legacy fixture holds only ${fixture.cases.length} cases`);
  check(fixture.cases.some((c) => /undo|reset/.test(c.label)) && fixture.cases.some((c) => c.era === "rev2"), "the legacy fixture lacks Undo / Reset answers or unblockRev 2");
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

/* ---------------------------------------------------------------- 3. unblockRev 4: Undo gives the move back */
{
  let solvesWithUndo = 0;
  let rev3Higher = 0;
  for (const { era, puzzle } of fixture.puzzles) {
    if (era !== "rev3") continue;
    const p4 = { ...puzzle, unblockRev: 4 } as UnblockPuzzleData;
    const line = decodeMoves(puzzle.solution ?? "");
    const clean = gradeAnswer(p4, encodeMoves(line), 30_000);
    check(clean.isCorrect && (clean.extra as { moves?: number }).moves === line.length, "unblockRev 4: the clean line doesn't count its own length");
    for (const m of markerAnswers(puzzle)) {
      const r = replayUnblock(puzzle.vehicles, decodeMoves(m.answer));
      const g4 = gradeAnswer(p4, m.answer, m.msLeft);
      const g3 = gradeAnswer(puzzle, m.answer, m.msLeft);
      const moves4 = (g4.extra as { moves?: number }).moves;
      const moves3 = (g3.extra as { moves?: number }).moves;
      check(moves4 === r.net, `${m.label}: unblockRev 4 stores ${moves4} moves, the board holds ${r.net}`);
      check(moves3 === r.moves, `${m.label}: unblockRev 3 stores ${moves3} moves, not every slide played (${r.moves})`);
      if (r.solved) {
        solvesWithUndo++;
        const sameTime = gradeAnswer(p4, encodeMoves(line), m.msLeft);
        if (r.net === line.length) check(g4.score === sameTime.score, `${m.label}: unblockRev 4 scores ${g4.score}, the clean line ${sameTime.score} (an undone slide still costs)`);
        if (moves3! > moves4!) rev3Higher++;
      } else {
        check(g4.score === g3.score, `${m.label}: unfinished credit changed between unblockRev 3 (${g3.score}) and 4 (${g4.score})`);
      }
    }
  }
  check(solvesWithUndo >= 12, `only ${solvesWithUndo} solves with undone slides tried`);
  check(rev3Higher >= 12, `unblockRev 3 counted more moves than 4 on only ${rev3Higher} of them`);
  // The net count itself.
  const vs: UnblockVehicle[] = [{ id: 0, axis: "h", len: 2, row: 2, col: 0 }];
  const r = replayUnblock(vs, decodeMoves("0:3,-1:0,0:2,-2:0,0:5"));
  check(r.solved && r.moves === 3 && r.net === 1, `replay counts ${r.moves} played / ${r.net} on the board`);
}

/* ---------------------------------------------------------------- 4. the stage's Moves pill */
{
  const stage = src("src/components/puzzles/UnblockPuzzle.tsx");
  check(/usesPatternNov15\(puzzle, "unblock"\) \? history\.length :/.test(stage), "the stage's Moves count isn't the board's slides on unblockRev 4");
  const p4 = fixture.puzzles.find((x) => x.era === "rev3")!.puzzle;
  const html = renderToStaticMarkup(React.createElement(UnblockPuzzle, { puzzle: { ...p4, unblockRev: 4 }, phaseStartedAt: 0, now: 0, locked: false, onSubmit: () => {} }));
  check(/moves/i.test(html), "the stage no longer shows the moves count");
  check(/parPills\("Moves", moveCount, puzzle.par!\)/.test(stage), "the stage no longer shows Moves and Par pills");
}

/* ---------------------------------------------------------------- 5. the reveal */
{
  // A small board: the gold car in row 2, car 1 (vertical) across its lane, car 2 (horizontal) elsewhere.
  const vs: UnblockVehicle[] = [
    { id: 0, axis: "h", len: 2, row: 2, col: 0 },
    { id: 1, axis: "v", len: 2, row: 1, col: 3 },
    { id: 2, axis: "h", len: 3, row: 5, col: 0 },
  ];
  const base = { type: "unblock", vehicles: vs, minMoves: 2, par: 2, solution: "1:3,0:5" } as unknown as UnblockPuzzleData;
  const reveal = (puzzle: UnblockPuzzleData, answer: string | null, correct: boolean, myExtra?: Record<string, unknown>) =>
    renderToStaticMarkup(React.createElement(unblockPuzzle.Reveal, { timeLimitMs: 60_000, puzzle, myAnswer: answer, myCorrect: correct, myMsRemaining: 20_400, myExtra } as never));
  const graded = (puzzle: UnblockPuzzleData, answer: string) => gradeAnswer(puzzle, answer, 20_400).extra as Record<string, unknown>;
  const solvedAnswer = "1:4,-1:0,1:3,0:5"; // a slide undone, then the line: 2 on the board, 3 played
  const stuck = "2:2"; // only car 2 moved: car 1 still in the gold car's lane
  const p4 = { ...base, unblockRev: 4 } as UnblockPuzzleData;
  const p3 = { ...base, unblockRev: 3 } as UnblockPuzzleData;
  const yoursOf = (html: string) => html.slice(html.indexOf("data-unblock-yours=\"\""));
  const solutionOf = (html: string) => html.slice(html.indexOf("data-unblock-solution"), html.indexOf("data-unblock-yours=\"\""));
  const key = (html: string, k: string) => html.match(new RegExp(`data-unblock-key="${k}"[^>]*>([^<]*)<span class="unblock-key-value">([^<]*)</span>`));

  // Solved, the new stamp: the key numbers are the stored grade's (moves 2, par 2) and the time left.
  const e4 = graded(p4, solvedAnswer);
  const h4 = reveal(p4, solvedAnswer, true, e4);
  check(e4["moves"] === 2, `unblockRev 4: the grade stores ${String(e4["moves"])} moves, not 2`);
  check(key(h4, "you")?.[2] === String(e4["moves"]) && /data-unblock-key="you"[^>]*data-yours-only/.test(h4), `unblockRev 4: the "your moves" pill isn't the stored ${String(e4["moves"])} under Yours only`);
  check(key(h4, "par")?.[1]?.trim() === "Par" && key(h4, "par")?.[2] === "2" && !/data-unblock-key="par"[^>]*data-yours-only/.test(h4), "the Par pill is missing or hidden under Solution");
  check(key(h4, "time")?.[2] === "20 s" && /data-unblock-key="time"[^>]*data-yours-only/.test(h4), "a solve's time left isn't a Yours pill (20 s)");
  check(/your moves: <span[^>]*>2<\/span>/.test(h4), "the pill no longer reads \"your moves: n\"");
  // The pair: both boards the same full-size board (one shown at a time by the switch), the solution side holding
  // nothing marked Yours-only (so it is never drawn half size beside a hidden Yours line).
  check(/data-unblock-solution/.test(h4) && /data-unblock-yours=""/.test(h4), "the solved reveal isn't a Solution / Yours pair");
  check(!/data-yours-only/.test(solutionOf(h4)), "the Solution side holds a Yours-only line");
  check((h4.match(/class="unblock-reveal-board"/g) ?? []).length === 2, "the two boards don't share the one full-size board box");
  check(/>Solution</.test(h4) && />Yours</.test(h4), "the Solution / Yours labels are missing");
  // The par route: one chip a move with the car's own sprite and its way.
  const route = h4.match(/data-unblock-route="(\d+)"/);
  check(route?.[1] === "2", `the route strip has ${route?.[1]} chips, not the solution's 2`);
  check(solutionOf(h4).includes('class="unblock-route"') && !yoursOf(h4).includes('class="unblock-route"'), "the route strip isn't under the Solution");
  check(/unblock-route-car--v[^>]*|src="\/pattern-art\/unblock\/blue-2v\.webp"/.test(h4) && h4.includes('src="/pattern-art/unblock/gold-2h.webp"'), "the route chips don't draw the cars' sprites");
  check(/↓2/.test(h4) && /→5/.test(h4), "the route chips don't show the way and the bays (car 1 ↓2, the gold car →5)");
  check(!/data-unblock-blocker/.test(h4), "a solved board is marked with blockers");
  check(!h4.includes("×"), "a stray × in the reveal");

  // Unfinished, the new stamp: the player's own board under Yours, the car still in the lane outlined.
  const eS = graded(p4, stuck);
  const hS = reveal(p4, stuck, false, eS);
  check(/data-unblock-yours-board="unfinished"/.test(hS), "an unfinished player's board isn't the Yours side");
  check(/data-unblock-blocker="1"/.test(yoursOf(hS)) && !/data-unblock-blocker="2"/.test(hS), "the car in the gold car's lane isn't outlined (or another car is)");
  check(/1 car still in the gold car’s way/.test(yoursOf(hS)), "the Yours side doesn't say how many cars are still in the way");
  check(key(hS, "you")?.[2] === String(eS["moves"]), "the unfinished \"your moves\" isn't the stored grade's");
  check(!/data-unblock-key="time"/.test(hS), "an unfinished round shows a time left");
  check(laneBlockers(vs).join() === "1" && laneBlockers(applyMove(vs, { id: 1, to: 3 })!).length === 0, "laneBlockers: wrong cars");
  // The Yours board is the layout the player left (car 2 at column 2, not the start's column 0).
  const yS = yoursOf(hS);
  check(/left:28\.571428571428573%[^"]*top:71\.42857142857143%/.test(yS), "the Yours board isn't the layout the player left (car 2 moved to column 2)");
  const r = replayUnblock(vs, decodeMoves(stuck));
  check(same(r.vehicles, applyMove(vs, { id: 2, to: 2 })), "the replay's final board isn't the board the player left");

  // An older stamp takes the same look but reads its own count (every slide played).
  const e3 = graded(p3, solvedAnswer);
  const h3 = reveal(p3, solvedAnswer, true, e3);
  check(e3["moves"] === 3 && key(h3, "you")?.[2] === "3", "unblockRev 3: the reveal doesn't show its stored 3 moves");
  const h3x = reveal(p3, solvedAnswer, true); // a row stored without the extra: the grader's own replay count
  check(key(h3x, "you")?.[2] === "3", "unblockRev 3: without the stored extra the reveal doesn't count every slide");
  const u3 = reveal(p3, stuck, false, graded(p3, stuck));
  check(/data-unblock-blocker="1"/.test(u3), "unblockRev 3: the unfinished reveal has no blocker marks");
  const old = reveal({ type: "unblock", vehicles: vs, minMoves: 2, solution: "1:3,0:5" } as unknown as UnblockPuzzleData, stuck, false);
  check(key(old, "par")?.[1]?.trim() === "Fewest", "an unstamped round's figure isn't labelled Fewest");
  // No answer at all: the solution alone, no Yours pill.
  const none = reveal(p4, null, false);
  check(!/data-unblock-key="you"/.test(none) && /data-unblock-route="2"/.test(none), "a reveal with no answer shows a Yours count or no route");
  // A broken stored solution: the player's board stands in, "Solution unavailable".
  const broken = reveal({ ...p4, solution: "9:9" } as UnblockPuzzleData, stuck, false);
  check(/Solution unavailable/.test(broken) && /data-unblock-yours-board/.test(broken), "a broken solution doesn't fall back to the player's board");
}

/* ---------------------------------------------------------------- 6. help */
{
  const how = () => PUZZLE_INSTRUCTIONS.unblock.how.map((l) => `${l.action} ${l.detail}`).join(" | ");
  const live = how();
  check(/Undo and Reset give the move back/.test(live), `the live help doesn't say Undo gives the move back: ${live}`);
  check(!/gold mark/i.test(live), "the help names the bar's gold mark");
  check(/Par is the fewest moves/.test(live), "the help lost the Par line");
  const before = pinPrePatternNov15(true);
  const pinned = how();
  pinPrePatternNov15(before);
  check(/don’t give a move back/.test(pinned), "the pinned help lost the older stamps' Undo line");
  check(PUZZLE_INSTRUCTIONS.unblock.how.filter((l) => !l.helpOnly).length <= 4, "more than four intro HOW lines");
  // The new look: cars on a lot, the gold car (intro GOAL / HOW / SCORE, "?" help, the intro example, the frame's goal).
  const ins = PUZZLE_INSTRUCTIONS.unblock;
  check(ins.goal === "Slide the gold car out through the exit.", `the GOAL line: ${ins.goal}`);
  check(/Drag a car along its own direction/.test(live) && /Clear a path for the gold car/.test(live), "the HOW lines don't describe the cars");
  const scoreText = JSON.stringify(ins.score);
  check(/gold car/.test(scoreText) && !/block/i.test(scoreText), `the "?" SCORE help still says block: ${scoreText}`);
  check(!/block/i.test(live + ins.goal), "the help still says block");
  const introHtml = renderToStaticMarkup(React.createElement(unblockPuzzle.IntroExample!));
  check(/Slide the cars out of the way\. Get the gold car to the exit\./.test(introHtml) && /Undo gives a move back/.test(introHtml), "the intro example's lines don't describe the cars and Undo");
  check(/unblock: "Slide the gold car out"/.test(src("src/components/duel/GameFrame.tsx")), "the frame's goal line still says block");
  check(/"Gold car"/.test(src("src/components/puzzles/UnblockPuzzle.tsx")) && /aria-label="Gold car"/.test(src("src/components/puzzles/useSolveFlourish.ts")), "the gold car's label and the solve flourish's selector disagree");
}

/* ---------------------------------------------------------------- 7. art */
{
  const dir = new URL("../public/pattern-art/unblock/", import.meta.url);
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
  const names = ["lot", "gold-2h", ...UNBLOCK_BODIES.flatMap((c) => ["2h", "2v", "3h", "3v"].map((k) => `${c}-${k}`))];
  let total = 0;
  for (const n of names) {
    const path = new URL(`${n}.webp`, dir);
    if (!existsSync(path)) {
      failures.push(`${n}.webp is missing`);
      continue;
    }
    const info = webpInfo(n);
    total += info.bytes;
    check(info.riff && info.alpha, `${n}.webp isn't a WebP with alpha`);
    check(info.bytes <= 25_000, `${n}.webp is ${info.bytes} bytes (over 25 KB)`);
    const m = /-(\d)([hv])$/.exec(n);
    if (m) {
      const len = Number(m[1]);
      const ratio = m[2] === "h" ? info.w / info.h : info.h / info.w;
      check(ratio === len, `${n}.webp is ${info.w}×${info.h}, not its ${len}-bay box's shape`);
      check(Math.min(info.w, info.h) >= 100, `${n}.webp is under 100 px a bay (${info.w}×${info.h})`);
    } else {
      check(info.w === info.h && info.w >= 640, `lot.webp is ${info.w}×${info.h}`);
    }
  }
  check(total <= 400_000, `the Gridlock sprites total ${total} bytes (over 400 KB)`);
  const vs: UnblockVehicle[] = [
    { id: 0, axis: "h", len: 2, row: 2, col: 0 },
    ...Array.from({ length: 12 }, (_, i) => ({ id: i + 1, axis: (i % 2 ? "v" : "h") as "h" | "v", len: i % 3 === 0 ? 3 : 2, row: 0, col: 0 })),
  ];
  const board = renderToStaticMarkup(React.createElement(UnblockBoard, { vehicles: vs }));
  check(board.includes(UNBLOCK_LOT_SPRITE), "the board doesn't draw the rendered lot");
  for (const v of vs) {
    const url = unblockCarSprite(v.id, v.axis, v.len);
    check(board.includes(`src="${url}"`), `the board doesn't draw ${url} for vehicle ${v.id}`);
    check(existsSync(new URL(`../public${url}`, import.meta.url)), `${url} has no file`);
  }
  check(unblockCarSprite(0, "h", 2).endsWith("/gold-2h.webp") && vs.slice(1).every((v) => !unblockCarSprite(v.id, v.axis, v.len).includes("gold")), "only the gold car draws the gold sprite");
  check(!/<rect[^>]*fill="var\(--primary\)"/.test(board), "a car is still drawn as SVG");
  const stage = renderToStaticMarkup(React.createElement(UnblockPuzzle, { puzzle: { ...fixture.puzzles[0]!.puzzle, unblockRev: 4 }, phaseStartedAt: 0, now: 0, locked: false, onSubmit: () => {} }));
  check(stage.includes("/pattern-art/unblock/gold-2h.webp") && stage.includes(UNBLOCK_LOT_SPRITE), "the stage doesn't draw the sprites");
  const intro = renderToStaticMarkup(React.createElement(unblockPuzzle.IntroExample!));
  check(intro.includes("/pattern-art/unblock/gold-2h.webp"), "the intro example doesn't draw the sprites");
  // No glow on the gold car (the overhaul's rule): no drop-shadow glow rule on the cars in the game's CSS.
  const css = src("src/polish-pattern/unblock.css") + src("src/polish-batch-p/batch-p.css");
  check(!/unblock-car[^{]*\{[^}]*drop-shadow\(0 0 /.test(css), "a glow rule is still on a Gridlock car");
}

/* ---------------------------------------------------------------- 8. sound */
{
  const manifest = SOUND_MANIFEST as unknown as Record<string, { url: string | null }>;
  for (const slot of ["unblock.slide", "unblock.slideLong", "unblock.blocked", "unblock.laneClear", "unblock.solve"]) {
    const e = manifest[slot];
    check(!!e && !!e.url && existsSync(new URL(`../public${e.url}`, import.meta.url)), `${slot}: no manifest slot with a file`);
  }
  const stage = src("src/components/puzzles/UnblockPuzzle.tsx");
  for (const cue of ["unblock.slideLong", "unblock.blocked", "unblock.laneClear", "unblock.slide"])
    check(stage.includes(`"${cue}"`), `the stage never fires ${cue}`);
  check(/data-quiet-shake=\{quietShake \? "" : undefined\}/.test(stage), "a blocked drag's shake isn't marked quiet (it would play wrong with the knock)");
  check(/if \(blocked\) soundCue\("unblock\.blocked"\)/.test(stage), "the knock fires on a tap that tried to go nowhere");
  check(/!isSolved\(next\) && goldLaneClear\(next\) && !goldLaneClear\(vehicles\)/.test(stage), "the glint isn't limited to a move that opens the lane short of the solve");
  const blocked: UnblockVehicle[] = [
    { id: 0, axis: "h", len: 2, row: 2, col: 0 },
    { id: 1, axis: "v", len: 2, row: 1, col: 4 },
  ];
  check(!goldLaneClear(blocked), "goldLaneClear: a car in the lane reads as clear");
  check(goldLaneClear(applyMove(blocked, { id: 1, to: 3 })!), "goldLaneClear: an open lane reads as blocked");
  check(goldLaneClear([{ id: 0, axis: "h", len: 2, row: 2, col: 0 }, { id: 1, axis: "v", len: 2, row: 3, col: 4 }]), "goldLaneClear: a car outside the lane blocks it");
  const doc = src("docs/sound-cues/pattern-elevenlabs.md");
  const section = doc.slice(doc.indexOf("<!-- gridlock:start -->"), doc.indexOf("<!-- gridlock:end -->"));
  for (const slot of ["unblock.slide", "unblock.slideLong", "unblock.blocked", "unblock.laneClear", "unblock.solve"])
    check(section.includes(`\`${slot}\``), `pattern-elevenlabs.md's Gridlock section doesn't list ${slot}`);
  const cues = src("docs/sound-cues/pattern.md");
  for (const slot of ["unblock.slideLong", "unblock.blocked", "unblock.laneClear"]) check(cues.includes(`\`${slot}\``), `docs/sound-cues/pattern.md doesn't list ${slot}`);
}

void statSync;
if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`pattern-overhaul-unblock-check: ${failures.length} failure(s), ${passes} passed`);
  process.exit(1);
}
console.log(`pattern-overhaul-unblock-check: all ${passes} assertions pass`);
