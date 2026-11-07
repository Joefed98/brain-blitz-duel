/**
 * standings-reveal-check (7 Nov 2026): the standings' broadcast reveal (src/lib/duel/standingsReveal.ts,
 * src/components/fx/useStandingsReveal.ts) and the podium's medal drop. No browser: happy-dom.
 *
 *  1. The plan, for every room size 1–16: every player lands exactly once, from last place up to 2nd one at
 *     a time, then every 1st place together; the stagger shrinks as rooms grow and everything (the sweep
 *     included) ends by STANDINGS_REVEAL_END_MS, inside 3 s; the drawn order starts as the previous order,
 *     is a permutation at every step and ends as the server's order.
 *  2. The real Standings with celebrations on, built by the room's own standings() from round results, for
 *     rooms of 2, 10 and 16, with ties (a shared 1st, a shared middle place) and players who left (not
 *     shown) or went inactive: the rows are drawn in the previous order at first with the totals before the
 *     round, land in turn, and end on the server's totals in the server's order, every row in place (no
 *     transform left), one soft tick per row before 1st, the bigger hit (countDing) last, 1st's sweep, and no
 *     timer, frame or sound after the end.
 *  2b. A Placings room (room scoring): the rows count their points, not the total score, from the points before
 *     the round to the server's points.
 *  3. A tap skips to the final state at once (totals, order, no slide left, no sweep, no later sounds).
 *  4. Reduced motion: the final state from the first render (no waiting rows, no transforms, no count).
 *  5. The CSS: the sweep and the medal drop are held still under reduced motion, the podium's medals drop
 *     bronze, silver, then gold, then the sweep across the gold block and medal.
 *
 *   bun scripts/standings-reveal-check.tsx
 */
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

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
// Every frame request is counted, so the check can prove nothing is drawn after the reveal ends.
let frames = 0;
const raf = (cb: (t: number) => void) => {
  frames++;
  return setTimeout(() => cb(performance.now()), 16) as unknown as number;
};
const caf = (id: number) => clearTimeout(id);
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "localStorage", "sessionStorage", "location", "getComputedStyle", "matchMedia", "ResizeObserver", "CustomEvent", "MutationObserver"] as const) {
  const value = (win as unknown as Record<string, unknown>)[key];
  if (value === undefined) continue;
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value: typeof value === "function" && !["HTMLElement", "Element", "Node", "Event", "ResizeObserver", "CustomEvent", "MutationObserver"].includes(key) ? (value as (...a: unknown[]) => unknown).bind(win) : value,
  });
}
for (const target of [globalThis, win] as Record<string, unknown>[]) {
  Object.defineProperty(target, "requestAnimationFrame", { configurable: true, writable: true, value: raf });
  Object.defineProperty(target, "cancelAnimationFrame", { configurable: true, writable: true, value: caf });
}
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const consoleError = console.error;
console.error = (...args: unknown[]) => {
  if (/not wrapped in act|useRouter must be used/.test(String(args[0] ?? ""))) return;
  consoleError(...args);
};
// Layout: happy-dom has none, so every list row is 48 px tall, stacked in page order. The reveal places
// rows with transforms from these, so a row's drawn top is offsetTop + its translateY.
const ROW_H = 48;
Object.defineProperty((win as unknown as { HTMLElement: { prototype: object } }).HTMLElement.prototype, "offsetTop", {
  configurable: true,
  get(this: HTMLElement) {
    if (this.tagName !== "LI" || !this.parentElement) return 0;
    return Array.from(this.parentElement.children).indexOf(this) * ROW_H;
  },
});
Object.defineProperty((win as unknown as { HTMLElement: { prototype: object } }).HTMLElement.prototype, "offsetHeight", {
  configurable: true,
  get(this: HTMLElement) {
    return this.tagName === "LI" ? ROW_H : 0;
  },
});
(win as unknown as { __DUELZ_BETA_CONFIG__?: Record<string, unknown> }).__DUELZ_BETA_CONFIG__ = { FX_CELEBRATIONS: true };

const R = await import("../src/lib/duel/standingsReveal");
const C = await import("../src/lib/fx/celebrations");
const { standings } = await import("../src/lib/duel/scoring");
const { previousStandingOrder, shownCountFrom } = await import("../src/lib/duel/resultPresentation");
import type { Standing } from "../src/lib/duel/scoring";
import type { DuelPlayerRow, RoundResultRow } from "../src/lib/duel/types";

/* ------------------------------------------------------------ fixtures: real standings from results */

