/**
 * pattern-overhaul-pipes-check (15 Nov 2026, the Pattern overhaul stage 1; patternNov15.ts, docs/design/game-reviews/
 * pattern.md "Pipeline"): Pipeline's pipesRev 5 and its new look, one assertion per change. No browser (happy-dom).
 *
 *   1. Older stamps grade exactly as before: every case of scripts/fixtures/pattern-overhaul-pipes-legacy.json.gz
 *      (pipesRev 3 and 4, recorded before the change by scripts/pattern-overhaul-pipes-record.ts) regrades identically,
 *      including logs carrying pipesRev 5's "-cell" turns (no turn on those stamps).
 *   2. The deal: live deals carry pipesRev 5 with par counted both ways (never above the clockwise par); the pinned deal
 *      is pipesRev 4 with the clockwise par; the board, source and solution are the same.
 *   3. pipesRev 5's rule: "-cell" is an anticlockwise quarter turn; a solve in par turns either way scores the full par
 *      bonus (200 at full time); the same solve clockwise only is over par; the kit's clockwise logs still grade.
 *   4. The help and intro say what changed (both ways, leaks, par in turns), within intro-score-text-check's limits;
 *      the pinned texts are the old ones.
 *   5. The sprites: every file exists, is WebP with alpha, at most 25 KB, 400 KB for the game.
 *   6. The art is wired: the board draws the sprites (dry and wet, turned by transforms), the source valve, spills at the
 *      network's open ends only; the reveal's own line is Yours-only and has no "×".
 *   7. The gestures: a tap turns clockwise, a long press, a swipe and a right click anticlockwise (once each).
 *   8. The sounds: every slot is in the manifest and fired by the stage; each has a line in the ElevenLabs list.
 *   9. The answer reveal (Joe's reveal redesign): Solution and Yours each one large board (the shared switch's labels),
 *      Yours the board as the server graded it (the log cut at the stored turns) with turned-but-wrong tiles outlined
 *      red, untouched ones dimmed and the network's open ends spraying; the player's line "You: …" only in the Yours
 *      column; pills from the stored grade (Turns, Par, Joined, Time left); no "×". Solved, unfinished and empty answers
 *      on pipesRev 5, and every kind of the legacy fixture's pipesRev 3 and 4 cases, plus an unlogged pipesRev 0 board.
 *  10. The intro and demos: older demos stopped; both live practice challenges and the 175 star still reachable.
 *  11. The effects (stage 2, pipesFx.ts on the effects kit): the ratchet turn both ways on the pipe's own art; water
 *      running into newly joined pipes from the side it enters by, in order from the source, ~200 ms a pipe, all within
 *      900 ms; cut-off pipes draining furthest first; nothing animates on a redraw; the next turn taken mid-effect;
 *      transform and opacity only, never the tile button, board or arena; reduced motion a 120 ms crossfade (the kit's
 *      for the turn) with no bubbles; the solve's source bubbles; the stage's wiring (the sized gurgle, the kit's silent
 *      combo, the bubble cue, the kit's win on the result).
 */
import { readFileSync, statSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Window } from "happy-dom";

const win = new Window({ url: "http://localhost/", width: 390, height: 700 });
const g = globalThis as Record<string, unknown>;
for (const key of ["window", "document", "navigator", "Node", "Element", "HTMLElement", "SVGElement", "Text", "Event", "CustomEvent", "PointerEvent", "MouseEvent", "getComputedStyle", "MutationObserver"]) {
  if (g[key] === undefined) g[key] = key === "window" ? win : (win as unknown as Record<string, unknown>)[key];
}
g["IS_REACT_ACT_ENVIRONMENT"] = true;

const React = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { generatePuzzle, gradeAnswer } = await import("../src/lib/duel/generate.server");
const { pinPrePatternNov15, usesPatternNov15 } = await import("../src/lib/duel/patternNov15");
const { withSeededRandom } = await import("../src/lib/duel/random");
const { decodePipesTurns, encodePipesTurnAnswer, pipesAfterTurns, pipesParTurns, pipesTwoWayParTurns } = await import("../src/lib/duel/depth4/pipesTaps");
const { gradePipesBoard } = await import("../src/lib/duel/logic.server");
const { rotateMask, tileOpenings, PIPE_E, PIPE_N, PIPE_S, PIPE_W } = await import("../src/lib/duel/logic");
const { PUZZLE_INSTRUCTIONS } = await import("../src/lib/duel/instructions");
const { patternStdHelp, patternStdIntro } = await import("../src/lib/duel/standard/patternText");
const { INTRO_SCORE } = await import("../src/lib/duel/introScore");
const { PipesBoard, pipesPuzzle, networkLeakArms, pipesRevealView, PIPES_LONG_PRESS_MS } = await import("../src/puzzles/pipes");
const { pipeArtUrls, pipeSprite } = await import("../src/components/puzzles/pattern/pipesArt");
const { SOUND_MANIFEST } = await import("../src/lib/fx/manifest");
const { PIPES_OVERHAUL_FIXTURE, pipesOverhaulAnswers } = await import("./pattern-overhaul-pipes-record");
import type { PipesOverhaulFixture } from "./pattern-overhaul-pipes-record";
import type { PipeTile, PuzzleData } from "../src/lib/duel/types";

