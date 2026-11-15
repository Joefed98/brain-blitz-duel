/**
 * pattern-overhaul-push-check (15 Nov 2026, the Pattern overhaul, stage 1, Heave): one assertion per change.
 *
 *  1. No stamp: Heave has no entry in the overhaul's deal layer, so rooms and practice deal exactly what they dealt
 *     before (the same puzzle with or without `pinPrePatternNov15`).
 *  2. Grading is unchanged: every case in scripts/fixtures/pattern-overhaul-push-legacy.json.gz (kit levels, the
 *     empty answer and spam, timelines attached, recorded before the overhaul by
 *     scripts/pattern-overhaul-push-record.ts) regrades to the same score, verdict and stored extra.
 *  3. Undo gives the push back: the stage's Undo drops the last step and its Pushes count is the board's own (a push
 *     undone grades as never played).
 *  4. Par shown in play: pushParFor (pushPar.data.ts) gives the bank's minimum for every layout of both banks and for
 *     live deals read from the public half alone (minPushes stays secret); the data file is up to date; the stage's
 *     pills are Pushes and Par.
 *  5. The reveal: under the solution playing back, the player's own count reads "You: …".
 *  6. Help: the help names par as shown, says Undo and Reset give the push back and where the arrows / swipe choice
 *     lives; the intro keeps at most four HOW lines.
 *  7. Art: every sprite exists as a 120 × 120 WebP with alpha within budget; the stage, the reveal and the intro draw
 *     them (one worker render per facing, the gold crate and gold mark only for the gold pair); no glow left on any
 *     piece.
 *  8. Sound: push.goldOff (fired when the gold crate leaves its mark) and push.stuck (a slot for the deadlock hint) are
 *     manifest slots with a file; the ElevenLabs lines list every Heave slot.
 *
 *   bun scripts/pattern-overhaul-push-check.ts
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
const { gradeAnswer } = await import("../src/lib/duel/generate.server");
const { PATTERN_NOV15_STAMPS } = await import("../src/lib/duel/patternNov15");
const { PUZZLE_INSTRUCTIONS } = await import("../src/lib/duel/instructions");
const { PATTERN_STD_HELP } = await import("../src/lib/duel/standard/patternText");
const { decodePushMoves, encodePushMoves, replayPush, decodePushSolution } = await import("../src/lib/duel/push");
const { pushParFor, pushLayoutKey } = await import("../src/lib/duel/pushPar");
const { splitPuzzle } = await import("../src/lib/duel/secrets");
const { PUSH_BANK } = await import("../src/lib/duel/pushBank.server");
const { PUSH_D4_BANK } = await import("../src/lib/duel/depth4/pushD4Bank.server");
const { pushPuzzle } = await import("../src/puzzles/push");
const { PUSH_SPRITES, PUSH_SPRITE_NAMES, WarehouseBoard } = await import("../src/components/puzzles/pattern/pushArt");
const { SOUND_MANIFEST } = await import("../src/lib/fx/manifest");
const { dealPushEra, pushAnswers, PUSH_LEGACY_SEEDS } = await import("./pattern-overhaul-push-record");
const { pushParSource } = await import("./push-par-data");
type PushPuzzleData = import("../src/lib/duel/types").PushPuzzleData;

const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else failures.push(message);
};
const src = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/* ---------------------------------------------------------------- 1. no stamp */
{
  check(!("push" in PATTERN_NOV15_STAMPS), "Heave has a Pattern overhaul stamp entry (its change is display only)");
  for (const seed of [11, 4242, 90210, ...PUSH_LEGACY_SEEDS]) {
    const live = dealPushEra("live", seed);
    const pinned = dealPushEra("pinned", seed);
    check(same(live, pinned), `seed ${seed}: the live deal differs from the pinned one`);
    check(live.pushRev === 3, `seed ${seed}: the live deal is pushRev ${live.pushRev}, not 3`);
  }
}

