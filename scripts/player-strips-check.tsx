/**
 * player-strips-check (wave 4 W4c, Joe's rules of 11 and 12 Nov 2026; happy-dom, ~3 s, no browser): the Category Cup's
 * standings, the Championship's bracket and your-match row, and the hall of fame draw every player as W4a's shared
 * `NameplateStrip` (docs/nameplate.md), with W4b's plates (`platesFor`) built on the server. What it proves:
 * - every row draws one shared strip; places, records, points, ticks and games won sit outside it (no cosmetic behind
 *   a score or a place);
 * - an account's strip opens their full card in `NameplateSheet`; a hidden player ("Hidden player" on a plain neutral
 *   disc, no initial or colour) and a guest open nothing;
 * - one call a page: the event page's plates arrive with its one view call, the hall of fame's with its one call, and the
 *   live part never asks for a card per row;
 * - the server side reads the plates through `platesFor` only (no name lookup of its own), lists the open view and reads
 *   the direct opponent as that player sees their own plate; W4c's own strip is gone.
 * The server's hiding on real data (an under-18 hidden from other entrants, shown to their direct opponent and to
 * themselves) is proved by tournament-events-server-check.
 */
import { existsSync, readFileSync } from "node:fs";

let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}

const { Window } = await import("happy-dom");
const win = new Window({ url: "https://joulz.uk/", width: 390, height: 844 });
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "KeyboardEvent", "PointerEvent", "MouseEvent", "SVGElement", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame", "localStorage", "sessionStorage", "MutationObserver", "CustomEvent", "DOMParser"] as const) {
  const value = (win as unknown as Record<string, unknown>)[key];
  const bind = typeof value === "function" && !/^[A-Z]/.test(key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: bind ? (value as (...a: unknown[]) => unknown).bind(win) : value });
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const origError = console.error;
const consoleErrors: string[] = [];
console.error = (...args: unknown[]) => {
  const text = args.map(String).join(" ");
  if (!/not wrapped in act|ReactDOMTestUtils/.test(text)) consoleErrors.push(text.slice(0, 300));
};

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const live = await import("../src/components/tournaments/BigEventLive");
import type { BigEventView, HallOfFameEntry } from "../src/lib/tournaments/eventsFlow.server";
import type { PlateView } from "../src/lib/identity/plates";

const $$ = (root: ParentNode, sel: string) => [...root.querySelectorAll(sel)] as unknown as HTMLElement[];
const settle = async (ms = 30) => act(async () => void (await new Promise((r) => setTimeout(r, ms))));

async function mount(node: React.ReactElement): Promise<{ el: HTMLElement; root: ReturnType<typeof createRoot> }> {
  const el = document.createElement("div") as unknown as HTMLElement;
  document.body.appendChild(el as unknown as Node);
  const root = createRoot(el as unknown as Element);
  await act(async () => root.render(node));
  return { el, root };
}

const card = (name: string, colour: number): PlateView => ({
  kind: "card",
  name,
  playerNumber: 42,
  tier: null,
  card: { avatarId: "captain-joulz", colour, gem: null, cardArt: "card-art.galaxy", frame: "frame.gold", nameColour: null, badges: [], title: null },
});
const HIDDEN: PlateView = { kind: "hidden" };
const GUEST: PlateView = { kind: "plain", name: "Ali", colour: 5 };

const cup: BigEventView = {
  eventId: "category_cup:2027-03-06:1900",
  kind: "category_cup",
  roundsTotal: 5,
  currentRound: 2,
  roundLabel: "Round 2 of 5",
  roundStartsAtMs: null,
  field: 4,
  bracketSize: null,
  myMatch: null,
  underReview: null,
  standings: [
    { place: 1, name: "Ann_1", plate: card("Ann_1", 1), me: true, record: "2–0", points: "4" },
    { place: 2, name: "Bob_2", plate: card("Bob_2", 2), me: false, record: "1–1", points: "2" },
    { place: 3, name: "Hidden player", plate: HIDDEN, me: false, record: "1–1", points: "2" },
    { place: 4, name: "Ali", plate: GUEST, me: false, record: "0–2", points: "0" },
  ],
  bracket: [],
};
const champ: BigEventView = {
  ...cup,
  eventId: "championship:2027-03",
  kind: "championship",
  standings: [],
  bracketSize: 4,
  bracket: [
    { stage: "knockout", round: 1, slot: 0, nameA: "Ann_1", nameB: "Hidden player", plateA: card("Ann_1", 1), plateB: HIDDEN, gamesA: 2, gamesB: 1, winner: "a", live: false, walkover: false, me: true },
    { stage: "knockout", round: 1, slot: 1, nameA: "Bob_2", nameB: null, plateA: card("Bob_2", 2), plateB: null, gamesA: null, gamesB: null, winner: "a", live: false, walkover: true, me: false },
  ],
};
const hall: HallOfFameEntry[] = [
  { month: "2027-06", label: "June 2027", name: "Ann_1", plate: card("Ann_1", 1) },
  { month: "2027-05", label: "May 2027", name: "Hidden player", plate: HIDDEN },
];
const calls = { event: 0, hall: 0 };
live.setBigEventsBackend({
  event: async (id) => {
    calls.event++;
    return id.startsWith("championship") ? champ : cup;
  },
  hallOfFame: async () => {
    calls.hall++;
    return hall;
  },
});

/** Every node matching `sel` in `row` sits outside the shared strip. */
const outside = (row: HTMLElement, sel: string) => $$(row, sel).length > 0 && $$(row, sel).every((n) => !n.closest("[data-nameplate]"));