function player(slot: number, status: "active" | "inactive" | "left" = "active"): DuelPlayerRow {
  return {
    id: `p${slot}`,
    duel_id: "d",
    player_slot: slot,
    display_name: `P${slot}`,
    user_id: `u${slot}`,
    ready_round: 0,
    intro_ready_round: 0,
    muted_by_host: false,
    last_reaction_at: null,
    last_seen_at: "2026-11-07T12:00:00Z",
    status,
    joined_at: "2026-11-07T12:00:00Z",
  } as DuelPlayerRow;
}
function result(slot: number, round: number, score: number, msRemaining = 30_000): RoundResultRow {
  return {
    id: `r${slot}-${round}`,
    duel_id: "d",
    player_slot: slot,
    round_number: round,
    answer: "x",
    is_correct: score > 0,
    ms_remaining: msRemaining,
    reaction_avg_ms: null,
    correct_count: null,
    errors: null,
    extra: null,
    score,
  } as RoundResultRow;
}
/** A room of `n` after round 2, where round 2 reshuffles the order; `left` slots left, `inactive` went quiet. */
function room(n: number, opts: { tieFirst?: boolean; tieMiddle?: boolean; left?: number[]; inactive?: number[] } = {}): Standing[] {
  const players = Array.from({ length: n }, (_, i) => player(i + 1, opts.left?.includes(i + 1) ? "left" : opts.inactive?.includes(i + 1) ? "inactive" : "active"));
  const results: RoundResultRow[] = [];
  for (let slot = 1; slot <= n; slot++) {
    results.push(result(slot, 1, 200 - slot * 9));
    if (!opts.inactive?.includes(slot)) results.push(result(slot, 2, 40 + ((slot * 37) % 150)));
  }
  if (opts.tieFirst) {
    // Two players level on total and time.
    const order = standings(players, results, 2);
    const [a, b] = [order[0]!.slot, order[1]!.slot];
    const r2a = results.find((r) => r.player_slot === a && r.round_number === 2)!;
    const r2b = results.find((r) => r.player_slot === b && r.round_number === 2)!;
    r2b.score += order[0]!.total - order[1]!.total;
    r2b.ms_remaining = r2a.ms_remaining;
    const r1a = results.find((r) => r.player_slot === a && r.round_number === 1)!;
    const r1b = results.find((r) => r.player_slot === b && r.round_number === 1)!;
    r1b.ms_remaining = r1a.ms_remaining;
  }
  if (opts.tieMiddle && n >= 5) {
    const order = standings(players, results, 2);
    const [a, b] = [order[2]!.slot, order[3]!.slot];
    const ra = results.filter((r) => r.player_slot === a);
    const rb = results.filter((r) => r.player_slot === b);
    for (let i = 0; i < Math.min(ra.length, rb.length); i++) rb[i]!.ms_remaining = ra[i]!.ms_remaining;
    const rb2 = rb.find((r) => r.round_number === 2);
    if (rb2) rb2.score += order[2]!.total - order[3]!.total;
  }
  return standings(players, results, 2);
}

/* ------------------------------------------------------------ 1. the plan */

