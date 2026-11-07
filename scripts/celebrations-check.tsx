/**
 * celebrations-check (Prompt P, 23 Oct 2026; display, sound and animation only): the celebrations
 * (src/lib/fx/celebrations.ts, CelebrationLayer, celebrationCanvas.ts, the hero's poses) fire when
 * they should and only then, never change what a screen says, and switch off completely.
 *
 *  1. Rules: the hero run at 149 vs 150 (HERO_RUN_SCORE), once per round; streak banners at 3, 7
 *     and 30 days only (2, 4, 31 none) from the daily record's own streak; the meter's fill and
 *     label; the podium's winner; the count-up's start (the total before the round) and climbs.
 *  2. The shared canvas: sparks never pass CELEBRATION_PARTICLES (pooled), the scene stops asking
 *     for frames when nothing moves, the GO strike fades in under 300 ms, one strike per GO, and its
 *     peak frame lights well under a quarter of the screen (WCAG 2.3.1: no large flash, never
 *     white); the hero's victory pose and run cycle stand on their ground at their height.
 *  3. The real components in happy-dom, with celebrations on: the podium's hero beside the gold
 *     step with a burst and chime, "You win!" and the zap only on the winner's phone; practice's
 *     new best (banner, burst, chime) and not without one; the lobby meter's crackle on a join, its
 *     burst only on filling; standings and podium totals counting up from the round before and
 *     ending on the server's exact numbers and order; a tap skipping straight there.
 *  4. Reduced motion: no sparks, run or strike; banners and the podium hero calm (a fade); totals
 *     final at once; the sounds still play.
 *  5. FX_CELEBRATIONS false: no request, no sound, no meter, no logo charge, and the screens' markup
 *     the same as before (the pill, totals from 0 on the podium, final totals on standings).
 *  6. Wiring: every moment's call site is gated on the switch.
 *  7. In a real browser (scripts/celebrations-browser.ts; --no-browser skips): the screens at
 *     414x896 as an iPhone 11 home-screen app, nothing shifting layout, taps reaching the content
 *     through the layer, the count-up's final numbers and order equal to the switch off, reduced
 *     motion, and the switch off against today's screens (scripts/fixtures/celebrations-off.json).
 *
 *   bun scripts/celebrations-check.tsx [--no-browser] [--shots=<dir>]
 */
import { readFileSync } from "node:fs";
import { MAX_PLAYERS } from "../src/lib/duel/types";
import { Window } from "happy-dom";
import { createCanvas } from "@napi-rs/canvas";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------ happy-dom first (modules read window) */

const win = new Window({ url: "https://joulz.uk/" });
let reduced = false;
Object.defineProperty(win, "matchMedia", {
  configurable: true,
  value: (query: string) => ({
    matches: /prefers-reduced-motion:\s*reduce/.test(query) ? reduced : false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }),
});
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "localStorage", "sessionStorage", "location", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame", "ResizeObserver", "CustomEvent"] as const) {
  const value = (win as unknown as Record<string, unknown>)[key];
  if (value === undefined) continue;
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value: typeof value === "function" && !["HTMLElement", "Element", "Node", "Event", "ResizeObserver", "CustomEvent"].includes(key) ? (value as (...a: unknown[]) => unknown).bind(win) : value,
  });
}
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const beta = win as unknown as { __DUELZ_BETA_CONFIG__?: Record<string, unknown> };
const setOn = (on: boolean) => {
  beta.__DUELZ_BETA_CONFIG__ = { FX_CELEBRATIONS: on };
};
setOn(true);

const C = await import("../src/lib/fx/celebrations");
const { CelebrationScene } = await import("../src/lib/fx/celebrationCanvas");
const hero = await import("../src/lib/arcade/hero.renderer");
const { dailyStreak } = await import("../src/lib/duel/dailyRecord");
const { shiftDayKey } = await import("../src/lib/duel/daily");
const config = await import("../src/config/betaConfig");

/* ------------------------------------------------------------ 1. rules */

check(config.FX_CELEBRATIONS === true, "FX_CELEBRATIONS is true in src/config/betaConfig.ts");
check(config.HERO_RUN_SCORE === 150 && C.HERO_RUN_SCORE === 150, "HERO_RUN_SCORE is 150 in betaConfig.ts");
check(!C.heroRunEarned(149), "the hero runs at 149");
check(C.heroRunEarned(150) && C.heroRunEarned(151), "the hero does not run at 150");
check(!C.heroRunEarned(null) && !C.heroRunEarned(undefined) && !C.heroRunEarned(0), "the hero runs with no score");
C.resetCelebrationMemory();
check(C.claimHeroRun("round:sudoku:3:1000") && !C.claimHeroRun("round:sudoku:3:1000"), "the hero runs twice in one round");
check(C.claimHeroRun("round:sudoku:4:2000") && C.claimHeroRun("practice:sudoku:1:3000"), "a later round or practice run does not get its hero run");
// The reveal's hero moments (27 Oct 2026): 150–189 the run, 190–199 the dance, 200 the lap with fireworks.
check(config.HERO_DANCE_SCORE === 190 && config.HERO_GRAND_SCORE === 200, "the dance and lap lines are not 190 and 200 in betaConfig.ts");
check(C.heroMomentFor(149) === null, `149: ${C.heroMomentFor(149)}, expected no hero`);
check(C.heroMomentFor(150) === "run", `150: ${C.heroMomentFor(150)}, expected the run`);
check(C.heroMomentFor(189) === "run", `189: ${C.heroMomentFor(189)}, expected the run (no dance)`);
check(C.heroMomentFor(190) === "dance", `190: ${C.heroMomentFor(190)}, expected the dance`);
check(C.heroMomentFor(199) === "dance", `199: ${C.heroMomentFor(199)}, expected the dance (no lap)`);
check(C.heroMomentFor(200) === "grand", `200: ${C.heroMomentFor(200)}, expected the lap with fireworks`);
check(C.heroMomentFor(null) === null && C.heroMomentFor(undefined) === null, "a missing score has a hero moment");
check(C.HERO_DANCE_MS >= 1300 && C.HERO_DANCE_MS <= 1700, `the dance lasts ${C.HERO_DANCE_MS} ms, about 1.5 s`);
check(C.HERO_GRAND_MS >= 2700 && C.HERO_GRAND_MS <= 3300, `the lap lasts ${C.HERO_GRAND_MS} ms, about 3 s`);