/* ---------------------------------------------------------------- 2. grading unchanged */
interface LegacyCase { era: "live" | "pinned"; seed: number; label: string; answer: string; msLeft: number; score: number; isCorrect: boolean; extra: unknown }
const fixture = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/pattern-overhaul-push-legacy.json.gz", import.meta.url))).toString()) as {
  puzzles: { era: "live" | "pinned"; seed: number; puzzle: PushPuzzleData }[];
  cases: LegacyCase[];
};
{
  check(fixture.cases.length >= 40, `the legacy fixture holds only ${fixture.cases.length} cases`);
  check(fixture.cases.some((c) => c.isCorrect) && fixture.cases.some((c) => !c.isCorrect && c.score > 0), "the legacy fixture lacks solves or unfinished credit");
  for (const { era, seed, puzzle } of fixture.puzzles) {
    check(same(dealPushEra(era, seed), puzzle), `${era} seed ${seed}: the deal changed`);
    const rebuilt = pushAnswers(seed, puzzle).map((a) => a.answer);
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

/* ---------------------------------------------------------------- 3. Undo gives the push back */
{
  const stage = src("src/puzzles/push.tsx");
  check(stage.includes("const undo = () => setMoves((current) => current.slice(0, -1));"), "Undo no longer drops the last step from the move list");
  check(/parPills\("Pushes", replay\.pushes, par, "pushes"\)/.test(stage) && /label: "Pushes", value: replay\.pushes/.test(stage), "the Pushes pill isn't the board's own count");
  // A solve with one extra step undone sends the solve's own steps (the answer is the board's steps).
  const solved = fixture.cases.find((c) => c.era === "live" && c.isCorrect)!;
  const sp = fixture.puzzles.find((x) => x.era === "live" && x.seed === solved.seed)!.puzzle;
  const moves = decodePushMoves(solved.answer);
  const r = replayPush(sp.walls, sp.targets, sp.pusher, sp.crates, moves);
  check(r.solved && r.pushes > 0, "the fixture's solve doesn't replay as solved");
  // Undo on the phone removes the step from the list, so the board, its pushes and the sent answer are the solve's.
  const withUndo = [...moves, moves[moves.length - 1]!].slice(0, -1);
  check(encodePushMoves(withUndo) === encodePushMoves(moves), "an undone step is still in the answer");
}

/* ---------------------------------------------------------------- 4. par */
{
  let wrong = 0;
  for (const e of [...PUSH_BANK, ...PUSH_D4_BANK]) if (pushParFor(e) !== e.minPushes) wrong++;
  check(wrong === 0, `${wrong} bank layouts show the wrong par`);
  const keys = new Set([...PUSH_BANK, ...PUSH_D4_BANK].map((e) => pushLayoutKey(e)));
  check(keys.size === PUSH_BANK.length + PUSH_D4_BANK.length, "two bank layouts share a par key");
  check(pushParSource() === src("src/lib/duel/pushPar.data.ts"), "pushPar.data.ts is out of date (bun scripts/push-par-data.ts)");
  check(pushParFor({ walls: [0], crates: [1], targets: [2], pusher: 3 }) === null, "an unknown layout shows a par");
  for (const seed of [3, 77, 1234, 5555, 99999]) {
    const full = dealPushEra("live", seed);
    const { pub } = splitPuzzle(full);
    check(!("minPushes" in pub) && !("solution" in pub), `seed ${seed}: the public half carries the minimum or the solution`);
    check(pushParFor(pub as PushPuzzleData) === full.minPushes, `seed ${seed}: par from the public half is ${pushParFor(pub as PushPuzzleData)}, not ${full.minPushes}`);
  }
  // The stage (outside a frame it draws the text summary) names the par.
  const pub = splitPuzzle(fixture.puzzles[0]!.puzzle).pub as PushPuzzleData;
  const html = renderToStaticMarkup(React.createElement(pushPuzzle.Stage, { puzzle: pub, phaseStartedAt: 0, now: 0, locked: false, onSubmit: () => {} } as never));
  check(html.includes(`par ${fixture.puzzles[0]!.puzzle.minPushes}`), "the stage doesn't show par");
  check(!src("src/puzzles/push.tsx").includes('{ id: "moves", label: "Moves"'), "the stage still shows a Moves pill in place of Par");
}

/* ---------------------------------------------------------------- 5. reveal */
{
  const p = fixture.puzzles[0]!.puzzle;
  const html = renderToStaticMarkup(React.createElement(pushPuzzle.Reveal, { timeLimitMs: 120_000, puzzle: p, myAnswer: "", myCorrect: false, myMsRemaining: 0 } as never));
  check(/You: \d+ \/ \d+ home/.test(html) && html.includes(`Minimum ${p.minPushes} push`), "the unsolved reveal's line doesn't say whose count it is");
  const sol = decodePushSolution(p.solution ?? "");
  check(sol.length === p.minPushes, "the stored solution isn't the minimum");
}

/* ---------------------------------------------------------------- 6. help */
{
  const help = PUZZLE_INSTRUCTIONS.push;
  const lines = help.how.map((h) => `${h.action} ${h.detail}`);
  check(lines.some((l) => /Undo and Reset give the push back/.test(l)), "the help doesn't say Undo gives the push back");
  check(lines.some((l) => /^Par is the fewest pushes, shown/.test(l)), "the help doesn't say par is shown");
  check(lines.some((l) => /game menu \(⋮\) or Settings → Game controls/.test(l)), "the help doesn't say where the arrows / swipe choice is");
  check(help.how.filter((h) => !h.helpOnly).length <= 4, "the intro shows more than four HOW lines");
  check(/\(par, shown\)/.test(PATTERN_STD_HELP.push), "the score help doesn't name par as shown");
  check(!/hatched/i.test(src("src/puzzles/push.tsx")), "the intro still talks about hatched markings");
}

/* ---------------------------------------------------------------- 7. art */
{
  let total = 0;
  for (const name of PUSH_SPRITE_NAMES) {
    const url = new URL(`../public/pattern-art/push/${name}.webp`, import.meta.url);
    if (!existsSync(url)) {
      failures.push(`${name}.webp is missing`);
      continue;
    }
    const buf = readFileSync(url);
    total += buf.length;
    const riff = buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP";
    const vp8x = buf.toString("ascii", 12, 16) === "VP8X";
    const alpha = vp8x && (buf[20]! & 0x10) !== 0;
    const w = vp8x ? 1 + buf.readUIntLE(24, 3) : 0;
    const h = vp8x ? 1 + buf.readUIntLE(27, 3) : 0;
    check(riff && alpha, `${name}.webp isn't a WebP with alpha`);
    check(w === 120 && h === 120, `${name}.webp is ${w} × ${h}, not one 120 px cell`);
    check(buf.length <= 25_000, `${name}.webp is ${buf.length} bytes (over 25 KB)`);
  }
  check(total <= 400_000, `the sprites total ${total} bytes`);
  const p = fixture.puzzles[0]!.puzzle;
  const board = renderToStaticMarkup(
    React.createElement(WarehouseBoard, { walls: p.walls, targets: p.targets, crates: p.crates, pusher: p.pusher, cols: 9, cells: 81, facing: "L", gold: p.gold }),
  );
  check(board.includes(`href="${PUSH_SPRITES.floor}"`) && board.includes(`href="${PUSH_SPRITES.wall}"`), "the board doesn't draw the floor and wall tiles");
  check((board.match(new RegExp(`href="${PUSH_SPRITES.goldMark}"`, "g")) ?? []).length === 1, "the board doesn't draw exactly one gold mark");
  check((board.match(new RegExp(`href="${PUSH_SPRITES.mark}"`, "g")) ?? []).length === p.targets.length - 1, "the board doesn't draw a mark on every other target");
  check((board.match(new RegExp(`src="${PUSH_SPRITES.goldCrate}"`, "g")) ?? []).length === 1, "the board doesn't draw exactly one gold crate");
  check((board.match(new RegExp(`src="${PUSH_SPRITES.crate}"`, "g")) ?? []).length === p.crates.length - 1, "the board doesn't draw every other crate as wood");
  check(board.includes(`src="${PUSH_SPRITES.worker.L}"`) && !board.includes("rotate("), "the worker isn't drawn from its own facing's render");
  const plain = renderToStaticMarkup(React.createElement(WarehouseBoard, { walls: p.walls, targets: p.targets, crates: p.crates, pusher: p.pusher, cols: 9, cells: 81 }));
  check(!plain.includes(PUSH_SPRITES.goldCrate) && !plain.includes(PUSH_SPRITES.goldMark) && plain.includes(`src="${PUSH_SPRITES.worker.U}"`), "a board with no gold pair draws gold, or the worker doesn't face up by default");
  const home = renderToStaticMarkup(React.createElement(WarehouseBoard, { walls: [], targets: [4], crates: [4], pusher: 0, cols: 3, cells: 9 }));
  check(home.includes('aria-label="Crate home"') && home.includes("push-home-tick"), "a crate on its mark isn't ticked");
  const intro = renderToStaticMarkup(React.createElement(pushPuzzle.IntroExample!));
  check(intro.includes(PUSH_SPRITES.crate) && intro.includes(PUSH_SPRITES.wall), "the intro example doesn't draw the sprites");
  const reveal = renderToStaticMarkup(React.createElement(pushPuzzle.Reveal, { timeLimitMs: 120_000, puzzle: p, myAnswer: "", myCorrect: false, myMsRemaining: 0 } as never));
  check(reveal.includes(PUSH_SPRITES.goldCrate) && reveal.includes(PUSH_SPRITES.floor), "the reveal doesn't draw the sprites");
  for (const f of ["src/polish-pattern/push.css", "src/components/puzzles/depth4/depth4.css"]) {
    check(!/push[^{]*\{[^}]*drop-shadow\(0 0 /.test(src(f)) && !/d4-gold[^{]*\{[^}]*(drop-shadow|box-shadow)/.test(src(f)), `${f}: a glow is still on a Heave piece`);
  }
  const batch = src("src/polish-batch-p/batch-p.css");
  check(!/\.push-crate[^{]*\{[^}]*drop-shadow/.test(batch) && !batch.includes(".push-crate-lit"), "batch-p.css still glows or lights the crates");
}

/* ---------------------------------------------------------------- 8. sound */
{
  const manifest = SOUND_MANIFEST as unknown as Record<string, { url: string | null }>;
  for (const slot of ["push.goldOff", "push.stuck", "push.home", "push.solve"]) {
    const e = manifest[slot];
    check(!!e && !!e.url && existsSync(new URL(`../public${e.url}`, import.meta.url)), `${slot}: no manifest slot with a file`);
  }
  for (const slot of ["push.step", "push.push"]) check(!!manifest[slot], `${slot}: no manifest slot`);
  const stage = src("src/puzzles/push.tsx");
  check(/if \(gold && goldHome && result\.state\.crates\[gold\.crate\] !== gold\.target\) soundCue\("push\.goldOff"\)/.test(stage), "the stage doesn't fire push.goldOff when the gold crate leaves its mark");
  check(stage.includes('soundCue(result.pushed ? "push.push" : "push.step")'), "steps and pushes no longer fire their own slots");
  check(!stage.includes('"push.stuck"'), "push.stuck fires before the deadlock hint exists");
  const doc = src("docs/sound-cues/pattern-elevenlabs.md");
  const section = doc.slice(doc.indexOf("<!-- heave:start -->"), doc.indexOf("<!-- heave:end -->"));
  for (const slot of ["push.step", "push.push", "push.home", "push.goldOff", "push.stuck", "push.solve"])
    check(section.includes(`\`${slot}\``), `pattern-elevenlabs.md's Heave section doesn't list ${slot}`);
  const cues = src("docs/sound-cues/pattern.md");
  for (const slot of ["push.goldOff", "push.stuck"]) check(cues.includes(`\`${slot}\``), `docs/sound-cues/pattern.md doesn't list ${slot}`);
}

void statSync;
if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`pattern-overhaul-push-check: ${failures.length} failure(s), ${passes} passed`);
  process.exit(1);
}
console.log(`pattern-overhaul-push-check: all ${passes} assertions pass`);
