/**
 * pattern-overhaul-laser-check (15 Nov 2026, the Pattern overhaul stage 1; patternNov15.ts, docs/design/game-reviews/
 * pattern.md "Lightbender"): Lightbender's laserRev 4 and its new look, one assertion per change. No browser (happy-dom).
 *
 *   1. Older stamps grade exactly as before: every case of scripts/fixtures/pattern-overhaul-laser-legacy.json.gz
 *      (laserRev 3 and 2, recorded before the change by scripts/pattern-overhaul-laser-record.ts) regrades identically;
 *      and the same answers on the same boards stamped laserRev 4 grade exactly as laserRev 3 (Undo sends ordinary
 *      verbs, so the server's replay and scoring don't change).
 *   2. The deal: live deals carry laserRev 4, the pinned deal laserRev 3, the board and solution the same.
 *   3. laserRev 4's Undo: laserUndoStep takes back a place, turn, move, removal and Reset, and its verbs replayed by the
 *      server give the same board; on the stage (happy-dom) Undo takes back a turn and then the placement, the log
 *      replays to the stage's board, and older stamps' Undo still only removes the last placed piece.
 *   4. Out of shots: on laserRev 4, after the third missed shot the board says "Out of shots", Fire, Undo and Reset are
 *      disabled, a tap places nothing and `laser.outOfShots` sounds; on laserRev 3 the board stays editable.
 *   5. The help says what changed (Undo free, out of shots locks the board) within the intro's limits; the pinned help
 *      doesn't.
 *   6. The sprites: every file exists, is WebP with alpha, at most 25 KB, 400 KB for the game.
 *   7. The art is wired: the board, intro and reveal draw the sprites (floor, brick, mirrors on their diagonal, the
 *      splitter, gems dark and lit with a directional gem's arrow, bombs, the emitter turned to its beam); the old SVG
 *      gem facets, neon beam and glows are gone; the reveal's own line is Yours-only "You: …" with no "×"; the Gems
 *      pill keeps the best shot; Par is shown in play.
 *   8. The sounds: every slot is in the manifest and fired by the game; each has a line in the ElevenLabs list.
 *   9. The answer reveal.
 *  10. The effects (stage 2, laserFx.ts on the kit): place = the kit's drop on the mirror's art, turn = a two-click
 *      ratchet, a refused square shaken on its own art (never the board), Fire pulses the emitter and the beam draws
 *      with a leading point, gems light in turn, the splitter pulses when reached, a bomb hit jolts the bomb, the near
 *      miss pulses the dark gem and shows "1 gem dark" in the Gems pill's place (not over the board) for its moment, out
 *      of shots sounds and settles, the solve's win on the reveal's result card; each on its own moment only, the next
 *      press taken during an effect, reduced motion the kit's crossfade, transform and opacity only.
 */
import { readFileSync, statSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Window } from "happy-dom";

const win = new Window({ url: "http://localhost/", width: 390, height: 844 });
const g = globalThis as Record<string, unknown>;
for (const key of ["window", "document", "navigator", "Node", "Element", "HTMLElement", "SVGElement", "Text", "Event", "CustomEvent", "PointerEvent", "MouseEvent", "KeyboardEvent", "getComputedStyle", "MutationObserver", "requestAnimationFrame", "cancelAnimationFrame", "ResizeObserver"]) {
  if (g[key] === undefined) g[key] = key === "window" ? win : (win as unknown as Record<string, unknown>)[key];
}
// The page's own event classes (Bun has its own Event and CustomEvent, which happy-dom refuses to dispatch).
for (const key of ["Event", "CustomEvent"]) g[key] = (win as unknown as Record<string, unknown>)[key];
g["IS_REACT_ACT_ENVIRONMENT"] = true;

const React = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { generatePuzzle, gradeAnswer } = await import("../src/lib/duel/generate.server");
const { pinPrePatternNov15, usesPatternNov15 } = await import("../src/lib/duel/patternNov15");
const { withSeededRandom } = await import("../src/lib/duel/random");
const { replayLaserLog, laserAction } = await import("../src/lib/duel/laserLog");
const { decodeActionLog, encodeActionLog, appendAction } = await import("../src/lib/duel/actionLog");
const { PUZZLE_INSTRUCTIONS } = await import("../src/lib/duel/instructions");
const { INTRO_SCORE } = await import("../src/lib/duel/introScore");
const { LaserBoard, laserPuzzle, laserUndoStep, laserGemsShown } = await import("../src/puzzles/laser");
const { laserArtUrls, LASER_SPRITES } = await import("../src/components/puzzles/pattern/laserArt");
const { SOUND_MANIFEST } = await import("../src/lib/fx/manifest");
const { clearStageState } = await import("../src/lib/duel/stageState");
const { LASER_OVERHAUL_FIXTURE } = await import("./pattern-overhaul-laser-record");
import type { LegacyCase } from "./pattern-overhaul-laser-record";
import type { LaserPuzzleData, MirrorPlacement } from "../src/lib/duel/types";

const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else failures.push(message);
};
const src = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sameBoard = (a: MirrorPlacement[], b: MirrorPlacement[]) => {
  const key = (l: MirrorPlacement[]) => l.map((m) => `${m.cell}:${m.kind}`).sort().join(",");
  return key(a) === key(b);
};

/* 1. Older stamps grade exactly as before; laserRev 4 grades as laserRev 3. */
const fx = JSON.parse(gunzipSync(readFileSync(LASER_OVERHAUL_FIXTURE)).toString()) as {
  puzzles: { era: string; seed: number; puzzle: LaserPuzzleData }[];
  cases: LegacyCase[];
};
{
  check(fx.cases.length >= 150, `legacy: only ${fx.cases.length} cases`);
  check(fx.cases.some((c) => /turn and back|move and back/.test(c.label)), "legacy: no case turns or moves a piece back");
  let diff = 0;
  let diff4 = 0;
  for (const c of fx.cases) {
    const p = fx.puzzles.find((x) => x.era === c.era && x.seed === c.seed)!.puzzle;
    const gr = gradeAnswer(p, c.answer, c.msLeft);
    const same = gr.score === c.score && gr.isCorrect === c.isCorrect && JSON.stringify(gr.extra ?? null) === JSON.stringify(c.extra);
    if (!same && diff++ < 3) failures.push(`legacy: ${c.era} ${c.seed} ${c.label} regrades ${gr.score} (was ${c.score})`);
    if (c.era === "rev3") {
      const p4 = { ...p, laserRev: 4 } as LaserPuzzleData;
      const g4 = gradeAnswer(p4, c.answer, c.msLeft);
      if ((g4.score !== c.score || g4.isCorrect !== c.isCorrect || JSON.stringify(g4.extra ?? null) !== JSON.stringify(c.extra)) && diff4++ < 3)
        failures.push(`rev4: ${c.seed} ${c.label} grades ${g4.score} on laserRev 4 (laserRev 3: ${c.score})`);
    }
  }
  check(diff === 0, `legacy: ${diff} of ${fx.cases.length} cases regrade differently`);
  check(diff4 === 0, `rev4: ${diff4} cases grade differently on laserRev 4`);
  check(fx.puzzles.every((x) => !usesPatternNov15(x.puzzle, "laser")), "legacy: a fixture puzzle reads as laserRev 4");
  check(fx.puzzles.some((x) => x.puzzle.laserRev === 3) && fx.puzzles.some((x) => x.puzzle.laserRev === 2), "legacy: the fixture lacks laserRev 3 or 2");
}