const today = "2026-10-27";
const run = (n: number) => Array.from({ length: n }, (_, i) => shiftDayKey(today, -i));
for (const [days, want] of [[1, null], [2, null], [3, 3], [4, null], [6, null], [7, 7], [8, null], [29, null], [30, 30], [31, null]] as const) {
  const streak = dailyStreak(run(days), today);
  check(streak === days, `the daily record's streak of ${days} days reads ${streak}`);
  check(C.streakMilestone(streak) === want, `a ${days}-day streak gives ${C.streakMilestone(streak)}, expected ${want}`);
}
check(C.streakBannerText(7) === "7-day streak!", `streak banner text: ${C.streakBannerText(7)}`);
// 31 Oct 2026: the room holds MAX_PLAYERS (16, was 10); the fill is still players / the room's seats.
check(C.meterFill(3) === 3 / MAX_PLAYERS && C.meterFill(MAX_PLAYERS) === 1 && C.meterFill(0) === 0 && C.meterFill(MAX_PLAYERS + 2) === 1, `meter fill is not players / ${MAX_PLAYERS}`);

type Row = Parameters<typeof C.podiumWinnerIsMe>[0][number];
const standing = (slot: number, total: number, roundScore: number, position: number, previousPosition: number | null): Row =>
  ({ slot, name: `P${slot}`, status: "active", total, roundScore, roundCorrect: true, answerMs: 1000, position, previousPosition, summary: "", detail: [] }) as Row;
const rows: Row[] = [standing(2, 640, 150, 1, 3), standing(1, 600, 80, 2, 1), standing(3, 590, 20, 3, 2)];
check(C.podiumWinnerIsMe(rows, 2) && !C.podiumWinnerIsMe(rows, 1), "podium winner");
check(C.podiumWinnerIsMe([standing(1, 500, 0, 1, 1), standing(2, 500, 0, 1, 2)], 2), "a shared first place is not a win");
check(C.countUpFrom(rows[0]!) === 490 && C.countUpFrom(standing(4, 50, 80, 4, null)) === 0, "count-up start is not the total before the round");
check(C.movedUp(rows[0]!) && !C.movedUp(rows[1]!) && !C.movedUp(standing(4, 1, 1, 1, null)), "climbs");

/* ------------------------------------------------------------ 2. the shared canvas */