const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else failures.push(message);
};
const src = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
type Pipes = Extract<PuzzleData, { type: "pipes" }>;

/* 1. Older stamps grade exactly as before. */
{
  const fx = JSON.parse(gunzipSync(readFileSync(PIPES_OVERHAUL_FIXTURE)).toString()) as PipesOverhaulFixture;
  check(fx.cases.length >= 400, `legacy: only ${fx.cases.length} cases`);
  check(fx.cases.some((c) => /~(?:.*,)?-\d/.test(c.answer)), "legacy: no case carries an anticlockwise turn");
  let diff = 0;
  for (const c of fx.cases) {
    const p = fx.puzzles[c.p]!;
    const gr = gradeAnswer(p, c.answer, c.msLeft);
    const same = gr.score === c.score && gr.isCorrect === c.correct && (gr.storedMs ?? null) === c.storedMs && JSON.stringify(gr.extra ?? null) === JSON.stringify(c.extra);
    if (!same && diff++ < 3) failures.push(`legacy: pipesRev ${(p as Pipes).pipesRev} case regrades ${gr.score} (was ${c.score})`);
  }
  check(diff === 0, `legacy: ${diff} of ${fx.cases.length} cases regrade differently`);
  check(fx.puzzles.every((p) => !usesPatternNov15(p, "pipes")), "legacy: a fixture puzzle reads as pipesRev 5");
}

/* 2. The deal. */
const SEEDS = [151_301, 151_337, 151_373];
const live: Pipes[] = [];
for (const seed of SEEDS) {
  const p = withSeededRandom(seed, () => generatePuzzle("pipes", { bankSeed: seed })) as Pipes;
  const was = pinPrePatternNov15(true);
  const old = withSeededRandom(seed, () => generatePuzzle("pipes", { bankSeed: seed })) as Pipes;
  pinPrePatternNov15(was);
  live.push(p);
  check(p.pipesRev === 5 && usesPatternNov15(p, "pipes"), `deal ${seed}: live deal is pipesRev ${p.pipesRev}`);
  check(old.pipesRev === 4 && !usesPatternNov15(old, "pipes"), `deal ${seed}: pinned deal is pipesRev ${old.pipesRev}`);
  check(JSON.stringify([p.tiles, p.source, p.solution]) === JSON.stringify([old.tiles, old.source, old.solution]), `deal ${seed}: the board changed`);
  check(old.par === pipesParTurns(old.tiles, old.solution ?? []), `deal ${seed}: pinned par isn't the clockwise par`);
  check(p.par === pipesTwoWayParTurns(p.tiles, p.solution ?? []), `deal ${seed}: live par isn't the two-way par`);
  check((p.par ?? 0) < (old.par ?? 0), `deal ${seed}: two-way par ${p.par} not below clockwise ${old.par}`);
}

/* 3. pipesRev 5's rule. */
{
  check(JSON.stringify(decodePipesTurns("0~-0,3,-12,999,-x", 49, true)) === JSON.stringify([{ cell: 0, turn: 3 }, { cell: 3, turn: 1 }, { cell: 12, turn: 3 }]), "rule: \"-cell\" isn't read as an anticlockwise turn");
  check(JSON.stringify(decodePipesTurns("0~-0,3,-12", 49, false)) === JSON.stringify([{ cell: 3, turn: 1 }]), "rule: older stamps read \"-cell\" as a turn");
  for (const p of live) {
    const limit = 120_000;
    // The fewest turns either way.
    const best = p.tiles.flatMap((tile, cell) => {
      const want = p.solution![cell]! & 15;
      for (let t = 0; t < 4; t++) if (rotateMask(tileOpenings(tile), t) === want) return t === 0 ? [] : t <= 2 ? Array(t).fill({ cell, turn: 1 as const }) : [{ cell, turn: 3 as const }];
      return [];
    });
    check(best.length === p.par, `rule: the best log has ${best.length} turns, par ${p.par}`);
    const board = pipesAfterTurns(p.tiles, best);
    check(gradePipesBoard(p.source, board).solved, "rule: the two-way log doesn't solve");
    const gr = gradeAnswer(p, encodePipesTurnAnswer(board, best), limit);
    check(gr.isCorrect && (gr.extra as { turns?: number }).turns === p.par, `rule: a two-way solve grades ${gr.isCorrect} in ${(gr.extra as { turns?: number })?.turns} turns`);
    check(gr.score === 200, `rule: a par solve at full time scores ${gr.score}, not 200`);
    const cw = best.flatMap((t) => (t.turn === 3 ? [t, t, t].map((x) => ({ cell: x.cell, turn: 1 as const })) : [t]));
    const gcw = gradeAnswer(p, encodePipesTurnAnswer(board, cw), limit);
    check(gcw.isCorrect && gcw.score < 200, `rule: the clockwise-only solve scores ${gcw.score} (over par, below 200)`);
    // The kit's clockwise logs (the older encoding) still grade on pipesRev 5.
    const kitLogs = pipesOverhaulAnswers(p, 7);
    check(kitLogs.every((a) => Number.isFinite(gradeAnswer(p, a, limit / 2).score)), "rule: a clockwise log no longer grades");
  }
}

