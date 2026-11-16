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
 *  5. The reveal: Solution / Yours columns for the switch, each board full size; the minimum route as arrow chips; the
 *     player's final warehouse with the crates not home outlined and the empty marks ringed; the key numbers (Par,
 *     You, Home, Gold crate, Time left) from the stored grade, the player's own only under Yours; no "×"; for a
 *     solved and an unfinished answer on today's stamp and on an older one (no gold pair).
 *  6. Help: the help names par as shown, says Undo and Reset give the push back and where the arrows / swipe choice
 *     lives; the intro keeps at most four HOW lines.
 *  7. Art: every sprite exists as a 160 × 160 WebP with alpha within budget; the stage, the reveal and the intro draw
 *     them (one worker render per facing, the gold crate and gold mark only for the gold pair); no glow left on any
 *     piece.
 *  8. Sound: push.goldOff (fired when the gold crate leaves its mark) and push.stuck (a slot for the deadlock hint) are
 *     manifest slots with a file; the ElevenLabs lines list every Heave slot.
 *  9. The effects (stage 2, pushFx.ts on the effects kit): a step its footstep only; a push its scrape with the crate's
 *     glide 60 ms behind the worker's; a crate home the thump, the kit's silent drop on the crate and its mark glowing
 *     (never on a refused step, Undo or Reset); the gold crate off its gold mark the sound and a dim of the mark (no
 *     shake); the solve's lights a wash over the floor under the pieces, staying on; the next step taken during an
 *     effect; reduced motion a 120 ms crossfade; transform and opacity only; the kit's silent win on a solved reveal.
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
const { SOLUTION_SWITCH_TYPES } = await import("../src/components/duel/SolutionSwitch");
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
  check(SOLUTION_SWITCH_TYPES.has("push"), "Heave's reveal isn't on the Solution / Yours switch");
  const reveal = (puzzle: PushPuzzleData, answer: string | null, extra: Record<string, unknown> | null, msLeft = 0) => {
    const g2 = answer === null ? null : gradeAnswer(puzzle, answer, msLeft);
    const stored = extra ?? ((g2?.extra as Record<string, unknown> | undefined) ?? null);
    return {
      grade: g2,
      stored,
      html: renderToStaticMarkup(
        React.createElement(pushPuzzle.Reveal, { timeLimitMs: 120_000, puzzle, myAnswer: answer, myCorrect: !!g2?.isCorrect, myMsRemaining: msLeft, myReactionAvgMs: null, myExtra: stored } as never),
      ),
    };
  };
  const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;
  const pill = (html: string, key: string) => html.match(new RegExp(`data-push-key="${key}"[^>]*>(.*?)</span></span>`))?.[1]?.replace(/<[^>]+>/g, "") ?? null;
  // An older stamp: a layout from the first bank, no gold pair, no stamp.
  const e = PUSH_BANK[3]!;
  const older = { type: "push", walls: e.walls, crates: e.crates, targets: e.targets, pusher: e.pusher, minPushes: e.minPushes, solution: e.solution } as PushPuzzleData;
  const live = fixture.puzzles.find((x) => x.era === "live")!.puzzle;
  const solvedCase = fixture.cases.find((c) => c.era === "live" && c.seed === fixture.puzzles.find((x) => x.puzzle === live)!.seed && c.isCorrect);
  const unfinishedCase = fixture.cases.find((c) => c.era === "live" && c.seed === fixture.puzzles.find((x) => x.puzzle === live)!.seed && !c.isCorrect && c.answer.length > 0);
  check(!!solvedCase && !!unfinishedCase, "the fixture lacks a solved and an unfinished answer for the reveal");
  // The solution's own pushes, as the phone sends them (a walk between pushes), for the older stamp.
  const walkSolution = (pz: PushPuzzleData) => {
    const walls = new Set(pz.walls);
    let state = { pusher: pz.pusher, crates: [...pz.crates] };
    const out: string[] = [];
    const behind: Record<string, number> = { U: 9, D: -9, L: 1, R: -1 };
    for (const m of decodePushSolution(pz.solution ?? "")) {
      const goal = m.cell + behind[m.dir]!;
      // BFS for the worker to the cell behind the crate.
      const prev = new Map<number, [number, string]>([[state.pusher, [-1, ""]]]);
      const q = [state.pusher];
      while (q.length && !prev.has(goal)) {
        const c = q.shift()!;
        for (const d of ["U", "D", "L", "R"] as const) {
          const n = c + { U: -9, D: 9, L: -1, R: 1 }[d];
          if (n < 0 || n > 80 || walls.has(n) || state.crates.includes(n) || prev.has(n)) continue;
          if ((d === "L" || d === "R") && Math.floor(n / 9) !== Math.floor(c / 9)) continue;
          prev.set(n, [c, d]);
          q.push(n);
        }
      }
      const path: string[] = [];
      for (let c = goal; prev.get(c)![0] !== -1; c = prev.get(c)![0]) path.unshift(prev.get(c)![1]);
      out.push(...path, m.dir);
      for (const d of [...path, m.dir]) state = replayPush(pz.walls, pz.targets, state.pusher, state.crates, [d as never]).state;
    }
    return out.join("");
  };
  const olderSolve = walkSolution(older);
  check(replayPush(older.walls, older.targets, older.pusher, older.crates, decodePushMoves(olderSolve)).solved, "the older stamp's walked solution doesn't solve");
  const olderUnfinished = olderSolve.slice(0, Math.floor(olderSolve.length / 2));

  for (const [label, puzzle, answer, msLeft] of [
    ["live solved", live, solvedCase!.answer, solvedCase!.msLeft],
    ["live unfinished", live, unfinishedCase!.answer, unfinishedCase!.msLeft],
    ["older solved", older, olderSolve, 40_000],
    ["older unfinished", older, olderUnfinished, 0],
  ] as const) {
    const { grade: g2, stored, html } = reveal(puzzle, answer, null, msLeft);
    const solved = !!g2?.isCorrect;
    check(html.includes(">Solution<") && html.includes(">Yours<"), `${label}: the reveal lacks its Solution / Yours columns`);
    check(!html.includes("×"), `${label}: a stray × in the reveal`);
    check(count(html, /class="push-route-chip"/g) === decodePushSolution(puzzle.solution ?? "").length, `${label}: the route strip doesn't hold one chip a push of the solution`);
    check(html.includes(`data-push-yours-board="${solved ? "solved" : "unfinished"}"`), `${label}: the Yours board isn't the player's ${solved ? "solved" : "unfinished"} warehouse`);
    const final = replayPush(puzzle.walls, puzzle.targets, puzzle.pusher, puzzle.crates, decodePushMoves(answer));
    const notHome = final.state.crates.filter((c) => !puzzle.targets.includes(c)).length;
    check(count(html, /data-push-missed=""/g) === (solved ? 0 : notHome), `${label}: ${count(html, /data-push-missed=""/g)} crates outlined, ${solved ? 0 : notHome} not home`);
    check(count(html, /data-push-empty-mark=/g) === (solved ? 0 : notHome), `${label}: the empty marks aren't ringed`);
    if (!solved && notHome) check(html.includes(`data-push-missed-count="${notHome}"`), `${label}: no note on the crates not home`);
    // The key numbers are the stored grade's.
    check(pill(html, "par") === `Par ${stored!["minPushes"]}`, `${label}: the Par pill reads ${pill(html, "par")}, the grade stored ${stored!["minPushes"]}`);
    check(pill(html, "pushes") === `You ${stored!["pushes"]}`, `${label}: the You pill reads ${pill(html, "pushes")}`);
    check(pill(html, "home") === `Home ${stored!["cratesHome"]} / ${stored!["crates"]}`, `${label}: the Home pill reads ${pill(html, "home")}`);
    check(solved ? pill(html, "time") === `Time left ${Math.round(msLeft / 1000)} s` : pill(html, "time") === null, `${label}: the Time left pill is wrong`);
    check((pill(html, "gold") !== null) === (puzzle.pushRev ?? 0) >= 1, `${label}: the gold pill shows on the wrong stamp`);
    check(/data-push-key="pushes" data-yours-only=""/.test(html) && !/data-push-key="par" data-yours-only/.test(html), `${label}: the player's count isn't marked Yours-only (or par is)`);
  }
  // Stored figures win over the phone's replay.
  const { html: forged } = reveal(live, unfinishedCase!.answer, { ...(gradeAnswer(live, unfinishedCase!.answer, 0).extra as Record<string, unknown>), pushes: 77, minPushes: 31 });
  check(pill(forged, "pushes") === "You 77" && pill(forged, "par") === "Par 31", "the reveal recomputes its numbers instead of reading the stored grade");
  // No answer: the solution alone.
  const none = renderToStaticMarkup(React.createElement(pushPuzzle.Reveal, { timeLimitMs: 120_000, puzzle: live, myAnswer: null, myCorrect: false, myReactionAvgMs: null } as never));
  check(!none.includes("data-push-yours-board") && none.includes("push-route-chip"), "a reveal with no answer doesn't show the solution alone");
  // Both boards drawn large: the reveal board takes the space's full width and height, never a half-size copy.
  check(/\.push-reveal-board \{ width: min\(100cqw, 100cqh, 400px\)/.test(src("src/polish-pattern/push.css")), "the reveal board isn't sized to the whole space");
  const sol = decodePushSolution(live.solution ?? "");
  check(sol.length === live.minPushes, "the stored solution isn't the minimum");
}