{
  const scene = new CelebrationScene();
  scene.burst(1, 100, 100, 0, 90, 0);
  scene.burst(1, 100, 100, 0, 90, 10);
  const canvas = createCanvas(414, 896);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  scene.draw(ctx, 414, 896, 34, 20);
  check(scene.live <= C.CELEBRATION_PARTICLES && scene.live >= 100, `sparks alive ${scene.live}, cap ${C.CELEBRATION_PARTICLES}`);
  check(scene.sparks.length === C.CELEBRATION_PARTICLES * 8, "the spark pool is not one preallocated array of the cap");
  check(C.CELEBRATION_PARTICLES === 120, "particle cap is not 120");
  scene.draw(ctx, 414, 896, 34, 5000);
  check(!scene.animating(5000) && scene.live === 0, "the scene keeps asking for frames after every spark has burnt out");
  scene.heroRun(2, 0);
  check(scene.animating(C.HERO_RUN_MS - 10) && !scene.animating(C.HERO_RUN_MS + 10), "the hero run does not last HERO_RUN_MS");
  check(C.HERO_RUN_MS >= 1400 && C.HERO_RUN_MS <= 1800, `hero run ${C.HERO_RUN_MS} ms, about 1.6 s`);
  scene.clear(2);
  check(!scene.run, "clearing a scope leaves its hero running");
  // The dance (190–199): on, dancing near the left edge (clear of the centred score), off; HERO_DANCE_MS long.
  {
    const show = new CelebrationScene();
    const dc = createCanvas(414, 896);
    const dctx = dc.getContext("2d") as unknown as CanvasRenderingContext2D;
    show.heroShow(3, "dance", false, 0);
    check(show.animating(C.HERO_DANCE_MS - 10) && !show.animating(C.HERO_DANCE_MS + 10), "the dance does not last HERO_DANCE_MS");
    const xs: number[] = [];
    for (let t = 0; t < C.HERO_DANCE_MS; t += 50) {
      dctx.clearRect(0, 0, 414, 896);
      show.draw(dctx, 414, 896, 34, t);
      xs.push((show.dirtyL + show.dirtyR) / 2);
      check(show.dirtyR > show.dirtyL, `the dance draws nothing at ${t} ms`);
      check(show.dirtyB <= 896 && show.dirtyT > 896 * 0.7, `the dance leaves the screen's bottom at ${t} ms (${show.dirtyT.toFixed(0)}–${show.dirtyB.toFixed(0)})`);
    }
    const mid = xs.slice(8, 20);
    check(xs[0]! < 40 && xs[xs.length - 1]! < 40, `the dancer does not come on and step off at the edge (${xs[0]!.toFixed(0)}, ${xs[xs.length - 1]!.toFixed(0)})`);
    check(mid.every((x) => x < 414 * 0.35) && Math.max(...mid) - Math.min(...mid) > 2, `the dance is not on the spot near the left edge (${mid.map((x) => x.toFixed(0)).join(",")})`);
    show.draw(dctx, 414, 896, 34, C.HERO_DANCE_MS + 1);
    check(!show.show && !show.animating(C.HERO_DANCE_MS + 1), "the dance keeps drawing after it ends");
    // The lap (200): six fireworks on schedule, the pool's cap held, the hero round the screen.
    show.heroShow(4, "grand", false, 0);
    check(show.animating(C.HERO_GRAND_MS - 10) && !show.animating(C.HERO_GRAND_MS + 10), "the lap does not last HERO_GRAND_MS");
    let top = Infinity;
    for (let t = 0; t < C.HERO_GRAND_MS; t += 25) {
      show.draw(dctx, 414, 896, 34, t);
      check(show.live <= C.CELEBRATION_PARTICLES, `${show.live} sparks alive in the lap (cap ${C.CELEBRATION_PARTICLES})`);
      if (t > 1100 && t < 1600) top = Math.min(top, show.dirtyT);
    }
    check(show.fireworks === 6, `the lap bursts ${show.fireworks} fireworks, expected 6`);
    check(top < 896 * 0.75, `the lap's leap stays on the bottom strip (top ${top.toFixed(0)})`);
    // A tap skips it: the hero and its sparks go at once.
    show.clearAll();
    show.heroShow(5, "grand", false, 0);
    show.draw(dctx, 414, 896, 34, 700);
    check(show.live > 0, "the lap has no fireworks by 700 ms");
    show.skip(5);
    show.draw(dctx, 414, 896, 34, 716);
    check(!show.show && show.live === 0 && !show.animating(716), "a skip leaves the lap's hero or sparks on screen");
    // Reduced motion: the hero stands still with a short glow (no fireworks), HERO_STILL_MS long.
    show.clearAll();
    show.heroShow(6, "grand", true, 0);
    check(show.animating(C.HERO_STILL_MS - 10) && !show.animating(C.HERO_STILL_MS + 10), "the calm hero does not last HERO_STILL_MS");
    const before = show.fireworks;
    const boxes: string[] = [];
    for (let t = 300; t < C.HERO_STILL_MS - 300; t += 100) {
      show.draw(dctx, 414, 896, 34, t);
      boxes.push(`${show.dirtyL.toFixed(1)},${show.dirtyT.toFixed(1)}`);
      check(show.live === 0, "reduced motion: the lap's fireworks burst");
    }
    check(show.fireworks === before, "reduced motion: fireworks counted");
    check(new Set(boxes).size === 1, `reduced motion: the hero moves (${[...new Set(boxes)].join(" ")})`);
    let lit = 0;
    const px = (dctx as unknown as { getImageData: CanvasRenderingContext2D["getImageData"] }).getImageData(0, 600, 200, 296).data;
    for (let i = 3; i < px.length; i += 4) if (px[i]! > 0) lit++;
    check(lit > 400, "reduced motion: no still hero or glow drawn");
  }
  check(C.STRIKE_IN_MS < 300, `the strike fades in over ${C.STRIKE_IN_MS} ms`);
  check(C.STRIKE_MS < 1000, "a strike outlasts a second (at most 2 a second, one per GO)");
  // The peak frame: lit pixels and no white flash across the screen.
  const strikeCanvas = createCanvas(414, 896);
  const sctx = strikeCanvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  sctx.fillStyle = "#07070A";
  sctx.fillRect(0, 0, 414, 896);
  scene.strike(414, 896, 0);
  scene.draw(sctx, 414, 896, 34, C.STRIKE_IN_MS);
  const data = (sctx as unknown as { getImageData: CanvasRenderingContext2D["getImageData"] }).getImageData(0, 0, 414, 896).data;
  let bright = 0;
  let lifted = 0;
  for (let i = 0; i < data.length; i += 4) {
    const l = (0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!) / 255;
    if (l > 0.8) bright++;
    if (l > 0.05) lifted++;
  }
  const pixels = 414 * 896;
  check(bright / pixels < 0.02, `the strike's peak frame is ${(100 * bright / pixels).toFixed(2)} % bright pixels (a large flash)`);
  check(bright > 200, "the strike draws no bolt");
  check(lifted / pixels > 0.5, "the strike has no soft brightening");
  const bg = (sctx as unknown as { getImageData: CanvasRenderingContext2D["getImageData"] }).getImageData(10, 880, 1, 1).data;
  check(bg[0]! < 60 && bg[1]! < 60, `the strike's brightening is not soft (corner ${bg[0]},${bg[1]},${bg[2]})`);
}
{
  const pose = hero.heroPose();
  const victory = hero.heroVictoryPose(pose, 50, 200, 100, 0);
  check(victory.footAY === 200 && victory.footBY === 200, "the victory pose's feet are off the ground");
  check(victory.handAY < victory.headY && victory.handBY < victory.headY && victory.handAX < victory.headX && victory.handBX > victory.headX, "the victory pose's arms are not up in a V");
  check(Math.abs(200 - (victory.handAY)) <= 100, "the victory pose is taller than its height");
  const bob = hero.heroVictoryPose(hero.heroPose(), 50, 200, 100, 300).headY;
  check(bob !== victory.headY, "the victory pose does not bob");
  check(hero.heroVictoryPose(hero.heroPose(), 50, 200, 100, 300, true).headY === victory.headY, "the calm victory pose bobs");
  let lowest = Infinity;
  let highest = -Infinity;
  for (let k = 0; k < 40; k++) {
    const p = hero.heroRunPose(hero.heroPose(), 50, 200, 100, k / 40);
    const ground = Math.max(p.footAY, p.footBY);
    lowest = Math.min(lowest, ground);
    highest = Math.max(highest, ground);
    check(ground <= 200.01, "a running foot goes through the ground");
    check(p.moveX > 0 && p.speed === 1, "the run's cape does not trail");
  }
  check(highest > 199 && lowest > 190, "the run cycle leaves the ground");
  const canvas = createCanvas(120, 120);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  hero.drawHero(ctx, hero.heroVictoryPose(hero.heroPose(), 60, 110, 90, 0));
  hero.drawHero(ctx, hero.heroRunPose(hero.heroPose(), 60, 110, 90, 0.3));
  check(true, "drawHero draws both poses");
}