/* 4. Help and intro. */
{
  const ins = PUZZLE_INSTRUCTIONS.pipes;
  const how = ins.how.map((l) => `${l.action} ${l.detail}`).join(" | ");
  check(/clockwise/.test(how) && /anticlockwise/.test(how) && /(Hold|hold)/.test(how) && /swipe/.test(how), `help: the turns both ways aren't described: ${how}`);
  check(/spill|leak/i.test(how), "help: live leaks aren't mentioned");
  check(/turns/.test(how) && /Par/.test(how), "help: par in turns isn't mentioned");
  check(ins.how.filter((l) => !l.helpOnly).length <= 4, "help: more than four intro HOW lines");
  check(/Turns/.test(patternStdHelp("pipes")) && /either way/.test(patternStdHelp("pipes")), "help: the SCORE list doesn't count turns either way");
  const intro = patternStdIntro("pipes");
  check(intro.length <= 90 && /fewest turns/.test(intro), `intro: "${intro}"`);
  check(/fewest turns/.test(INTRO_SCORE.pipes), `intro: the round intro's SCORE line says "${INTRO_SCORE.pipes}"`);
  const was = pinPrePatternNov15(true);
  const oldHow = PUZZLE_INSTRUCTIONS.pipes.how.map((l) => `${l.action} ${l.detail}`).join(" | ");
  check(!/anticlockwise/.test(oldHow) && /fewest taps/.test(oldHow), "help: the pinned help describes pipesRev 5");
  check(/fewest taps/.test(patternStdIntro("pipes")) && /fewest taps/.test(INTRO_SCORE.pipes), "intro: the pinned intro describes pipesRev 5");
  pinPrePatternNov15(was);
  check(/anticlockwise/.test(PUZZLE_INSTRUCTIONS.pipes.how.map((l) => l.detail).join(" ")), "help: the texts didn't rebuild after the pin");
}

/* 5. The sprites. */
{
  let total = 0;
  for (const url of pipeArtUrls()) {
    const path = new URL(`../public${url}`, import.meta.url);
    let buf: Buffer | null = null;
    try {
      buf = readFileSync(path);
    } catch {
      failures.push(`sprite: ${url} missing`);
      continue;
    }
    total += statSync(path).size;
    const webp = buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP";
    // An alpha channel: VP8X with the alpha flag, or a lossless VP8L.
    const kind = buf.subarray(12, 16).toString();
    const alpha = (kind === "VP8X" && (buf[20]! & 0x10) !== 0) || kind === "VP8L";
    check(webp && alpha, `sprite: ${url} isn't WebP with alpha (${kind})`);
    check(buf.length <= 25_000, `sprite: ${url} is ${buf.length} bytes`);
  }
  check(total <= 400_000, `sprites: ${total} bytes for the game`);
  check(pipeArtUrls().length === 33, `sprites: expected 33, ${pipeArtUrls().length}`);
  // Every side-set maps to a sprite and its turn.
  for (let mask = 1; mask < 16; mask++) {
    const s = pipeSprite(mask);
    check(!!s, `sprite: side-set ${mask} has no sprite`);
  }
  check(JSON.stringify(pipeSprite(PIPE_E | PIPE_S)) === JSON.stringify({ shape: "corner", turns: 1 }), "sprite: east-south isn't the corner turned once");
  check(JSON.stringify(pipeSprite(PIPE_W)) === JSON.stringify({ shape: "end", turns: 3 }), "sprite: west isn't the end turned three times");
}

