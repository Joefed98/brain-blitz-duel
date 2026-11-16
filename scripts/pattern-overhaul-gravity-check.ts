/**
 * pattern-overhaul-gravity-check (15 Nov 2026, the Pattern overhaul, stage 1, Topsy-Turvy): one assertion per change.
 *
 *  1. Deals: rooms and practice deal gravityRev 8, each board's tilt limit its stored fewest tilts + 8 (the server's
 *     breadth-first minimum; the generator's verifier agrees); `pinPrePatternNov15(true)` deals gravityRev 7 with its
 *     old limits; the boards, routes and par are the same puzzle otherwise.
 *  2. Older stamps grade exactly as before: every case in scripts/fixtures/pattern-overhaul-gravity-legacy.json.gz
 *     (gravityRev 7 and 6: routes, prefixes, Undo / Reset answers, dead tilts, random tilting, recorded before the
 *     change by scripts/pattern-overhaul-gravity-record.ts) regrades to the same score, verdict and stored extra.
 *  3. gravityRev 8: Undo and Reset give the tilt back. A solve with undone tilts counts only the tilts left on the boards
 *     (the stored tilts and the par bonus equal the clean routes'); the limit is judged on that count (undoing never
 *     runs a board out); gravityRev 7 counts every tilt that moved a ball.
 *  4. The stage: the Tilts pill is the current board's (undone tilts given back) against that board's par, with the
 *     tilts left; a tilt that moves nothing adds no draft and no sound (a small lean only).
 *  5. The reveal: one board at a time, large, with a switcher (opening where the player stopped); the cups of balls
 *     not home ringed red; the board's par route as arrow chips; "You n tilts · Par p" for the board; the key numbers
 *     (boards, home, tilts, par, time left) equal the stored grade's; no stray mark; on gravityRev 8, 7 and 6.
 *  6. Help: the live help says Undo gives the tilt back and the limit is par plus 8, and where the direction controls
 *     are; the pinned help keeps the old line.
 *  7. Art: every sprite exists as WebP with alpha within budget; the stage, the intro and the reveal draw the marbles
 *     and cups; topsy.css draws the block, floor and frame; no glow on a ball.
 *  8. Sound: gravity.tilt (looped rumble), gravity.stop, gravity.combo, gravity.boardClear and gravity.outOfTilts are
 *     manifest slots with a file, fired by a tilt's sounds at the right moments; listed in the ElevenLabs doc.
 *  9. Clock: the catalogue says the dealt 120 s; stored four-ball rounds without a clock keep 90 s.
 * 10. Intro and demos (GOAL; demos before gravityRev 8 stopped); both practice challenges and the 175 star still met
 *     by the par routes on gravityRev 8; an undone tilt keeps par, a wasted one kept misses it.
 *
 * 11. Stage 2 (15 Nov 2026): Joe's reveal fix (the board line and its pills are the chosen board's own: its outcome,
 *     the stored grade's tilts on it, its par and the grader's replay's balls home; the round's totals under "Round")
 *     and the effects on the live board in happy-dom: a tilt leans the tray's art layer through the roll (a dead tilt
 *     a small lean, no sound, no draft), balls home drop into their cups as their rolls end (kit drop, silent), two in
 *     one tilt pop their rings (kit combo, silent), a cleared tray flips away and the next turns in, "Out of tilts"
 *     lands (kit drop) with the clunk, the solved reveal's result lands with the kit's win; the next tilt is taken at
 *     once during every effect; transform and opacity only, never the measured grid; reduced motion a 120 ms fade.
 *
 *   bun scripts/pattern-overhaul-gravity-check.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Window } from "happy-dom";

const win = new Window({ url: "http://localhost/", width: 390, height: 700 });
const g = globalThis as Record<string, unknown>;
for (const key of ["window", "document", "navigator", "Node", "Element", "HTMLElement", "SVGElement", "Text", "Event", "CustomEvent", "getComputedStyle", "MutationObserver"]) {
  if (g[key] === undefined) g[key] = key === "window" ? win : (win as unknown as Record<string, unknown>)[key];
}
// Cues are window events: dispatch them with happy-dom's own event classes (Bun has its own).
g["CustomEvent"] = (win as unknown as Record<string, unknown>)["CustomEvent"];
g["Event"] = (win as unknown as Record<string, unknown>)["Event"];
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
const { verifyTopsyPuzzle } = await import("../src/lib/duel/topsy.server");
const { replayTopsyPuzzle, topsyBoardPar, topsyStart, topsyTilt, TOPSY_V8_SPARE } = await import("../src/lib/duel/topsy");
const { gravityMazePuzzle } = await import("../src/puzzles/gravityMaze");
const { TopsyStage, TopsyBoardView, topsyTiltSounds, stopTopsyRumble } = await import("../src/components/puzzles/pattern/topsyBoard");
const { TOPSY_SPRITES, TOPSY_BLOCK_URL, TOPSY_FLOOR_URL, TOPSY_FRAME_URL, topsyHoleUrl, topsyMarbleUrl } = await import("../src/components/puzzles/pattern/topsyArt");
const { SOUND_MANIFEST } = await import("../src/lib/fx/manifest");
const { puzzleTimeLimitMs, typeTimeLimitMs, shownTimeLimitMs } = await import("../src/lib/duel/catalogue");
const { CATALOGUE_DATA } = await import("../src/lib/duel/catalogue.data");
const { casesFor, dealEra } = await import("./pattern-overhaul-gravity-record");
type GravityPuzzleData = import("../src/lib/duel/types").GravityPuzzleData;
type GravityDir = import("../src/lib/duel/types").GravityDir;

const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else failures.push(message);
};
const src = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const tiltsOf = (extra: unknown) => (extra as { tilts?: number } | null)?.tilts;

/* ---------------------------------------------------------------- 1. deals */
{
  for (const seed of [11, 4242, 90210]) {
    const live = withSeededRandom(seed, () => generatePuzzle("gravity", { bankSeed: seed })) as GravityPuzzleData;
    check(live.gravityRev === 8, `seed ${seed}: the live deal is gravityRev ${live.gravityRev}, not 8`);
    check(same(live.tiltLimits, (live.boardMins ?? []).map((m) => m + 8)), `seed ${seed}: the limits ${live.tiltLimits} aren't each board's fewest + 8 (${live.boardMins})`);
    check(verifyTopsyPuzzle(live) === null, `seed ${seed}: the generator's verifier refuses the deal (${verifyTopsyPuzzle(live)})`);
    const before = pinPrePatternNov15(true);
    const old = withSeededRandom(seed, () => generatePuzzle("gravity", { bankSeed: seed })) as GravityPuzzleData;
    pinPrePatternNov15(before);
    check(old.gravityRev === 7, `seed ${seed}: the pinned deal is gravityRev ${old.gravityRev}, not 7`);
    check(same({ ...old, gravityRev: 8, tiltLimits: live.tiltLimits }, live), `seed ${seed}: gravityRev 8 deals a different puzzle from gravityRev 7 beyond the limits`);
    check((old.tiltLimits ?? []).every((l, i) => l > live.tiltLimits![i]!), `seed ${seed}: the old limits ${old.tiltLimits} weren't looser than the new ${live.tiltLimits}`);
    check(live.boards!.every((_, i) => topsyBoardPar(live, i) === live.boardMins![i]) && old.boards!.every((_, i) => topsyBoardPar(old, i) === null), `seed ${seed}: the board par shown is wrong`);
    // A tampered limit is refused by the verifier.
    check(verifyTopsyPuzzle({ ...live, tiltLimits: live.tiltLimits!.map((l) => l + 1) }) !== null, `seed ${seed}: the verifier accepts a wrong gravityRev 8 limit`);
  }
}

