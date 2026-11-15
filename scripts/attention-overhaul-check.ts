/**
 * attention-overhaul-check (15 Nov 2026, phase 2 step 4; docs/design/attention-overhaul.md): the Attention overhaul's
 * stage 1, the new look and the game changes. No browser (happy-dom for the two rendered parts).
 *
 *   1. Stamps: live deals carry Double Take spotRev 4, Tally countRev 7, Matchmaker pairRev 4; with
 *      pinPreAttentionOverhaul the deals are exactly the stamps before (and byte for byte what the layer was given).
 *   2. Legibility on every dealt pair, on 200 seeds each: a Double Take colour change differs by at least
 *      MIN_LIGHTNESS_GAP in CIE L*; every turn is at least 30° (a quarter turn or a mirror of an asymmetric piece); the
 *      hidden seventh is at least 15 % smaller; Eagle Eye's look-alikes are exactly 45° off a target; every uncounted
 *      Tally colour sits clear of the counted ones; any two Matchmaker colours are lightness-apart, and the palette
 *      holds no red / orange or pink / purple pair.
 *   3. Tally's spread: no two shapes overlap (each shape's box circle inside its own cell), every shape inside the
 *      tray, the counts and every tray's true answer exactly the layer's input's.
 *   4. Matchmaker pairRev 4: the same number of pairs, every pair a distinct shape and colour, the gold pair on the
 *      board, a perfect run solves through the server's replay.
 *   5. Grading parity: the same answer grades the same on the new stamp as on the old (Double Take, Tally, Matchmaker).
 *   6. Bomb Defusal: no bank plan repeats an action or runs past its steps, so the input limits never block it; the
 *      limit rule itself.
 *   7. The 120 s rule: every Attention game's live deal is at most 120 s.
 *   8. Every sprite the games ask for exists in public/attention/.
 *   9. The help says what changed; Labyrinth's switch is in the game menu, not beside the pad.
 *  11. Stage 2, the effects: every moment's sound slot is in the manifest with a library stand-in, named in the
 *      ElevenLabs list and fired by its game; each game's moments go through the effects kit on the piece itself; no
 *      board shake or doubled wrong sound is left; Tally's reveal says "So close: 11, you said 12".
 *  10. Every Classic practice challenge of Double Take, Tally and Matchmaker (the three new stamps) is still met by a
 *      perfect run on the new Normal, through the real grader and the real challenge checker.
 *
 *   bun scripts/attention-overhaul-check.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { Window } from "happy-dom";

const win = new Window({ url: "http://localhost/", width: 390, height: 844 });
const g = globalThis as Record<string, unknown>;
for (const key of ["window", "document", "navigator", "Node", "Element", "HTMLElement", "SVGElement", "Text", "Event", "CustomEvent", "getComputedStyle", "MutationObserver", "localStorage"]) {
  if (g[key] === undefined) g[key] = key === "window" ? win : (win as unknown as Record<string, unknown>)[key];
}
// happy-dom's own events (Bun's globals aren't happy-dom's, and its dispatchEvent checks the class).
g["Event"] = (win as unknown as Record<string, unknown>)["Event"];
g["CustomEvent"] = (win as unknown as Record<string, unknown>)["CustomEvent"];
g["ResizeObserver"] ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const React = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const { generatePuzzle } = await import("../src/lib/duel/generate.server");
const { gradeAnswer } = await import("../src/lib/duel/gradeAnswer.server");
const { withSeededRandom } = await import("../src/lib/duel/random");
const O = await import("../src/lib/duel/attentionOverhaul");
const P = await import("../src/lib/duel/attentionPalette.data");
const { countUpStageTruth } = await import("../src/lib/duel/attentionRev");
const { replayPairs, encodePairFlips } = await import("../src/lib/duel/pairmatch");
const { BOMB_V3_BANK } = await import("../src/lib/duel/bombBankV3.server");
const { decodeBombActions } = await import("../src/lib/duel/bomb");
const { BOMB_MAX_SEQUENCE } = await import("../src/lib/duel/types");
const { bombActionAllowed } = await import("../src/puzzles/bombDefusal");
const { PUZZLE_INSTRUCTIONS } = await import("../src/lib/duel/instructions");
const { ArrowPad } = await import("../src/components/puzzles/GridDrag");
const { MENU_DIRECTION_GAMES, readDirectionControls, setDirectionControls, onDirectionControls } = await import("../src/lib/directionControls");
const { EAGLE_ANGLES } = await import("../src/components/puzzles/refreshIcons");
const { scanStageMatches } = await import("../src/lib/duel/attentionRev");
const { SPOT_BONUS_SCALE } = await import("../src/lib/duel/depth/doubleTake");
const art = await import("../src/components/puzzles/attention/attentionArt");

const failures: string[] = [];
const joinStagesFor = (p: import("../src/lib/duel/types").CountUpPuzzleData, first: number) =>
  p.stages.map((st, i) => String(i === 0 ? first : countUpStageTruth(st))).join("|");
let passes = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else failures.push(message);
};
type AnyPuzzle = Record<string, unknown> & { type: string };
const deal = (type: string, seed: number, pinned = false): AnyPuzzle => {
  const was = O.pinPreAttentionOverhaul(pinned);
  try {
    return withSeededRandom(seed, () => generatePuzzle(type as never, { unblockRow: null })) as unknown as AnyPuzzle;
  } finally {
    O.pinPreAttentionOverhaul(was);
  }
};
const SEEDS = Array.from({ length: 200 }, (_, i) => 9100 + i * 37);
const L = P.lightness;

/* ------------------------------------------------------------------ 1. stamps */
{
  const spot = deal("spotdiff", 1);
  const count = deal("countup", 1);
  const pair = deal("pairmatch", 1);
  check(spot.spotRev === O.SPOT_REV_NEXT, `Double Take deals spotRev ${spot.spotRev}, not ${O.SPOT_REV_NEXT}`);
  check(count.countRev === O.COUNT_REV_MARKS, `Tally deals countRev ${count.countRev}, not ${O.COUNT_REV_MARKS}`);
  check(pair.pairRev === O.PAIR_REV_CLEAR, `Matchmaker deals pairRev ${pair.pairRev}, not ${O.PAIR_REV_CLEAR}`);
  check(deal("spotdiff", 1, true).spotRev === O.SPOT_REV_STANDARD, "pinned: Double Take not spotRev 3");
  check(deal("countup", 1, true).countRev === O.COUNT_REV_NOTES, "pinned: Tally not countRev 6");
  check(deal("pairmatch", 1, true).pairRev === O.PAIR_REV_STANDARD, "pinned: Matchmaker not pairRev 3");
  // The layer leaves every other game and every older stamp alone.
  for (const type of ["symscan", "maze", "bomb", "reaction"]) {
    check(JSON.stringify(deal(type, 3)) === JSON.stringify(deal(type, 3, true)), `${type}: the overhaul layer changed its deal`);
  }
  const older = { ...deal("spotdiff", 2, true), spotRev: 2 };
  check(O.dealAttentionOverhaul(older) === older, "the layer moved a spotRev 2 puzzle");
}