/* 2. The deal. */
const SEEDS = [181_301, 181_337, 181_373];
const live: LaserPuzzleData[] = [];
for (const seed of SEEDS) {
  const p = withSeededRandom(seed, () => generatePuzzle("laser", { bankSeed: seed })) as LaserPuzzleData;
  const was = pinPrePatternNov15(true);
  const old = withSeededRandom(seed, () => generatePuzzle("laser", { bankSeed: seed })) as LaserPuzzleData;
  pinPrePatternNov15(was);
  live.push(p);
  check(p.laserRev === 4 && usesPatternNov15(p, "laser"), `deal ${seed}: live deal is laserRev ${p.laserRev}`);
  check(old.laserRev === 3 && !usesPatternNov15(old, "laser"), `deal ${seed}: pinned deal is laserRev ${old.laserRev}`);
  // The same board (the generator's own build time, stats.generationMs, aside).
  const strip = (q: LaserPuzzleData) => JSON.stringify({ ...q, laserRev: 0, stats: { ...(q as { stats?: object }).stats, generationMs: 0 } });
  check(strip(p) === strip(old), `deal ${seed}: the board changed`);
  check((p.par ?? 0) > 0, `deal ${seed}: no par to show`);
}

/* 3a. laserUndoStep, against the server's replay. */
for (const p of live) {
  const sol = p.solution ?? [];
  const fixed = new Set([p.source, ...p.gems, ...p.bombs, ...p.blocks, ...(p.splitters ?? [])]);
  const free = Array.from({ length: 100 }, (_, i) => i).filter((c) => !fixed.has(c) && !sol.some((m) => m.cell === c));
  let placed: MirrorPlacement[] = [];
  let log: ReturnType<typeof decodeActionLog>["actions"] = [];
  let t = 500;
  const send = (a: string) => {
    log = appendAction(log, a, (t += 400));
  };
  type U = Parameters<typeof laserUndoStep>[1];
  const stack: U[] = [];
  const boards: MirrorPlacement[][] = [];
  const doit = (a: string, next: MirrorPlacement[], u: U) => {
    boards.push(placed);
    send(a);
    placed = next;
    stack.push(u);
  };
  for (const m of sol) doit(laserAction.place(m.cell, m.kind), [...placed, m], { k: "place", cell: m.cell });
  const m0 = sol[0]!;
  doit(laserAction.turn(m0.cell), placed.map((m) => (m.cell === m0.cell ? { ...m, kind: m.kind === "/" ? "\\" : m.kind === "\\" ? "/" : m.kind === "S|" ? "S-" : "S|" } : m)), { k: "turn", cell: m0.cell });
  const m1 = sol[1]!;
  doit(laserAction.move(m1.cell, free[0]!), [...placed.filter((m) => m.cell !== m1.cell), { cell: free[0]!, kind: m1.kind }], { k: "move", from: m1.cell, to: free[0]! });
  const m2 = sol[2]!;
  doit(laserAction.remove(m2.cell), placed.filter((m) => m.cell !== m2.cell), { k: "remove", cell: m2.cell, kind: m2.kind });
  doit(laserAction.reset(), [], { k: "reset", pieces: placed.map((m) => ({ ...m })) });
  // Undo every change, newest first: each step gives back the board before it, and the server agrees.
  let ok = true;
  while (stack.length) {
    const u = stack.pop()!;
    const step = laserUndoStep(placed, u);
    for (const a of step.actions) send(a);
    placed = step.placed;
    const want = boards.pop()!;
    if (!sameBoard(placed, want)) ok = false;
    const server = replayLaserLog(p, encodeActionLog(log), 60_000);
    if (!sameBoard(server.layout, placed) || server.diag.dropped !== 0) ok = false;
  }
  check(ok, `undo: laserUndoStep doesn't give back each board (or the server disagrees) on seed ${p.bankSeed ?? "?"}`);
  check(placed.length === 0, "undo: undoing everything doesn't empty the board");
  // Undo the reset alone puts every piece back; fire then solves.
  const solved = (() => {
    let l: typeof log = [];
    let tt = 300;
    for (const m of sol) l = appendAction(l, laserAction.place(m.cell, m.kind), (tt += 400));
    l = appendAction(l, laserAction.reset(), (tt += 400));
    for (const a of laserUndoStep([], { k: "reset", pieces: sol }).actions) l = appendAction(l, a, (tt += 400));
    l = appendAction(l, laserAction.fire(), (tt += 400));
    return gradeAnswer(p, encodeActionLog(l), 40_000);
  })();
  check(solved.isCorrect, "undo: putting a Reset back and firing doesn't solve");
}

/* 3b–4. The stage (happy-dom). */
// The grid measures 400 × 400 at the page's top left (happy-dom does no layout).
const proto = win.HTMLElement.prototype as unknown as Record<string, unknown>;
const isGrid = (el: unknown) => typeof (el as { className?: unknown }).className === "string" && /\bgrid h-full w-full\b/.test((el as { className: string }).className);
const origRect = proto["getBoundingClientRect"] as (this: unknown) => DOMRect;
Object.defineProperty(proto, "getBoundingClientRect", {
  configurable: true,
  value: function (this: unknown) {
    return isGrid(this) ? ({ left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400, x: 0, y: 0 } as DOMRect) : origRect.call(this);
  },
});
for (const prop of ["clientWidth", "clientHeight", "offsetWidth", "offsetHeight"]) {
  const d = Object.getOwnPropertyDescriptor(proto, prop) ?? Object.getOwnPropertyDescriptor(win.Element.prototype, prop);
  Object.defineProperty(proto, prop, {
    configurable: true,
    get(this: unknown) {
      return isGrid(this) ? 400 : d?.get ? d.get.call(this) : 0;
    },
  });
}
// Every stage timer at once (beam steps, the verdict, the fade), in order.
const realTimeout = win.setTimeout.bind(win);
(win as unknown as { setTimeout: unknown }).setTimeout = (fn: () => void, _ms?: number) => realTimeout(fn, 0);
const cues: string[] = [];
win.addEventListener("duelz-sound", (e) => cues.push(((e as unknown as CustomEvent).detail as { cue: string }).cue));