{
  const { el, root } = await mount(React.createElement(live.BigEventLive, { eventId: cup.eventId }));
  await settle();
  const rows = $$(el, "[data-standing]");
  check(rows.length === 4 && rows.every((r) => $$(r, "[data-nameplate]").length === 1), "standings: every row draws one shared nameplate strip");
  check(rows.map((r) => r.querySelector("[data-nameplate]")?.getAttribute("data-nameplate")).join() === "card,card,hidden,plain", "standings: accounts on their card strip, the hidden player and the guest on their own kinds");
  check(rows.every((r) => outside(r, "[data-place]")) && rows.every((r) => !/\d–\d|pts/.test(r.querySelector("[data-nameplate]")?.textContent ?? "")), "standings: the place, record and points sit outside the strip");
  const hiddenRow = rows[2]!;
  const disc = hiddenRow.querySelector("[data-hidden-disc]");
  check(!!disc && disc.textContent === "" && !(disc as unknown as HTMLElement).getAttribute("style") && hiddenRow.querySelector("[data-nameplate]")!.textContent === "Hidden player" && $$(hiddenRow, "svg").length === 0, "a hidden player: “Hidden player” on a plain neutral disc, no initial, colour or cosmetics");
  check(rows[0]!.querySelector("[data-nameplate]")!.textContent!.includes("Ann_1 (you)"), "you: your own row by name, marked (you)");
  check(rows.map((r) => !!r.querySelector("[data-open-card]")).join() === "true,true,false,false", "only an account's row opens a card; hidden and guest rows open nothing");
  await act(async () => (rows[1]!.querySelector("[data-open-card]") as unknown as HTMLElement).click());
  await settle();
  check(!!document.querySelector("[data-card-sheet]") && (document.body.textContent ?? "").includes("1–1 · 2 pts"), "a tap opens the player's full card in NameplateSheet, with their record under it");
  check(calls.event === 1, `the event page: one call brings every row's plate (${calls.event})`);
  await act(async () => root.unmount());
}
{
  const { el, root } = await mount(React.createElement(live.BigEventLive, { eventId: champ.eventId }));
  await settle();
  const [played, bye] = $$(el, "[data-bracket-match]");
  check(!!played && $$(played, "[data-nameplate]").length === 2 && outside(played, "[data-side-score]"), "bracket: both players' strips, ticks and games won outside them");
  check(played!.querySelector('[data-side="b"] [data-nameplate]')?.getAttribute("data-nameplate") === "hidden" && !played!.querySelector('[data-side="b"] [data-open-card]'), "bracket: a hidden player's side is “Hidden player” and opens nothing");
  check(!!bye && $$(bye, "[data-nameplate]").length === 1 && (bye.textContent ?? "").includes("Bye"), "bracket: a bye's empty side has no strip");
  check(calls.event === 2, `the bracket page: one more call, no card fetched per row (${calls.event})`);
  await act(async () => root.unmount());
}
{
  const { el, root } = await mount(React.createElement(live.HallOfFame, { on: true }));
  await settle();
  const rows = $$(el, "[data-hall-row]");
  check(rows.length === 2 && rows[0]!.querySelector("[data-nameplate]")?.getAttribute("data-nameplate") === "card" && !!rows[0]!.querySelector("[data-open-card]"), "hall of fame: the winner's strip, opening their card");
  check(rows[1]!.querySelector("[data-nameplate]")?.getAttribute("data-nameplate") === "hidden" && !rows[1]!.querySelector("[data-open-card]") && $$(rows[1]!, "svg").length === 0, "hall of fame: a hidden winner stays “Hidden player” with no cosmetics");
  check(calls.hall === 1, `the hall of fame: one call (${calls.hall})`);
  await act(async () => root.unmount());
}

const src = readFileSync("src/components/tournaments/BigEventLive.tsx", "utf8");
check(/NameplateStrip/.test(src) && /NameplateSheet/.test(src) && !/PlayerStrip/.test(src), "the live part draws W4a's shared NameplateStrip and NameplateSheet, W4c's own strip gone");
check(!/getPublicCard|publicCardsFor|nameplatesFor|economy\.functions/.test(src), "the live part never fetches a card per row (the plates come with the page's call)");
check(!existsSync("src/design/identity/PlayerStrip.tsx") && !existsSync("src/lib/identity/playerStrip.server.ts") && !existsSync("src/lib/identity/playerStrip.ts"), "W4c's own strip and its server half are removed");
const flow = readFileSync("src/lib/tournaments/eventsFlow.server.ts", "utf8");
check(/platesFor\(/.test(flow) && !/readPublicProfiles\(|readPublicCards\(/.test(flow), "the server builds a page's plates through W4b's platesFor (the shared nameplatesFor), with no name lookup of its own");
check(/async function directPlate\(client: Db, userId: string, nowMs: number\)[\s\S]{0,120}platesFor\(client, userId, \[\{ userId, name: "" \}\]/.test(flow) && /opponentPlate: oppPlate/.test(flow), "the direct opponent's plate is read as that player sees their own (shown in the your-match row only)");
check(/hallOfFame\(client: Db, nowMs = Date\.now\(\), viewerId = ""\)/.test(flow), "the hall of fame is an open list: everyone hidden by the plates' rule but the viewer");
check(consoleErrors.length === 0, `no console errors (${consoleErrors.join(" | ").slice(0, 200)})`);

console.error = origError;
live.setBigEventsBackend(null);
console.log(`player-strips-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(`FAIL: ${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("PASS: every player shows as W4a's shared nameplate strip, cosmetics only in the name area, hidden players open nothing, one call a page.");
process.exit(0);
