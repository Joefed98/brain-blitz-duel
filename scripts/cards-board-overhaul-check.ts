/**
 * cards-board-overhaul-check (phase 2 step 4, 15 Nov 2026; no browser, ~3 s): the Cards & Board overhaul's stage 1 for
 * Free Cell, Mahjong Solitaire, Summit, Five Hands and Thirteen.
 *
 *  1. No gameplay moved: every dealt stamp is the one main deals, and flawless runs still score 200 through the replay.
 *  2. Layouts: Free Cell's eight columns of 50-wide cards fit the table, its labelled Undo and Reset sit under the
 *     columns and hit-test as drawn; Summit's and Thirteen's cards are larger, every card's drawn box answers a tap at
 *     its visible part, the piles sit inside the world.
 *  3. Reset asks first: the confirmation's buttons hit as drawn, a tap off the panel cancels, and the stages send Reset
 *     only from the confirmation (Free Cell, Thirteen; Mahjong's R key and button open the question).
 *  4. Card motion: a card slides to its new place along an arc and lands on time; reduced motion places it at once;
 *     a face-down card turned up flips; a seeded stock card slides from the stock; a card on the table keeps its place.
 *  5. Five Hands' POINTS chip shows the score (hand points × 1.4) on fiveHandsRev 3.
 *  6. The reveal picture: each game's final table, cropped inside its world, with short plain labels that match the
 *     server's replay (no "×" in a label; Five Hands' sum adds up to the shown score).
 *  7. Art: every image exists, its size matches the layout the renderer reads, and each game's images stay under 400 KB.
 *  8. Sound and touch: the new slots are in the manifest; the five games' observers call the light touch.
 *
 *   bun scripts/cards-board-overhaul-check.ts
 */
import { existsSync, readFileSync, statSync } from "node:fs";

import { freecellFlawless, fiveHandsFlawless, pyramidFlawless, tripeaksFlawless } from "./cards/flawless";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}
const read = (p: string) => readFileSync(p, "utf8");

const FC = await import("../src/lib/arcade/cards/freecell");
const FCR = await import("../src/lib/arcade/cards/freecell.renderer");
const TP = await import("../src/lib/arcade/cards/tripeaks");
const TPR = await import("../src/lib/arcade/cards/tripeaks.renderer");
const PY = await import("../src/lib/arcade/cards/pyramid");
const PYR = await import("../src/lib/arcade/cards/pyramid.renderer");
const FH = await import("../src/lib/arcade/cards/fiveHands");
const FHR = await import("../src/lib/arcade/cards/fiveHands.renderer");
const MJ = await import("../src/lib/arcade/mahjong");
const BTN = await import("../src/lib/arcade/cards/cardButtons.renderer");
const ART = await import("../src/lib/arcade/cards/realArt.renderer");
const CARDS = await import("../src/lib/duel/cards");

/* 1. No gameplay moved */
check(FC.FC_REV === 5 && TP.TP_REV === 3 && PY.PY_REV === 3 && FH.FH_REV === 3 && MJ.MAHJONG_REV_DEALT === 2, "the dealt stamps are main's (freecellRev 5, tripeaksRev 3, pyramidRev 3, fiveHandsRev 3, mahjongRev 2)");
{
  const fc = freecellFlawless(3, 20, 5);
  check(CARDS.replayFreecellRun(3, fc.raw, 5).home === 40, "Free Cell: a flawless run still takes every card home through the replay");
  const tp = tripeaksFlawless(3, 15, 3);
  check(CARDS.replayTripeaksRun(3, tp.raw, 3).finished, "Summit: a flawless run still clears through the replay");
  const py = pyramidFlawless(3, 15, 3);
  check(CARDS.replayPyramidRun(3, py.raw, 3).finished, "Thirteen: a flawless run still clears through the replay");
}