/* ------------------------------------------------------------------ 2. legibility */
const spotHex = (c: string) => (P.SPOT_ENAMEL as Record<string, string>)[c]!;
for (const seed of SEEDS.slice(0, 120)) {
  const p = deal("spotdiff", seed) as unknown as import("../src/lib/duel/types").SpotPuzzleData;
  const pictures = [{ top: p.top, bottom: p.bottom }, ...(p.reef ? [p.reef] : [])];
  for (const pic of pictures) {
    const bottom = new Map(pic.bottom.map((s) => [s.cell, s]));
    for (const t of pic.top) {
      const b = bottom.get(t.cell)!;
      if (t.kind === b.kind && t.colour !== b.colour) {
        const gap = Math.abs(L(spotHex(t.colour)) - L(spotHex(b.colour)));
        check(gap >= P.MIN_LIGHTNESS_GAP, `Double Take seed ${seed}: a colour change ${t.colour}→${b.colour} is only ${gap.toFixed(1)} L* apart`);
      }
      if (t.kind === b.kind && ((t.rot ?? 0) !== (b.rot ?? 0) || !!t.flip !== !!b.flip)) {
        const turn = Math.abs((t.rot ?? 0) - (b.rot ?? 0));
        check(turn >= P.MIN_TURN_DEG || !!t.flip !== !!b.flip, `Double Take seed ${seed}: a turn of ${turn}°`);
        check(t.kind === "triangle" || t.kind === "arrow", `Double Take seed ${seed}: a ${t.kind} turned (not an asymmetric piece)`);
      }
    }
  }
}
check(1 - SPOT_BONUS_SCALE >= P.MIN_SIZE_GAP, `Double Take's hidden seventh is only ${Math.round((1 - SPOT_BONUS_SCALE) * 100)} % smaller`);
const angleGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};
for (const seed of SEEDS.slice(0, 120)) {
  const p = deal("symscan", seed) as unknown as import("../src/lib/duel/types").SymbolScanPuzzleData;
  for (const stage of p.stages) {
    const targets = [stage.target, ...(stage.alsoTarget ? [stage.alsoTarget] : [])];
    const matches = new Set(scanStageMatches(stage));
    stage.cells.forEach((dir, i) => {
      if (matches.has(i)) return;
      const nearest = Math.min(...targets.map((t) => angleGap(EAGLE_ANGLES[dir], EAGLE_ANGLES[t])));
      check(nearest >= 45, `Eagle Eye seed ${seed}: an eagle only ${nearest}° off a target`);
    });
  }
}
const tallyHex = (c: string) => (P.TALLY_ENAMEL as Record<string, string>)[c]!;
for (const seed of SEEDS) {
  const p = deal("countup", seed) as unknown as import("../src/lib/duel/types").CountUpPuzzleData;
  p.stages.forEach((stage, i) => {
    const counted = O.tallyCountedColours(stage);
    for (const s of stage.shapes) {
      if (counted.includes(s.colour)) continue;
      for (const c of counted) {
        const gap = Math.abs(L(tallyHex(c)) - L(tallyHex(s.colour)));
        check(gap >= P.MIN_LIGHTNESS_GAP, `Tally seed ${seed} tray ${i + 1}: ${s.colour} is only ${gap.toFixed(1)} L* from the counted ${c}`);
      }
    }
  });
}
{
  const ids = Object.keys(P.PAIR_ENAMEL);
  for (const a of ids)
    for (const b of ids)
      if (a < b) check(P.lightnessApart((P.PAIR_ENAMEL as Record<string, string>)[a]!, (P.PAIR_ENAMEL as Record<string, string>)[b]!), `Matchmaker: ${a} and ${b} are too close in lightness`);
  for (const [x, y] of [["RED", "ORANGE"], ["PINK", "PURPLE"]]) check(!(ids.includes(x!) && ids.includes(y!)), `Matchmaker's palette holds ${x} and ${y}`);
}