const centre = (cell: number) => {
  const pitch = 400 / 10;
  return { clientX: (cell % 10) * pitch + pitch / 2, clientY: Math.floor(cell / 10) * pitch + pitch / 2 };
};
const settle = async () => {
  for (let i = 0; i < 6; i++) await act(async () => new Promise((r) => realTimeout(r, 5)));
};

async function playStage(puzzle: LaserPuzzleData, key: string) {
  clearStageState(key);
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host as unknown as Element);
  let draft = "";
  let submitted: string | null = null;
  await act(async () => {
    root.render(React.createElement(laserPuzzle.Stage, {
      puzzle, locked: false, onSubmit: (a: string) => (submitted = a), onDraftAnswer: (a: string) => (draft = a), stateKey: key, phaseStartedAt: Date.now(),
    } as never));
  });
  const board = () => host.querySelector(".laser-board") as unknown as HTMLElement;
  const button = (name: RegExp) => Array.from(host.querySelectorAll("button")).find((b) => name.test(b.textContent?.trim() ?? "")) as unknown as HTMLButtonElement;
  const down = async (cell: number) => {
    await act(async () => {
      board().dispatchEvent(new win.PointerEvent("pointerdown", { bubbles: true, cancelable: true, ...centre(cell) }) as unknown as Event);
    });
  };
  const tapPlaced = async (cell: number) => {
    await down(cell);
    await act(async () => {
      win.dispatchEvent(new win.PointerEvent("pointerup", { bubbles: true, ...centre(cell) }));
    });
  };
  const click = async (b: HTMLButtonElement) => {
    await act(async () => {
      b.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }) as unknown as Event);
    });
    await settle();
  };
  const fixed = new Set([puzzle.source, ...puzzle.gems, ...puzzle.bombs, ...puzzle.blocks, ...(puzzle.splitters ?? [])]);
  const free = Array.from({ length: 100 }, (_, i) => i).filter((c) => !fixed.has(c));
  return { host, root, board, button, down, tapPlaced, click, free, draft: () => draft, submitted: () => submitted };
}

const p4 = live[0]!;
{
  const s = await playStage(p4, "pol-rev4");
  const cell = s.free[0]!;
  await s.down(cell);
  const mirrorKinds = () => Array.from(s.host.querySelectorAll("[data-mirror]")).map((n) => (n as unknown as Element).getAttribute("data-mirror"));
  check(JSON.stringify(mirrorKinds()) === JSON.stringify(["/"]), `stage: a tap didn't place a mirror (${JSON.stringify(mirrorKinds())})`);
  check(s.host.innerHTML.includes("/pattern-art/laser/mirror-slash.webp"), "art: a placed mirror isn't drawn with its sprite");
  await s.tapPlaced(cell);
  check(JSON.stringify(mirrorKinds()) === JSON.stringify(["\\"]), `stage: a tap on the mirror didn't turn it (${JSON.stringify(mirrorKinds())})`);
  check(s.host.innerHTML.includes("/pattern-art/laser/mirror-back.webp"), "art: a turned mirror isn't drawn with its sprite");
  const undo = s.button(/^Undo$/);
  check(!!undo && !undo.disabled, "stage: Undo isn't available after a turn");
  await s.click(undo);
  check(JSON.stringify(mirrorKinds()) === JSON.stringify(["/"]), `stage: Undo didn't take back the turn (${JSON.stringify(mirrorKinds())})`);
  await s.click(s.button(/^Undo$/));
  check(mirrorKinds().length === 0, "stage: the second Undo didn't take back the placement");
  check(s.button(/^Undo$/).disabled, "stage: Undo is still available with nothing to take back");
  const replay = replayLaserLog(p4, s.draft(), 60_000);
  check(replay.layout.length === 0 && replay.diag.dropped === 0, `stage: the log doesn't replay to the stage's board (${JSON.stringify(replay.layout)})`);
  const verbs = decodeActionLog(s.draft(), 60_000).actions.map((a) => a.a);
  check(JSON.stringify(verbs) === JSON.stringify([`p${cell}s`, `r${cell}`, `r${cell}`, `x${cell}`]), `stage: the log is ${JSON.stringify(verbs)}`);
  // Three missed shots on an empty board: out of shots.
  cues.length = 0;
  for (let shot = 0; shot < 3; shot++) await s.click(s.button(/^Fire$/));
  await settle();
  const spent = s.host.querySelector("[data-laser-spent]");
  check(!!spent && /Out of shots/.test(spent.textContent ?? ""), "out of shots: the board doesn't say so");
  check(s.button(/^Fire$/).disabled && s.button(/^Reset$/).disabled && s.button(/^Undo$/).disabled, "out of shots: Fire, Reset or Undo still works");
  await s.down(s.free[1]!);
  check(s.host.querySelectorAll("[data-mirror]").length === 0, "out of shots: a tap still places a mirror");
  check(cues.filter((c) => c === "laser.outOfShots").length === 1, `out of shots: laser.outOfShots sounded ${cues.filter((c) => c === "laser.outOfShots").length} times`);
  check(s.host.querySelector("[data-laser-shots-left]")?.getAttribute("data-laser-shots-left") === "0", "out of shots: the shots-left figure isn't 0");
  check(s.submitted() === null, "out of shots: the stage submitted");
  await act(async () => s.root.unmount());
}
{
  // laserRev 3: Undo only takes back the last placed piece; after three shots the board is still editable.
  const p3 = { ...p4, laserRev: 3 } as LaserPuzzleData;
  const s = await playStage(p3, "pol-rev3");
  const cell = s.free[0]!;
  await s.down(cell);
  await s.tapPlaced(cell);
  await s.click(s.button(/^Undo$/));
  check(s.host.querySelectorAll("[data-mirror]").length === 0, "rev3: Undo no longer removes the last placed piece");
  for (let shot = 0; shot < 3; shot++) await s.click(s.button(/^Fire$/));
  await settle();
  check(!s.host.querySelector("[data-laser-spent]"), "rev3: the board locks after three shots");
  await s.down(s.free[1]!);
  check(s.host.querySelectorAll("[data-mirror]").length === 1, "rev3: a tap after three shots no longer places a mirror");
  await act(async () => s.root.unmount());
}