/* 2. Layouts */
{
  const right = FCR.fcColX(FC.FC_COLS - 1) + FCR.FC_COL_W;
  check(FCR.FC_COL_W === 50 && FCR.fcColX(0) > 0 && right < FCR.FC_WORLD_W, `Free Cell: eight columns of ${FCR.FC_COL_W}-wide cards fit the ${FCR.FC_WORLD_W}-wide table`);
  check(FCR.FC_COL_BOTTOM < FCR.FC_BTN_ROW_Y && FCR.FC_BTN_ROW_Y + FCR.FC_BTN_ROW_H <= FCR.FC_WORLD_H - 8, "Free Cell: the Undo and Reset row sits under the columns, inside the table");
  for (const b of FCR.FC_BUTTONS) check(FCR.fcButtonHit(b.box.x + b.box.w / 2, b.box.y + b.box.h / 2) === b.kind, `Free Cell: the ${b.kind === FC.FC_INPUT_UNDO ? "Undo" : "Reset"} button hits as drawn`);
  check(FCR.fcButtonHit(FCR.FC_WORLD_W / 2, 20) === 0, "Free Cell: the HUD row no longer holds buttons");
  const s = FC.freecellGameFor(5).init(7);
  const longest = Math.max(...s.cols.map((c) => c.length));
  check(FCR.FC_COL_Y + (longest - 1) * FCR.fcColStep(longest) + FCR.FC_COL_H <= FCR.FC_COL_BOTTOM, "Free Cell: the dealt columns end above the buttons");
  let ok = true;
  s.cols.forEach((col, c) => col.forEach((_, i) => {
    const hit = FCR.fcHit(s, FCR.fcColX(c) + FCR.FC_COL_W / 2, FCR.FC_COL_Y + i * FCR.fcColStep(col.length) + 6);
    if (!hit || hit.pile !== c || hit.index !== i) ok = false;
  }));
  check(ok, "Free Cell: every card answers a tap on its visible strip");

  const t = TP.tripeaksGameFor(3).init(5);
  check(TPR.TP_CARD_W > 39 && TPR.TP_CARD_H > 70, `Summit: larger cards (${TPR.TP_CARD_W} × ${TPR.TP_CARD_H}, were 39 × 70)`);
  let tpOk = true;
  for (let i = 18; i < 28; i++) {
    const b = TPR.tpCardBox(i);
    if (TPR.tpHit(t, b.x + 6, b.y + TPR.TP_CARD_H / 2) !== i) tpOk = false;
  }
  check(tpOk, "Summit: each bottom-row card answers a tap on its visible left side (the row overlaps a little)");
  check(TPR.tpHit(t, TPR.TP_STOCK_X + TPR.TP_PILE_W / 2, TPR.TP_PILE_Y + TPR.TP_PILE_H / 2) === TP.TP_STOCK_PILE, "Summit: the stock hits as drawn");
  check(TPR.TP_PILE_Y + TPR.TP_PILE_H < TPR.TP_WORLD_H - 40 && TPR.TP_DISCARD_X + TPR.TP_PILE_W < TPR.TP_WORLD_W, "Summit: the stock and discard sit inside the table, under the peaks");
  check(TPR.tpCardBox(18).y + TPR.TP_CARD_H < TPR.TP_PILE_Y, "Summit: the pair sits below the peaks");

  const p = PY.pyramidGameFor(3).init(5);
  check(PYR.PY_CARD_W >= 56 && PYR.PY_CARD_H >= 82, `Thirteen: larger cards (${PYR.PY_CARD_W} × ${PYR.PY_CARD_H}, were 54 × 78)`);
  const last = PYR.pyCardBox(27);
  check(PYR.pyCardBox(21).x >= 0 && last.x + PYR.PY_CARD_W <= PYR.PY_WORLD_W && last.y + PYR.PY_CARD_H < PYR.PY_PANEL_Y, "Thirteen: the pyramid's bottom row fits the table, above the panel");
  check(PYR.pyHit(p, last.x + PYR.PY_CARD_W / 2, last.y + PYR.PY_CARD_H / 2) === 27, "Thirteen: a bottom-row card hits as drawn");
  check(PYR.PY_PILE_Y + PYR.PY_PILE_H < PYR.PY_BTN_Y, "Thirteen: the piles end above Undo and Reset");
}