/* ------------------------------------------------------------------ 3. Tally's spread */
for (const seed of SEEDS.slice(0, 80)) {
  const before = deal("countup", seed, true) as unknown as import("../src/lib/duel/types").CountUpPuzzleData;
  const after = withSeededRandom(seed + 1, () => O.spreadTally(before));
  check(after.stages.length === before.stages.length, `Tally seed ${seed}: the trays changed`);
  after.stages.forEach((stage, i) => {
    check(countUpStageTruth(stage) === countUpStageTruth(before.stages[i]!), `Tally seed ${seed} tray ${i + 1}: the answer changed`);
    check(stage.shapes.length === before.stages[i]!.shapes.length, `Tally seed ${seed} tray ${i + 1}: shapes added or lost`);
    const h = (100 * stage.rows) / stage.cols;
    for (const s of stage.shapes) {
      const r = s.size / 2;
      check(s.x - r >= 0 && s.x + r <= 100 && (s.y * h) / 100 - r >= 0 && (s.y * h) / 100 + r <= h, `Tally seed ${seed} tray ${i + 1}: a shape over the tray's edge`);
    }
    for (let a = 0; a < stage.shapes.length; a++)
      for (let b = a + 1; b < stage.shapes.length; b++) {
        const A = stage.shapes[a]!;
        const B = stage.shapes[b]!;
        const gap = O.tallyCentreGap(stage, A, B);
        if (gap < (A.size + B.size) / 2) check(false, `Tally seed ${seed} tray ${i + 1}: shapes ${a} and ${b} overlap`);
      }
  });
  check(JSON.stringify(after.counts) === JSON.stringify(before.counts), `Tally seed ${seed}: the stored counts changed`);
}