/* ---------------------------------------------------------------- 2. older stamps grade as before */
type Era = "rev7" | "rev6";
interface LegacyCase { era: Era; seed: number; label: string; answer: string; msLeft: number; score: number; isCorrect: boolean; extra: unknown }
const fixture = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/pattern-overhaul-gravity-legacy.json.gz", import.meta.url))).toString()) as {
  puzzles: { era: Era; seed: number; puzzle: GravityPuzzleData }[];
  cases: LegacyCase[];
};
{
  check(fixture.cases.length >= 40, `the legacy fixture holds only ${fixture.cases.length} cases`);
  check(fixture.cases.some((c) => /undo|reset/.test(c.label)) && fixture.cases.some((c) => c.era === "rev6"), "the legacy fixture lacks Undo / Reset answers or gravityRev 6");
  for (const { era, seed, puzzle } of fixture.puzzles) {
    check(same(dealEra(era, seed), puzzle), `${era} seed ${seed}: the pinned deal changed`);
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

/* ---------------------------------------------------------------- 3. gravityRev 8: Undo gives the tilt back */
const asV8 = (p: GravityPuzzleData): GravityPuzzleData => ({ ...p, gravityRev: 8, tiltLimits: (p.boardMins ?? []).map((m) => m + TOPSY_V8_SPARE) });
{
  let solves = 0;
  for (const { era, puzzle } of fixture.puzzles) {
    if (era !== "rev7") continue;
    const p8 = asV8(puzzle);
    const line = (puzzle.boardSolutions ?? []).join("");
    const par = (puzzle.boardMins ?? []).reduce((n, m) => n + m, 0);
    const clean = gradeAnswer(p8, line, 60_000);
    check(clean.isCorrect && tiltsOf(clean.extra) === par, `gravityRev 8: the clean routes store ${tiltsOf(clean.extra)} tilts, not the par ${par}`);
    const b0 = p8.boards![0]!;
    const wrong = (["U", "D", "L", "R"] as GravityDir[]).find((d) => d !== line[0] && topsyTilt(b0, new Set(b0.walls), topsyStart(b0), d).moved)!;
    const other = (["U", "D", "L", "R"] as GravityDir[]).find((d) => d !== wrong && topsyTilt(b0, new Set(b0.walls), topsyTilt(b0, new Set(b0.walls), topsyStart(b0), wrong).state, d).moved)!;
    for (const [label, answer] of [
      ["wrong then undo", `${wrong}X${line}`],
      ["two wrong, two undos", `${wrong}${other}XX${line}`],
      ["wrong two, reset", `${wrong}${other}Y${line}`],
    ] as const) {
      const g8 = gradeAnswer(p8, answer, 60_000);
      const g7 = gradeAnswer(puzzle, answer, 60_000);
      check(g8.isCorrect && tiltsOf(g8.extra) === par, `${label}: gravityRev 8 stores ${tiltsOf(g8.extra)} tilts, the boards hold ${par}`);
      check(g8.score === clean.score, `${label}: gravityRev 8 scores ${g8.score}, the clean routes ${clean.score} (an undone tilt still costs)`);
      check(tiltsOf(g7.extra)! > par, `${label}: gravityRev 7 no longer counts the undone tilts (${tiltsOf(g7.extra)})`);
      solves++;
    }
    // The limit is judged on the tilts left on the board: tilting back and forth with Undo never runs it out.
    const limit = p8.tiltLimits![0]!;
    const churn = `${wrong}X`.repeat(limit + 4);
    const r8 = replayTopsyPuzzle(p8, churn.split("") as GravityDir[]);
    check(r8.current === 0 && !r8.boards[0]!.outOfTilts && r8.boards[0]!.tilts === 0, "gravityRev 8: undone tilts ran the board out of tilts");
    const r7 = replayTopsyPuzzle(puzzle, `${wrong}X`.repeat(puzzle.tiltLimits![0]! + 1).split("") as GravityDir[]);
    check(r7.boards[0]!.outOfTilts, "gravityRev 7: undone tilts no longer count against the limit");
    // Without Undo the board runs out at its par + 8.
    const back = (["U", "D", "L", "R"] as GravityDir[]);
    let spam = "";
    for (let i = 0; i < 80; i++) spam += back[i % 4]!;
    const rs = replayTopsyPuzzle(p8, spam.split("") as GravityDir[]);
    const first = rs.boards[0]!;
    check(first.cleared || (first.outOfTilts && first.tilts === limit), `gravityRev 8: board 1 ran out at ${first.tilts}, not its limit ${limit}`);
  }
  check(solves >= 12, `only ${solves} solves with undone tilts tried`);
}

/* ---------------------------------------------------------------- 4. the stage */
{
  const stage = src("src/components/puzzles/pattern/topsyBoard.tsx");
  check(/parPills\("Tilts", tiltsHere, boardPar\)/.test(stage), "the stage's Tilts pill isn't the board's own tilts against its par");
  check(/const boardPar = topsyBoardPar\(data, shown\)/.test(stage), "the board's par isn't read for the board shown");
  // A tilt that moves nothing: no sound and no draft (the return comes before every sound and setTilts).
  const press = stage.slice(stage.indexOf("const press = (dir: GravityDir)"), stage.indexOf("const starsHere"));
  // Changed with Joe's approval, 15 Nov 2026 (routine consequence of the Pattern overhaul, stage 2): the dead tilt's
  // small lean is now leanTopsyTray's (the tray's art layer), no longer a data-nudge CSS state on the measured box.
  const dead = press.indexOf("if (!out.moved) {");
  check(dead > 0 && dead < press.indexOf("topsyTiltSounds(") && dead < press.indexOf("setTilts(next)"), "a tilt that moves nothing still sounds or adds a draft");
  check(!/playSound\("pz_gravity_pull"\)/.test(press) && !/soundCue\("gravity\.tilt"\)/.test(press), "the press still plays a sound before knowing the tilt moves anything");
  check(/if \(!out\.moved\) \{\s*leanTopsyTray\(tray, dir, \{ small: true \}\);\s*return;/.test(press), "a dead tilt doesn't get the small lean");
  check(!/data-nudge/.test(src("src/polish-pattern/topsy.css")), "topsy.css still leans the measured box (data-nudge)");
  // The stage renders (rev 8, first board).
  const p8 = asV8(fixture.puzzles[0]!.puzzle);
  const html = renderToStaticMarkup(React.createElement(TopsyStage, { puzzle: p8, phaseStartedAt: 0, now: 0, locked: false, onSubmit: () => {} } as never));
  check(html.includes("data-topsy-head") && /Undo/.test(html) && /Reset/.test(html), "the stage no longer draws its head row, Undo and Reset");
}

/* ---------------------------------------------------------------- 5. the reveal */
{
  const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const render = (puzzle: GravityPuzzleData, answer: string, msLeft: number) => {
    const g = gradeAnswer(puzzle, answer, msLeft);
    const html = renderToStaticMarkup(
      React.createElement(gravityMazePuzzle.Reveal, { timeLimitMs: 120_000, puzzle, myAnswer: answer, myCorrect: g.isCorrect, myMsRemaining: msLeft, myExtra: g.extra ?? null } as never),
    );
    return { html, g, extra: (g.extra ?? {}) as Record<string, number> };
  };
  const p8 = asV8(fixture.puzzles[0]!.puzzle);
  const p7 = fixture.puzzles.find((x) => x.era === "rev7")!.puzzle;
  const p6 = fixture.puzzles.find((x) => x.era === "rev6")!.puzzle;
  for (const [stamp, p] of [["gravityRev 8", p8], ["gravityRev 7", p7], ["gravityRev 6", p6]] as const) {
    const routes = p.boardSolutions ?? [];
    const line = routes.join("");
    const solved = render(p, line, 50_000);
    const part = render(p, routes[0] ?? "", 0);
    for (const [label, r] of [["solved", solved], ["unfinished", part]] as const) {
      const t = text(r.html);
      // One board at a time, large, with a switcher of three.
      check((r.html.match(/role="tab"/g) ?? []).length === 3 && (r.html.match(/data-topsy-board=""/g) ?? []).length === 1, `${stamp} ${label}: the reveal doesn't show one board with a switcher of three`);
      check(/data-reveal-board=""/.test(r.html), `${stamp} ${label}: the board isn't marked for the reveal's fit`);
      check(r.html.includes("/pattern-art/gravity/hole-"), `${stamp} ${label}: the reveal doesn't draw the rendered cups`);
      // The par route as arrow chips (the board shown's stored route).
      check((r.html.match(/class="topsy-chip"/g) ?? []).length >= 4 && /Par route/.test(t), `${stamp} ${label}: the par route isn't drawn as arrow chips`);
      // The round's key numbers come from the stored grade, under their own "Round" label.
      // Changed with Joe's approval, 15 Nov 2026 (routine consequence of the Pattern overhaul, stage 2: Joe's fix moved
      // the round's totals under "Round" and the per-board pills follow the switcher; section 11 proves the board pills).
      // Changed with Joe's approval, 15 Nov 2026 (Topsy-Turvy's Round row on one line): the shorter labels, "Boards 3/3",
      // "Home 18/18" and "Left 50 s" (were "3 of 3", "18 of 18", "Time left 50 s"); the levels check proves the fit.
      const e = r.extra;
      const round = text(r.html.slice(r.html.indexOf("data-topsy-keys")));
      check(round.includes("Round") && round.includes(`Boards ${e.cleared}/3`) && round.includes(`Home ${e.home}/18`) && round.includes(`Tilts ${e.tilts}`) && round.includes(`Par ${e.parTilts ?? (p.boardMins ?? []).reduce((n, m) => n + m, 0)}`), `${stamp} ${label}: the round's numbers don't match the stored grade: ${round}`);
      check(!/[×✗]/.test(t), `${stamp} ${label}: a stray × or ✗ in the reveal`);
    }
    // Solved: board 1 opens, cleared, nothing marked missed; time left shown.
    check(/aria-selected="true"[^>]*>Board 1/.test(solved.html) && /Cleared/.test(text(solved.html)) && !/is-missed/.test(solved.html), `${stamp}: the solved reveal doesn't open on a cleared board 1 with nothing missed`);
    check(/Left 50 s/.test(text(solved.html)), `${stamp}: the solved reveal doesn't give the time left`);
    // Unfinished: opens on board 2 (where the player stopped), every ball and cup there marked missed.
    check(/aria-selected="true"[^>]*>Board 2/.test(part.html), `${stamp}: the unfinished reveal doesn't open where the player stopped`);
    check((part.html.match(/data-missed=""/g) ?? []).length === 6 && /Not finished|Not reached/.test(text(part.html)), `${stamp}: the unfinished board's empty cups aren't marked (${(part.html.match(/data-missed=""/g) ?? []).length})`);
    check(!/Left \d+ s/.test(text(part.html)), `${stamp}: an unfinished reveal shows a time left`);
  }
  // The per-board line and pills: the board shown's own tilts against its own par (section 11 proves every board).
  // Changed with Joe's approval, 15 Nov 2026 (routine consequence of the Pattern overhaul, stage 2: Joe's fix).
  const b8 = (p8.boardSolutions ?? [])[0]!;
  const one = render(p8, b8, 0);
  const sum = text(one.html.slice(one.html.indexOf("data-topsy-board-sum"), one.html.indexOf("data-reveal-board")));
  check(/Board \d · .*Tilts \d+ Par \d+ Home \d of 6/.test(sum), `the board's line and pills don't read "Board n · … Tilts t Par p Home h of 6": ${sum}`);
}

/* ---------------------------------------------------------------- 6. help */
{
  const how = () => PUZZLE_INSTRUCTIONS.gravity.how.map((l) => `${l.action} ${l.detail}`).join(" | ");
  const live = how();
  check(/Undo and Reset give the tilt back/.test(live), `the live help doesn't say Undo gives the tilt back: ${live}`);
  check(/par plus 8/.test(live), "the live help doesn't give the limit as par plus 8");
  check(/game menu \(⋮\) or Settings → Game controls/.test(live), "the help doesn't say where the direction controls are");
  const before = pinPrePatternNov15(true);
  const pinned = how();
  pinPrePatternNov15(before);
  check(/don’t give a tilt back/.test(pinned), "the pinned help lost the older stamps' Undo line");
  check(PUZZLE_INSTRUCTIONS.gravity.how.filter((l) => !l.helpOnly).length <= 4, "more than four intro HOW lines");
}

/* ---------------------------------------------------------------- 7. art */
{
  const webpInfo = (url: string) => {
    const buf = readFileSync(new URL(`../public${url}`, import.meta.url));
    const riff = buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP";
    const chunk = buf.toString("ascii", 12, 16);
    let alpha = false;
    let w = 0;
    if (chunk === "VP8X") {
      alpha = (buf[20]! & 0x10) !== 0;
      w = 1 + (buf[24]! | (buf[25]! << 8) | (buf[26]! << 16));
    } else if (chunk === "VP8L") {
      const bits = buf.readUInt32LE(21);
      w = (bits & 0x3fff) + 1;
      alpha = ((bits >> 28) & 1) === 1;
    }
    return { riff, alpha, w, bytes: buf.length };
  };
  // Changed with Joe's approval, 15 Nov 2026 (routine consequence of the Pattern overhaul, stage 3: Expert's eight balls
  // add a lime green and a pearl white marble and cup).
  check(TOPSY_SPRITES.length === 19, `${TOPSY_SPRITES.length} sprites listed, not 19 (8 marbles, 8 cups, block, floor, frame)`);
  let total = 0;
  for (const url of TOPSY_SPRITES) {
    if (!existsSync(new URL(`../public${url}`, import.meta.url))) {
      failures.push(`${url} is missing`);
      continue;
    }
    const info = webpInfo(url);
    total += info.bytes;
    check(info.riff && info.alpha, `${url} isn't a WebP with alpha`);
    check(info.bytes <= 25_000, `${url} is ${info.bytes} bytes (over 25 KB)`);
    check(info.w >= 96, `${url} is ${info.w} px wide (under 2× a ~45 px cell)`);
  }
  check(total <= 400_000, `the Topsy-Turvy sprites total ${total} bytes (over 400 KB)`);
  const p8 = asV8(fixture.puzzles[0]!.puzzle);
  const stage = renderToStaticMarkup(React.createElement(TopsyStage, { puzzle: p8, phaseStartedAt: 0, now: 0, locked: false, onSubmit: () => {} } as never));
  const reveal = renderToStaticMarkup(React.createElement(gravityMazePuzzle.Reveal, { timeLimitMs: 120_000, puzzle: p8, myAnswer: "", myCorrect: false, myMsRemaining: 0 } as never));
  const intro = renderToStaticMarkup(React.createElement(gravityMazePuzzle.IntroExample!));
  for (const [name, html] of [["reveal", reveal], ["intro", intro]] as const) {
    for (let i = 0; i < 6; i++) check(html.includes(`src="${topsyHoleUrl(i)}"`), `the ${name} doesn't draw cup ${i}`);
  }
  // The board's balls (drawn once the grid is measured) and the intro's after-tilt state carry the marbles: the home
  // balls sit in their cups.
  check(intro.includes("topsy-sunk") && /src="\/pattern-art\/gravity\/marble-/.test(intro), "the intro's balls home don't draw a marble in their cup");
  const board = src("src/components/puzzles/pattern/topsyBoard.tsx");
  // The stage draws the same board view once its space is measured (not in static markup).
  check(stage.includes("data-topsy-head") && /<TopsyBoardView\s+key=\{shown\}/.test(board), "the stage doesn't draw the board view");
  check(/<TopsyMarble index=\{index\} \/>/.test(board), "the board's balls don't draw the marble sprite");
  check(topsyMarbleUrl(0).endsWith("marble-yellow.webp") && topsyHoleUrl(5).endsWith("hole-orange.webp"), "the sprite colours aren't in ball order");
  const css = src("src/polish-pattern/topsy.css");
  for (const url of [TOPSY_BLOCK_URL, TOPSY_FLOOR_URL, TOPSY_FRAME_URL]) check(css.includes(`url("${url}")`), `topsy.css doesn't draw ${url}`);
  const art = css.slice(css.indexOf("The Pattern overhaul"));
  check(!/topsy-[a-z]+[^{]*\{[^}]*drop-shadow\(0 0 /.test(art) && /\.grav-ball\.is-locked \{\s*filter: drop-shadow\(0 2px 2px/.test(art), "a glow is still on a Topsy-Turvy ball");
}

/* ---------------------------------------------------------------- 8. sound */
{
  const manifest = SOUND_MANIFEST as unknown as Record<string, { url: string | null; loop?: boolean }>;
  for (const slot of ["gravity.tilt", "gravity.stop", "gravity.lock", "gravity.combo", "gravity.boardClear", "gravity.outOfTilts", "gravity.solve"]) {
    const e = manifest[slot];
    check(!!e && !!e.url && existsSync(new URL(`../public${e.url}`, import.meta.url)), `${slot}: no manifest slot with a file`);
  }
  check(manifest["gravity.tilt"]?.loop === true, "gravity.tilt isn't a loop (the rumble lasts as long as the balls move)");
  // A tilt's sounds, in order, in time: a board with two balls rolling home and one stopping against a block.
  const board = { walls: [9], starts: [0, 10, 20], holes: [5, 15, 99], stars: [] };
  const out = topsyTilt(board, new Set(board.walls), topsyStart(board), "R");
  check(out.dropped.length === 2 && out.paths[2]!.length > 1, "the sound test board doesn't roll as expected");
  const heard: { cue: string; at: number }[] = [];
  const t0 = Date.now();
  const listen = (event: Event) => heard.push({ cue: (event as CustomEvent<{ cue: string }>).detail.cue, at: Date.now() - t0 });
  window.addEventListener("duelz-sound", listen);
  topsyTiltSounds(out, true, false);
  await new Promise((resolve) => setTimeout(resolve, 900));
  const cues = heard.map((h) => h.cue);
  check(cues.filter((c) => c === "gravity.lock").length === 2, `two balls home play ${cues.filter((c) => c === "gravity.lock").length} pips`);
  check(cues.filter((c) => c === "gravity.stop").length === 1, "the ball stopping against a block doesn't click once");
  check(cues.includes("gravity.combo") && cues.indexOf("gravity.combo") > cues.lastIndexOf("gravity.lock"), "two home in one tilt don't play the combo after their pips");
  check(cues[cues.length - 1] === "gravity.boardClear" && !cues.includes("gravity.outOfTilts"), "a cleared board doesn't end on the board-cleared sound");
  const lockAt = heard.find((h) => h.cue === "gravity.lock")!.at;
  check(lockAt >= 5 * 45 - 30, `the first pip came at ${lockAt} ms, before the ball reached its hole (5 squares)`);
  heard.length = 0;
  topsyTiltSounds(out, false, true);
  await new Promise((resolve) => setTimeout(resolve, 900));
  check(heard.some((h) => h.cue === "gravity.outOfTilts") && !heard.some((h) => h.cue === "gravity.boardClear"), "the last tilt doesn't play the closing clunk");
  window.removeEventListener("duelz-sound", listen);
  stopTopsyRumble();
  const doc = src("docs/sound-cues/pattern-elevenlabs.md");
  const section = doc.slice(doc.indexOf("<!-- topsy:start -->"), doc.indexOf("<!-- topsy:end -->"));
  for (const slot of ["gravity.tilt", "gravity.stop", "gravity.lock", "gravity.combo", "gravity.boardClear", "gravity.outOfTilts", "gravity.solve"])
    check(section.includes(`\`${slot}\``), `pattern-elevenlabs.md's Topsy-Turvy section doesn't list ${slot}`);
  const cues2 = src("docs/sound-cues/pattern.md");
  for (const slot of ["gravity.stop", "gravity.combo", "gravity.boardClear", "gravity.outOfTilts"]) check(cues2.includes(`\`${slot}\``), `docs/sound-cues/pattern.md doesn't list ${slot}`);
}

/* ---------------------------------------------------------------- 9. clock */
{
  check(CATALOGUE_DATA.gravity.timeLimitMs === 120_000 && typeTimeLimitMs("gravity") === 120_000 && shownTimeLimitMs("gravity") === 120_000, "the catalogue doesn't say the dealt 120 s");
  const live = withSeededRandom(5, () => generatePuzzle("gravity", { bankSeed: 5 })) as GravityPuzzleData;
  check(puzzleTimeLimitMs(live) === 120_000, "a live deal isn't 120 s");
  const classic = { type: "gravity", walls: [], starts: [0, 8, 72, 80], targets: [40, 41, 39, 31], minMoves: 5, solution: "UDLRU" } as unknown as GravityPuzzleData;
  check(puzzleTimeLimitMs(classic) === 90_000, `a stored four-ball round's clock is ${puzzleTimeLimitMs(classic)} ms, not 90 s`);
}

/* ---------------------------------------------------------------- 10. intro, demos, challenges and stars */
{
  // The intro's GOAL and the still (rendered art); demos recorded before gravityRev 8 stay stopped.
  check(PUZZLE_INSTRUCTIONS.gravity.goal === "Tilt to roll every ball into its own hole, three boards in a row.", "the intro GOAL changed");
  check(/\(demo\.puzzle\.gravityRev \?\? 0\) < 8\) return null;/.test(src("src/lib/duel/introDemo.functions.ts")), "a Topsy-Turvy demo recorded before gravityRev 8 would still play");
  // Challenges ("Right way up": par tilts; "Head rush": full speed by 32 s) and the 175 star stay achievable on
  // gravityRev 8, and par still asks for the shortest routes (one wasted tilt left on a board misses it).
  const { PRACTICE_CHALLENGES, evaluateChallenge } = await import("../src/lib/duel/practiceChallenges");
  const { STAR_SCORE } = await import("../src/lib/practice/progressRules");
  const mine = PRACTICE_CHALLENGES.filter((c) => c.type === "gravity");
  check(mine.length === 2, `Topsy-Turvy has ${mine.length} challenges, not 2`);
  for (const { puzzle } of fixture.puzzles.filter((x) => x.era === "rev7")) {
    const p8 = asV8(puzzle);
    const routes = p8.boardSolutions ?? [];
    const line = routes.join("");
    const fast = gradeAnswer(p8, line, 120_000 - 25_000);
    for (const c of mine) check(evaluateChallenge(c, { score: fast.score, isCorrect: fast.isCorrect, extra: fast.extra }).met, `${c.id}: the par routes in 25 s don't meet it on gravityRev 8`);
    check(fast.score >= STAR_SCORE, `the par routes in 25 s score ${fast.score}, under the star's ${STAR_SCORE}`);
    // A wasted tilt kept (not undone) misses par; undone, it meets par again.
    const b0 = p8.boards![0]!;
    const wrong = (["U", "D", "L", "R"] as GravityDir[]).find((d) => d !== line[0] && topsyTilt(b0, new Set(b0.walls), topsyStart(b0), d).moved)!;
    const par = mine.find((c) => c.id === "gravity.right-way-up")!;
    const undone = gradeAnswer(p8, `${wrong}X${line}`, 95_000);
    check(evaluateChallenge(par, { score: undone.score, isCorrect: undone.isCorrect, extra: undone.extra }).met, "Right way up: an undone tilt now misses par on gravityRev 8");
    const kept = replayTopsyPuzzle(p8, `${wrong}${line}`.split("") as GravityDir[]);
    if (kept.solved) {
      const g = gradeAnswer(p8, `${wrong}${line}`, 95_000);
      check(!evaluateChallenge(par, { score: g.score, isCorrect: g.isCorrect, extra: g.extra }).met, "Right way up: a wasted tilt still meets par");
    }
  }
}

/* ---------------------------------------------------------------- 11. stage 2: Joe's reveal fix and the effects */
{
  const { createRoot } = await import("react-dom/client");
  const { flushSync } = await import("react-dom");
  const K = await import("../src/lib/fx/kit");
  const W = win as unknown as Record<string, any>;
  const text = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Reduced motion is switchable; every element is 390 × 560 (so the stage measures a board); pointer capture is a no-op.
  let reduced = false;
  const matchMedia = (query: string) => ({ matches: query.includes("prefers-reduced-motion") ? reduced : false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  Object.defineProperty(win, "matchMedia", { configurable: true, writable: true, value: matchMedia });
  const proto = W["HTMLElement"].prototype;
  const box = { x: 0, y: 0, left: 0, top: 0, right: 390, bottom: 560, width: 390, height: 560, toJSON() {} };
  Object.defineProperty(proto, "getBoundingClientRect", { configurable: true, value: () => box });
  for (const [k, v] of [["clientWidth", 390], ["clientHeight", 560], ["offsetWidth", 390], ["offsetHeight", 560]] as const) Object.defineProperty(proto, k, { configurable: true, get: () => v });
  for (const k of ["setPointerCapture", "releasePointerCapture"]) Object.defineProperty(W["Element"].prototype, k, { configurable: true, writable: true, value() {} });
  Object.defineProperty(W["Element"].prototype, "hasPointerCapture", { configurable: true, writable: true, value: () => false });

  // Every Web Animation is recorded (the kit's and the board's own), with the element it ran on.
  type Rec = { el: Element; frames: Keyframe[]; options: KeyframeAnimationOptions };
  let played: Rec[] = [];
  Object.defineProperty(W["Element"].prototype, "animate", {
    configurable: true,
    writable: true,
    value(this: Element, frames: Keyframe[], options: KeyframeAnimationOptions) {
      played.push({ el: this, frames, options });
      return { cancel() {}, finish() {}, onfinish: null, oncancel: null, finished: new Promise<void>(() => {}) };
    },
  });
  let kit: { kind: string; variant: string; sound: unknown }[] = [];
  K.setGameFxSink((r) => kit.push({ kind: r.kind, variant: r.variant, sound: r.sound }));
  const cues: string[] = [];
  const onCue = (e: Event) => cues.push((e as CustomEvent<{ cue: string }>).detail.cue);
  window.addEventListener("duelz-sound", onCue);
  const clear = () => {
    played = [];
    kit = [];
    cues.length = 0;
  };
  const onlyTransformOpacity = (frames: Keyframe[]) => frames.every((f) => Object.keys(f).every((k) => ["transform", "opacity", "offset", "easing"].includes(k)));

  /* -- Joe's fix: the reveal's pills follow the board switcher; the round's totals sit under "Round". -- */
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host as unknown as Element);
  const p8r = asV8(fixture.puzzles[0]!.puzzle);
  const routes = p8r.boardSolutions ?? [];
  const b0 = p8r.boards![0]!;
  const wrong = (["U", "D", "L", "R"] as GravityDir[]).find((d) => d !== routes[0]![0] && topsyTilt(b0, new Set(b0.walls), topsyStart(b0), d).moved)!;
  // Board 1 solved with a wasted tilt kept, board 2 with an undone one, board 3 left part-way.
  const answers: [string, string][] = [
    ["solved", routes.join("")],
    ["mixed", `${wrong}${routes[0]}${wrong}X${routes[1]}${routes[2]!.slice(0, 1)}`],
    ["unfinished", routes[0]!],
  ];
  for (const [label, answer] of answers) {
    const g = gradeAnswer(p8r, answer, label === "solved" ? 50_000 : 0);
    const extra = (g.extra ?? {}) as Record<string, unknown>;
    const replay = replayTopsyPuzzle(p8r, answer.split("") as GravityDir[]);
    flushSync(() => root.render(React.createElement(gravityMazePuzzle.Reveal, { timeLimitMs: 120_000, puzzle: p8r, myAnswer: answer, myCorrect: g.isCorrect, myMsRemaining: label === "solved" ? 50_000 : 0, myExtra: extra } as never)));
    const tabs = [...host.querySelectorAll('[role="tab"]')] as HTMLElement[];
    for (let i = 0; i < 3; i++) {
      flushSync(() => tabs[i]!.dispatchEvent(new W["MouseEvent"]("click", { bubbles: true })));
      const sum = host.querySelector("[data-topsy-board-sum]");
      const pill = (k: string) => text(sum?.querySelector(`[data-key="${k}"] b`));
      const result = replay.boards[i];
      const home = result ? result.state.balls.filter((x) => x === -1).length : 0;
      const outcome = !result ? "Not reached" : result.cleared ? "Cleared" : result.outOfTilts ? "Out of tilts" : "Not finished";
      check(sum?.getAttribute("data-board") === String(i + 1) && text(sum?.querySelector(".topsy-board-line")) === `Board ${i + 1} · ${outcome}`, `${label} board ${i + 1}: the line isn't the chosen board's ("${text(sum?.querySelector(".topsy-board-line"))}")`);
      // A board never reached has no stored entry: 0 tilts.
      const storedTilts = (extra["boardTilts"] as number[])[i] ?? 0;
      check(pill("tilts") === String(storedTilts), `${label} board ${i + 1}: the Tilts pill ${pill("tilts")} isn't the stored grade's board tilts ${storedTilts}`);
      check(pill("par") === String(p8r.boardMins![i]), `${label} board ${i + 1}: the Par pill ${pill("par")} isn't the board's stored par ${p8r.boardMins![i]}`);
      check(pill("home") === `${home} of 6`, `${label} board ${i + 1}: the Home pill ${pill("home")} isn't the grader's replay's ${home} of 6`);
      // Changed with Joe's approval, 15 Nov 2026 (Topsy-Turvy's Round row on one line): "Left 50 s" and "3/3" below.
      check(!/Boards|Round|Left \d+ s/.test(text(sum)), `${label} board ${i + 1}: a round total sits among the board's pills`);
      const round = host.querySelector("[data-topsy-keys]");
      check(text(round?.querySelector(".topsy-round-label")) === "Round" && text(round?.querySelector('[data-key="tilts"] b')) === String(extra["tilts"]) && text(round?.querySelector('[data-key="boards"] b')) === `${extra["cleared"]}/3`, `${label} board ${i + 1}: the round's totals aren't under "Round" with the stored figures`);
    }
    const sums = new Set<string>();
    for (const t of tabs) {
      flushSync(() => t.dispatchEvent(new W["MouseEvent"]("click", { bubbles: true })));
      sums.add(text(host.querySelector("[data-topsy-board-sum]")));
    }
    check(sums.size === 3, `${label}: switching boards doesn't change the board's line and pills`);
    flushSync(() => root.render(React.createElement("div")));
  }

  /* -- The solve's win on the result (the reveal), silent; never on an unfinished round. -- */
  clear();
  const solvedG = gradeAnswer(p8r, routes.join(""), 50_000);
  flushSync(() => root.render(React.createElement(gravityMazePuzzle.Reveal, { timeLimitMs: 120_000, puzzle: p8r, myAnswer: routes.join(""), myCorrect: true, myMsRemaining: 50_000, myExtra: solvedG.extra } as never)));
  await sleep(0);
  const wins = kit.filter((k) => k.kind === "win");
  check(wins.length === 1 && wins[0]!.sound === null && played.some((p) => p.el.hasAttribute("data-topsy-board-sum")), "a solved reveal's result doesn't land with the kit's silent win");
  flushSync(() => root.render(React.createElement("div")));
  clear();
  flushSync(() => root.render(React.createElement(gravityMazePuzzle.Reveal, { timeLimitMs: 120_000, puzzle: p8r, myAnswer: routes[0], myCorrect: false, myMsRemaining: 0, myExtra: gradeAnswer(p8r, routes[0]!, 0).extra } as never)));
  await sleep(0);
  check(!kit.some((k) => k.kind === "win") && played.length === 0, "an unfinished reveal plays a win (or any effect)");
  flushSync(() => root.render(React.createElement("div")));

  /* -- The live board's effects on a made-up round: tilt R rolls two balls home (5 squares each), tilt R again moves
        nothing, tilt L clears the board; board 2 is tilted up and down until it runs out. -- */
  const A = { walls: [], starts: [0, 10, 29, 39, 49, 59], holes: [5, 15, 20, 30, 40, 50], stars: [] };
  const P = { type: "gravity", gravityRev: 8, boards: [A, A, A], tiltLimits: [10, 10, 10], boardMins: [2, 2, 2], boardSolutions: ["RL", "RL", "RL"], timeLimitMs: 120_000, minMoves: 6 } as unknown as GravityPuzzleData;
  const rTilt = topsyTilt(A, new Set(A.walls), topsyStart(A), "R");
  check(rTilt.dropped.length === 2 && rTilt.paths.filter((p) => p.length > 1).length === 2 && !topsyTilt(A, new Set(), rTilt.state, "R").moved, "the made-up board doesn't roll as planned");
  const upDown = Array.from({ length: 10 }, (_, i) => (i % 2 ? "D" : "U")) as GravityDir[];
  const planned = replayTopsyPuzzle(P as never, ["R", "L", ...upDown]);
  check(planned.boards[0]!.cleared && planned.boards[1]!.outOfTilts && !planned.boards[1]!.cleared && planned.boards[1]!.tilts === 10, "the made-up round's second board doesn't run out of tilts as planned");

  let stageN = 0;
  const mountStage = () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const r = createRoot(el as unknown as Element);
    const drafts: string[] = [];
    flushSync(() => r.render(React.createElement(gravityMazePuzzle.Stage, { puzzle: P, locked: false, phaseStartedAt: Date.now(), now: Date.now(), onSubmit: () => {}, onDraftAnswer: (a: string) => drafts.push(a), stateKey: `topsy-fx-${++stageN}` } as never)));
    const tilt = (label: "Up" | "Down" | "Left" | "Right") => {
      const button = el.querySelector(`button[aria-label="${label}"]`) as HTMLElement | null;
      flushSync(() => {
        button?.dispatchEvent(new W["PointerEvent"]("pointerdown", { bubbles: true, pointerId: 1 }));
        button?.dispatchEvent(new W["PointerEvent"]("pointerup", { bubbles: true, pointerId: 1 }));
      });
    };
    return { el, r, drafts, tilt, last: () => drafts[drafts.length - 1] ?? "" };
  };
  const inLayer = (rec: Rec, sel: string) => rec.el.matches(sel);
  const tray = (s: { el: Element }) => s.el.querySelector("[data-topsy-tilt]");

  for (const motion of ["full", "reduced"] as const) {
    reduced = motion === "reduced";
    const tag = `(${motion})`;
    const s = mountStage();
    check(!!tray(s) && !!s.el.querySelector("[data-topsy-measure]") && !s.el.querySelector("[data-topsy-flip] [data-topsy-measure]"), `${tag} the board's measured grid sits outside the art layers the effects move`);
    clear();
    s.tilt("Right");
    // The tilt: the tray's art layer leans and holds through the roll (the next frame's sunk marbles drop home).
    const lean = played.filter((p) => inLayer(p, "[data-topsy-tilt]"));
    check(lean.length === 1 && s.last() === "R", `${tag} a tilt that moves leans the tray once (${lean.length}) and is drawn at once`);
    if (reduced) check(lean[0]?.frames.every((f) => f.transform === undefined) && Number(lean[0]?.options.duration) <= 120, `${tag} the lean is a 120 ms crossfade, no movement`);
    else {
      check(lean.some((p) => p.frames.some((f) => String(f.transform).includes("rotateY(6deg)"))) && Number(lean[0]?.options.duration) <= 900 && Number(lean[0]?.options.duration) >= 5 * 45, `${tag} the lean tips the tray 6° right for at least the roll (225 ms), at most 900 ms`);
    }
    // Two home: each drops into its cup as its roll ends (the kit's drop, silent), and their rings pop as a combo.
    const wraps = played.filter((p) => inLayer(p, "[data-topsy-sunk]"));
    const drops = kit.filter((k) => k.kind === "drop");
    check(wraps.length === 2 && drops.length === 2 && drops.every((k) => k.sound === null && k.variant === motion), `${tag} the two balls home drop into their cups (${wraps.length} cups, ${drops.length} kit drops, silent)`);
    check(wraps.every((w) => Number(w.options.delay) === (reduced ? 0 : 5 * 45)), `${tag} a ball drops home as its roll ends (${wraps.map((w) => w.options.delay).join(",")} ms)`);
    const combos = kit.filter((k) => k.kind === "combo");
    check(combos.length === 2 && combos.every((k) => k.sound === null) && played.filter((p) => inLayer(p, "[data-topsy-ring]")).length === 2, `${tag} two home in one tilt pop their rings as a kit combo (silent: gravity.combo)`);
    // The next tilt is taken at once while the lean runs: a tilt that moves nothing nods (full) and sounds nothing.
    const before = played.length;
    cues.length = 0;
    s.tilt("Right");
    const nod = played.slice(before).filter((p) => inLayer(p, "[data-topsy-tilt]"));
    if (reduced) check(nod.length === 0, `${tag} a tilt that moves nothing shows nothing (nothing changed)`);
    else check(nod.length === 1 && nod[0]!.frames.some((f) => String(f.transform).includes("rotateY(2deg)")) && Number(nod[0]!.options.duration) <= 200, `${tag} a tilt that moves nothing gives a small lean only`);
    check(s.last() === "R" && played.slice(before).filter((p) => !inLayer(p, "[data-topsy-tilt]")).length === 0 && kit.length === 4, `${tag} a tilt that moves nothing adds no draft and no other effect`);
    s.tilt("Left");
    check(s.last() === "RL", `${tag} the next tilt during the effects is taken at once`);
    // The cleared board: the tray flips away at the end of its hold, the next one turns in.
    await sleep(1100);
    check(cues.includes("gravity.boardClear"), `${tag} the cleared board plays gravity.boardClear (${cues.join(",")})`);
    const away = played.filter((p) => inLayer(p, "[data-topsy-flip]") && p.options.fill === "forwards");
    const inn = played.filter((p) => inLayer(p, "[data-topsy-flip]") && p.options.fill !== "forwards");
    if (reduced) check(away.length === 0 && inn.length === 1 && inn[0]!.frames.every((f) => f.transform === undefined) && Number(inn[0]!.options.duration) <= 120, `${tag} the next board crossfades in (no flip)`);
    else {
      check(away.length === 1 && String(away[0]!.frames[1]!.transform).includes("rotateY(80deg)") && away[0]!.frames[1]!.opacity === 0, `${tag} the cleared tray flips away (${away.length})`);
      check(inn.length === 1 && String(inn[0]!.frames[0]!.transform).includes("rotateY(-80deg)") && inn[0]!.frames[1]!.opacity === 1, `${tag} the next tray turns in`);
    }
    check(/Board 2/.test(text(s.el.querySelector("[data-topsy-head]")) + text(document.body)) || !!s.el.querySelector("[data-topsy-board]"), `${tag} the next board shows`);
    // Out of tilts on board 2: the banner lands (kit drop, silent) and the closing clunk sounds.
    clear();
    for (const d of upDown) s.tilt(d === "U" ? "Up" : "Down");
    check(s.last() === `RL${upDown.join("")}`, `${tag} every tilt on board 2 is taken at once (${s.last()})`);
    const banner = s.el.querySelector("[data-topsy-banner]");
    check(!!banner && played.some((p) => p.el === banner) && kit.some((k) => k.kind === "drop" && k.sound === null), `${tag} "Out of tilts" lands with the kit's silent drop`);
    await sleep(700);
    check(cues.includes("gravity.outOfTilts") && !cues.includes("gravity.boardClear"), `${tag} running out plays the closing clunk, not the board-cleared sound`);
    // Never the measured grid, the board box, the arena or the stage; only transform and opacity.
    check(!played.some((p) => p.el.matches("[data-topsy-measure], [data-topsy-measure] *, [data-topsy-board], [data-game-arena], [data-stage-column]")), `${tag} an effect moved the measured grid, the board box, the arena or the stage`);
    check(played.every((p) => onlyTransformOpacity(p.frames)), `${tag} an effect animates something other than transform and opacity`);
    check(played.every((p) => Number(p.options.duration) <= 900), `${tag} an effect runs longer than 900 ms`);
    flushSync(() => s.r.unmount());
    await sleep(0);
  }
  reduced = false;

  /* -- Still boards (intro, reveal, tile) play nothing; the board view's drop is the live board's only. -- */
  clear();
  const still = document.createElement("div");
  document.body.appendChild(still);
  const sr = createRoot(still as unknown as Element);
  flushSync(() => sr.render(React.createElement(TopsyBoardView, { board: A, state: topsyStart(A) })));
  flushSync(() => sr.render(React.createElement(TopsyBoardView, { board: A, state: rTilt.state })));
  check(played.length === 0 && kit.length === 0, "a still board plays an effect when its state changes");
  flushSync(() => sr.unmount());

  /* -- Sources: one animate call (the board's play helper), no CSS lean on the measured box, the kit for the pieces. -- */
  const board = src("src/components/puzzles/pattern/topsyBoard.tsx");
  const css = src("src/polish-pattern/topsy.css");
  check((board.match(/\.animate\(/g) ?? []).length === 1 && !/\.animate\(/.test(src("src/puzzles/gravityMaze.tsx")), "Topsy-Turvy animates outside its one play helper");
  check(/gameFx\("drop", wrap\.firstElementChild, \{ delayMs: delay, silent: true \}\)/.test(board) && /gameFx\("combo", rings\?\.\[b\]/.test(board), "the drop home and the combo aren't the kit's");
  check(!/data-lean|data-nudge/.test(css) && !/data-lean=/.test(board), "the measured box still carries a CSS lean");
  check(/\.topsy-measure \{[^}]*visibility: hidden/.test(css) && /\.topsy-measure \{[^}]*inset: 1\.6%/.test(css) && /\.grav-tray\.topsy-tray\[data-topsy-board\] \.grav-well \{[^}]*inset: 1\.6%/.test(css), "the measured grid and the art grid don't share one place");
  window.removeEventListener("duelz-sound", onCue);
  K.setGameFxSink(null);
  stopTopsyRumble();
  root.unmount();
}

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`pattern-overhaul-gravity-check: ${failures.length} failure(s), ${passes} passed`);
  process.exit(1);
}
console.log(`pattern-overhaul-gravity-check: all ${passes} assertions pass`);
process.exit(0);