/* ---------------------------------------------------------------- 6. help */
{
  const help = PUZZLE_INSTRUCTIONS.push;
  const lines = help.how.map((h) => `${h.action} ${h.detail}`);
  check(lines.some((l) => /Undo and Reset give the push back/.test(l)), "the help doesn't say Undo gives the push back");
  check(lines.some((l) => /^Par is the fewest pushes, shown/.test(l)), "the help doesn't say par is shown");
  check(lines.some((l) => /^A green tick marks a crate on a mark/.test(l)), "the help doesn't describe the crate-home tick");
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
    const chunk = buf.toString("ascii", 12, 16);
    const vp8x = chunk === "VP8X";
    const alpha = vp8x && (buf[20]! & 0x10) !== 0;
    // A full tile (floor, wall) is opaque edge to edge, so the encoder writes a plain lossy WebP (VP8) without alpha.
    const w = vp8x ? 1 + buf.readUIntLE(24, 3) : chunk === "VP8 " ? buf.readUInt16LE(26) & 0x3fff : 0;
    const h = vp8x ? 1 + buf.readUIntLE(27, 3) : chunk === "VP8 " ? buf.readUInt16LE(28) & 0x3fff : 0;
    const fullTile = name === "floor" || name === "wall";
    check(riff && (alpha || fullTile), `${name}.webp isn't a WebP with alpha`);
    check(w === 160 && h === 160, `${name}.webp is ${w} × ${h}, not one 160 px cell`);
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
  // Changed with Joe's approval, 15 Nov 2026 (routine consequence of the Pattern overhaul): stage 2 adds the gold mark's
  // dim beside the sound, so the condition now opens a block.
  check(/if \(gold && goldHome && result\.state\.crates\[gold\.crate\] !== gold\.target\) \{\s*soundCue\("push\.goldOff"\);\s*setGoldOff\(/.test(stage), "the stage doesn't fire push.goldOff when the gold crate leaves its mark");
  check(stage.includes('soundCue(result.pushed ? "push.push" : "push.step")'), "steps and pushes no longer fire their own slots");
  // Stage 3 (16 Nov 2026, the levels): the deadlock hint exists now, so push.stuck fires, and only behind it (the level's
  // stuck hint, pattern-overhaul-push-levels-check section 7); flipped from "never fires" as the assertion itself foresaw.
  check(/if \(dead && result\.pushed && [^\n]*soundCue\("push\.stuck"\)/.test(stage), "push.stuck fires outside the deadlock hint");
  const doc = src("docs/sound-cues/pattern-elevenlabs.md");
  const section = doc.slice(doc.indexOf("<!-- heave:start -->"), doc.indexOf("<!-- heave:end -->"));
  for (const slot of ["push.step", "push.push", "push.home", "push.goldOff", "push.stuck", "push.solve"])
    check(section.includes(`\`${slot}\``), `pattern-elevenlabs.md's Heave section doesn't list ${slot}`);
  const cues = src("docs/sound-cues/pattern.md");
  for (const slot of ["push.goldOff", "push.stuck"]) check(cues.includes(`\`${slot}\``), `docs/sound-cues/pattern.md doesn't list ${slot}`);
}

/* ---------------------------------------------------------------- 9. the effects (stage 2) */
{
  // Real timers and React's own scheduling; the page's own events (Bun's globals are another realm's).
  g["IS_REACT_ACT_ENVIRONMENT"] = false;
  g["CustomEvent"] = (win as unknown as Record<string, unknown>)["CustomEvent"];
  g["Event"] = (win as unknown as Record<string, unknown>)["Event"];
  for (const key of ["PointerEvent", "MouseEvent", "KeyboardEvent", "requestAnimationFrame", "cancelAnimationFrame", "localStorage", "matchMedia"]) {
    if (g[key] === undefined) g[key] = (win as unknown as Record<string, unknown>)[key];
  }
  const { createRoot } = await import("react-dom/client");
  const { forceGameFxVariant, setGameFxSink } = await import("../src/lib/fx/kit");
  const { PUSH_CRATE_LAG_MS } = await import("../src/components/puzzles/pattern/pushFx");
  const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

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
  const on = (r: Rec, sel: string) => (r.el as Element).matches?.(sel);

  // A hand-made 9 × 9 warehouse (walls round the edge): the worker at 10; crate A at 11 one push from its mark at 12;
  // the gold crate at 20 on its gold mark; crate C at 23 one push from its mark at 24.
  const border = Array.from({ length: 81 }, (_, c) => c).filter((c) => c < 9 || c >= 72 || c % 9 === 0 || c % 9 === 8);
  const puzzle = { type: "push", walls: border, crates: [11, 20, 23], targets: [12, 20, 24], pusher: 10, pushRev: 1, gold: { crate: 1, target: 20 } } as unknown as PushPuzzleData;
  const drafts: string[] = [];
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host as unknown as Element);
  const mount = async (key: string) => {
    root.render(
      React.createElement(pushPuzzle.Stage, { key, puzzle, phaseStartedAt: 0, now: 0, locked: false, onSubmit: () => {}, onDraftAnswer: (a: string) => drafts.push(a), stateKey: `fx-${key}` } as never),
    );
    await sleep(60);
  };
  const press = (label: string) => {
    const named = [...host.querySelectorAll("button")].find((b) => !b.getAttribute("aria-label") && b.textContent?.trim() === label);
    if (named) return void (named as unknown as { click(): void }).click();
    const btn = host.querySelector(`button[aria-label="${label}"]`);
    if (!btn) throw new Error(`no ${label} button`);
    btn.dispatchEvent(new win.PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }) as unknown as Event);
    btn.dispatchEvent(new win.PointerEvent("pointerup", { bubbles: true, pointerId: 1 }) as unknown as Event);
  };
  const clear = () => {
    recs.length = 0;
    kit.length = 0;
    cues.length = 0;
  };
  const mine = () => recs.filter((r) => on(r, ".push-mark-glow, .push-gold-dim, .push-piece-inner"));
  forceGameFxVariant("full");
  await mount("a");
  check(mine().length === 0 && kit.length === 0, "fx: the first draw plays an effect");

  // A step into the wall is refused: none of Heave's effects.
  clear();
  press("Up");
  await sleep(40);
  check(mine().length === 0 && !kit.some((k) => k.kind === "drop") && !cues.includes("push.home"), "fx: a refused step plays a crate effect");

  // Right: crate A onto its mark, two of three home: the thump (push.home), the kit's silent drop on the crate and its
  // mark glowing; Down at once (the gold crate off its gold mark) is taken while those still run.
  clear();
  press("Right");
  await sleep(20);
  press("Down");
  await sleep(60);
  check(drafts.at(-1) === "RD", `fx: the next step during an effect wasn't taken (${drafts.at(-1)})`);
  check(cues.includes("push.push") && cues.includes("push.home"), `fx: the push and the crate home don't sound (${cues})`);
  const dropOn = recs.filter((r) => on(r, "[data-push-crate] > .push-piece-inner"));
  check(kit.filter((k) => k.kind === "drop" && k.variant === "full" && k.sound === null).length === 1 && dropOn.length === 1, `fx: a crate home isn't the kit's silent drop on the crate (${JSON.stringify(kit)})`);
  const glow = recs.find((r) => on(r, ".push-mark-glow"));
  check(!!glow && glow.frames.some((f) => f.opacity === 1) && glow.frames.at(-1)!.opacity === 0, "fx: the mark doesn't glow up and fade back");
  const glowCell = host.querySelector(".push-mark-glow-cell") as unknown as HTMLElement | null;
  check(!!glowCell && /translate\(300%, 100%\)/.test(glowCell.getAttribute("style") ?? ""), `fx: the glow isn't on the mark the crate landed on (${glowCell?.getAttribute("style")})`);
  // The gold crate pushed off its gold mark: the sound and a dim of the gold mark, no shake (no kit "wrong").
  check(cues.includes("push.goldOff") && recs.some((r) => on(r, ".push-gold-dim") && r.frames.some((f) => Number(f.opacity) > 0)), `fx: the gold crate off its mark doesn't dim the mark (${cues})`);
  check(!kit.some((k) => k.kind === "wrong") && !recs.some((r) => on(r, ".push-gold-dim") && r.frames.some((f) => f.transform)), "fx: the gold mark shakes");
  const dimCell = host.querySelector(".push-gold-dim-cell") as unknown as HTMLElement | null;
  check(!!dimCell && /translate\(200%, 200%\)/.test(dimCell.getAttribute("style") ?? ""), "fx: the dim isn't over the gold mark");
  // Undo puts the gold crate back on its mark: no thump, no glow, no dim.
  clear();
  press("Undo");
  await sleep(60);
  check(drafts.at(-1) === "R" && mine().length === 0 && !kit.some((k) => k.kind === "drop"), `fx: Undo plays a crate effect (${drafts.at(-1)}, ${mine().length})`);
  // A plain step: its footstep only.
  clear();
  press("Down");
  await sleep(40);
  check(cues.includes("push.push") && cues.includes("push.goldOff"), "fx: pushing the gold crate off again doesn't sound");
  clear();
  press("Right");
  await sleep(40);
  check(cues.join() === "push.step" && mine().length === 0, `fx: a plain step plays more than its footstep (${cues})`);
  // On to the solve: C home, then the gold crate back up onto its mark.
  for (const d of ["Right", "Right", "Down", "Down", "Left", "Left", "Left", "Up"]) {
    press(d);
    await sleep(30);
  }
  await sleep(60);
  const board = host.querySelector(".push-board");
  check(drafts.at(-1) === "RDRRRDDLLLU" && board?.getAttribute("data-lit") === "true" && cues.includes("push.solve"), `fx: the solve doesn't switch the lights on (${drafts.at(-1)}, ${cues})`);
  // The lights are a wash over the floor, under the pieces.
  const order = [...(board?.children ?? [])].map((c) => (c.classList.contains("push-lights") ? "L" : c.hasAttribute("data-push-crate") ? "C" : c.classList.contains("push-floor") ? "F" : "."));
  check(order.indexOf("F") < order.indexOf("L") && order.indexOf("L") < order.indexOf("C"), `fx: the lights aren't between the floor and the pieces (${order.join("")})`);
  await sleep(1300);
  check(host.querySelector(".push-board")?.getAttribute("data-lit") === "true" && !!host.querySelector(".push-lights"), "fx: the lights don't stay on once solved");
  check(recs.every((r) => Number(r.options.duration ?? 0) <= 900), "fx: an effect runs longer than 900 ms");
  check(onlyTransformOpacity(), "fx: an effect animates something other than transform and opacity");
  check(!recs.some((r) => (r.el as Element).tagName === "BUTTON" || on(r, "[data-game-arena], [data-game-stage], .push-board, [data-push-crate], .push-piece-worker")), "fx: an effect moves a control, the board, a piece's cell box or the arena");
  root.unmount();

  // Reduced motion: every change a 120 ms crossfade, no movement.
  forceGameFxVariant("reduced");
  const root2 = createRoot(host as unknown as Element);
  root2.render(React.createElement(pushPuzzle.Stage, { puzzle, phaseStartedAt: 0, now: 0, locked: false, onSubmit: () => {}, stateKey: "fx-r" } as never));
  await sleep(60);
  clear();
  press("Right");
  await sleep(30);
  press("Down");
  await sleep(60);
  check(kit.some((k) => k.kind === "drop" && k.variant === "reduced"), "fx: the reduced crate home isn't the kit's");
  check(recs.length >= 3 && recs.every((r) => r.frames.every((f) => f.transform === undefined) && Number(r.options.duration) <= 120), `fx: reduced motion still moves something, or longer than 120 ms (${JSON.stringify(recs.map((r) => [r.frames, r.options.duration]))})`);
  check(recs.some((r) => on(r, ".push-mark-glow")) && recs.some((r) => on(r, ".push-gold-dim")), "fx: reduced motion doesn't show the glow or the dim");
  root2.unmount();

  // The reveal: a solve's payoff is the kit's win on the reveal's result card, silent; never on an unfinished one.
  forceGameFxVariant("full");
  const card = document.createElement("div");
  card.className = "answer-reveal-content";
  card.innerHTML = '<div data-verdict-row=""></div><div class="x"></div>';
  document.body.appendChild(card);
  const rroot = createRoot(card.querySelector(".x") as unknown as Element);
  clear();
  rroot.render(React.createElement(pushPuzzle.Reveal, { puzzle, myAnswer: "R", myCorrect: false, myMsRemaining: 0, myExtra: null } as never));
  await sleep(60);
  check(!kit.some((k) => k.kind === "win"), "fx: an unfinished reveal plays the win");
  rroot.render(React.createElement(pushPuzzle.Reveal, { puzzle, myAnswer: "RDRRRDDLLLU", myCorrect: true, myMsRemaining: 30_000, myExtra: null } as never));
  await sleep(60);
  check(kit.filter((k) => k.kind === "win" && k.sound === null).length === 1 && recs.some((r) => on(r, "[data-verdict-row]")), `fx: the solved reveal isn't the kit's silent win on the result card (${JSON.stringify(kit)})`);
  rroot.unmount();

  forceGameFxVariant(null);
  setGameFxSink(null);
  proto["animate"] = realAnimate;

  // The crate's glide a beat behind the worker's; only pushFx.ts (and the kit) start animations; CSS transform and
  // opacity only; push.stuck still unfired (it comes with the levels).
  const css = src("src/polish-pattern/push.css");
  check(PUSH_CRATE_LAG_MS === 60 && /\.push-piece\[data-push-crate\] \{ transition-delay: 60ms; \}/.test(css), "fx: the crate's glide doesn't start 60 ms after the worker's");
  check(/\.push-piece \{[^}]*transition: transform 120ms/.test(css), "fx: the worker's step isn't a 120 ms glide");
  for (const file of ["src/puzzles/push.tsx", "src/components/puzzles/pattern/pushArt.tsx"]) check(!/\.animate\(/.test(src(file)), `fx: ${file} animates outside pushFx.ts`);
  const fxSrc = src("src/components/puzzles/pattern/pushFx.ts");
  check(/from "@\/lib\/fx\/kit"/.test(fxSrc) && /gameFx\("drop"/.test(fxSrc), "fx: a crate home isn't the kit's drop");
  for (const [, name, body] of css.matchAll(/@keyframes ([\w-]+) \{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)) {
    const props = [...body!.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    check(props.every((p) => p === "transform" || p === "opacity"), `fx: keyframes ${name} animate ${props.join(", ")}`);
  }
  // Stage 3: push.stuck fires once, from the deadlock hint (flipped from "never" now the levels exist).
  check((src("src/puzzles/push.tsx").match(/"push\.stuck"/g) ?? []).length === 1, "fx: push.stuck fires other than once, from the hint");
}

void statSync;
if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`pattern-overhaul-push-check: ${failures.length} failure(s), ${passes} passed`);
  process.exit(1);
}
console.log(`pattern-overhaul-push-check: all ${passes} assertions pass`);