/* ------------------------------------------------------------------ 4. Matchmaker's board */
for (const seed of SEEDS.slice(0, 100)) {
  const p = deal("pairmatch", seed) as unknown as import("../src/lib/duel/types").PairPuzzleData;
  const keys = p.cards.map((c) => `${c.shape}:${c.colour}`);
  const distinct = new Set(keys);
  check(distinct.size * 2 === p.cards.length && [...distinct].every((k) => keys.filter((x) => x === k).length === 2), `Matchmaker seed ${seed}: not ${p.cards.length / 2} distinct pairs`);
  check(p.cards.every((c) => c.colour in P.PAIR_ENAMEL && (O.PAIR_CLEAR_SHAPES as readonly string[]).includes(c.shape)), `Matchmaker seed ${seed}: a card off the clear palette`);
  check(!!p.gold && keys.includes(`${p.gold.shape}:${p.gold.colour}`), `Matchmaker seed ${seed}: the gold pair isn't on the board`);
  const flips: number[] = [];
  const seen = new Map<string, number>();
  keys.forEach((k, i) => (seen.has(k) ? flips.push(seen.get(k)!, i) : seen.set(k, i)));
  const replay = replayPairs(p.cards, flips);
  check(replay.solved && replay.tries === p.cards.length / 2, `Matchmaker seed ${seed}: a perfect run doesn't solve`);
}
for (const seed of SEEDS.slice(0, 40)) {
  const old = deal("pairmatch", seed, true) as unknown as import("../src/lib/duel/types").PairPuzzleData;
  check(old.cards.every((c) => ["circle", "square", "triangle", "star"].includes(c.shape)), `Matchmaker pinned seed ${seed}: a new shape on an old board`);
}

/* ------------------------------------------------------------------ 5. grading parity */
{
  const same = (a: { score: number; isCorrect: boolean }, b: { score: number; isCorrect: boolean }) => a.score === b.score && a.isCorrect === b.isCorrect;
  for (const seed of SEEDS.slice(0, 30)) {
    const spot = deal("spotdiff", seed);
    const diffs = (spot.differences as { cells: number[]; scene?: number }[]) ?? [];
    const taps = [0, 1].map((sc) => diffs.filter((d) => (d.scene ?? 0) === sc).slice(0, 4 + (seed % 3)).map((d) => d.cells[0]).join(","));
    const answer = `${taps[0]}|${taps[1]}`;
    const a = gradeAnswer({ ...spot, spotRev: O.SPOT_REV_NEXT } as never, answer, 20_000);
    const b = gradeAnswer({ ...spot, spotRev: O.SPOT_REV_STANDARD } as never, answer, 20_000);
    check(same(a, b), `Double Take seed ${seed}: spotRev 4 grades ${a.score}, spotRev 3 ${b.score}`);
    const count = deal("countup", seed) as AnyPuzzle;
    const stages = count.stages as import("../src/lib/duel/types").CountUpStage[];
    const ans = stages.map((s, i) => String(countUpStageTruth(s) + (i === seed % 4 ? 1 : 0))).join(";");
    const c1 = gradeAnswer({ ...count, countRev: O.COUNT_REV_MARKS } as never, ans, 15_000);
    const c2 = gradeAnswer({ ...count, countRev: O.COUNT_REV_NOTES } as never, ans, 15_000);
    check(same(c1, c2), `Tally seed ${seed}: countRev 7 grades ${c1.score}, countRev 6 ${c2.score}`);
    const pair = deal("pairmatch", seed) as AnyPuzzle;
    const cards = pair.cards as import("../src/lib/duel/types").PairCard[];
    const flips = cards.map((_, i) => i);
    const p1 = gradeAnswer({ ...pair, pairRev: O.PAIR_REV_CLEAR } as never, encodePairFlips(flips), 30_000);
    const p2 = gradeAnswer({ ...pair, pairRev: O.PAIR_REV_STANDARD } as never, encodePairFlips(flips), 30_000);
    check(same(p1, p2), `Matchmaker seed ${seed}: pairRev 4 grades ${p1.score}, pairRev 3 ${p2.score}`);
  }
}