/* 6. The art is wired. */
{
  // A 3 × 3: source top left, a run east then a dead end; the corner below the source leaks south into an end that faces away.
  const tiles: PipeTile[] = [
    { sides: PIPE_E | PIPE_S }, { sides: PIPE_E | PIPE_W }, { sides: PIPE_W },
    { sides: PIPE_N | PIPE_S }, { sides: PIPE_N | PIPE_E }, { sides: PIPE_S },
    { sides: PIPE_E }, { sides: PIPE_E }, { sides: PIPE_N },
  ];
  const connected = new Set([0, 1, 2, 3]);
  const leaks = networkLeakArms(tiles, connected, 3);
  check(leaks[3] === PIPE_S && leaks[0] === 0 && leaks[1] === 0 && leaks[2] === 0 && leaks[4] === 0, `leaks: ${JSON.stringify(leaks)}`);
  const html = renderToStaticMarkup(React.createElement(PipesBoard, { tiles, source: 0, cols: 3, connected, showLeaks: true }));
  check(html.includes('/pattern-art/pipes/corner-1-dry.webp') && html.includes('/pattern-art/pipes/corner-1-wet.webp'), "art: the board doesn't draw the turned corner's sprites");
  check((html.match(/data-wet="true"/g) ?? []).length === 4, "art: the wet set isn't shown on exactly the connected pipes");
  check(html.includes("/pattern-art/pipes/valve.webp"), "art: no source valve");
  check((html.match(/data-pipe-leak=/g) ?? []).length === 1, "art: spills aren't drawn at the network's open ends only");
  check(/data-pipe-turns="1"/.test(html) && !/rotate\(\d+deg\)/.test(html.split("pipe-spill")[0]!), "art: a turned pipe doesn't draw its own turn's sprite");
  check(!/<svg[^>]*class="pipe-art/.test(html) && !html.includes("pipe-channel"), "art: the old SVG pipework is still drawn");
  check(src("src/polish-pattern/pipes.css").includes('/pattern-art/pipes/tile.webp'), "art: the tile sprite isn't the tile's background");
  check(!/drop-shadow/.test(src("src/polish-layout/polish-nov3-pattern.css").split("Pipeline (pipes)")[1]!.split("Turntable")[0]!), "art: the network still glows");
  // The intro and the reveal draw the same board.
  const intro = renderToStaticMarkup(React.createElement(pipesPuzzle.IntroExample!));
  check(intro.includes("/pattern-art/pipes/") && intro.includes("data-pipe-leak"), "art: the intro doesn't draw the sprites and a leak");
  // Turns and Par sit with the board, inside the arena.
  const stage = src("src/puzzles/pipes.tsx");
  check(/<FramePills inArena testId="pipes"/.test(stage), "pills: Turns / Par aren't drawn next to the board");
}

/* 7. The gestures. */
{
  const tiles: PipeTile[] = [{ sides: PIPE_N }, { sides: PIPE_E }, { sides: PIPE_S }, { sides: PIPE_W }];
  const turns: [number, number][] = [];
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host as unknown as Element);
  await act(async () => {
    root.render(React.createElement(PipesBoard, { tiles, source: 0, cols: 2, connected: new Set([0]), twoWay: true, onTurn: (cell: number, dir: number) => turns.push([cell, dir]) }));
  });
  const btn = (i: number) => host.querySelector(`[data-pipe-cell="${i}"]`) as unknown as HTMLElement;
  const fire = (el: HTMLElement, type: string, init: Record<string, unknown> = {}) => {
    const Ctor = (type.startsWith("pointer") ? win.PointerEvent : win.MouseEvent) as unknown as typeof MouseEvent;
    el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, clientX: 10, clientY: 10, button: 0, ...init }) as unknown as Event);
  };
  check(btn(0)?.getAttribute("data-two-way") === "true", "gestures: the tile isn't marked two-way");
  // A tap.
  await act(async () => {
    fire(btn(0), "pointerdown");
    fire(btn(0), "pointerup");
    fire(btn(0), "click");
  });
  // A long press (the click after it is no tap).
  await act(async () => {
    fire(btn(1), "pointerdown");
    await new Promise((r) => setTimeout(r, PIPES_LONG_PRESS_MS + 60));
    fire(btn(1), "pointerup");
    fire(btn(1), "click");
  });
  // A swipe.
  await act(async () => {
    fire(btn(2), "pointerdown");
    fire(btn(2), "pointermove", { clientX: 40, clientY: 12 });
    fire(btn(2), "pointerup", { clientX: 40, clientY: 12 });
    fire(btn(2), "click", { clientX: 40, clientY: 12 });
  });
  // A right click.
  await act(async () => {
    fire(btn(3), "pointerdown", { button: 2 });
    fire(btn(3), "pointerup", { button: 2 });
  });
  check(JSON.stringify(turns) === JSON.stringify([[0, 1], [1, -1], [2, -1], [3, -1]]), `gestures: turns ${JSON.stringify(turns)}`);
  await act(async () => root.unmount());
  // Older stamps: the stage passes the turn on as clockwise whatever the gesture.
  check(/const d: TurnDir = twoWay \? dir : 1;/.test(src("src/puzzles/pipes.tsx")), "gestures: older stamps can turn anticlockwise");
}

/* 8. The sounds. */
{
  const stage = src("src/puzzles/pipes.tsx");
  const doc = src("docs/sound-cues/pattern-elevenlabs.md");
  const section = doc.split("<!-- pipeline:start -->")[1]?.split("<!-- pipeline:end -->")[0] ?? "";
  for (const slot of ["pipes.rotate", "pipes.flow", "pipes.combo", "pipes.drain", "pipes.solve", "pipes.bubble"]) {
    check(slot in SOUND_MANIFEST, `sound: ${slot} isn't in the manifest`);
    check(stage.includes(`"${slot}"`), `sound: the stage never fires ${slot}`);
    check(section.includes(`\`${slot}\``), `sound: ${slot} has no line in pattern-elevenlabs.md`);
  }
}

