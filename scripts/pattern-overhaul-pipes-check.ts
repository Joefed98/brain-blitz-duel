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
const { PipesBoard, pipesPuzzle, networkLeakArms, PIPES_LONG_PRESS_MS } = await import("../src/puzzles/pipes");
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
  const was = pinPrePatternNov15(true);
  const oldHow = PUZZLE_INSTRUCTIONS.pipes.how.map((l) => `${l.action} ${l.detail}`).join(" | ");
  check(!/anticlockwise/.test(oldHow) && /fewest taps/.test(oldHow), "help: the pinned help describes pipesRev 5");
  check(/fewest taps/.test(patternStdIntro("pipes")), "intro: the pinned intro describes pipesRev 5");
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
  check(pipeArtUrls().length === 13, "sprites: expected 13");
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
  check(html.includes('/pattern-art/pipes/corner-dry.webp') && html.includes('/pattern-art/pipes/corner-wet.webp'), "art: the board doesn't draw the corner sprites");
  check((html.match(/data-wet="true"/g) ?? []).length === 4, "art: the wet set isn't shown on exactly the connected pipes");
  check(html.includes("/pattern-art/pipes/source.webp"), "art: no source valve");
  check((html.match(/data-pipe-leak=/g) ?? []).length === 1, "art: spills aren't drawn at the network's open ends only");
  check(/rotate\(90deg\)/.test(html), "art: the sprites aren't turned by a transform");
  check(!/<svg[^>]*class="pipe-art/.test(html) && !html.includes("pipe-channel"), "art: the old SVG pipework is still drawn");
  check(src("src/polish-pattern/pipes.css").includes('/pattern-art/pipes/tile.webp'), "art: the tile sprite isn't the tile's background");
  check(!/drop-shadow/.test(src("src/polish-layout/polish-nov3-pattern.css").split("Pipeline (pipes)")[1]!.split("Turntable")[0]!), "art: the network still glows");
  // The intro and the reveal draw the same board.
  const intro = renderToStaticMarkup(React.createElement(pipesPuzzle.IntroExample!));
  check(intro.includes("/pattern-art/pipes/") && intro.includes("data-pipe-leak"), "art: the intro doesn't draw the sprites and a leak");
  const p = live[0]!;
  const reveal = renderToStaticMarkup(React.createElement(pipesPuzzle.Reveal, { timeLimitMs: 120_000, puzzle: p, myAnswer: `${"0".repeat(49)}~0,-1`, myCorrect: false, myMsRemaining: 0 } as never));
  check(reveal.includes("/pattern-art/pipes/"), "reveal: no sprites");
  const own = reveal.match(/<p data-yours-only=""[^>]*>([^<]*)<\/p>/);
  check(!!own && /^You: \d+ \/ 49 connected$/.test(own[1]!), `reveal: the player's line isn't Yours-only "You: n / 49 connected": ${own?.[1]}`);
  check(!/×/.test(reveal), "reveal: a stray × is drawn");
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

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL pattern-overhaul-pipes-check: ${failures.length} failure(s), ${passes} passed`);
  process.exit(1);
}
console.log(`pattern-overhaul-pipes-check: ${passes} checks passed`);
process.exit(0);