/* ------------------------------------------------------------ 3–5. the real components */

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { NewBestMoment } = await import("../src/components/duel/NewBestMoment");
const { ChargeMeter } = await import("../src/components/fx/ChargeMeter");
const { Podium } = await import("../src/components/duel/Podium");
const { Standings } = await import("../src/components/duel/Standings");
const { LogoMark } = await import("../src/components/brand/LogoMark");
const { AppWordmark } = await import("../src/components/brand/AppWordmark");

const requests = C.logCelebrations(true);
const sounds = C.celebrationSoundLog();
const reset = () => {
  requests.length = 0;
  sounds.length = 0;
};

async function mount(element: unknown) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host as unknown as HTMLElement);
  await act(async () => root.render(element as never));
  return {
    host,
    rerender: (next: unknown) => act(async () => root.render(next as never)),
    unmount: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}
const wait = (ms: number) => act(async () => sleep(ms));

const podiumRows = (mineFirst: boolean) => [
  standing(1, mineFirst ? 812 : 700, 150, mineFirst ? 1 : 2, 2),
  standing(2, mineFirst ? 700 : 812, 120, mineFirst ? 2 : 1, 1),
  standing(3, 640, 60, 3, 3),
  standing(4, 410, 90, 4, 4),
];
const podiumProps = (mineFirst: boolean) => ({
  rows: podiumRows(mineFirst),
  mySlot: 1,
  results: [],
  roundOrder: [],
  isHost: true,
  busy: false,
  onPlayAgain: () => {},
  onLeave: () => {},
});
const scoreTexts = (host: Element) => Array.from(host.querySelectorAll(".th-score")).map((el) => el.textContent);
const listNames = (host: Element) => Array.from(host.querySelectorAll("ul li .th-name")).map((el) => el.textContent);

// 3a. The podium: winner and not.
for (const mineFirst of [true, false]) {
  setOn(true);
  reset();
  const view = await mount(React.createElement(Podium, podiumProps(mineFirst)));
  await wait(700);
  const heroAt = requests.find((r) => r.kind === "podiumHero") as { anchor: Element; calm: boolean } | undefined;
  check(!!heroAt && heroAt.anchor.getAttribute("data-podium-step") === "1", `${mineFirst ? "winner" : "non-winner"}: no hero beside the winner's step`);
  check(heroAt?.calm === false, "the podium hero is calm with full motion");
  check(requests.some((r) => r.kind === "burst"), "the podium hero has no spark burst");
  const banner = requests.find((r) => r.kind === "banner") as { text: string } | undefined;
  check(mineFirst ? banner?.text === "You win!" : !banner, `${mineFirst ? "winner" : "non-winner"}: banner ${banner?.text ?? "none"}`);
  // Prompt S: the victory sting as the hero takes his pose on every phone; the winner's "You win!" chimes; no zap.
  check(mineFirst ? sounds.includes("chime") : !sounds.includes("chime"), `${mineFirst ? "winner" : "non-winner"}: chime ${sounds.join(",")}`);
  check(sounds.filter((s) => s === "victory").length === 1 && !sounds.includes("zap"), `the podium hero has no victory sting (or a zap): ${sounds.join(",")}`);
  await wait(1200);
  const want = podiumRows(mineFirst).map((r) => String(r.total));
  const shown = scoreTexts(view.host);
  // Plinths (2, 1, 3), then the list in the server's order.
  const plinths = [podiumRows(mineFirst).find((r) => r.position === 2)!, podiumRows(mineFirst).find((r) => r.position === 1)!, podiumRows(mineFirst).find((r) => r.position === 3)!].map((r) => String(r.total));
  check(JSON.stringify(shown) === JSON.stringify([...plinths, ...want]), `podium totals end on ${shown.join(",")}, server ${[...plinths, ...want].join(",")}`);
  check(JSON.stringify(listNames(view.host)) === JSON.stringify(podiumRows(mineFirst).map((r) => r.name)), "podium list order is not the server's");
  await view.unmount();
  check(requests.some((r) => r.kind === "clear"), "leaving the podium does not clear its celebration");
}