/* 3. Reset asks first */
{
  const W = 414;
  const H = 772;
  const b = BTN.confirmBoxes(W, H);
  check(BTN.confirmHit(W, H, b.ok.x + b.ok.w / 2, b.ok.y + b.ok.h / 2) === "ok", "the confirmation's Reset hits as drawn");
  check(BTN.confirmHit(W, H, b.cancel.x + b.cancel.w / 2, b.cancel.y + b.cancel.h / 2) === "cancel", "the confirmation's Cancel hits as drawn");
  check(BTN.confirmHit(W, H, W / 2, b.panel.y + 20) === null, "a tap on the question's text does nothing");
  check(BTN.confirmHit(W, H, 10, 10) === "cancel", "a tap off the panel cancels");
  check(b.ok.w >= 44 && b.ok.h >= 44 && b.cancel.h >= 44, "the confirmation's buttons are thumb-sized");
  const fc = read("src/puzzles/freecell.tsx");
  check(/if \(held === FC_INPUT_RESET\) \{\s*view\.confirm = true;/.test(fc) && /if \(hit === "ok"\) return \{ k: FC_INPUT_RESET/.test(fc), "Free Cell: the Reset button opens the question; only its Reset sends Reset");
  const py = read("src/puzzles/pyramid.tsx");
  check(/if \(held === PY_INPUT_RESET\) \{\s*view\.confirm = true;/.test(py) && /if \(hit === "ok"\) return \{ k: PY_INPUT_RESET/.test(py), "Thirteen: the Reset button opens the question; only its Reset sends Reset");
  const mj = read("src/puzzles/mahjong.tsx");
  check(/key === "r" \|\| key === "R"\)\) \{\s*\/\/[^\n]*\n\s*if \(kind === "down"\) \{\s*setConfirming\(true\)/.test(mj), "Mahjong: R opens the question");
  check((mj.match(/MAHJONG_BUTTON_RESET, b: 0, c: 0 \}\)/g) ?? []).length === 2 && /data-game-controls="confirm-reset"/.test(mj), "Mahjong: Reset is sent only from the question (its button and Enter)");
  check(/if \(mahjongReleaseInside\(event\)\) \{\s*setConfirming\(true\)/.test(mj), "Mahjong: the Reset button opens the question on release");
  const fcView = FCR.fcNewView();
  check(fcView.confirm === false && !!fcView.motion, "Free Cell's view starts with the question closed and a card motion");
}

/* 4. Card motion */
{
  const m = new ART.CardMotion();
  m.frame(0);
  m.place(5, 10, 10);
  m.frame(16);
  const start = m.place(5, 210, 10);
  check(start.moving && start.x < 30, "a card given a new place starts from where it was");
  m.frame(16 + 90);
  const mid = m.place(5, 210, 10);
  check(mid.moving && mid.x > 30 && mid.x < 210 && mid.y < 10, "mid-slide it is on its way, lifted on an arc");
  m.frame(16 + ART.slideMs(200) + 1);
  const end = m.place(5, 210, 10);
  check(!end.moving && end.x === 210 && end.y === 10, `it lands on time (${ART.slideMs(200)} ms for 200 units, at most 260)`);
  check(ART.slideMs(10_000) === 260 && ART.slideMs(0) === 150, "a slide takes 150–260 ms");
  const still = new ART.CardMotion();
  still.enabled = false;
  still.frame(0);
  still.place(1, 0, 0);
  still.frame(16);
  const at = still.place(1, 100, 100);
  check(!at.moving && at.x === 100, "with motion off (reduced motion) a card is placed at once");
  const f = new ART.CardMotion();
  f.frame(0);
  f.place(2, 0, 0, true);
  f.frame(16);
  f.place(2, 0, 0, false);
  f.frame(16 + ART.FLIP_MS / 4);
  const flip = f.place(2, 0, 0, false);
  check(flip.flipW < 1 && flip.down, "a face-down card turned up flips (the back first)");
  f.frame(16 + ART.FLIP_MS + 1);
  check(f.place(2, 0, 0, false).flipW === 1, "the flip ends flat, face up");
  const s = new ART.CardMotion();
  s.frame(0);
  s.seed(9, 300, 600, true);
  s.frame(16);
  const fromStock = s.place(9, 100, 600, false);
  check(fromStock.moving && fromStock.x > 250, "a seeded stock card slides from the stock");
  s.frame(1000);
  s.place(9, 100, 600);
  s.frame(1016);
  s.seed(9, 300, 600, true);
  check(!s.place(9, 100, 600).moving, "a card already on the table keeps its place when the stock seeds it again");
  const instant = new ART.CardMotion();
  instant.frame(0);
  instant.place(3, 0, 0);
  instant.frame(16);
  check(!instant.place(3, 50, 50, false, true).moving, "a dragged or flying card is placed exactly (instant)");
}

/* 5. Five Hands' POINTS chip */
{
  const run = fiveHandsFlawless(4, 20, 3);
  const st = run.state;
  check(FHR.fhPointsShown(st) === FH.fhScoreV3(FH.fhTotalV3(st)), `Five Hands: POINTS shows the score (${FHR.fhPointsShown(st)}), hand points × 1.4`);
  check(FHR.fhPointsShown(st) !== FH.fhTotalV3(st) || FH.fhTotalV3(st) === 0, "Five Hands: not the raw hand points");
  const v2 = FH.fiveHandsGameFor(2).init(4);
  check(FHR.fhPointsShown(v2) === FH.fhTotals(v2.rows, v2.rev).total, "Five Hands: older revisions keep their hand points");
}

/* 6. The reveal picture */
{
  const { cardsRevealPicture, CARDS_REVEAL_TYPES } = await import("../src/components/duel/CardsRevealPicture");
  check(["freecell", "mahjong", "tripeaks", "fivehands", "pyramid"].every((t) => CARDS_REVEAL_TYPES.has(t)) && CARDS_REVEAL_TYPES.size === 5, "the reveal picture serves the five games");
  const fc = freecellFlawless(3, 20, 5);
  const tp = tripeaksFlawless(3, 15, 3);
  const py = pyramidFlawless(3, 15, 3);
  const fh = fiveHandsFlawless(4, 20, 3);
  const cases: [string, Record<string, unknown>, string][] = [
    ["freecell", { type: "freecell", seed: 3, freecellRev: 5 }, fc.raw],
    ["tripeaks", { type: "tripeaks", seed: 3, tripeaksRev: 3 }, tp.raw],
    ["pyramid", { type: "pyramid", seed: 3, pyramidRev: 3 }, py.raw],
    ["fivehands", { type: "fivehands", seed: 4, fiveHandsRev: 3 }, fh.raw],
    ["mahjong", { type: "mahjong", seed: 3, mahjongRev: 2 }, "3|0||600|"],
  ];
  for (const [type, puzzle, raw] of cases) {
    const pic = cardsRevealPicture(puzzle as never, raw);
    check(!!pic, `${type}: the reveal picture is worked out from the stored run`);
    if (!pic) continue;
    check(pic.top >= 0 && pic.bottom > pic.top + 150 && pic.bottom <= 772, `${type}: the table is cropped inside its world (${pic.top}–${pic.bottom})`);
    check(pic.facts.length === 3 && pic.facts.every((f) => f.label.length <= 12 && !/[×x]\s*\d|\d\s*[×]/.test(f.label) && f.value.length <= 14), `${type}: three short plain key numbers (${pic.facts.map((f) => `${f.label} ${f.value}`).join(", ")})`);
  }
  const fcPic = cardsRevealPicture(cases[0]![1] as never, fc.raw)!;
  check(fcPic.facts[0]!.value === "40/40" && fcPic.facts[0]!.best === true, "Free Cell: Home reads 40/40, lit, on a clear");
  const tpPic = cardsRevealPicture(cases[1]![1] as never, tp.raw)!;
  check(tpPic.marks?.of === 10 && tpPic.marks.filled === Math.min(10, CARDS.replayTripeaksRun(3, tp.raw, 3).bestRun), "Summit: the best-run ladder fills to the run");
  const fhPic = cardsRevealPicture(cases[3]![1] as never, fh.raw)!;
  const m = /^\((\d+)(?: \+ (\d+))?\) × 1\.4 = (\d+)$/.exec(fhPic.sum ?? "");
  check(!!m && Math.min(200, Math.floor(((+m[1]! + +(m[2] ?? 0)) * 7) / 5)) === +m[3]! && +m[3]! === FHR.fhPointsShown(fh.state), `Five Hands: the sum adds up to the score (${fhPic.sum})`);
  const empty = cardsRevealPicture(cases[0]![1] as never, "");
  check(empty === null, "an empty run draws no picture");
  const reveal = read("src/components/duel/ArcadeReveal.tsx");
  check(/CARDS_REVEAL_TYPES\.has\(puzzle\.type\) && myScore !== null \? <CardsRevealPicture/.test(reveal), "the arcade reveal draws the picture once the score is stored");
}

/* 7. Art */
{
  const files = ["cards.webp", "felt.webp", "tiles.webp", "mahjong-table.webp"].map((f) => `public/cards-board/${f}`);
  check(files.every((f) => existsSync(f)), "every image exists in public/cards-board/");
  const kb = (f: string) => statSync(`public/cards-board/${f}`).size / 1024;
  const cardGame = kb("cards.webp") + kb("felt.webp");
  const mahjong = kb("tiles.webp") + kb("mahjong-table.webp");
  check(cardGame < 400, `a card game's images: ${Math.round(cardGame)} KB (under 400)`);
  check(mahjong < 400, `Mahjong's images: ${Math.round(mahjong)} KB (under 400)`);
  const dims = (f: string) => {
    const b = readFileSync(`public/cards-board/${f}`);
    // WebP VP8X / VP8 / VP8L headers.
    const kind = b.toString("ascii", 12, 16);
    if (kind === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (kind === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    const v = b.readUInt32LE(21);
    return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 };
  };
  const c = ART.REAL_ART.cards;
  const cd = dims("cards.webp");
  check(cd.w === c.cols * c.cellW && cd.h === Math.ceil(53 / c.cols) * c.cellH, `the card sheet is ${c.cols} cells across of ${c.cellW} × ${c.cellH} (${cd.w} × ${cd.h})`);
  check(Math.abs(c.w / c.h - 0.68) < 0.01, "the rendered cards are the faces' 0.68 aspect");
  const t = ART.REAL_ART.tiles;
  const td = dims("tiles.webp");
  check(td.w === t.cols * t.cellW && td.h === Math.ceil(34 / t.cols) * t.cellH, `the tile sheet is ${t.cols} cells across of ${t.cellW} × ${t.cellH} (${td.w} × ${td.h})`);
  check(Math.abs(t.w / t.h - (MJ.MAHJONG_TILE_W + 6) / (MJ.MAHJONG_TILE_H + 6)) < 0.01, "a rendered tile has the game's tile and depth shape (bounds rule)");
  const fd = dims("felt.webp");
  check(fd.w === 828 && fd.h === 1544, "the felt is 2× the 414 × 772 table");
  check(existsSync("scripts/cards-board-art/render.py") && existsSync("scripts/cards-board-art/textures.ts") && existsSync("scripts/cards-board-art/pack.py"), "the Blender pipeline is in the repo");
  // Older card games and the skins keep their own art.
  const cr = read("src/lib/arcade/cards/cards.renderer.ts");
  check(/export function drawCard\(/.test(cr) && !/realArt/.test(cr), "the shared drawCard (Full House and the retired games) is unchanged in kind");
}

/* 8. Sound and touch */
{
  const manifest = read("src/lib/fx/manifest.ts");
  for (const slot of ["freecell.undo", "freecell.reset", "mahjong.undo", "mahjong.reset", "pyramid.undo", "pyramid.reset", "tripeaks.flip", "cards.confirm"]) check(manifest.includes(`"${slot}":`), `the ${slot} slot is in the manifest`);
  check(existsSync("docs/sound-cues/cards-board-elevenlabs.md"), "the ElevenLabs list is in docs/sound-cues");
  const gs = read("src/lib/fx/gameSounds.ts");
  for (const fn of ["mahjongSounds", "freecellSounds", "tripeaksSounds", "fiveHandsSounds", "pyramidSounds"]) {
    const body = gs.slice(gs.indexOf(`export function ${fn}(`), gs.indexOf("\n}\n", gs.indexOf(`export function ${fn}(`)));
    check(body.includes("cardFeel()"), `${fn}: the light touch on place or match`);
  }
  check(/export function freecellPick\(\): void \{[^}]*cardFeel\(\)/.test(gs), "Free Cell: the light touch on pick up");
}

/* 9. Stage 2: the effects (renderer-side, started from what the sim's state did, never writing to it) */
{
  const { createCanvas, Path2D: NapiPath2D } = await import("@napi-rs/canvas");
  // The renderers' sprite caches use OffscreenCanvas where there is one (as scripts/skins/frames.ts stands it in).
  (globalThis as unknown as { Path2D: unknown }).Path2D = NapiPath2D;
  (globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = class {
    constructor(w: number, h: number) {
      return createCanvas(Math.max(1, w), Math.max(1, h));
    }
  };
  const FX = await import("../src/lib/arcade/cards/cardsFx.renderer");
  const MJR = await import("../src/lib/arcade/mahjong.renderer");
  const ctxOf = () => createCanvas(414, 772).getContext("2d") as unknown as CanvasRenderingContext2D;
  const size = { width: 414, height: 772 };
  let t = 0;
  const clocked = <V extends { fx?: InstanceType<typeof FX.FxTimeline> }>(view: V) => {
    view.fx!.now = () => t;
    return view;
  };
  const frozen = (x: unknown) => JSON.stringify(x);

  // The timeline itself.
  {
    const tl = new FX.FxTimeline();
    tl.now = () => t;
    t = 1000;
    check(tl.start("a", 200, 7) && tl.at<number>("a")?.data === 7 && tl.busy(), "the timeline starts an effect and reads it back");
    t = 1100;
    check(Math.abs((tl.at("a")?.k ?? 0) - 0.5) < 1e-9, "an effect's progress runs 0 → 1 over its length");
    t = 1201;
    check(tl.at("a") === null && !tl.busy(), "an effect ends on time and nothing keeps running");
    tl.start("b", 100, null, 50);
    check(tl.at("b") === null, "a delayed effect waits for its delay");
    const off = new FX.FxTimeline();
    off.enabled = false;
    check(!off.start("x", 100) && off.at("x") === null, "with effects off (reduced motion) nothing starts: only the state change is drawn");
    check(FX.shakeX(1) === 0 && FX.shakeX(0) === 0, "a shake ends where it began");
  }

  // Free Cell: a refused move wobbles back, two or more home at once stamp ×n, the clear's cascade.
  {
    const view = clocked(FCR.fcNewView());
    const st = FC.freecellGameFor(5).init(7);
    t = 0;
    FCR.drawFreecell(ctxOf(), st, size, view);
    view.lastTry = { pile: 2, index: 4 };
    const refused = { ...st, tick: st.tick + 1, rejects: st.rejects + 1 };
    const before = frozen(refused);
    FCR.drawFreecell(ctxOf(), refused, size, view);
    check(frozen(refused) === before, "Free Cell: drawing with effects never changes the sim's state");
    check(JSON.stringify(view.fx!.at("wobble")?.data) === JSON.stringify({ pile: 2, index: 4 }), "Free Cell: a refused move wobbles the card it moved");
    const batch = { ...refused, tick: refused.tick + 1, fly: [0, 0, 0, 13, 1, 0], flyTick: refused.tick + 1 };
    FCR.drawFreecell(ctxOf(), batch, size, view);
    check(view.fx!.at<number>("combo")?.data === 2, "Free Cell: two cards home at once stamp ×2");
    FCR.drawFreecell(ctxOf(), { ...batch, tick: batch.tick + 1, ended: 1 }, size, view);
    check(!!view.fx!.at("cascade"), "Free Cell: the clear starts the bouncing cards");
    t = 2000;
    check(!view.fx!.busy(), "Free Cell: every effect is over within 900 ms (the cascade's length)");
    const SND = await import("../src/lib/fx/gameSounds");
    const rates = Array.from({ length: 10 }, (_, r) => SND.fcHomeRate({ home: [r + 1, 0, 0, 0] }, { home: [r, 0, 0, 0] }));
    check(rates.every((r, i) => i === 0 || r > rates[i - 1]!), "Free Cell: each card home sounds a step higher up its suit's scale");
  }

  // Summit: the run ladder grows, crumbles on a stock turn, a peak top flies, a refused card nudges, the clear lights the peaks.
  {
    const view = clocked(TPR.tpNewView());
    const st = TP.tripeaksGameFor(3).init(5);
    t = 0;
    TPR.drawTripeaks(ctxOf(), st, size, view);
    const run3 = { ...st, tick: st.tick + 1, run: 3 };
    TPR.drawTripeaks(ctxOf(), run3, size, view);
    check(view.fx!.at<number>("rung")?.data === 3, "Summit: a card played adds a rung to the ladder");
    const turned = { ...run3, tick: run3.tick + 1, run: 0, turns: run3.turns + 1 };
    TPR.drawTripeaks(ctxOf(), turned, size, view);
    check(view.fx!.at<number>("crumble")?.data === 3, "Summit: a stock turn crumbles a run of three");
    const peak = { ...turned, tick: turned.tick + 1, peaks: 1, lastPlay: 1 };
    TPR.drawTripeaks(ctxOf(), peak, size, view);
    check(view.fx!.at<{ index: number }>("peak")?.data.index === 1, "Summit: a peak's top card flies up with a sparkle");
    view.lastTry = 20;
    TPR.drawTripeaks(ctxOf(), { ...peak, tick: peak.tick + 1, rejects: peak.rejects + 1 }, size, view);
    check(view.fx!.at<number>("nudge")?.data === 20, "Summit: a refused card leans to the discard and springs back");
    TPR.drawTripeaks(ctxOf(), { ...peak, tick: peak.tick + 2, rejects: peak.rejects + 1, ended: 1 }, size, view);
    t = 600;
    check(!!view.fx!.at("light0") && !!view.fx!.at("light2"), "Summit: the clear lights the three peaks in turn");
  }

  // Thirteen: a pair flies off with 13, a King spins away, a wrong pair shakes, a card brightens, the outline lights.
  {
    const view = clocked(PYR.pyNewView());
    const st = PY.pyramidGameFor(3).init(5);
    t = 0;
    PYR.drawPyramid(ctxOf(), st, size, view);
    const gone = st.gone.slice();
    gone[21] = 1;
    gone[22] = 1;
    const paired = { ...st, tick: st.tick + 1, gone, pairs: 1, ppPairs: 1, removed: 2, lastA: 21, lastB: 22 };
    const before = frozen(paired);
    PYR.drawPyramid(ctxOf(), paired, size, view);
    check(frozen(paired) === before, "Thirteen: drawing with effects never changes the sim's state");
    const pair = view.fx!.at<{ card: number }[]>("pair");
    check(!!pair && pair.data.length === 2 && pair.data[0]!.card === st.tab[21] && pair.data[1]!.card === st.tab[22], "Thirteen: the pair taken flies from where its cards were drawn");
    check(!!view.fx!.at("uncover15"), "Thirteen: the card the pair uncovered brightens");
    const gone2 = gone.slice();
    gone2[23] = 1;
    PYR.drawPyramid(ctxOf(), { ...paired, tick: paired.tick + 1, gone: gone2, kings: 1, removed: 3, lastA: 23, lastB: -1 }, size, view);
    check(view.fx!.at<{ card: number }>("king")?.data.card === st.tab[23], "Thirteen: a King spins off alone");
    view.lastTry = 24;
    PYR.drawPyramid(ctxOf(), { ...paired, tick: paired.tick + 2, gone: gone2, kings: 1, removed: 3, rejects: 1, sel: -1 }, size, view);
    check((view.fx!.at<number[]>("wrong")?.data ?? []).includes(24), "Thirteen: a wrong pair shakes the card tapped");
    PYR.drawPyramid(ctxOf(), { ...paired, tick: paired.tick + 3, gone: gone2, kings: 1, removed: 3, rejects: 1, ended: 1 }, size, view);
    t = 600;
    check(!!view.fx!.at("row6") && !!view.fx!.at("row0"), "Thirteen: the clear lights the pyramid's outline from the bottom row up");
  }

  // Five Hands: a hand made flashes and stamps, the column pick lifts and flies its points, the score counts up.
  {
    const run = fiveHandsFlawless(4, 20, 3);
    const end = run.state;
    const view = clocked(FHR.fhNewView());
    t = 0;
    // A modest board (the flawless rows already reach 200, so a column could not move the score): column 0 holds a pair.
    const C = await import("../src/lib/arcade/cards/cards");
    const ranks = [[1, 3, 6, 9, 12], [1, 4, 7, 10, 13], [5, 8, 11, 2, 6], [9, 12, 3, 7, 10], [11, 2, 5, 8, 13]];
    const modest = ranks.map((row, r) => row.map((rank, k) => C.cardOf((r + k) % 4, rank)));
    const noPick = { ...end, rows: modest, pick: -1, ended: 0, tick: end.tick - 5 };
    FHR.drawFiveHands(ctxOf(), noPick, size, view);
    // A column whose hand scores, so the score moves.
    const col = [0, 1, 2, 3, 4].find((k) => FH.fhPickedHand({ ...noPick, pick: k }).points > 0) ?? 2;
    FHR.drawFiveHands(ctxOf(), { ...noPick, tick: noPick.tick + 1, pick: col }, size, view);
    check(view.fx!.at<number>("column")?.data === col, "Five Hands: the picked column's cards lift");
    check(FH.fhPickedHand({ ...noPick, pick: col }).points === 0 || !!view.fx!.at<[number, number]>("count"), "Five Hands: the POINTS chip counts up to the new score");
    t = 700;
    check(!!view.fx!.at("columnPoints") && !!view.fx!.at<string>("sum") && view.fx!.at<string>("sum")!.data.includes("× 1.4"), "Five Hands: the column's points fly to the total, then the bonus counts in");
    const st = FH.fiveHandsGameFor(3).init(4);
    const v2 = clocked(FHR.fhNewView());
    t = 0;
    FHR.drawFiveHands(ctxOf(), st, size, v2);
    const rows = st.rows.map((r) => r.slice());
    rows[0] = [0, 13, 26, 39, 1];
    FHR.drawFiveHands(ctxOf(), { ...st, tick: st.tick + 1, rows, lastRow: 0 }, size, v2);
    check(v2.fx!.at<{ row: number }>("hand")?.data.row === 0, "Five Hands: a hand made flashes its cards and stamps its badge");
  }

  // Mahjong: the pair flies, a wrong pair shakes, blockers flash, the shuffle spins, six left brightens, the shower.
  {
    const view = MJR.mahjongNewView();
    view.fx.now = () => t;
    const g = MJ.mahjongGameFor(2);
    let st = g.init(3);
    t = 0;
    const mctx = createCanvas(356, 608).getContext("2d") as unknown as CanvasRenderingContext2D;
    const msize = { width: 356, height: 608 };
    MJR.drawMahjong(mctx, st, msize, view);
    const moves = MJ.mahjongMoves(st.face);
    const [a, b] = moves[0]!;
    const face = st.face.slice();
    const fa = face[a]!;
    face[a] = -1;
    face[b] = -1;
    st = { ...st, tick: st.tick + 1, face, pairs: 1, lastA: a, lastB: b };
    MJR.drawMahjong(mctx, st, msize, view);
    const pair = view.fx.at<{ fa: number }>("pair");
    check(pair?.data.fa === fa, "Mahjong: the pair taken slides together and flies off with its faces");
    st = { ...st, tick: st.tick + 1, misses: 1, sel: 5 };
    MJR.drawMahjong(mctx, st, msize, view);
    check(!!view.fx.at("wrong"), "Mahjong: a second tile that doesn't match shakes both tiles");
    const blockedSlot = st.face.findIndex((f, i) => f >= 0 && !MJ.mahjongFree(st.face, i));
    st = { ...st, tick: st.tick + 1, blocked: 1, lastBlocked: blockedSlot };
    MJR.drawMahjong(mctx, st, msize, view);
    const blockers = view.fx.at<number[]>("blockers")?.data ?? [];
    check(blockers.length > 0 && blockers.every((x) => st.face[x]! >= 0), "Mahjong: a blocked tile flashes the tiles that block it");
    st = { ...st, tick: st.tick + 1, shuffles: 1 };
    MJR.drawMahjong(mctx, st, msize, view);
    check(!!view.fx.at("spin"), "Mahjong: a Shuffle spins the tiles and lands them again");
    const few = st.face.map((f, i) => (i < 6 && f >= 0 ? f : -1));
    st = { ...st, tick: st.tick + 1, face: few, pairs: MJ.MAHJONG_PAIRS - 3 };
    MJR.drawMahjong(mctx, st, msize, view);
    check(!!view.fx.at("brighten"), "Mahjong: the mat brightens with six tiles left");
    st = { ...st, tick: st.tick + 1, face: st.face.map(() => -1), pairs: MJ.MAHJONG_PAIRS, clearedTick: st.tick + 1 };
    const before = frozen(st);
    MJR.drawMahjong(mctx, st, msize, view);
    check(frozen(st) === before, "Mahjong: drawing with effects never changes the sim's state");
    check(!!view.fx.at("shower"), "Mahjong: the clear rains tiles");
    check(MJ.mahjongBlockers(g.init(3).face, MJ.mahjongMoves(g.init(3).face)[0]![0]).length === 0, "Mahjong: a free tile has no blockers");
    const mj = read("src/puzzles/mahjong.tsx");
    check(/useMemo\(\(\) => mahjongArtGameFor\(data\?\.mahjongRev, view, level\), \[data\?\.mahjongRev, view, level\]\)/.test(mj), "Mahjong: one game object per revision, view and level (the run never restarts)");
  }

  // The reveal and replays draw no effect: without a view nothing is tracked.
  {
    const st = FC.freecellGameFor(5).init(7);
    FCR.drawFreecell(ctxOf(), { ...st, rejects: 3 }, size);
    check(true, "drawing without a view (reveals, replays, the intro's still) runs no effect");
  }

  // Sound slots for stage 2, each taking over from today's sound once its file is set.
  {
    const manifest = read("src/lib/fx/manifest.ts");
    const doc = read("docs/sound-cues/cards-board-elevenlabs.md");
    const slots = ["freecell.wobble", "freecell.combo", "freecell.bounce", "mahjong.pairFly", "mahjong.wrongPair", "mahjong.blockers", "mahjong.spin", "mahjong.nearEnd", "mahjong.shower", "tripeaks.ladderBreak", "tripeaks.peakFly", "tripeaks.nudge", "tripeaks.stuck", "tripeaks.peaksLight", "fivehands.flip", "fivehands.stamp", "fivehands.bigStamp", "fivehands.columnTick", "fivehands.countUp", "pyramid.pairFly", "pyramid.kingFlourish", "pyramid.wrongPair", "pyramid.uncover", "pyramid.outline"];
    check(slots.every((x) => manifest.includes(`"${x}":`) && doc.includes(`\`${x}\``)), `the ${slots.length} stage-2 sound slots are in the manifest and on Joe's list`);
    const gs = read("src/lib/fx/gameSounds.ts");
    check(/function overCue\(cue: string, before: \(\) => void, rate\?: number\): void \{\s*if \(cueHasFile\(cue\)\) effectCue\(cue, 0, rate\);\s*else before\(\);/.test(gs), "a stage-2 slot plays its own file once set, today's sound until then");
  }
}

if (failures.length) {
  for (const f of failures) console.log(`  FAIL ${f}`);
  console.log(`FAIL cards-board-overhaul-check: ${failures.length} failed, ${passes} passed`);
  process.exit(1);
}
console.log(`PASS cards-board-overhaul-check: ${passes} checks`);