/* 5. Help and intro. */
{
  const how = PUZZLE_INSTRUCTIONS.laser.how.map((l) => `${l.action} ${l.detail}`).join(" | ");
  check(/Undo/.test(how) && /turn/.test(how) && /move/.test(how) && /costs nothing/.test(how), `help: Undo taking back any change isn't described: ${how}`);
  check(/Out of shots/.test(how) && /locks/.test(how), "help: out of shots isn't described");
  check(PUZZLE_INSTRUCTIONS.laser.how.filter((l) => !l.helpOnly).length <= 4, "help: more than four intro HOW lines");
  check(INTRO_SCORE.laser.length <= 90, `intro: SCORE line "${INTRO_SCORE.laser}" is over 90 characters`);
  const was = pinPrePatternNov15(true);
  const oldHow = PUZZLE_INSTRUCTIONS.laser.how.map((l) => `${l.action} ${l.detail}`).join(" | ");
  pinPrePatternNov15(was);
  check(!/Undo/.test(oldHow) && !/Out of shots/.test(oldHow), "help: the pinned help describes laserRev 4");
}

/* 6. The sprites. */
{
  let total = 0;
  for (const url of laserArtUrls()) {
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
    const kind = buf.subarray(12, 16).toString();
    const alpha = (kind === "VP8X" && (buf[20]! & 0x10) !== 0) || kind === "VP8L";
    check(webp && alpha, `sprite: ${url} isn't WebP with alpha (${kind})`);
    check(buf.length <= 25_000, `sprite: ${url} is ${buf.length} bytes`);
  }
  check(total <= 400_000, `sprites: ${total} bytes for the game`);
  check(LASER_SPRITES.length === 10, "sprites: expected 10");
}