// 3b. The count-up on standings: from the total before the round, ending on the server's numbers.
{
  setOn(true);
  reset();
  const standingsRows = [standing(2, 640, 150, 1, 3), standing(1, 600, 80, 2, 1), standing(3, 590, 20, 3, 2)];
  const props = { round: 4, rows: standingsRows, mySlot: 1, autoSeconds: 8, continueState: { kind: "waiting" } as never };
  const view = await mount(React.createElement(Standings, props));
  await wait(60);
  const early = scoreTexts(view.host).map(Number);
  const finals = standingsRows.map((r) => r.total);
  check(early.every((n, i) => n >= C.countUpFrom(standingsRows[i]!) && n <= finals[i]!) && early.some((n, i) => n < finals[i]!), `standings do not count up from the round before: ${early.join(",")}`);
  await wait(C.COUNT_UP_MS + 300);
  check(JSON.stringify(scoreTexts(view.host)) === JSON.stringify(standingsRows.map((r) => String(r.total))), `standings end on ${scoreTexts(view.host).join(",")}`);
  check(JSON.stringify(Array.from(view.host.querySelectorAll("li .th-name")).map((e) => e.textContent)) === JSON.stringify(standingsRows.map((r) => r.name)), "standings order is not the server's");
  check(requests.some((r) => r.kind === "burst") && sounds.filter((s) => s === "overtake").length === 1 && !sounds.includes("zap"), `a climb has no sparks and one overtake zap: ${sounds.join(",")}`);
  // The count-up ticks, at most COUNT_TICKS_PER_S a second, then dings (rows landing together share the slot's gap).
  const ticks = sounds.filter((s) => s === "countTick").length;
  check(ticks >= 2 && ticks <= Math.ceil((C.COUNT_UP_MS / 1000) * C.COUNT_TICKS_PER_S) + 1, `the count-up ticks ${ticks} times over ${C.COUNT_UP_MS} ms`);
  check(sounds.includes("countDing") && sounds.lastIndexOf("countDing") > sounds.lastIndexOf("countTick"), `the count-up does not ding as it lands: ${sounds.join(",")}`);
  await view.unmount();

  // A tap skips to the final state.
  reset();
  const tapped = await mount(React.createElement(Standings, { ...props, round: 5 }));
  await wait(80);
  await act(async () => {
    window.dispatchEvent(new (win as unknown as { PointerEvent: typeof Event }).PointerEvent("pointerdown", { bubbles: true }) as unknown as Event);
  });
  await wait(60);
  check(JSON.stringify(scoreTexts(tapped.host)) === JSON.stringify(standingsRows.map((r) => String(r.total))), `a tap does not skip to the final totals: ${scoreTexts(tapped.host).join(",")}`);
  check(Array.from(tapped.host.querySelectorAll("li")).every((li) => !(li as HTMLElement).style.transform || /translateY\(0(px)?\)/.test((li as HTMLElement).style.transform)), "a tap leaves rows mid-slide");
  await tapped.unmount();
}

// 3c. Practice's new best, and none without one.
{
  setOn(true);
  reset();
  const view = await mount(React.createElement(NewBestMoment));
  await wait(700);
  const banner = requests.find((r) => r.kind === "banner") as { text: string; burst: boolean } | undefined;
  check(banner?.text === "New best!" && banner.burst, `new best: banner ${banner?.text}, burst ${banner?.burst}`);
  check(sounds.includes("chime"), "new best has no chime");
  check(!view.host.querySelector("[data-new-best]"), "celebrations on still draw the old pill as well");
  await view.unmount();
  // AnswerReveal draws NewBestMoment only in practice, on a new best or (Practice goals, 6 Nov 2026) a star earned.
  const reveal = readFileSync("src/components/duel/AnswerReveal.tsx", "utf8");
  check(/\{practice && \(personalBest \|\| starLine\) && myScore !== null \? <NewBestMoment starLine=\{starLine\} \/> : null\}/.test(reveal), "the new best moment is not drawn only in practice on a new best or a star earned");
}

// 3d. The lobby meter: a join crackles, filling sparks once.
{
  setOn(true);
  reset();
  const view = await mount(React.createElement(ChargeMeter, { players: 3 }));
  const fill = view.host.querySelector(".charge-meter-fill") as HTMLElement;
  check(fill.style.transform === `scaleX(${3 / MAX_PLAYERS})`, `meter at 3: ${fill.style.transform}`);
  check(!view.host.querySelector(".charge-meter-label") && (view.host.textContent ?? "") === "", "the meter has a label of its own (the line above it says the count)");
  check(!sounds.length, "the meter makes a sound when it first draws");
  await view.rerender(React.createElement(ChargeMeter, { players: 4 }));
  check(sounds.join() === "crackle" && !requests.some((r) => r.kind === "burst"), `a join: ${sounds.join()}`);
  await view.rerender(React.createElement(ChargeMeter, { players: 3 }));
  check(sounds.join() === "crackle", "a leave crackles");
  await view.rerender(React.createElement(ChargeMeter, { players: MAX_PLAYERS }));
  await wait(700);
  check(requests.filter((r) => r.kind === "burst").length === 1 && sounds.includes("chime"), "filling the room does not spark once");
  await view.unmount();
}