/* 9. The answer reveal. */
{
  const column = (html: string, attr: string) => {
    const at = html.indexOf(attr);
    if (at < 0) return "";
    const next = html.indexOf("data-pipes-yours", at + attr.length);
    return attr === "data-pipes-solution" ? html.slice(at, next < 0 ? undefined : next) : html.slice(at);
  };
  const pill = (html: string, id: string) => html.match(new RegExp(`data-hud-pill="${id}"><span[^>]*>[^<]*</span><b[^>]*>([^<]*)</b>`))?.[1] ?? null;
  const render = (puzzle: PuzzleData, answer: string | null, correct: boolean, msLeft: number, extra: unknown) =>
    renderToStaticMarkup(React.createElement(pipesPuzzle.Reveal, { timeLimitMs: 120_000, puzzle, myAnswer: answer, myCorrect: correct, myMsRemaining: msLeft, myExtra: extra, myReactionAvgMs: null } as never));
  const judge = (label: string, puzzle: PuzzleData, answer: string | null, msLeft: number, gradeOf: { correct: boolean; extra: unknown }) => {
    const html = render(puzzle, answer, gradeOf.correct, msLeft, gradeOf.extra);
    const extra = (gradeOf.extra ?? {}) as { turns?: number; connected?: number };
    const sol = column(html, "data-pipes-solution");
    const yours = column(html, "data-pipes-yours");
    check(/>Solution</.test(sol) && />Yours</.test(yours), `reveal ${label}: no Solution / Yours labels`);
    check(sol.includes("/pattern-art/pipes/") && yours.includes("/pattern-art/pipes/"), `reveal ${label}: a board without the sprites`);
    check(!/You:/.test(sol) && /data-pipes-result="">You: /.test(yours), `reveal ${label}: the player's line isn't "You: …" in the Yours column only`);
    check(!/×/.test(html) && !/data-yours-only/.test(sol), `reveal ${label}: a stray × or a Yours-only line under Solution`);
    check(!/data-hud-pill/.test(sol), `reveal ${label}: numbers under Solution`);
    if (typeof extra.connected === "number") check(pill(yours, "connected") === `${extra.connected}/49`, `reveal ${label}: Joined ${pill(yours, "connected")}, stored ${extra.connected}`);
    if (typeof extra.turns === "number") check(pill(yours, "turns") === String(extra.turns), `reveal ${label}: Turns ${pill(yours, "turns")}, stored ${extra.turns}`);
    else check(pill(yours, "turns") === null, `reveal ${label}: a turns pill without a stored count`);
    const par = (puzzle as Pipes).pipesRev ? (puzzle as Pipes).par ?? 0 : 0;
    check(par > 0 ? pill(yours, "par") === String(par) : pill(yours, "par") === null, `reveal ${label}: Par ${pill(yours, "par")}`);
    check(gradeOf.correct ? pill(yours, "time") === `${Math.round(msLeft / 1000)} s` : pill(yours, "time") === null, `reveal ${label}: Time left ${pill(yours, "time")}`);
    // Highlights: an unfinished board marks the wrong / untouched tiles exactly as the graded board has them.
    const view = pipesRevealView(puzzle as Pipes, answer, extra as Record<string, unknown>);
    const wrongN = (yours.match(/data-wrong="true"/g) ?? []).length;
    const dimN = (yours.match(/data-untouched="true"/g) ?? []).length;
    if (gradeOf.correct) check(wrongN === 0 && dimN === 0, `reveal ${label}: a solved board has highlights`);
    else {
      check(wrongN === view.wrong.size && dimN === view.untouched.size && wrongN + dimN > 0, `reveal ${label}: ${wrongN} red, ${dimN} dimmed (view ${view.wrong.size}, ${view.untouched.size})`);
      const solution = (puzzle as Pipes).solution!;
      check([...view.wrong, ...view.untouched].every((c) => tileOpenings(view.mine[c]!) !== (solution[c]! & 15)), `reveal ${label}: a tile as in the solution is highlighted`);
      check(view.mine.every((t, c) => tileOpenings(t) === (solution[c]! & 15) || view.wrong.has(c) || view.untouched.has(c)), `reveal ${label}: a wrong tile isn't highlighted`);
      check(view.connected.size === (extra.connected ?? view.connected.size), `reveal ${label}: the board shown isn't the graded board`);
      check(view.leaks === 0 || /data-pipe-leak=/.test(yours), `reveal ${label}: open ends not drawn`);
    }
  };
  // pipesRev 5: solved (two-way par line), unfinished (half of it), empty.
  for (const p of live) {
    const best = p.tiles.flatMap((tile, cell) => {
      const want = p.solution![cell]! & 15;
      for (let t = 0; t < 4; t++) if (rotateMask(tileOpenings(tile), t) === want) return t === 0 ? [] : t <= 2 ? Array(t).fill({ cell, turn: 1 as const }) : [{ cell, turn: 3 as const }];
      return [];
    });
    for (const [label, log] of [["solved", best], ["unfinished", best.slice(0, best.length >> 1)], ["one turn", best.slice(0, 1)]] as const) {
      const board = pipesAfterTurns(p.tiles, log);
      const answer = encodePipesTurnAnswer(board, log);
      const msLeft = 41_400;
      const gr = gradeAnswer(p, answer, msLeft);
      judge(`rev5 ${label}`, p, answer, msLeft, { correct: gr.isCorrect, extra: gr.extra });
      if (label === "solved") check(/data-pipes-turns-bar/.test(render(p, answer, true, msLeft, gr.extra)), "reveal: no turns-against-par bar on a solve");
    }
    const empty = gradeAnswer(p, "", 0);
    judge("rev5 empty", p, null, 0, { correct: empty.isCorrect, extra: empty.extra });
  }
  // Older stamps: every kind in the legacy fixture (its stored grade), and an unlogged board (pipesRev 0).
  const fx = JSON.parse(gunzipSync(readFileSync(PIPES_OVERHAUL_FIXTURE)).toString()) as PipesOverhaulFixture;
  const sample = fx.cases.filter((_, i) => i % 7 === 0);
  for (const c of sample) judge(`rev${(fx.puzzles[c.p] as Pipes).pipesRev} case`, fx.puzzles[c.p]!, c.answer, c.msLeft, { correct: c.correct, extra: c.extra });
  check(sample.some((c) => c.correct) && sample.some((c) => !c.correct), "reveal: the sample lacks a solved or an unfinished case");
  const p0 = { ...live[0]!, pipesRev: undefined, par: undefined } as unknown as PuzzleData;
  const sides = (live[0]!.tiles.map((t, i) => (i < 10 ? rotateMask(tileOpenings(t), 1) : tileOpenings(t)).toString(16))).join("");
  const g0 = gradeAnswer(p0, sides, 0);
  judge("rev0", p0, sides, 0, { correct: g0.isCorrect, extra: g0.extra });
}