check(R.STANDINGS_REVEAL_END_MS <= 3000, `the reveal may run ${R.STANDINGS_REVEAL_END_MS} ms, over 3 s`);
for (let n = 1; n <= 16; n++) {
  for (const variant of [{}, { tieFirst: true }, { tieMiddle: true }] as const) {
    if (n < 2 && Object.keys(variant).length) continue;
    const rows = room(n, variant);
    const label = `${n} players ${JSON.stringify(variant)}`;
    const plan = R.standingsRevealPlan(rows);
    const all = plan.steps.flat();
    check(all.length === rows.length && new Set(all).size === rows.length, `${label}: every player does not land exactly once`);
    const firsts = rows.filter((r) => r.position === 1).map((r) => r.slot).sort();
    check(JSON.stringify([...(plan.steps.at(-1) ?? [])].sort()) === JSON.stringify(firsts), `${label}: 1st place does not land last, together`);
    const before = plan.steps.slice(0, -1);
    check(before.every((s) => s.length === 1), `${label}: the rows before 1st do not land one at a time`);
    const expectUp = rows.filter((r) => r.position !== 1).map((r) => r.slot).reverse();
    check(JSON.stringify(before.flat()) === JSON.stringify(expectUp), `${label}: rows do not land from last place up`);
    check(plan.stepAt.every((t, i) => i === 0 || t > plan.stepAt[i - 1]!), `${label}: landing times do not rise`);
    check(plan.endMs <= R.STANDINGS_REVEAL_END_MS, `${label}: the reveal ends at ${plan.endMs} ms, after ${R.STANDINGS_REVEAL_END_MS}`);
    if (before.length > 1) {
      const hold = plan.stepAt.at(-1)! - plan.stepAt.at(-2)!;
      check(hold >= R.REVEAL_ROW_MS + R.REVEAL_HOLD_MS, `${label}: no hold before 1st (${hold} ms)`);
    }
    const start = R.standingsRevealOrder(rows, plan, 0).map((r) => r.slot);
    check(JSON.stringify(start) === JSON.stringify(previousStandingOrder(rows).map((r) => r.slot)), `${label}: the reveal does not start in the previous order`);
    for (let k = 0; k <= plan.steps.length; k++) {
      const order = R.standingsRevealOrder(rows, plan, k);
      check(order.length === rows.length && new Set(order.map((r) => r.slot)).size === rows.length, `${label}: step ${k} is not a permutation`);
      const landed = new Set(plan.steps.slice(0, k).flat());
      const tail = order.slice(order.length - landed.size).map((r) => r.slot);
      const want = rows.slice(rows.length - landed.size).map((r) => r.slot);
      if (k < plan.steps.length) check(JSON.stringify(tail) === JSON.stringify(want), `${label}: step ${k}'s landed rows are not in their final places`);
    }
    check(JSON.stringify(R.standingsRevealOrder(rows, plan, plan.steps.length)) === JSON.stringify(rows), `${label}: the reveal does not end in the server's order`);
  }
}
{
  const p2 = R.standingsRevealPlan(room(2));
  const p16 = R.standingsRevealPlan(room(16));
  check(p16.staggerMs < p2.staggerMs || p2.steps.length <= 2, "the stagger does not shrink as the room grows");
  check(p16.staggerMs >= R.REVEAL_STAGGER_MIN_MS, `16 players: stagger ${p16.staggerMs} ms`);
}
check(R.standingsRevealPlan([]).steps.length === 0, "an empty room has a reveal");

/* ------------------------------------------------------------ 2–4. the real Standings */

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { Standings } = await import("../src/components/duel/Standings");

const sounds = C.celebrationSoundLog();
C.logCelebrations(true);

async function mount(rows: Standing[], mySlot: number) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host as unknown as HTMLElement);
  await act(async () => root.render(React.createElement(Standings, { round: 2, rows, mySlot, autoSeconds: 8, continueState: { kind: "waiting" } as never })));
  return {
    host,
    unmount: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}
const wait = (ms: number) => act(async () => sleep(ms));
const items = (host: Element) => Array.from(host.querySelectorAll("ul.rs-list > li")) as HTMLElement[];
const totals = (host: Element) => items(host).map((li) => li.querySelector(".th-score")?.textContent ?? "");
const shift = (li: HTMLElement) => {
  const m = /translateY\((-?[\d.]+)px\)/.exec(li.style.transform);
  return m ? Number(m[1]) : 0;
};
/** The slots as drawn, top to bottom (page place plus transform). */
const drawn = (host: Element, rows: Standing[]) =>
  items(host)
    .map((li, i) => ({ slot: rows[i]!.slot, top: li.offsetTop + shift(li) }))
    .sort((a, b) => a.top - b.top)
    .map((r) => r.slot);

const CASES: { label: string; rows: Standing[]; left?: number[] }[] = [
  { label: "2 players", rows: room(2) },
  { label: "2 players, level", rows: room(2, { tieFirst: true }) },
  { label: "10 players, shared 1st", rows: room(10, { tieFirst: true }) },
  { label: "10 players, one left, one inactive, a shared place", rows: room(10, { left: [4], inactive: [7], tieMiddle: true }), left: [4] },
  { label: "16 players", rows: room(16, { tieMiddle: true }) },
  { label: "16 players, two left", rows: room(16, { left: [3, 11] }), left: [3, 11] },
];