// 3e. The logo charges in once per app open: the first header as the app opens, again on a reopen,
// never on a later mount (a tab switch, a route change, back to Play); then it is #133's mark exactly.
{
  setOn(true);
  const normal = (el: Element | null) => (el?.outerHTML ?? "").replace(/_r_[0-9a-z]+_|«r[0-9a-z]+»|:r[0-9a-z]+:/g, "#");
  C.resetCelebrationMemory();
  const first = await mount(React.createElement(AppWordmark));
  check(!!first.host.querySelector("[data-logo-charge] animate"), "the app's first header does not charge in");
  const plain = await mount(React.createElement(LogoMark, { width: 17, height: 22, className: "ap-wordmark-mark" }));
  check(!plain.host.querySelector("[data-logo-charge], clipPath, animate, g"), "a mark without the charge-in is not the plain mark");
  check(first.host.querySelectorAll("[data-logo-line]").length === 2 && Array.from(first.host.querySelectorAll("[data-logo-line]")).every((l) => l.getAttribute("vector-effect") === "non-scaling-stroke" && l.getAttribute("stroke-width") === plain.host.querySelector("[data-logo-line]")!.getAttribute("stroke-width")), "the charge-in does not draw #133's hairline speed lines");
  await wait(C.LOGO_CHARGE_MS + 250);
  check(normal(first.host.querySelector("svg")) === normal(plain.host.querySelector("svg")), "once the charge-in ends the header mark is not exactly the plain mark");
  // A tab switch or route change: a new header, drawn finished.
  const second = await mount(React.createElement(AppWordmark));
  check(!second.host.querySelector("[data-logo-charge]"), "a later header (tab switch, route change, back to Play) charges in again");
  await second.unmount();
  // A reopened app: the header on screen charges in again, then settles to the plain mark.
  await act(async () => C.appReopened());
  check(!!first.host.querySelector("[data-logo-charge] animate"), "reopening the app does not charge the header in again");
  await wait(C.LOGO_CHARGE_MS + 250);
  check(normal(first.host.querySelector("svg")) === normal(plain.host.querySelector("svg")), "after a reopen's charge-in the mark is not the plain mark");
  await first.unmount();
  // The app opened on a room link, then a route change to Play: its first header is drawn finished.
  C.resetCelebrationMemory();
  win.history.pushState({}, "", "/duel/ABCD");
  const late = await mount(React.createElement(AppWordmark));
  check(!late.host.querySelector("[data-logo-charge]"), "a header first drawn after a route change charges in");
  await late.unmount();
  win.history.pushState({}, "", "/");
  await plain.unmount();
  check(C.LOGO_CHARGE_MS === 600, "the charge-in is not about 600 ms");
  check(!/localStorage|sessionStorage/.test(readFileSync("src/components/brand/AppWordmark.tsx", "utf8")) && !/Storage/.test(readFileSync("src/lib/fx/celebrations.ts", "utf8")), "the charge-in keeps a storage key");
}

// 4. Reduced motion.
{
  reduced = true;
  setOn(true);
  reset();
  const view = await mount(React.createElement(Podium, podiumProps(true)));
  await wait(40);
  const totals = podiumRows(true);
  check(JSON.stringify(scoreTexts(view.host).slice(3)) === JSON.stringify(totals.map((r) => String(r.total))), `reduced motion: podium totals count (${scoreTexts(view.host).slice(3).join(",")})`);
  await wait(600);
  const heroAt = requests.find((r) => r.kind === "podiumHero") as { calm: boolean } | undefined;
  check(heroAt?.calm === true, "reduced motion: the podium hero is not calm");
  check(!requests.some((r) => r.kind === "burst"), "reduced motion: sparks");
  const banner = requests.find((r) => r.kind === "banner") as { calm: boolean; burst: boolean } | undefined;
  check(banner?.calm === true && banner.burst === false, "reduced motion: the banner drops in or sparks");
  check(sounds.includes("victory"), "reduced motion: the sounds stop");
  check(!sounds.includes("countTick"), "reduced motion: the count-up ticks (there is no count-up)");
  await view.unmount();
  reset();
  C.heroRun(1);
  C.goStrike();
  C.sparkBurst(1, 10, 10);
  check(!requests.length, `reduced motion: ${requests.map((r) => r.kind).join(",")}`);
  check(sounds.join() === "zap,thunder", `reduced motion: GO's zap and thunder are not all that sounds (${sounds.join()})`);
  reset();
  C.heroDance(1);
  C.heroGrand(1);
  const calmShows = requests.filter((r) => r.kind === "heroShow");
  check(calmShows.length === 2 && calmShows.every((r) => r.kind === "heroShow" && r.calm), `reduced motion: the dance and lap are not the still hero (${JSON.stringify(calmShows.map((r) => r.kind === "heroShow" && r.calm))})`);
  check(sounds.join() === "heroDance,heroGrand", `reduced motion: the dance and lap sounds (${sounds.join()})`);
  reduced = false;
}