/* ------------------------------------------------------------------ 6. Bomb Defusal's input limits */
{
  let plans = 0;
  for (const bomb of BOMB_V3_BANK) {
    const plan = decodeBombActions((bomb as { required?: string; sequence?: string }).required ?? bomb.sequence ?? "");
    const steps = bomb.stepCount || BOMB_MAX_SEQUENCE;
    let taken: string[] = [];
    let blocked = false;
    for (const action of plan) {
      if (!bombActionAllowed(taken as never, action, steps)) blocked = true;
      taken = [...taken, action];
    }
    check(!blocked, `Bomb Defusal bank plan ${plans}: the input limits block its own defusing order`);
    plans++;
  }
  check(plans >= 300, `Bomb Defusal: only ${plans} bank plans checked`);
  check(!bombActionAllowed(["bA"] as never, "bA" as never, 6), "Bomb Defusal: a button pressed twice is allowed");
  check(!bombActionAllowed(["w1", "w2", "w3"] as never, "bA" as never, 3), "Bomb Defusal: a step past the bomb's steps is allowed");
  check(bombActionAllowed(["w1"] as never, "bA" as never, 6), "Bomb Defusal: a fresh step is refused");
}

/* ------------------------------------------------------------------ 7. the 120 s rule */
for (const type of ["symscan", "spotdiff", "countup", "maze", "bomb", "pairmatch"]) {
  const p = deal(type, 5);
  const limit = (p.timeLimitMs as number | undefined) ?? 0;
  check(limit === 0 || limit <= 120_000, `${type}: dealt ${limit} ms, over 120 s`);
}