/* 10. Intro, demos, challenges and stars. */
{
  check(/data\.type === "pipes" && demo\?\.puzzle\.type === "pipes" && \(demo\.puzzle\.pipesRev \?\? 0\) < 5\) return null;/.test(src("src/lib/duel/introDemo.functions.ts")), "demos: a Pipeline demo recorded before pipesRev 5 would still play");
  check(PUZZLE_INSTRUCTIONS.pipes.goal === "Connect every pipe to the source.", "intro: the GOAL changed");
  // The live practice challenges: No leaks (finish) and Plumber's par (the par bonus in full) are met by a two-way par
  // solve and missed by a clockwise-only one (so par stays meaningful); the 175 star is met by the par solve at 60 s left.
  const p = live[1]!;
  const best = p.tiles.flatMap((tile, cell) => {
    const want = p.solution![cell]! & 15;
    for (let t = 0; t < 4; t++) if (rotateMask(tileOpenings(tile), t) === want) return t === 0 ? [] : t <= 2 ? Array(t).fill({ cell, turn: 1 as const }) : [{ cell, turn: 3 as const }];
    return [];
  });
  const board = pipesAfterTurns(p.tiles, best);
  const parSolve = gradeAnswer(p, encodePipesTurnAnswer(board, best), 60_000);
  const parts = (parSolve.extra as { parts?: { efficiency?: number } } | null)?.parts;
  check(parSolve.isCorrect && (parts?.efficiency ?? 0) >= 10, `challenges: Plumber's par isn't met by a par solve (${JSON.stringify(parts)})`);
  check(parSolve.score >= 175, `stars: a par solve at 60 s left scores ${parSolve.score} (< 175)`);
  const cw = best.flatMap((t) => (t.turn === 3 ? [1, 2, 3].map(() => ({ cell: t.cell, turn: 1 as const })) : [t]));
  const cwSolve = gradeAnswer(p, encodePipesTurnAnswer(board, cw), 60_000);
  const cwParts = (cwSolve.extra as { parts?: { efficiency?: number } } | null)?.parts;
  check(cwSolve.isCorrect && (cwParts?.efficiency ?? 0) < 10, `challenges: Plumber's par is met clockwise only (${JSON.stringify(cwParts)})`);
  const challenges = src("src/lib/duel/practiceChallenges.data.ts");
  check(challenges.includes('ch("pipes", "No leaks", "Connect every pipe.", "C", "finish", false, all(FIN))') && challenges.includes('ch("pipes", "Plumber’s par", "Connect every pipe in par turns.", "C", "par", false, bonus(10))'), "challenges: Pipeline's live challenges changed");
}