// 5. Switched off: nothing at all, and the screens as before.
{
  setOn(false);
  reset();
  check(!C.celebrationsOn(), "the override does not switch celebrations off");
  const podium = await mount(React.createElement(Podium, podiumProps(true)));
  // Read at mount (a busy machine's next frames have counted on already).
  const atMount = scoreTexts(podium.host);
  // Off counts from 0 (as before): early values sit below each row's total before the round, where on would start.
  const fromOn = podiumRows(true).map((r) => C.countUpFrom(r));
  const listAtMount = atMount.slice(3);
  check(listAtMount.length === 4 && listAtMount.every((t, i) => Number(t) < fromOn[i]!), `off: podium totals do not count up from 0 as before (${atMount.join(",")})`);
  check(JSON.stringify(listNames(podium.host)) === JSON.stringify(podiumRows(true).map((r) => r.name)), "off: the podium list does not start in the server's order");
  await wait(1500);
  const standingsRows = [standing(2, 640, 150, 1, 3), standing(1, 600, 80, 2, 1)];
  const st = await mount(React.createElement(Standings, { round: 2, rows: standingsRows, mySlot: 1, autoSeconds: 8, continueState: { kind: "waiting" } as never }));
  check(JSON.stringify(scoreTexts(st.host)) === JSON.stringify(["600", "640"]) || JSON.stringify(scoreTexts(st.host)) === JSON.stringify(["640", "600"]), `off: standings totals are not final at once (${scoreTexts(st.host).join(",")})`);
  const pill = await mount(React.createElement(NewBestMoment));
  check(!!pill.host.querySelector("[data-new-best] .new-best-moment"), "off: the new best pill is gone");
  const meterless = readFileSync("src/components/duel/RoomLobby.tsx", "utf8");
  check(
    // Polish batch R: the "Players · n of 10" line is drawn either way; off, a plain neutral bar (no charge).
    /\{players\.length\} of \{MAX_PLAYERS\}[\s\S]{0,80}\{celebrate \? \(\s*<ChargeMeter players=\{players\.length\} \/>\s*\) : \(\s*<div className="rs-meter" aria-hidden="true">/.test(meterless) &&
      (meterless.match(/<ChargeMeter /g) ?? []).length === 1,
    "off: the lobby still draws the meter, or its count line changed",
  );
  const mark = await mount(React.createElement(LogoMark, {}));
  const wordmark = await mount(React.createElement(AppWordmark));
  check(!wordmark.host.querySelector("[data-logo-charge]") && !mark.host.querySelector("[data-logo-charge]"), "off: the logo charges in");
  check(mark.host.querySelectorAll("path").length === 3 && !mark.host.querySelector("clipPath, animate"), "off: the logo's markup changed");
  C.heroRun(1);
  C.goStrike();
  C.showBanner(1, "x");
  C.podiumHero(1, document.body as unknown as Element);
  C.sparkBurst(1, 1, 1);
  C.celebrationSound("zap");
  await wait(800);
  check(!requests.filter((r) => r.kind !== "clear").length, `off: celebration requests ${requests.map((r) => r.kind).join(",")}`);
  check(!sounds.length, `off: celebration sounds ${sounds.join(",")}`);
  await podium.unmount();
  await st.unmount();
  await pill.unmount();
  await mark.unmount();
  await wordmark.unmount();
  setOn(true);
}

/* --------------------------------------------- 5b. the recorded set (Prompt S) */
{
  const { SOUND_MANIFEST } = await import("../src/lib/fx/manifest");
  const PL = await import("../src/lib/fx/prepareLightning");
  const { DUEL_START_VOICE_MS } = await import("../src/lib/duel/startPresentation");
  const slots = Object.values(C.CELEBRATION_SOUND_SLOTS).flat();
  for (const slot of slots) {
    const entry = (SOUND_MANIFEST as Record<string, { channel: string; url: string | null; frequency: number }>)[slot];
    check(!!entry && entry.channel === "effects" && /^\/sounds\/sfx_[a-z_0-9]+\.mp3$/.test(entry.url ?? "") && entry.frequency === 0, `${slot}: not an effects slot on an sfx_ file (no beep)`);
  }
  C.resetCelebrationMemory();
  const turns = Array.from({ length: 7 }, () => C.nextCrackleSlot());
  check(turns.every((slot, i) => i === 0 || slot !== turns[i - 1]) && new Set(turns).size === 3, `the crackles do not rotate: ${turns.join(",")}`);
  reset();
  C.heroRun(1);
  check(sounds.join() === "heroRun", `the hero run has no whoosh: ${sounds.join()}`);
  reset();
  C.heroDance(1);
  check(sounds.join() === "heroDance" && requests.some((r) => r.kind === "heroShow" && r.show === "dance" && !r.calm), `the dance: ${sounds.join()} / ${requests.map((r) => r.kind).join()}`);
  reset();
  C.heroGrand(1);
  check(sounds.join() === "heroRun,heroGrand" && requests.some((r) => r.kind === "heroShow" && r.show === "grand" && !r.calm), `the lap has no whoosh and big flourish: ${sounds.join()}`);
  reset();
  C.fireworkPop();
  check(sounds.join() === "firework", "a firework does not crackle");
  reset();
  C.skipCelebration(1);
  check(requests.some((r) => r.kind === "skip" && r.scope === 1), "a skip is not sent");
  reset();
  C.logoChargeSound();
  check(!sounds.length, "the logo charge sounds before sound is unlocked");
  // Prepare to Duel: no strike's thunder while the voice line plays, nor within 400 ms either side of it,
  // for the manifest's length and for shorter and longer decoded files.
  const sound = await import("../src/lib/sound");
  const voiceLengths = [sound.voiceDurationMs("prepareToDuel"), 1200, 2000, 4000];
  check(voiceLengths[0] === SOUND_MANIFEST.prepareToDuel.ms, "the voice length before decoding is not the manifest's");
  let sounding = 0;
  for (const voiceMs of voiceLengths) {
    const from = DUEL_START_VOICE_MS - PL.STRIKE_VOICE_CLEAR_MS;
    const to = DUEL_START_VOICE_MS + voiceMs + PL.STRIKE_VOICE_CLEAR_MS;
    for (let n = 0; n < 2000; n++) {
      for (const strike of PL.planStrikes(Math.random)) {
        if (!PL.strikeSounds(strike.atMs, voiceMs)) continue;
        sounding++;
        // The crack [at, at + length) never overlaps the line widened by 400 ms each side.
        const end = strike.atMs + PL.STRIKE_THUNDER_MS;
        check(end <= from || strike.atMs >= to, `a strike at ${strike.atMs} ms thunders during the ${voiceMs} ms voice line`);
      }
    }
    // Edges: every landing time from 0 to the screen's end, 1 ms apart.
    for (let at = 0; at <= 6000; at++) {
      const quiet = at + PL.STRIKE_THUNDER_MS > from && at < to;
      if (PL.strikeSounds(at, voiceMs) === quiet) {
        check(false, `a ${voiceMs} ms line: a strike at ${at} ms ${quiet ? "sounds" : "is silent"}`);
        break;
      }
    }
  }
  check(sounding > 0, "no Prepare to Duel strike ever thunders");
  check(PL.strikeSounds(DUEL_START_VOICE_MS + 1200 + 400, 1200) && !PL.strikeSounds(DUEL_START_VOICE_MS + 1200 + 399, 1200), "the 400 ms after the voice line ends is wrong");
  check(/strikeSounds\(strike\.atMs, voiceDurationMs\("prepareToDuel"\)\)\) celebrationSound\("prepareThunder"\)/.test(readFileSync("src/components/duel/PrepareLightning.tsx", "utf8")), "Prepare to Duel's strikes are silent, or not judged on the voice file's real length");
  check(/celebrationSound\(days >= 30 \? "streakBig" : "streak"\)/.test(readFileSync("src/routes/daily.tsx", "utf8")), "the streak banners do not play the flourishes");
  check(!/playCelebrationSynth|CELEBRATION_SYNTH/.test(readFileSync("src/lib/sound.ts", "utf8")), "the synthesised placeholders are still in sound.ts");
  reset();
}

/* ------------------------------------------------------------ 6. wiring */

const src = (p: string) => readFileSync(p, "utf8");
check(/celebrationsOn\(\)/.test(src("src/routes/__root.tsx")) && /<CelebrationLayer \/>/.test(src("src/routes/__root.tsx")), "the root does not mount the layer behind the switch");
check(/pointer-events: none/.test(src("src/polish-layout/celebrations.css").split(".celebration-canvas")[0]!), "the layer is not pointer-events none");
check(/heroRunEarned\(myScore\)/.test(src("src/components/duel/AnswerReveal.tsx")) && /heroRun=\{false\}/.test(src("src/components/async/AsyncResults.tsx")), "the hero run is not on the reveal (and off on reopened daily reveals)");
check(/heroMomentFor\(myScore\)/.test(src("src/components/duel/AnswerReveal.tsx")) && /heroGrand\(scope, spot\)/.test(src("src/components/duel/AnswerReveal.tsx")) && /heroDance\(scope, spot\)/.test(src("src/components/duel/AnswerReveal.tsx")), "the dance and lap are not on the reveal");
check(/addEventListener\("pointerdown", skip, \{ capture: true, passive: true \}\)/.test(src("src/components/duel/AnswerReveal.tsx")) && !/preventDefault|stopPropagation/.test(src("src/components/duel/AnswerReveal.tsx").split("const skip = () =>")[1]!.split("const timer")[0]!), "a tap does not skip the hero moment, or the skip swallows the tap");
check(/goStrike\(\)/.test(src("src/components/duel/RoundIntro.tsx")) && !/goStrike|celebrat/i.test(src("src/components/duel/DuelStart.tsx")), "GO's strike is not on the countdown, or it is on Prepare to Duel");
check(/celebrationsOn\(\)\) \{\s*unlockAudio\(\);\s*celebrationSound\("zap"\)/.test(src("src/routes/index.tsx")), "Create a room has no zap behind the switch");
check(/streakMilestone\(dailyStreak\(/.test(src("src/routes/daily.tsx")) && /firstToday/.test(src("src/routes/daily.tsx")), "the streak banner is not from today's first daily");
check(!/[^a-z]Math\.random/.test(src("src/lib/fx/celebrationCanvas.ts")), "the canvas scene uses Math.random");
check(!/new (Array|Float32Array|Map|Set)\(|\[\]|\{ *\w+:/.test(src("src/lib/fx/celebrationCanvas.ts").split("draw(ctx: CanvasRenderingContext2D")[1]!.split("\n}\n")[0]!.replace(/\/\/.*$/gm, "")), "a frame allocates (draw passes create arrays or objects)");

/* ------------------------------------------------------------ 7. the browser pass */

if (!process.argv.includes("--no-browser")) {
  const { spawnSync } = await import("node:child_process");
  const shots = process.argv.find((a) => a.startsWith("--shots="));
  const out = spawnSync("bun", ["scripts/celebrations-browser.ts", ...(shots ? [shots] : [])], { encoding: "utf8", timeout: 290_000 });
  const text = `${out.stdout ?? ""}${out.stderr ?? ""}`;
  for (const line of text.split("\n")) if (/^(PASS|FAIL|NOTE|  )/.test(line)) console.log(`  ${line}`);
  check(out.status === 0 && /^PASS/m.test(text), "the browser pass failed (scripts/celebrations-browser.ts)");
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(`PASS: celebrations-check, ${passes} checks`);
process.exit(0);