for (const { label, rows, left = [] } of CASES) {
  reduced = false;
  sounds.length = 0;
  const plan = R.standingsRevealPlan(rows);
  const view = await mount(rows, rows.at(-1)!.slot);
  await wait(20);
  const names = Array.from(view.host.querySelectorAll("ul.rs-list > li .th-name")).map((e) => e.textContent);
  check(JSON.stringify(names) === JSON.stringify(rows.map((r) => r.name)), `${label}: the list's page order is not the server's`);
  check(left.every((slot) => !names.includes(`P${slot}`)), `${label}: a player who left is shown`);
  if (label.includes("inactive")) check(items(view.host).some((li) => li.className.includes("opacity-40")), `${label}: the inactive player is not shown dimmed`);
  check(JSON.stringify(drawn(view.host, rows)) === JSON.stringify(previousStandingOrder(rows).map((r) => r.slot)), `${label}: not drawn in the previous order at first (${drawn(view.host, rows).join()})`);
  check(JSON.stringify(totals(view.host)) === JSON.stringify(rows.map((r) => String(C.countUpFrom(r)))), `${label}: the first totals are not the totals before the round (${totals(view.host).join()})`);
  check(items(view.host).every((li) => li.getAttribute("data-reveal") === "waiting"), `${label}: rows have landed before the reveal starts`);
  // Part-way: some rows landed, from the bottom.
  if (plan.steps.length > 2) {
    await wait(plan.stepAt[1]! + 40 - 20);
    const states = items(view.host).map((li) => li.getAttribute("data-reveal"));
    const landedCount = states.filter((s) => s === "landed").length;
    check(landedCount >= 2 && landedCount < rows.length && states.slice(rows.length - landedCount).every((s) => s === "landed"), `${label}: part-way, the landed rows are not the bottom ones (${states.join()})`);
    check(!view.host.querySelector("[data-reveal-sweep]"), `${label}: 1st's sweep before 1st lands`);
  }
  await wait(plan.stepAt.at(-1)! + 60);
  check(!!view.host.querySelector("[data-reveal-sweep]"), `${label}: 1st lands with no sweep`);
  const swept = Array.from(view.host.querySelectorAll("[data-reveal-sweep] .th-name")).map((e) => e.textContent).sort();
  check(JSON.stringify(swept) === JSON.stringify(rows.filter((r) => r.position === 1).map((r) => r.name).sort()), `${label}: the sweep is on ${swept.join()}, not 1st place`);
  await wait(R.STANDINGS_REVEAL_END_MS - plan.stepAt.at(-1)! + 200);
  check(JSON.stringify(totals(view.host)) === JSON.stringify(rows.map((r) => String(r.total))), `${label}: ends on ${totals(view.host).join()}, the server's ${rows.map((r) => r.total).join()}`);
  check(JSON.stringify(drawn(view.host, rows)) === JSON.stringify(rows.map((r) => r.slot)), `${label}: not drawn in the server's order at the end`);
  check(items(view.host).every((li) => shift(li) === 0), `${label}: a row is left out of place`);
  check(items(view.host).every((li) => li.getAttribute("data-reveal") === "landed"), `${label}: a row never landed`);
  const before = rows.filter((r) => r.position !== 1).length;
  check(sounds.filter((s) => s === "countTick").length === before, `${label}: ${sounds.filter((s) => s === "countTick").length} ticks for ${before} rows before 1st`);
  check(sounds.filter((s) => s === "countDing").length === 1 && sounds.lastIndexOf("countDing") > sounds.lastIndexOf("countTick"), `${label}: 1st does not land with one bigger hit, last (${sounds.join()})`);
  check(!sounds.includes("zap"), `${label}: a zap`);
  // Idle: nothing drawn or heard once it has ended.
  const framesAt = frames;
  const soundsAt = sounds.length;
  await wait(400);
  check(frames === framesAt, `${label}: ${frames - framesAt} frames requested after the reveal ended`);
  check(sounds.length === soundsAt, `${label}: sounds after the reveal ended`);
  await view.unmount();
}

// 2b. A Placings room: the reveal counts points (shownTotal), from the points before the round (shownCountFrom).
{
  reduced = false;
  sounds.length = 0;
  const n = 8;
  const players = Array.from({ length: n }, (_, i) => player(i + 1));
  const results: RoundResultRow[] = [];
  for (let slot = 1; slot <= n; slot++) {
    results.push(result(slot, 1, 200 - slot * 9));
    results.push(result(slot, 2, 40 + ((slot * 37) % 150)));
  }
  const rows = standings(players, results, 2, undefined, undefined, "placings");
  check(rows.every((r) => r.points !== undefined) && rows.some((r) => r.points !== r.total), "Placings room: the rows carry no points apart from their totals");
  const plan = R.standingsRevealPlan(rows);
  const view = await mount(rows, rows.at(-1)!.slot);
  await wait(20);
  check(JSON.stringify(totals(view.host)) === JSON.stringify(rows.map((r) => String(shownCountFrom(r)))), `Placings room: the first figures are not the points before the round (${totals(view.host).join()})`);
  await wait(R.STANDINGS_REVEAL_END_MS + 200);
  check(JSON.stringify(totals(view.host)) === JSON.stringify(rows.map((r) => String(r.points))), `Placings room: ends on ${totals(view.host).join()}, not the server's points ${rows.map((r) => r.points).join()}`);
  check(plan.steps.flat().length === rows.length, "Placings room: every player does not land");
  await view.unmount();
}