/* 7. The art is wired. */
{
  const board = (props: Record<string, unknown>) =>
    renderToStaticMarkup(React.createElement(LaserBoard, {
      source: 0, dir: "R", gems: [5, 25, 45], bombs: [7], blocks: [9], splitters: [], directionalGems: [{ cell: 45, from: "L" }],
      placed: [{ cell: 2, kind: "/" }, { cell: 3, kind: "\\" }, { cell: 33, kind: "S|" }], beam: null, litGems: [25], ...props,
    } as never));
  const html = board({});
  // Mirrors sit on the measured grid, so they draw on the stage (checked there); the rest draw from the markup.
  for (const name of ["splitter", "gem-dark", "gem-lit", "bomb", "emitter"])
    check(html.includes(`/pattern-art/laser/${name}.webp`), `art: the board doesn't draw ${name}`);
  check(/data-gem-state="lit"/.test(html) && /data-gem-state="dark"/.test(html), "art: gems aren't drawn dark and lit");
  check(/data-gem-from="L"[\s\S]*?<polyline/.test(html), "art: the directional gem has no arrow");
  check(board({ bombFlash: true }).includes("/pattern-art/laser/bomb-hit.webp"), "art: a hit bomb isn't drawn red hot");
  check(/data-emitter-dir="R"/.test(html), "art: the emitter isn't turned to its beam");
  const css = src("src/polish-pattern/laser.css");
  check(css.includes('/pattern-art/laser/floor.webp') && css.includes('/pattern-art/laser/brick.webp'), "art: the floor and brick sprites aren't the cells' backgrounds");
  check(html.includes('aria-label="Wall"'), "art: walls aren't drawn");
  check(!/#FFF1BD|#A9AEC4|laser-gem-sparkle|laser-bomb-spark/.test(html), "art: the old SVG gem facets or sparks are still drawn");
  const beamHtml = board({ beam: [[0, 1, 2, 12, 22]] });
  check(!/feGaussianBlur|laser-beam-neon/.test(beamHtml), "art: the beam still has its blurred neon copy");
  check(!/drop-shadow/.test(src("src/polish-batch-p/batch-p.css").split("Lightbender (laser)")[1]!.split("Topsy-Turvy")[0]!), "art: lit gems still glow (batch P)");
  check(board({ outOfShots: true }).includes("Out of shots"), "art: the board can't say out of shots");
  const intro = renderToStaticMarkup(React.createElement(laserPuzzle.IntroExample!));
  check(intro.includes("/pattern-art/laser/gem-lit.webp") && intro.includes("/pattern-art/laser/splitter.webp"), "art: the intro doesn't draw the sprites");
  // The Gems pill keeps the best shot; Par is shown in play.
  check(laserGemsShown(5, 0) === 5, "pills: the Gems count falls back when the beam fades");
  const stage = src("src/puzzles/laser.tsx");
  check(/parPills\("Mirrors", mirrorsPlaced, elegantPar/.test(stage), "pills: Par isn't shown in play");
}

/* 8. The sounds. */
{
  const stage = src("src/puzzles/laser.tsx") + src("src/components/puzzles/pattern/laserArt.tsx");
  const doc = src("docs/sound-cues/pattern-elevenlabs.md");
  const section = doc.split("<!-- lightbender:start -->")[1]?.split("<!-- lightbender:end -->")[0] ?? "";
  for (const slot of ["laser.place", "laser.turn", "laser.fire", "laser.gem", "laser.bomb", "laser.nearMiss", "laser.outOfShots", "laser.solve"]) {
    check(slot in SOUND_MANIFEST, `sound: ${slot} isn't in the manifest`);
    check(stage.includes(`"${slot}"`), `sound: the game never fires ${slot}`);
    check(section.includes(`\`${slot}\``), `sound: ${slot} has no line in pattern-elevenlabs.md`);
  }
  for (const slot of ["laser.nearMiss", "laser.outOfShots"]) {
    const e = (SOUND_MANIFEST as Record<string, { url: string | null }>)[slot];
    check(!!e?.url, `sound: ${slot} has no library placeholder`);
  }
  check(section.includes("`pz_laser_split`") && section.includes("`pz_laser_gem`"), "sound: the splitter chord and gem notes aren't listed");
}

/* 9. The answer reveal (Joe, 15 Nov 2026): one large board at a time, the player's against the solution with what
   was wrong or missed highlighted, short labels, the numbers from the stored grade, the shots as a strip. */
{
  const reveal = async (puzzle: LaserPuzzleData, answer: string, msLeft: number) => {
    const graded = gradeAnswer(puzzle, answer, msLeft);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host as unknown as Element);
    await act(async () => {
      root.render(React.createElement(laserPuzzle.Reveal, {
        timeLimitMs: 60_000, puzzle, myAnswer: answer, myCorrect: graded.isCorrect, myMsRemaining: graded.isCorrect ? msLeft : 0,
        myReactionAvgMs: null, myExtra: graded.extra ?? null,
      } as never));
    });
    await settle();
    const live = host;
    const snap = live.cloneNode(true) as typeof live;
    const html = live.innerHTML;
    const text = (sel: string) => (snap.querySelector(sel)?.textContent ?? "").trim();
    const pill = (id: string) => text(`[data-hud-pill="${id}"]`);
    const marks = (kind: string) => Array.from(snap.querySelectorAll(`[data-mark="${kind}"]`)).map((n) => Number((n as unknown as Element).getAttribute("data-cell")));
    const out = { graded, html, text, pill, marks, host: snap };
    await act(async () => root.unmount());
    return out;
  };
  const common = (label: string, r: Awaited<ReturnType<typeof reveal>>) => {
    const leaves = Array.from(r.host.querySelectorAll("span")).map((n) => (n.textContent ?? "").trim());
    check(leaves.includes("Solution") && leaves.includes("Yours"), `reveal ${label}: no Solution / Yours labels for the switch`);
    check(/^You: /.test(r.text("[data-laser-result]")), `reveal ${label}: the player's line isn't "You: …" (${r.text("[data-laser-result]")})`);
    check(!!r.host.querySelector("[data-laser-yours] [data-laser-result]") && !r.host.querySelector("[data-laser-solution] [data-laser-result]"), `reveal ${label}: the player's line sits under the solution`);
    check(!/×/.test(r.html), `reveal ${label}: a stray × is drawn`);
    check(!!r.host.querySelector("[data-laser-yours] [data-hud-pills]") && !r.host.querySelector("[data-laser-solution] [data-hud-pills]"), `reveal ${label}: the player's numbers aren't under Yours only`);
    check(r.html.includes("/pattern-art/laser/"), `reveal ${label}: no sprites`);
    check(r.html.includes("laser-beam"), `reveal ${label}: no beam path drawn`);
  };
  // laserRev 4, solved by the kit's near-perfect player.
  const { KITS } = await import("./puzzle-fairness/kits");
  const { SKILLS, makeRng } = await import("./puzzle-fairness/kit");
  const { laserBestGems } = await import("../src/lib/duel/standard/pattern.server");
  const solvedPlay = KITS.laser!.play(p4, makeRng(7), { ...SKILLS.near, err: 0 }, 60_000);
  const solvedAnswer = solvedPlay.steps.at(-1)!.answer;
  const rs = await reveal(p4, solvedAnswer, 30_000);
  check(rs.graded.isCorrect, "reveal: the kit's flawless run doesn't solve");
  common("solved", rs);
  const ex = rs.graded.extra as Record<string, unknown>;
  check(rs.marks("wrong").length + rs.marks("missing").length + rs.marks("unlit").length === 0, "reveal solved: a solve is marked wrong");
  check(rs.pill("gems") === `Gems${p4.gems.length}/${p4.gems.length}`, `reveal solved: gems pill "${rs.pill("gems")}"`);
  check(rs.pill("shots") === `Shots${(ex["shots"] as unknown[]).length}/3`, `reveal solved: shots pill "${rs.pill("shots")}"`);
  check(rs.pill("mirrors") === `Mirrors${ex["solveMirrors"]}` && rs.pill("par") === `Par${ex["par"]}`, `reveal solved: mirrors / par "${rs.pill("mirrors")}" "${rs.pill("par")}"`);
  check(rs.pill("time") === "Time left30 s", `reveal solved: time pill "${rs.pill("time")}"`);
  // laserRev 4, unfinished: the solution with one mirror turned, fired once, then twice more after turning another.
  const sol = p4.solution ?? [];
  const mirrorsOnly = sol.filter((m) => m.kind === "/" || m.kind === "\\");
  let l: ReturnType<typeof decodeActionLog>["actions"] = [];
  let tt = 300;
  for (const m of sol) l = appendAction(l, laserAction.place(m.cell, m.kind), (tt += 400));
  const turned = mirrorsOnly[0]!.cell;
  l = appendAction(l, laserAction.turn(turned), (tt += 400));
  l = appendAction(l, laserAction.fire(), (tt += 400));
  const ru = await reveal(p4, encodeActionLog(l), 0);
  check(!ru.graded.isCorrect, "reveal unfinished: the turned layout solves");
  common("unfinished", ru);
  const exu = ru.graded.extra as Record<string, unknown>;
  const stored = laserBestGems(exu, 60_000, 3).gems;
  check(ru.pill("gems") === `Gems${stored}/${p4.gems.length}`, `reveal unfinished: gems pill "${ru.pill("gems")}" (stored grade ${stored})`);
  check(ru.pill("shots") === "Shots1/3", `reveal unfinished: shots pill "${ru.pill("shots")}"`);
  check(!ru.pill("mirrors") && !ru.pill("time"), "reveal unfinished: a solve's numbers on an unfinished round");
  check(JSON.stringify(ru.marks("wrong")) === JSON.stringify([turned]) && JSON.stringify(ru.marks("missing")) === JSON.stringify([turned]), `reveal unfinished: wrong ${JSON.stringify(ru.marks("wrong"))} missing ${JSON.stringify(ru.marks("missing"))} (turned ${turned})`);
  const shot = replayLaserLog(p4, encodeActionLog(l), 60_000).shotLog[0]!;
  if (!shot.hitBomb) check(ru.marks("unlit").length === p4.gems.length - shot.gemsLit, `reveal unfinished: ${ru.marks("unlit").length} gems marked dark, the shot lit ${shot.gemsLit}`);
  check(ru.host.querySelectorAll("[data-shot]").length === 1 && !!ru.host.querySelector("[data-laser-key]"), "reveal unfinished: no shot strip or highlight key");
  // Nothing at all.
  const rn = await reveal(p4, "", 0);
  common("empty", rn);
  check(rn.pill("gems") === `Gems0/${p4.gems.length}`, `reveal empty: gems pill "${rn.pill("gems")}"`);
  // Older stamps read their stored data: every rev3 and rev2 fixture case renders, its gems pill matching the stored grade.
  let older = 0;
  for (const c of fx.cases.filter((x) => ["average", "near", "spam random-layout-x3", "half unfired"].includes(x.label) && (x.seed === 8100 || x.seed === 8134))) {
    const p = fx.puzzles.find((x) => x.era === c.era && x.seed === c.seed)!.puzzle;
    const r = await reveal(p, c.answer, c.msLeft);
    const ext = c.extra as Record<string, unknown>;
    const want = c.isCorrect ? p.gems.length : c.era === "rev3" ? laserBestGems(ext, 60_000, 3).gems : (ext["gemsLit"] as number);
    if (r.pill("gems") !== `Gems${want}/${p.gems.length}`) failures.push(`reveal ${c.era} ${c.seed} ${c.label}: gems pill "${r.pill("gems")}", stored ${want}`);
    else older++;
    if (!/^You: /.test(r.text("[data-laser-result]"))) failures.push(`reveal ${c.era} ${c.label}: no "You: …" line`);
    if (c.isCorrect && r.marks("wrong").length) failures.push(`reveal ${c.era} ${c.label}: a solve is marked wrong`);
  }
  check(older >= 12, `reveal: only ${older} older-stamp reveals matched their stored grade`);
  // Drawn large: one column at a time at the reveal's full width.
  const css = src("src/polish-pattern/laser.css");
  check(/\.laser-reveal-board \{\s*width: min\(100%, calc\(100cqh - \d+px\)\);/.test(css), "reveal: the board isn't sized to the full width");
  check(!/data-yours-only/.test(src("src/puzzles/laser.tsx").split("function Reveal(")[1] ?? ""), "reveal: data-yours-only would leave the card without a width");
}

/* 10. The effects (stage 2, 15 Nov 2026; laserFx.ts on the effects kit). Each moment fires its effect on the piece's
   own art and not on other moments; transform and opacity only; the next press is taken during an effect; reduced
   motion is the kit's crossfade. */
{
  const { forceGameFxVariant, setGameFxSink } = await import("../src/lib/fx/kit");
  const { LASER_NEAR_MISS_MS, LASER_TURN_MS, laserDarkGem } = await import("../src/components/puzzles/pattern/laserFx");
  const { GoalLineContext } = await import("../src/components/duel/GameFrame");
  type Rec = { el: Element; frames: Keyframe[]; options: KeyframeAnimationOptions };
  const recs: Rec[] = [];
  const eproto = (win as unknown as { Element: { prototype: Record<string, unknown> } }).Element.prototype;
  const realAnimate = eproto["animate"];
  eproto["animate"] = function (this: Element, frames: Keyframe[], options: KeyframeAnimationOptions | number) {
    recs.push({ el: this, frames, options: typeof options === "number" ? { duration: options } : options });
    return { cancel() {}, addEventListener() {}, finished: Promise.resolve() };
  };
  const kit: { kind: string; variant: string; silent: boolean }[] = [];
  setGameFxSink((r) => kit.push({ kind: r.kind, variant: r.variant, silent: r.sound === null }));
  const allowed = new Set(["transform", "opacity", "offset", "easing", "composite"]);
  const onlyTransformOpacity = () => recs.every((r) => r.frames.every((f) => Object.keys(f).every((k) => allowed.has(k))));
  const onPieces = () => !recs.some((r) => r.el.matches?.("[data-game-arena], [data-game-stage], .laser-board, .laser-board > .grid, button"));
  const kinds = () => kit.map((k) => k.kind);
  const clear = () => {
    recs.length = 0;
    kit.length = 0;
    cues.length = 0;
  };
  // The near miss's pill clear (and only it) is held, so the pill can be read while it shows.
  const held: (() => void)[] = [];
  const zero = (win as unknown as { setTimeout: (fn: () => void, ms?: number) => number }).setTimeout;
  (win as unknown as { setTimeout: unknown }).setTimeout = (fn: () => void, ms?: number) => {
    if (ms === LASER_NEAR_MISS_MS) {
      held.push(fn);
      return 0;
    }
    return zero(fn, ms);
  };
  forceGameFxVariant("full");

  // The stage, in a frame (the pills draw only there).
  const stageIn = async (puzzle: LaserPuzzleData, key: string) => {
    clearStageState(key);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host as unknown as Element);
    await act(async () => {
      root.render(React.createElement(GoalLineContext.Provider, { value: () => {} },
        React.createElement(laserPuzzle.Stage, { puzzle, locked: false, onSubmit: () => {}, onDraftAnswer: () => {}, stateKey: key, phaseStartedAt: Date.now() } as never)));
    });
    const board = () => host.querySelector(".laser-board") as unknown as HTMLElement;
    const down = async (cell: number) => act(async () => {
      board().dispatchEvent(new win.PointerEvent("pointerdown", { bubbles: true, cancelable: true, ...centre(cell) }) as unknown as Event);
    });
    const up = async (cell: number) => act(async () => {
      win.dispatchEvent(new win.PointerEvent("pointerup", { bubbles: true, ...centre(cell) }));
    });
    const button = (name: RegExp) => Array.from(host.querySelectorAll("button")).find((b) => name.test(b.textContent?.trim() ?? "")) as unknown as HTMLButtonElement;
    const click = async (b: HTMLButtonElement) => {
      await act(async () => {
        b.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }) as unknown as Event);
      });
      await settle();
    };
    return { host, root, board, down, up, button, click };
  };

  // Place, turn, refuse, and a second press during the effect.
  {
    const s = await stageIn(p4, "fx-rev4");
    const fixed = new Set([p4.source, ...p4.gems, ...p4.bombs, ...p4.blocks, ...(p4.splitters ?? [])]);
    const free = Array.from({ length: 100 }, (_, i) => i).filter((c) => !fixed.has(c));
    check(recs.length === 0 && kit.length === 0, `fx: the first draw animates (${recs.length}, ${kinds()})`);
    clear();
    await s.down(free[0]!);
    const art0 = s.host.querySelector(`[data-mirror-cell="${free[0]}"]`);
    check(kinds().join() === "drop" && kit[0]!.silent, `fx: a placement isn't the kit's silent drop (${kinds()})`);
    check(!!art0 && recs.length === 1 && recs[0]!.el === art0, "fx: the drop isn't on the mirror's own art");
    check(cues.includes("laser.place") && !cues.includes("laser.turn"), `fx: the placement's sound (${cues})`);
    // The next press at once, while the drop still runs: taken.
    await s.down(free[1]!);
    check(s.host.querySelectorAll("[data-mirror]").length === 2, "fx: a press during the drop wasn't taken");
    clear();
    await s.down(free[0]!);
    await s.up(free[0]!);
    const turn = recs.filter((r) => r.el === s.host.querySelector(`[data-mirror-cell="${free[0]}"]`));
    check(kit.length === 0 && turn.length === 1 && String(turn[0]!.frames[0]!.transform) === "rotate(-90deg)", `fx: the turn isn't the ratchet on the mirror's art (${kinds()}, ${turn.length})`);
    check(turn[0]!.frames.length >= 4 && Number(turn[0]!.options.duration) === LASER_TURN_MS && LASER_TURN_MS <= 900, "fx: the turn isn't a two-click ratchet under 900 ms");
    check(cues.includes("laser.turn") && !cues.includes("laser.place"), `fx: the turn's sound (${cues})`);
    // A refused drop: the kit's shake on that square's art, never the board; no placement sound.
    clear();
    await s.down(p4.gems[0]!);
    check(kinds().join() === "wrong" && kit[0]!.silent && recs[0]?.el.closest?.(`[data-laser-cell="${p4.gems[0]}"]`), `fx: a refused square isn't shaken on its own art (${kinds()})`);
    check(!s.board().className.includes("animate-shake"), "fx: a refusal still shakes the whole board");
    check(!cues.includes("laser.place"), "fx: a refused press sounds as a placement");
    // A press that changes nothing (a drag dropped off the board from the tray) plays nothing.
    clear();
    await act(async () => {
      s.button(/^Fire$/); // present
    });
    check(recs.length === 0 && kit.length === 0 && cues.length === 0, "fx: a redraw with nothing changed plays something");
    // Undo of the turn turns it back (the ratchet again), Undo of a placement plays nothing.
    await s.click(s.button(/^Undo$/));
    check(recs.some((r) => String(r.frames[0]?.transform) === "rotate(-90deg)") && cues.includes("laser.turn"), "fx: Undo of a turn doesn't turn back");
    clear();
    await s.click(s.button(/^Undo$/));
    check(kit.length === 0 && !cues.includes("laser.place"), "fx: taking a piece back plays a placement");
    check(onPieces() && onlyTransformOpacity(), "fx: an effect moves the board, a button, or something other than transform and opacity");
    // Fire: the emitter pulses (the hum is laser.fire), the beam draws.
    clear();
    await s.click(s.button(/^Fire$/));
    check(cues.filter((c) => c === "laser.fire").length === 1, `fx: Fire's hum (${cues})`);
    check(kit.some((k) => k.kind === "tap" && k.silent) && recs.some((r) => r.el.matches?.(".laser-emitter")), "fx: the emitter doesn't pulse as the beam leaves it");
    check(onPieces() && onlyTransformOpacity(), "fx: the shot's effects move the board or something other than transform and opacity");
    await act(async () => s.root.unmount());
  }

  // The board's moments on their own: gems lighting in turn, the splitter reached, a bomb hit, the beam's head.
  {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host as unknown as Element);
    const base = { source: 0, dir: "R", gems: [3, 6, 9], bombs: [44], blocks: [], splitters: [5], directionalGems: [], placed: [], live: true };
    const draw = (props: Record<string, unknown>) => act(async () => {
      root.render(React.createElement(LaserBoard, { ...base, ...props } as never));
    });
    await draw({ beam: null, litGems: [] });
    clear();
    await draw({ beam: [[0, 1, 2, 3, 4]], litGems: [3], beamDrawing: true });
    check(kit.filter((k) => k.kind === "combo").length === 1 && recs.some((r) => r.el.closest?.('[data-laser-cell="3"]')), `fx: the first gem doesn't light up on its own art (${kinds()})`);
    check(host.querySelectorAll("[data-beam-head]").length === 1, "fx: the drawing beam has no leading point");
    clear();
    await draw({ beam: [[0, 1, 2, 3, 4, 5]], litGems: [3], beamDrawing: true });
    check(kinds().join() === "tap" && recs.some((r) => r.el.closest?.('[data-laser-cell="5"]')), `fx: the splitter doesn't pulse when the beam reaches it (${kinds()})`);
    clear();
    await draw({ beam: [[0, 1, 2, 3, 4, 5]], litGems: [3], beamDrawing: true });
    check(kit.length === 0 && recs.length === 0, "fx: a step with nothing new plays something");
    await draw({ beam: [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]], litGems: [3, 6, 9], beamDrawing: false });
    check(kit.filter((k) => k.kind === "combo").length === 2, `fx: gems 2 and 3 don't light in turn (${kinds()})`);
    check(host.querySelectorAll("[data-beam-head]").length === 0, "fx: the finished beam still has a leading point");
    clear();
    await draw({ beam: [[0, 1, 2, 3, 4, 5, 15, 25, 35, 45]], litGems: [3], bombFlash: true });
    check(kit.some((k) => k.kind === "wrong" && k.silent) && recs.some((r) => r.el.matches?.(".laser-bomb-hit")), `fx: the bomb hit doesn't jolt the bomb (${kinds()})`);
    check(onPieces() && onlyTransformOpacity(), "fx: the board's effects move the board or something other than transform and opacity");
    // Reduced motion: each change still shows, as the kit's crossfade (no particles, nothing moves).
    forceGameFxVariant("reduced");
    await draw({ beam: null, litGems: [], bombFlash: false, placed: [] });
    clear();
    await draw({ beam: null, litGems: [], placed: [{ cell: 22, kind: "/" }] });
    await draw({ beam: null, litGems: [], placed: [{ cell: 22, kind: "\\" }] });
    await draw({ beam: [[0, 1, 2, 3]], litGems: [3], placed: [{ cell: 22, kind: "\\" }] });
    check(kinds().join() === "drop,tap,tap,combo" && kit.every((k) => k.variant === "reduced"), `fx: reduced motion isn't the kit's crossfade (${kit.map((k) => `${k.kind}:${k.variant}`)})`);
    check(recs.length === 4 && recs.every((r) => r.frames.every((f) => f.transform === undefined) && Number(r.options.duration) <= 160), "fx: reduced motion still moves something, or runs long");
    forceGameFxVariant("full");
    await act(async () => root.unmount());
  }

  // The near miss: a shot that lights every gem but one: the dark gem's two soft pulses, "1 gem dark" by the Gems pill.
  {
    check(laserDarkGem([2, 15], [2], false) === 15 && laserDarkGem([2, 15, 30], [2], false) === null && laserDarkGem([2, 15], [2], true) === null, "fx: the dark gem isn't found");
    const near = { ...p4, source: 0, dir: "R", gems: [3, 15], bombs: [], blocks: [], splitters: [], directionalGems: [], splitterPieces: 0, solution: [] } as unknown as LaserPuzzleData;
    const s = await stageIn(near, "fx-near");
    clear();
    held.length = 0;
    await s.click(s.button(/^Fire$/));
    // Changed with Joe's approval, 15 Nov 2026 (Lightbender's near miss in the Gems pill): "1 gem dark" shows in the
    // Gems pill's own place (its content swapped, the count hidden in the same grid cell), never as a pill of its own.
    const pill = s.host.querySelector('[data-hud-pills="laser"] [data-hud-pill="gems"]');
    const pillIds = () => Array.from(s.host.querySelectorAll('[data-hud-pills="laser"] [data-hud-pill]')).map((el) => el.getAttribute("data-hud-pill"));
    const swapped = () => s.host.querySelector('[data-hud-pill="gems"] [data-laser-gems]')?.getAttribute("data-laser-gems");
    const darkShown = () => {
      const dark = s.host.querySelector('[data-hud-pill="gems"] .laser-gems-dark');
      return swapped() === "dark" && dark?.getAttribute("aria-hidden") !== "true" && /1 gem dark/.test(dark?.textContent ?? "");
    };
    check(cues.includes("laser.nearMiss") && !cues.includes("laser.bomb"), `fx: the near miss's sound (${cues})`);
    check(!!pill && darkShown() && pill.getAttribute("data-tone") === "accent", "fx: no \"1 gem dark\" in the Gems pill's place");
    check(!pillIds().includes("nearMiss") && pillIds().filter((id) => id === "gems").length === 1, `fx: the near miss adds a pill (${pillIds()})`);
    check(!s.host.querySelector(".laser-board")?.textContent?.includes("1 gem dark"), "fx: \"1 gem dark\" sits over the board");
    const pulses = recs.filter((r) => kit.some((k) => k.kind === "nearMiss"));
    check(kit.filter((k) => k.kind === "nearMiss").length === 2 && kit.filter((k) => k.kind === "nearMiss").every((k) => k.silent) && pulses.some((r) => r.el.closest?.('[data-laser-cell="15"]')) && recs.some((r) => r.el === pill), `fx: the dark gem and the pill don't pulse (${kinds()})`);
    // The board takes the next press while the pill still shows.
    const fixed = new Set([0, 3, 15]);
    const cell = Array.from({ length: 100 }, (_, i) => i).find((c) => !fixed.has(c))!;
    await s.down(cell);
    check(s.host.querySelectorAll("[data-mirror]").length === 1 && darkShown(), "fx: a press during the near miss wasn't taken");
    for (const fn of held.splice(0)) await act(async () => fn());
    check(swapped() === "count" && !darkShown() && /Gems/.test(s.host.querySelector('[data-hud-pill="gems"] .laser-gems-count')?.textContent ?? ""), "fx: \"1 gem dark\" stays after its moment");
    // A shot that lights none of the two isn't a near miss.
    await act(async () => s.root.unmount());
    const far = { ...near, gems: [15, 25] } as unknown as LaserPuzzleData;
    const f = await stageIn(far, "fx-far");
    clear();
    await f.click(f.button(/^Fire$/));
    check(!cues.includes("laser.nearMiss") && !kit.some((k) => k.kind === "nearMiss") && f.host.querySelector('[data-hud-pill="gems"] [data-laser-gems]')?.getAttribute("data-laser-gems") === "count", "fx: a plain miss shows a near miss");
    // Out of shots after the third: laser.outOfShots and the calm settle (no extra effect on the board).
    await f.click(f.button(/^Fire$/));
    clear();
    await f.click(f.button(/^Fire$/));
    check(cues.filter((c) => c === "laser.outOfShots").length === 1 && !!f.host.querySelector("[data-laser-spent]"), "fx: out of shots doesn't sound or settle");
    await act(async () => f.root.unmount());
  }

  // The solve: laser.solve at the solve, the kit's win on the reveal's result card.
  {
    const host = document.createElement("div");
    host.setAttribute("data-reveal-screen", "");
    const row = document.createElement("div");
    row.setAttribute("data-verdict-row", "");
    host.appendChild(row);
    const slot = document.createElement("div");
    host.appendChild(slot);
    document.body.appendChild(host);
    const root = createRoot(slot as unknown as Element);
    const { KITS } = await import("./puzzle-fairness/kits");
    const { SKILLS, makeRng } = await import("./puzzle-fairness/kit");
    const sol = KITS.laser!.play(p4, makeRng(7), { ...SKILLS.near, err: 0 }, 60_000).steps.at(-1)!.answer;
    clear();
    await act(async () => {
      root.render(React.createElement(laserPuzzle.Reveal, { timeLimitMs: 60_000, puzzle: p4, myAnswer: sol, myCorrect: true, myMsRemaining: 30_000, myReactionAvgMs: null, myExtra: gradeAnswer(p4, sol, 30_000).extra ?? null } as never));
    });
    check(kit.filter((k) => k.kind === "win").length === 1 && kit.find((k) => k.kind === "win")!.silent && recs.some((r) => r.el === row), `fx: the solve's win isn't on the result card (${kinds()})`);
    clear();
    await act(async () => {
      root.render(React.createElement(laserPuzzle.Reveal, { timeLimitMs: 60_000, puzzle: p4, myAnswer: "", myCorrect: false, myMsRemaining: 0, myReactionAvgMs: null, myExtra: null } as never));
    });
    check(!kit.some((k) => k.kind === "win"), "fx: a missed round plays the win");
    await act(async () => root.unmount());
    const board = src("src/puzzles/laser.tsx");
    check(/useSolveMoment\(live && solved, "laser\.solve"\)/.test(board), "fx: laser.solve isn't sounded at the solve");
  }

  // Only laserFx.ts calls animate (transform only), and every keyframe in laser.css is transform or opacity.
  for (const file of ["src/puzzles/laser.tsx", "src/components/puzzles/pattern/laserArt.tsx"]) check(!/\.animate\(/.test(src(file)), `fx: ${file} animates outside laserFx.ts`);
  check(/from "@\/lib\/fx\/kit"/.test(src("src/components/puzzles/pattern/laserFx.ts")), "fx: laserFx.ts doesn't use the kit");
  const css = src("src/polish-pattern/laser.css");
  check(!/transition:|stroke-dashoffset/.test(css), "fx: laser.css transitions or animates a stroke");
  for (const [, body] of css.matchAll(/@keyframes [\w-]+ \{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)) {
    const props = [...body!.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    check(props.every((p) => p === "transform" || p === "opacity"), `fx: a laser.css keyframe animates ${props.join(", ")}`);
  }
  forceGameFxVariant(null);
  setGameFxSink(null);
  eproto["animate"] = realAnimate;
  (win as unknown as { setTimeout: unknown }).setTimeout = zero;
}

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL pattern-overhaul-laser-check: ${failures.length} failure(s), ${passes} passed`);
  process.exit(1);
}
console.log(`pattern-overhaul-laser-check: ${passes} checks passed`);
process.exit(0);