/* 11. The effects (stage 2, 15 Nov 2026; pipesFx.ts, the effects kit). */
{
  const { planWaterIn, planDrain, PIPE_FLOW_TOTAL_MS, PIPE_FLOW_TILE_MS } = await import("../src/components/puzzles/pattern/pipesFx");
  const { forceGameFxVariant, setGameFxSink } = await import("../src/lib/fx/kit");
  const { pipeFlowRate } = await import("../src/puzzles/pipes");

  // The plans: in order from the source, a step of at most 200 ms, every pipe full within 900 ms; drains furthest first.
  const many = Array.from({ length: 12 }, (_, i) => ({ cell: i, depth: 3 + i, dx: 1, dy: 0 }));
  const plan = planWaterIn([...many].reverse());
  check(plan.map((s) => s.cell).join() === many.map((s) => s.cell).join(), "fx: water doesn't run in from the source outwards");
  check(plan.every((s, i) => i === 0 || s.delay - plan[i - 1]!.delay <= PIPE_FLOW_TILE_MS), "fx: a step longer than 200 ms");
  check(plan.at(-1)!.delay + PIPE_FLOW_TILE_MS <= PIPE_FLOW_TOTAL_MS, `fx: water still running after 900 ms (${plan.at(-1)!.delay})`);
  const few = planWaterIn([{ cell: 4, depth: 2, dx: 0, dy: 1 }, { cell: 5, depth: 3, dx: 1, dy: 0 }, { cell: 9, depth: 3, dx: 0, dy: 1 }]);
  check(few[0]!.delay === 0 && few[1]!.delay === PIPE_FLOW_TILE_MS && few[2]!.delay === PIPE_FLOW_TILE_MS, `fx: ~200 ms a pipe (${JSON.stringify(few)})`);
  const drain = planDrain(many);
  check(drain[0]!.cell === 11 && drain.at(-1)!.cell === 0 && drain.at(-1)!.delay <= PIPE_FLOW_TOTAL_MS, "fx: draining isn't furthest first within 900 ms");
  check(pipeFlowRate(1) > pipeFlowRate(3) && pipeFlowRate(3) > pipeFlowRate(5) && pipeFlowRate(5) === pipeFlowRate(9), "fx: the gurgle isn't sized to the join");

  // Every animation the board starts, recorded (happy-dom has no Web Animations engine).
  type Rec = { el: Element; frames: Keyframe[]; options: KeyframeAnimationOptions };
  const recs: Rec[] = [];
  const proto = (win as unknown as { HTMLElement: { prototype: Record<string, unknown> } }).HTMLElement.prototype;
  const realAnimate = proto["animate"];
  proto["animate"] = function (this: Element, frames: Keyframe[], options: KeyframeAnimationOptions) {
    recs.push({ el: this, frames, options });
    return { cancel() {}, addEventListener() {}, finished: Promise.resolve() };
  };
  const kitCalls: string[] = [];
  setGameFxSink((r) => kitCalls.push(`${r.kind}:${r.variant}`));
  const allowed = new Set(["transform", "opacity", "offset", "easing", "composite"]);
  const onlyTransformOpacity = () => recs.every((r) => r.frames.every((f) => Object.keys(f).every((k) => allowed.has(k))));

  // A 3 × 3 (source top left): a run east along the top, a corner down the middle; tile 1 turned off the line.
  const solvedTiles: PipeTile[] = [
    { sides: PIPE_E }, { sides: PIPE_E | PIPE_W }, { sides: PIPE_W | PIPE_S },
    { sides: 0 }, { sides: 0 }, { sides: PIPE_N | PIPE_S },
    { sides: 0 }, { sides: 0 }, { sides: PIPE_N },
  ];
  const off = solvedTiles.map((t, i) => (i === 1 ? { sides: PIPE_N | PIPE_S } : t));
  const { pipelineDepths } = await import("../src/components/puzzles/pipelineFlow");
  const conn = (tiles: PipeTile[]) => new Set(pipelineDepths(tiles, 0, 3).keys());
  const turns: [number, number][] = [];
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host as unknown as Element);
  const draw = (tiles: PipeTile[]) =>
    act(async () => {
      root.render(React.createElement(PipesBoard, { tiles, source: 0, cols: 3, connected: conn(tiles), animateWater: true, twoWay: true, onTurn: (cell: number, dir: number) => turns.push([cell, dir]) }));
    });
  forceGameFxVariant("full");
  await draw(off);
  check(recs.length === 0, `fx: the first draw animates (${recs.length})`);
  const wetOf = (cell: number) => host.querySelector(`[data-pipe-index="${cell}"] .pipe-wet`);
  // Rejoin: 1, 2, 5, 8 fill in order from the source; nothing else moves.
  await draw(solvedTiles);
  const fills = recs.filter((r) => (r.el as Element).classList?.contains("pipe-wet"));
  const order = [1, 2, 5, 8].map((c) => fills.find((r) => r.el === wetOf(c)));
  check(order.every(Boolean) && fills.length === 4, `fx: water ran into ${fills.length} pipes (want 1, 2, 5, 8)`);
  check(order.every((r, i) => i === 0 || Number(r!.options.delay) > Number(order[i - 1]!.options.delay)), "fx: water doesn't reach the pipes in order from the source");
  check(String(order[0]!.frames[0]!.transform).startsWith("translate(-100%, 0%)"), `fx: water into tile 1 doesn't enter from the west (${order[0]!.frames[0]!.transform})`);
  check(String(order[2]!.frames[0]!.transform) === "translate(0%, -100%)", `fx: water into tile 5 doesn't enter from the north (${order[2]!.frames[0]!.transform})`);
  check(recs.filter((r) => (r.el as Element).classList?.contains("pipe-wet-in")).length === 4, "fx: the water's content isn't held in place while it runs in");
  check(!recs.some((r) => r.el === wetOf(0)), "fx: the source's water re-ran");
  // Cut off again: the same pipes drain, the furthest first, held full until their turn.
  recs.length = 0;
  await draw(off);
  const drains = recs.filter((r) => (r.el as Element).classList?.contains("pipe-wet"));
  const d8 = drains.find((r) => r.el === wetOf(8));
  const d1 = drains.find((r) => r.el === wetOf(1));
  check(drains.length === 4 && !!d8 && !!d1 && Number(d8.options.delay) < Number(d1.options.delay), "fx: draining isn't the cut-off pipes, furthest first");
  check(drains.every((r) => r.frames.every((f) => f.opacity === 1) && r.options.fill === "backwards"), "fx: a draining pipe isn't held full until its turn");
  // A redraw with nothing changed (the clock) animates nothing.
  recs.length = 0;
  await draw(off);
  check(recs.length === 0, "fx: a redraw with no turn animates");

  // The turn: a ratchet on the pipe's own art, either way; never on the tile button (its hit area).
  recs.length = 0;
  const btn = (i: number) => host.querySelector(`[data-pipe-cell="${i}"]`) as unknown as HTMLElement;
  await act(async () => {
    btn(2).dispatchEvent(new win.MouseEvent("click", { bubbles: true }) as unknown as Event);
    // The next input at once, mid-effect: taken.
    btn(5).dispatchEvent(new win.MouseEvent("click", { bubbles: true }) as unknown as Event);
  });
  await act(async () => {
    // Straight after, while tile 5's ratchet still runs: the other way round.
    btn(5).dispatchEvent(new win.PointerEvent("pointerdown", { bubbles: true, button: 2 }) as unknown as Event);
  });
  check(JSON.stringify(turns.slice(-3)) === JSON.stringify([[2, 1], [5, 1], [5, -1]]), `fx: an input during an effect was not taken (${JSON.stringify(turns)})`);
  const ratchets = recs.filter((r) => (r.el as Element).classList?.contains("pipe-turn"));
  check(ratchets.length === 3 && String(ratchets[0]!.frames[0]!.transform) === "rotate(-90deg)" && String(ratchets[2]!.frames[0]!.transform) === "rotate(90deg)", `fx: the ratchet doesn't turn from where the tile was, both ways (${ratchets.map((r) => r.frames[0]!.transform)})`);
  check(ratchets.every((r) => r.frames.length >= 4 && Number(r.options.duration) <= 900), "fx: the turn isn't a two-click ratchet under 900 ms");
  check(!recs.some((r) => (r.el as Element).tagName === "BUTTON" || (r.el as Element).matches?.("[data-game-arena], [data-game-stage], .pipes-board")), "fx: an effect moves a tile button, the board or the arena");
  check(onlyTransformOpacity(), "fx: an effect animates something other than transform and opacity");

  // Reduced motion: every change a 120 ms crossfade, no movement.
  forceGameFxVariant("reduced");
  recs.length = 0;
  kitCalls.length = 0;
  await act(async () => {
    btn(1).dispatchEvent(new win.MouseEvent("click", { bubbles: true }) as unknown as Event);
  });
  await draw(solvedTiles);
  check(kitCalls.includes("tap:reduced"), `fx: the reduced turn isn't the kit's crossfade (${kitCalls})`);
  check(recs.length > 0 && recs.every((r) => r.frames.every((f) => f.transform === undefined) && Number(r.options.duration) <= 120), "fx: reduced motion still moves something, or longer than 120 ms");
  check(recs.filter((r) => (r.el as Element).classList?.contains("pipe-wet")).length === 4, "fx: reduced motion doesn't show the water's change");
  recs.length = 0;
  await draw(off);
  check(recs.filter((r) => (r.el as Element).classList?.contains("pipe-wet")).every((r) => r.frames[0]!.opacity === 1 && r.frames.at(-1)!.opacity === 0 && !r.options.delay), "fx: reduced draining isn't a crossfade out");
  await act(async () => root.unmount());

  // The solve's bubbles: from the source valve, none under reduced motion.
  const { sourceBubbles } = await import("../src/components/puzzles/pattern/pipesFx");
  const valve = document.createElement("span");
  document.body.appendChild(valve);
  recs.length = 0;
  sourceBubbles(valve as unknown as Element);
  check(valve.querySelectorAll(".pipe-bubble").length === 0, "fx: bubbles under reduced motion");
  forceGameFxVariant("full");
  sourceBubbles(valve as unknown as Element);
  check(valve.querySelectorAll(".pipe-bubble").length === 4 && recs.length === 4 && onlyTransformOpacity(), "fx: the source doesn't bubble on the solve");
  forceGameFxVariant(null);
  setGameFxSink(null);
  proto["animate"] = realAnimate;

  // The stage wires each moment (sounds through their slots; the kit for the combo and the result).
  const stage = src("src/puzzles/pipes.tsx");
  check(/soundCueAt\("pipes\.flow", pipeFlowRate\(joined\)\)/.test(stage), "fx: the gurgle isn't sized to the join");
  check(/gameFx\("combo", turned\?\.querySelector\("\.pipe-art"\), \{ count: [^}]*silent: true \}\)/.test(stage), "fx: the combo isn't the kit's, silent, on the turned pipe");
  check(/sourceBubbles\(/.test(stage) && /soundCue\("pipes\.bubble"\)/.test(stage), "fx: the solve doesn't bubble the source");
  check(/gameFx\("win", card \?\? null, \{ silent: true, inGame: false \}\)/.test(stage), "fx: the kit's win isn't on the result");
  check(/animateWater\n/.test(stage), "fx: the live board doesn't animate the water");
  // Only Pipeline's effects file calls animate, and the solve rush is transform-only CSS.
  for (const file of ["src/puzzles/pipes.tsx", "src/components/puzzles/pattern/pipesArt.tsx"]) check(!/\.animate\(/.test(src(file)), `fx: ${file} animates outside pipesFx.ts`);
  const css = src("src/polish-pattern/pipes.css");
  check(!/stroke-dashoffset|transition:/.test(css), "fx: pipes.css animates something other than transform and opacity");
  for (const [, body] of css.matchAll(/@keyframes [\w-]+ \{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)) {
    const props = [...body!.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    check(props.every((p) => p === "transform" || p === "opacity"), `fx: a keyframe animates ${props.join(", ")}`);
  }
}

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL pattern-overhaul-pipes-check: ${failures.length} failure(s), ${passes} passed`);
  process.exit(1);
}
console.log(`pattern-overhaul-pipes-check: ${passes} checks passed`);
process.exit(0);
