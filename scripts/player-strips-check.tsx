/**
 * player-strips-check (wave 4 W4c, Joe's rule of 11 Nov 2026: a player's card, avatar and frame show wherever they
 * appear; happy-dom, ~2 s, no browser). What it proves:
 * - the strip's four kinds: an account's avatar in its colour, card art and frame in the name area and the name in
 *   its name colour; a guest's colour and initial; "Hidden player" on a plain neutral disc (Joe, 12 Nov 2026) and
 *   "Deleted player" with nothing else;
 * - an unchanged re-render changes nothing in the page (CLAUDE.md working rule 6);
 * - the Category Cup's standings, the Championship's bracket and the hall of fame draw every player as a strip, with
 *   places, records, points, ticks and games outside it (no cosmetic behind a score or a place);
 * - one call per page: the event page's strips arrive with its one view call, the hall of fame's with its one call,
 *   and the live part never asks for a card per row.
 */
import { readFileSync } from "node:fs";

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
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "SVGElement", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame", "localStorage", "sessionStorage", "MutationObserver", "CustomEvent", "DOMParser"] as const) {
  const value = (win as unknown as Record<string, unknown>)[key];
  const bind = typeof value === "function" && !/^[A-Z]/.test(key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: bind ? (value as (...a: unknown[]) => unknown).bind(win) : value });
}
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
const { PlayerStrip } = await import("../src/design/identity/PlayerStrip");
const strips = await import("../src/lib/identity/playerStrip");
const live = await import("../src/components/tournaments/BigEventLive");
import type { BigEventView, HallOfFameEntry } from "../src/lib/tournaments/eventsFlow.server";

const $$ = (root: ParentNode, sel: string) => [...root.querySelectorAll(sel)] as unknown as HTMLElement[];
const settle = async (ms = 30) => act(async () => void (await new Promise((r) => setTimeout(r, ms))));

async function mount(node: React.ReactElement): Promise<{ el: HTMLElement; root: ReturnType<typeof createRoot> }> {
  const el = document.createElement("div") as unknown as HTMLElement;
  document.body.appendChild(el as unknown as Node);
  const root = createRoot(el as unknown as Element);
  await act(async () => root.render(node));
  return { el, root };
}

/* ------------------------------------------------------------------ the strip's kinds */
const dressed = strips.accountStrip({
  username: "SkyRacer",
  colour: 3,
  avatar_id: "captain-joulz",
  gem: null,
  card_art: "card-art.galaxy",
  frame: "frame.gold",
  name_colour: "name-colour.chrome",
});
{
  const { el, root } = await mount(React.createElement(PlayerStrip, { player: dressed, you: true }));
  const s = el.querySelector("[data-player-strip]") as unknown as HTMLElement;
  check(s?.getAttribute("data-player-strip") === "account" && s.getAttribute("data-card-art") === "card-art.galaxy" && s.getAttribute("data-frame") === "frame.gold" && s.getAttribute("data-name-colour") === "name-colour.chrome" && s.getAttribute("data-avatar") === "captain-joulz", "an account: its card art, frame, name colour and avatar");
  check($$(s, "svg.pstrip-art").length === 1 && $$(s, "svg.pstrip-frame").length === 1 && $$(s, ".pcard-av svg").length === 1, "the art and frame drawn inside the strip, the avatar beside the name");
  check(s.querySelector("[data-strip-name]")?.textContent === "SkyRacer (you)" && s.getAttribute("aria-label") === "SkyRacer (you)", "the username in the name area, (you) for the viewer");
  const changes: unknown[] = [];
  const mo = new MutationObserver((r) => changes.push(...r));
  mo.observe(el as unknown as Node, { subtree: true, childList: true, attributes: true, characterData: true });
  await act(async () => root.render(React.createElement(PlayerStrip, { player: { ...dressed }, you: true })));
  await settle(5);
  mo.disconnect();
  check(changes.length === 0, `an unchanged re-render changes nothing (${changes.length} DOM changes)`);
  await act(async () => root.unmount());
}
for (const [player, kind, text] of [
  [strips.guestStrip("Ali", 5), "guest", "Ali"],
  [strips.hiddenStrip(), "hidden", "Hidden player"],
  [strips.deletedStrip(), "deleted", "Deleted player"],
] as const) {
  const { el, root } = await mount(React.createElement(PlayerStrip, { player }));
  const s = el.querySelector("[data-player-strip]") as unknown as HTMLElement;
  const initial = s.querySelector("[data-strip-initial]");
  check(s.getAttribute("data-player-strip") === kind && $$(s, "svg").length === 0 && !s.hasAttribute("data-frame") && !s.hasAttribute("data-card-art"), `${kind}: no card art, frame or avatar`);
  const disc = s.querySelector("[data-strip-disc]");
  check(kind === "hidden" ? !!disc && disc.textContent === "" && !(disc as unknown as HTMLElement).getAttribute("style") : disc === null, `${kind}: ${kind === "hidden" ? "a plain neutral disc, no initial or colour" : "no hidden disc"}`);
  check(s.querySelector("[data-strip-name]")?.textContent === text && (kind === "guest" ? initial?.textContent === "A" : initial === null), `${kind}: ${kind === "guest" ? "colour and initial" : `"${text}" alone`}`);
  await act(async () => root.unmount());
}