/* ------------------------------------------------------------------ 8. sprites */
{
  const want: string[] = [];
  for (const d of Object.keys(EAGLE_ANGLES)) for (const gold of [false, true]) want.push(art.eagleSprite(d as never, gold));
  for (const theme of ["shop", "reef"] as const)
    for (const kind of ["circle", "square", "triangle", "star", "hexagon", "arrow"]) for (const c of Object.keys(P.SPOT_ENAMEL)) want.push(art.spotSprite(theme, kind, c as never));
  for (const shape of ["circle", "square", "triangle", "star", "hexagon"]) for (const c of Object.keys(P.TALLY_ENAMEL)) want.push(art.tallySprite(shape, c as never));
  for (const shape of O.PAIR_CLEAR_SHAPES) for (const c of Object.keys(P.PAIR_ENAMEL)) want.push(art.pairSprite(shape, c as never));
  for (const c of ["RED", "BLUE", "GREEN", "YELLOW", "WHITE", "BLACK"]) want.push(art.wireSprite(c), art.capSprite(c));
  for (const [game, name] of [["symscan", "tile"], ["symscan", "tile-marked"], ["spotdiff", "shelves"], ["spotdiff", "rockpool"], ["countup", "felt"], ["maze", "floor"], ["bomb", "casing"], ["bomb", "terminal"], ["bomb", "screw"], ["pairmatch", "back"], ["pairmatch", "face"]] as const)
    want.push(art.attentionArt(game, name));
  const missing = want.filter((url) => !existsSync(new URL(`../public${url}`, import.meta.url)));
  check(missing.length === 0, `${missing.length} sprites missing: ${missing.slice(0, 5).join(", ")}`);
  // Joe's image budget (15 Nov 2026): each game's new art under about 400 KB of compressed WebP.
  const { readdirSync, statSync } = await import("node:fs");
  for (const game of art.ATTENTION_ART_GAMES) {
    const dir = new URL(`../public/attention/${game}/`, import.meta.url);
    const bytes = readdirSync(dir).reduce((n, f) => n + statSync(new URL(f, dir)).size, 0);
    check(bytes <= 400 * 1024, `${game}: ${Math.round(bytes / 1024)} KB of art, over the 400 KB budget`);
    check(readdirSync(dir).every((f) => f.endsWith(".webp")), `${game}: art that isn't WebP`);
  }
  const css = readFileSync(new URL("../src/polish-attention/attention-overhaul.css", import.meta.url), "utf8");
  for (const m of css.matchAll(/url\("([^"]+)"\)/g)) check(existsSync(new URL(`../public${m[1]}`, import.meta.url)), `the CSS names a missing file ${m[1]}`);
}

/* ------------------------------------------------------------------ 9. help, the menu switch */
{
  const text = (type: string) => {
    const ins = (PUZZLE_INSTRUCTIONS as Record<string, { how: { action: string; detail: string; helpOnly?: boolean }[] }>)[type]!;
    return { all: ins.how.map((l) => `${l.action} ${l.detail}`).join(" | "), intro: ins.how.filter((l) => !l.helpOnly).length };
  };
  check(/5 misses allowed/.test(text("spotdiff").all) && /for the finish bonus/.test(text("spotdiff").all), "Double Take's help doesn't say 5 misses are allowed for the finish bonus");
  check(/Tap Next/.test(text("spotdiff").all), "Double Take's help doesn't say the picture waits for Next");
  check(/mark it as counted/.test(text("countup").all), "Tally's help doesn't name the marks");
  check(/Backtracking/.test(text("maze").all) && /par/.test(text("maze").all), "Labyrinth's help doesn't say backtracking counts against par");
  check(/game menu/.test(text("maze").all), "Labyrinth's help doesn't say where the controls switch is");
  check(/Nothing reacts live/.test(text("bomb").all) && /DEFUSE/.test(text("bomb").all), "Bomb Defusal's help doesn't say nothing reacts live");
  check(/skip the wait/.test(text("pairmatch").all), "Matchmaker's help doesn't name the quick flip-back");
  for (const type of ["symscan", "spotdiff", "countup", "maze", "bomb", "pairmatch"]) check(text(type).intro <= 4, `${type}: more than four intro HOW lines`);
  check(MENU_DIRECTION_GAMES.includes("maze"), "Labyrinth's switch isn't in the game menu");
  const withSwitch = renderToStaticMarkup(React.createElement(ArrowPad, { onPress: () => undefined }));
  const without = renderToStaticMarkup(React.createElement(ArrowPad, { onPress: () => undefined, menuSwitch: true }));
  check(/role="switch"/.test(withSwitch), "ArrowPad lost its switch for the other games");
  check(!/role="switch"/.test(without), "Labyrinth's pad still draws the switch beside it");
  check(/menuSwitch/.test(readFileSync(new URL("../src/puzzles/mazeDash.tsx", import.meta.url), "utf8")), "Labyrinth doesn't ask for the menu switch");
  const heard: string[] = [];
  const off = onDirectionControls((v) => heard.push(v));
  setDirectionControls("joystick");
  check(readDirectionControls() === "joystick" && heard.at(-1) === "joystick", "the direction choice didn't reach the pads");
  setDirectionControls("arrows");
  check(readDirectionControls() === "arrows" && heard.at(-1) === "arrows", "the direction choice didn't go back");
  off();
}

/* ------------------------------------------------------------------ 10. challenges still achievable */
{
  const { challengesFor, evaluateChallenge } = await import("../src/lib/duel/practiceChallenges");
  const { joinStages } = await import("../src/lib/duel/stagedRounds");
  const { joinPairGoldTime } = await import("../src/lib/duel/depth/matchmaker");
  const perfect: Record<string, (p: AnyPuzzle) => string> = {
    spotdiff: (p) => {
      const diffs = (p.differences as { cells: number[]; scene?: number }[]) ?? [];
      const bonus = p.bonus as { cells: number[]; scene?: number } | undefined;
      return [0, 1]
        .map((sc) => [...diffs.filter((d) => (d.scene ?? 0) === sc).map((d) => d.cells[0]), ...(bonus && (bonus.scene ?? 0) === sc ? [bonus.cells[0]] : [])].join(","))
        .join("|");
    },
    countup: (p) => joinStages((p.stages as import("../src/lib/duel/types").CountUpStage[]).map((st) => String(countUpStageTruth(st))), 4),
    pairmatch: (p) => {
      const cards = p.cards as import("../src/lib/duel/types").PairCard[];
      const seen = new Map<string, number>();
      const flips: number[] = [];
      cards.forEach((c, i) => {
        const k = `${c.shape}:${c.colour}`;
        if (seen.has(k)) flips.push(seen.get(k)!, i);
        else seen.set(k, i);
      });
      return joinPairGoldTime(encodePairFlips(flips), 5_000);
    },
  };
  for (const [type, answer] of Object.entries(perfect)) {
    for (const seed of [11, 12, 13]) {
      const p = deal(type, seed);
      const limit = (p.timeLimitMs as number | undefined) ?? 90_000;
      const graded = gradeAnswer(p as never, answer(p), limit - 15_000);
      for (const c of challengesFor(type).filter((c) => c.level === "classic")) {
        const r = evaluateChallenge(c, { score: graded.score, isCorrect: graded.isCorrect, extra: graded.extra as Record<string, unknown> | null, level: "classic" });
        check(r.met, `${type} seed ${seed}: a perfect run on the new stamp misses the challenge "${c.name}" (score ${graded.score})`);
      }
    }
  }
}

/* ------------------------------------------------------------------ 11. stage 2: the effects */
{
  const { SOUND_MANIFEST } = await import("../src/lib/fx/manifest");
  const { ATTENTION_SOUND_FALLBACKS } = await import("../src/components/puzzles/attention/attentionFx");
  const list = readFileSync(new URL("../docs/sound-cues/attention-elevenlabs.md", import.meta.url), "utf8");
  const files = ["symbolScan", "spotTheDifference", "countUp", "mazeDash", "bombDefusal", "pairMatch"].map((f) => readFileSync(new URL(`../src/puzzles/${f}.tsx`, import.meta.url), "utf8"));
  const code = files.join("\n");
  for (const [slot, fallback] of Object.entries(ATTENTION_SOUND_FALLBACKS)) {
    check(slot in SOUND_MANIFEST, `${slot}: not a manifest slot`);
    check(fallback in SOUND_MANIFEST && !!(SOUND_MANIFEST as Record<string, { url: string | null }>)[fallback]!.url, `${slot}: its stand-in ${fallback} has no file`);
    check(list.includes(`\`${slot}\``), `${slot}: missing from the ElevenLabs list`);
    check(code.includes(`"${slot}"`) || (slot.endsWith("unmark") && code.includes(slot.replace("unmark", "mark"))), `${slot}: no game fires it`);
  }
  const [eagle, spot, tally, maze, bomb, pair] = files as [string, string, string, string, string, string];
  check(/gameFx\("tap"/.test(eagle) && /gameFx\("nearMiss"/.test(eagle) && /symscan\.gridClear/.test(eagle), "Eagle Eye: the mark tap, the grid's flight or the reveal's missed pulse is missing");
  check(/gameFx\("combo"/.test(spot) && /gameFx\("wrong"/.test(spot) && /gameFx\("slide"/.test(spot), "Double Take: the combo, the wrong square or the picture slide is missing");
  check(!/animate-shake/.test(spot) && !/playWrong\(\)/.test(spot), "Double Take: the arena still shakes or plays a second wrong");
  check(/gameFx\("tap"/.test(tally) && /gameFx\("slide"/.test(tally) && /FxCountUp/.test(tally) && /gameFx\("nearMiss"/.test(tally), "Tally: the key, the tray slide, the count-up or the near miss is missing");
  check(!/puzzleReject\(\)/.test(maze) && /gameFx\("wrong"/.test(maze) && /maze\.deadEnd/.test(maze) && /maze\.back/.test(maze), "Labyrinth: the board still shakes, or the bump, back or dead-end moment is missing");
  check(/gameFx\("tap"/.test(bomb) && /bomb\.step/.test(bomb), "Bomb Defusal: the cap press or the step tick is missing");
  check(/gameFx\("combo"/.test(pair) && /wrongMoveFlash\(card \?\? null, false\)/.test(pair) && /pairmatch\.gold/.test(pair) && !/playWrong\(\)/.test(pair), "Matchmaker: the match lift, the silent wrong flash or the gold shimmer is missing, or a second wrong remains");
  const css = readFileSync(new URL("../src/polish-attention/attention-overhaul.css", import.meta.url), "utf8");
  for (const kf of css.matchAll(/@keyframes ([\w-]+)/g)) check(new RegExp(`prefers-reduced-motion[\\s\\S]*${kf[1]!.replace("attn-", "")}|prefers-reduced-motion[\\s\\S]*animation: none`).test(css), `${kf[1]}: no reduced-motion rule`);
  // Tally's one-off verdict, drawn from a real deal.
  const { countUpPuzzle } = await import("../src/puzzles/countUp");
  const tp = deal("countup", 21) as unknown as import("../src/lib/duel/types").CountUpPuzzleData;
  const truth0 = countUpStageTruth(tp.stages[0]!);
  const html = renderToStaticMarkup(React.createElement(countUpPuzzle.Reveal, { puzzle: tp, myAnswer: joinStagesFor(tp, truth0 + 1), myCorrect: false, timeLimitMs: 60_000 } as never));
  check(html.includes(`So close: ${truth0}, you said ${truth0 + 1}`), `Tally: the one-off verdict doesn't read "So close: ${truth0}, you said ${truth0 + 1}"`);
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`FAIL ${f}`);
  console.log(`attention-overhaul-check: ${failures.length} failures, ${passes} passed`);
  process.exit(1);
}
console.log(`PASS attention-overhaul-check: ${passes} assertions`);