// 3. A tap skips to the final state.
for (const { label, rows } of CASES.filter((c) => /10|16/.test(c.label))) {
  sounds.length = 0;
  const view = await mount(rows, rows[0]!.slot);
  await wait(150);
  await act(async () => {
    window.dispatchEvent(new (win as unknown as { PointerEvent: typeof Event }).PointerEvent("pointerdown", { bubbles: true }) as unknown as Event);
  });
  await wait(40);
  check(JSON.stringify(totals(view.host)) === JSON.stringify(rows.map((r) => String(r.total))), `skip, ${label}: totals ${totals(view.host).join()}`);
  check(JSON.stringify(drawn(view.host, rows)) === JSON.stringify(rows.map((r) => r.slot)), `skip, ${label}: not drawn in the server's order`);
  check(items(view.host).every((li) => shift(li) === 0 && /none/.test(li.style.transition)), `skip, ${label}: a row still slides`);
  check(items(view.host).every((li) => li.getAttribute("data-reveal") === "landed"), `skip, ${label}: a row still waits`);
  check(!view.host.querySelector("[data-reveal-sweep]"), `skip, ${label}: the sweep still plays`);
  const heard = sounds.length;
  await wait(R.STANDINGS_REVEAL_END_MS);
  check(sounds.length === heard, `skip, ${label}: sounds after the skip (${sounds.slice(heard).join()})`);
  await view.unmount();
}

// 4. Reduced motion: the final state from the first render.
for (const { label, rows } of CASES) {
  reduced = true;
  sounds.length = 0;
  const view = await mount(rows, rows[0]!.slot);
  check(JSON.stringify(totals(view.host)) === JSON.stringify(rows.map((r) => String(r.total))), `reduced motion, ${label}: totals ${totals(view.host).join()}`);
  check(items(view.host).every((li) => !li.hasAttribute("data-reveal") && !li.hasAttribute("data-reveal-sweep") && !li.style.transform), `reduced motion, ${label}: rows wait, slide or sweep`);
  await wait(300);
  check(!sounds.includes("countTick"), `reduced motion, ${label}: ticks`);
  check(JSON.stringify(totals(view.host)) === JSON.stringify(rows.map((r) => String(r.total))), `reduced motion, ${label}: totals moved`);
  await view.unmount();
}
reduced = false;

/* ------------------------------------------------------------ 5. the CSS */

const css = readFileSync("src/polish-layout/room-screens.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const delay = (place: number) => Number(new RegExp(`\\[data-podium-step="${place}"\\] > \\[data-jz="medal"\\] \\{ animation-delay: (\\d+)ms; \\}`).exec(css)?.[1] ?? NaN);
const sweepDelay = Number(/\[data-podium-step="1"\]::after \{\s*animation-delay: (\d+)ms;/.exec(css)?.[1] ?? NaN);
check(delay(3) < delay(2) && delay(2) < delay(1), `the medals do not drop bronze, silver, then gold (${delay(3)}, ${delay(2)}, ${delay(1)})`);
check(sweepDelay > delay(1), "the podium's sweep does not follow the gold medal");
const reducedBlock = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(css.slice(css.indexOf("rs-sweep")))?.[1] ?? "";
check(/data-reveal-sweep\]::after/.test(reducedBlock) && /\[data-podium-step="1"\]::after/.test(reducedBlock) && /\[data-jz="medal"\]/.test(reducedBlock) && /animation: none/.test(reducedBlock), "reduced motion does not hold the sweep and the medal drop still");
check(/@keyframes rs-sweep \{\s*from \{ background-position: 100% 0; \}\s*to \{ background-position: 0% 0; \}/.test(css), "the sweep does not rest off the row (transparent) at both ends");

console.log(failures.length ? `FAIL: ${failures.length} of ${passes + failures.length} checks failed` : `PASS: standings-reveal-check, ${passes} checks`);
for (const f of failures) console.log(`  - ${f}`);
process.exit(failures.length ? 1 : 0);