/* ------------------------------------------------------------------ the pages: strips in rows, one call each */
const p = (name: string, colour: number) => strips.accountStrip({ username: name, colour, avatar_id: "captain-joulz", gem: null, card_art: "card-art.galaxy", frame: "frame.gold", name_colour: null });
const cup: BigEventView = {
  eventId: "category_cup:2027-03-06:1900",
  kind: "category_cup",
  roundsTotal: 5,
  currentRound: 2,
  roundLabel: "Round 2 of 5",
  roundStartsAtMs: null,
  field: 3,
  bracketSize: null,
  myMatch: null,
  underReview: null,
  standings: [
    { place: 1, name: "Ann_1", player: p("Ann_1", 1), me: true, record: "2–0", points: "4" },
    { place: 2, name: "Bob_2", player: p("Bob_2", 2), me: false, record: "1–1", points: "2" },
    { place: 3, name: "Deleted player", player: strips.deletedStrip(), me: false, record: "0–2", points: "0" },
  ],
  bracket: [],
};
const champ: BigEventView = {
  ...cup,
  eventId: "championship:2027-03",
  kind: "championship",
  standings: [],
  bracketSize: 2,
  bracket: [
    { stage: "knockout", round: 1, slot: 0, nameA: "Ann_1", nameB: "Bob_2", playerA: p("Ann_1", 1), playerB: p("Bob_2", 2), gamesA: 2, gamesB: 1, winner: "a", live: false, walkover: false, me: true },
  ],
};
const hall: HallOfFameEntry[] = [
  { month: "2027-06", label: "June 2027", name: "Ann_1", player: p("Ann_1", 1) },
  { month: "2027-05", label: "May 2027", name: "Hidden player", player: strips.hiddenStrip() },
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

const outside = (row: HTMLElement, sel: string) => $$(row, sel).length > 0 && $$(row, sel).every((n) => !n.closest(".pstrip"));
{
  const { el, root } = await mount(React.createElement(live.BigEventLive, { eventId: cup.eventId }));
  await settle();
  const rows = $$(el, "[data-standing]");
  check(rows.length === 3 && rows.every((r) => $$(r, "[data-player-strip]").length === 1), "standings: every row draws one strip");
  check(rows.every((r) => outside(r, "[data-place]")) && rows.every((r) => !(r.querySelector(".pstrip")?.textContent ?? "").match(/\d–\d|pts/)), "standings: the place, record and points sit outside the strip");
  check(rows[0]!.querySelector("[data-strip-name]")?.textContent === "Ann_1 (you)" && rows[2]!.querySelector("[data-player-strip]")?.getAttribute("data-player-strip") === "deleted", "standings: you marked, a deleted player plain");
  check(calls.event === 1, `the event page: one call brings every row's strip (${calls.event})`);
  await act(async () => root.unmount());
}
{
  const { el, root } = await mount(React.createElement(live.BigEventLive, { eventId: champ.eventId }));
  await settle();
  const row = $$(el, "[data-bracket-match]")[0]!;
  check(!!row && $$(row, "[data-player-strip]").length === 2 && outside(row, "[data-side-score]"), "bracket: both players' strips, ticks and games won outside them");
  check(calls.event === 2, `the bracket page: one more call, no card fetched per row (${calls.event})`);
  await act(async () => root.unmount());
}
{
  const { el, root } = await mount(React.createElement(live.HallOfFame, { on: true }));
  await settle();
  const rows = $$(el, "[data-hall-row]");
  check(rows.length === 2 && rows[0]!.querySelector("[data-player-strip]")?.getAttribute("data-frame") === "frame.gold", "hall of fame: the winner's strip with their frame");
  check(rows[1]!.querySelector("[data-player-strip]")?.getAttribute("data-player-strip") === "hidden" && rows[1]!.querySelector("[data-strip-name]")?.textContent === "Hidden player" && $$(rows[1]!, "svg").length === 0, "hall of fame: a hidden winner stays \"Hidden player\" with no cosmetics");
  check(calls.hall === 1, `the hall of fame: one call (${calls.hall})`);
  await act(async () => root.unmount());
}
const src = readFileSync("src/components/tournaments/BigEventLive.tsx", "utf8");
check(!/getPublicCard|economy\.functions|publicCardFor/.test(src), "the live part never fetches a card per row (the strips come with the page's call)");
const flow = readFileSync("src/lib/tournaments/eventsFlow.server.ts", "utf8");
check(/playerStripSets\(/.test(flow) && !/readPublicProfiles\(/.test(flow), "the server builds the page's strips in one batch (playerStripSets), not a name lookup per player");
const stripSrc = readFileSync("src/lib/identity/playerStrip.server.ts", "utf8");
check(stripSrc.includes('open.set(id, strip.kind === "account" && under18.has(id) ? hiddenStrip() : strip)') && stripSrc.includes("if (dob.error) for (const id of part) under18.add(id)"), "the open view hides every under-18 (and everyone on a failed age read)");
check(consoleErrors.length === 0, `no console errors (${consoleErrors.join(" | ").slice(0, 200)})`);

console.error = origError;
live.setBigEventsBackend(null);
console.log(`player-strips-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(`FAIL: ${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("PASS: players show as their nameplate strips (avatar, colour, frame, username), cosmetics only in the name area, one call a page.");
process.exit(0);
