/**
 * identity-everywhere-check (13 Nov 2026, Joe's rule: one identity everywhere; docs/nameplate.md "Rooms"). Proves, end
 * to end through the real code:
 *
 *  1. On a real database (scripts/server-fn-harness.ts, every migration applied), a room of 10 (an account with
 *     cosmetics and a badge, an under-18 account, an account waiting for deletion, seven guests) made and joined through
 *     the real createRoomFn / joinRoomFn: roomCardsFn answers every seat's card in ONE batched read (one seats read,
 *     one public-cards read, one card-badges read, one profiles read, whatever the room's size), keyed by seat and never
 *     carrying an account id; inside the room the under-18 shows with their card (direct opponents); guests and the
 *     account waiting for deletion have no card (the room draws their colour and initial); a caller with no seat gets
 *     nothing. Outside the room, the shared plates (platesFor, the boards' audience) draw the same under-18 and the
 *     deletion-pending account as "Hidden player" with nothing of the account.
 *  2. In happy-dom, on the real room screens under the room's card host (Standings, the round leaderboard, the podium,
 *     the chat's mini card): one card fetch for the room however often the screens re-render or move phase, a second
 *     only when someone joins; account rows draw the shared NameplateStrip with the card, guests their colour and
 *     initial, nobody "Hidden player" inside the room; scores and places sit outside every strip; a tap on a card
 *     row opens the full card (PlayerCard) in the shared sheet; the podium draws the top three as full cards.
 *  3. Statically: the old public Daily board is gone (DailyBoard.tsx deleted; /daily and its results open the Daily top
 *     100; the old call answers only the caller's own row through `ownDailyLine`), and no badge, challenge or Joules
 *     rule reads it; "Your look" is retired from Profile (no look picker there) while a guest still picks a colour in
 *     the lobby (remembered for the next room) and sign-up starts from it; the room's card reads take ids from seats
 *     through one helper (`cardIdOf`).
 *  4. The shared LiveTag's text on its red is at least 4.5:1.
 */
import { existsSync, readFileSync } from "node:fs";

import {
  ANON_KEY,
  callServerFn,
  installServerFnPlugin,
  postgresBin,
  SERVICE_KEY,
  startLocalDb,
  startRestServer,
  userToken,
  type LocalDb,
  type RestServer,
} from "./server-fn-harness";

let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}
async function section(name: string, body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } catch (err) {
    check(false, `${name}: threw ${err instanceof Error ? (err.stack ?? err.message).split("\n").slice(0, 4).join(" | ") : String(err)}`);
  }
}
const quietLog = console.log;
console.log = (...args: unknown[]) => {
  const line = args.map(String).join(" ");
  if (/^\s*(FAIL|NOTE)|^identity-everywhere-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
const origError = console.error;
const consoleErrors: string[] = [];
console.error = (...args: unknown[]) => {
  const text = args.map(String).join(" ");
  if (!/not wrapped in act|ReactDOMTestUtils/.test(text)) consoleErrors.push(text.slice(0, 300));
};

/** The scenario's own clock (never the real one). */
const NOW = Date.UTC(2026, 10, 13, 15, 0, 0);
const born = (years: number) => new Date(NOW - years * 365.25 * 86_400_000).toISOString().slice(0, 10);

/* ------------------------------------------------------------------ 1. on a real database */

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const HOST = uid(1); // an adult with every card cosmetic and a badge
const KID = uid(2); // 15
const GONE = uid(3); // an account waiting for deletion
const GUESTS = [4, 5, 6, 7, 8, 9, 10].map(uid);
const OUTSIDER = uid(20);
const LATE = uid(21); // the 11th, a guest

if (!postgresBin()) {
  if (process.env["CI"]) check(false, "no PostgreSQL binaries on the CI runner");
  else quietLog("  NOTE no PostgreSQL binaries found: the database part didn't run (CI runs it)");
} else {
  let db: LocalDb | null = null;
  let rest: RestServer | null = null;
  try {
    db = startLocalDb("identity-everywhere-check-");
    check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
    rest = await startRestServer(db.socketDir);
    process.env["SUPABASE_URL"] = rest.url;
    process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
    await installServerFnPlugin();
    await runDb(db, rest);
  } catch (err) {
    check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await rest?.stop();
    db?.stop();
  }
}

async function runDb(db: LocalDb, rest: RestServer): Promise<void> {
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };
  const duel = await import("../src/lib/duel/duel.functions");
  const cardsFns = await import("../src/lib/identity/roomCards.functions");
  const { platesFor } = await import("../src/lib/identity/plates.server");
  const { adminDb } = await import("../src/lib/data/db.server");
  const client = await adminDb();

  q(`INSERT INTO auth.users (id) VALUES ${[HOST, KID, GONE, ...GUESTS, OUTSIDER, LATE].map((u) => `('${u}')`).join(", ")}`);
  q(`SET session_replication_role = replica; INSERT INTO public.profiles (user_id, username, username_key, colour, date_of_birth, player_number) VALUES
    ('${HOST}', 'Ana_Gold', 'ana_gold', 7, DATE '${born(30)}', 42),
    ('${KID}', 'Kiddo', 'kiddo', 12, DATE '${born(15)}', 44),
    ('${GONE}', 'Leaving', 'leaving', 3, DATE '${born(40)}', 45)`);
  for (const [item, slot] of [["card-art.grid", "card-art"], ["frame.gold", "frame"], ["name-colour.gold-leaf", "name-colour"]] as const) {
    q(`SELECT public.economy_grant_item('${HOST}', '${item}', 'grant')`);
    check(q(`SELECT public.economy_equip('${HOST}', '${slot}', '${item}')`) === "equipped", `the check's account equips ${item}`);
  }
  q(`SELECT public.badge_award('${HOST}', 'friendly', '{}'::jsonb)`);
  q(`SELECT public.badge_set_card('${HOST}', ARRAY['friendly'])`);

  let roomId = "";
  let roomCode = "";
  await section("room of 10", async () => {
    const made = await callServerFn(duel.createRoomFn, { displayName: "Ana" }, userToken(HOST));
    roomId = made.roomId;
    roomCode = made.roomCode;
    check(/^[0-9a-f-]{36}$/.test(roomId), "the host makes a room through createRoomFn");
    const joiners: [string, string][] = [[KID, "Kid"], [GONE, "Gone"], ...GUESTS.map((g, i): [string, string] => [g, `Guest${i + 1}`])];
    for (const [user, name] of joiners) {
      const joined = await callServerFn(duel.joinRoomFn, { roomCode, displayName: name, via: "code" }, userToken(user));
      check(joined?.ok !== false, `${name} joins through joinRoomFn`);
    }
    q(`UPDATE public.profiles SET deletion_requested_at = now() WHERE user_id = '${GONE}'`);
    check(q(`SELECT count(*) FROM public.duel_players WHERE duel_id = '${roomId}'`) === "10", "the room holds 10 players");
  });

  const seatOf = (user: string) => q(`SELECT id FROM public.duel_players WHERE duel_id = '${roomId}' AND user_id = '${user}'`);

  await section("one batched read", async () => {
    const before = rest.log.length;
    const cards = await callServerFn(cardsFns.roomCardsFn, { roomId }, userToken(GUESTS[0]!));
    const reqs = rest.log.slice(before).map((r) => `${r.method} ${r.path}`);
    const count = (re: RegExp) => reqs.filter((r) => re.test(r)).length;
    check(count(/economy_public_cards/) === 1, `one public-cards read for the room of 10, not one per player (${reqs.join(" | ")})`);
    check(count(/badge_public_cards/) === 1, "one card-badges read for the room");
    check(count(/\/profiles/) === 1, "one profiles read for the room");
    check(count(/\/duel_players/) === 1, "one seats read for the room");
    check(reqs.length <= 8, `the whole answer is a handful of reads (${reqs.length}), whatever the room's size`);
    const keys = Object.keys(cards ?? {});
    check(keys.length === 2 && keys.includes(seatOf(HOST)) && keys.includes(seatOf(KID)), `cards for the two visible accounts, keyed by seat (${keys.join()})`);
    const text = JSON.stringify(cards);
    check(![HOST, KID, GONE, ...GUESTS].some((u) => text.includes(u)), "no account id in the answer (cards are keyed by seat)");
    const host = cards[seatOf(HOST)];
    check(host?.card.cardArt === "card-art.grid" && host.card.frame === "frame.gold" && host.card.nameColour === "name-colour.gold-leaf" && host.card.badges.join() === "friendly" && host.playerNumber === 42, "the host's card: card art, frame, name colour, badges, player number");
    const kid = cards[seatOf(KID)];
    check(!!kid && kid.card.colour === 12, "inside their own room the under-18 is shown with their card (direct opponents)");
    check(!(seatOf(GONE) in cards) && GUESTS.every((g) => !(seatOf(g) in cards)), "guests and the account waiting for deletion have no card (their room colour and initial)");

    // Ten more seats would still be one read: a room of 16 (the cap) costs the same four reads.
    const out = await callServerFn(cardsFns.roomCardsFn, { roomId }, userToken(OUTSIDER));
    check(JSON.stringify(out) === "{}", "a caller with no seat in the room gets nothing");
    const late = await callServerFn(duel.joinRoomFn, { roomCode, displayName: "Late" }, userToken(LATE));
    check(late?.ok !== false, "an 11th player joins");
    const before2 = rest.log.length;
    const again = await callServerFn(cardsFns.roomCardsFn, { roomId }, userToken(LATE));
    check(rest.log.slice(before2).filter((r) => /economy_public_cards/.test(r.path)).length === 1 && Object.keys(again).length === 2, "after a join the room's cards are one read again, for the newcomer too");
  });

  await section("outside the room", async () => {
    const rows = [HOST, KID, GONE].map((userId) => ({ userId, name: "stored" }));
    const list = await platesFor(client, OUTSIDER, rows, NOW);
    check(list.get(KID)?.kind === "hidden" && JSON.stringify(list.get(KID)) === JSON.stringify({ kind: "hidden" }), "outside the room (a board) the under-18 is Hidden player, nothing of the account");
    check(list.get(GONE)?.kind === "hidden", "outside the room the account waiting for deletion is Hidden player");
    check(list.get(HOST)?.kind === "card", "an adult account keeps their card on a board");
    const room = await platesFor(client, OUTSIDER, rows, NOW, { audience: "room" });
    check(room.get(KID)?.kind === "card" && room.get(GONE)?.kind === "plain", "the room audience (used only for a seated caller) shows them as usual");
  });
}

/* ------------------------------------------------------------------ 2. the room screens, in happy-dom */

{
  const { Window } = await import("happy-dom");
  const win = new Window({ url: "https://joulz.uk/duel/ABCD", width: 390, height: 844 });
  for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "KeyboardEvent", "PointerEvent", "MouseEvent", "SVGElement", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame", "localStorage", "sessionStorage", "MutationObserver", "CustomEvent", "DOMParser"] as const) {
    const value = (win as unknown as Record<string, unknown>)[key];
    const bind = typeof value === "function" && !/^[A-Z]/.test(key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: bind ? (value as (...a: unknown[]) => unknown).bind(win) : value });
  }
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  const React = await import("react");
  const { act, useState } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const RP = await import("../src/components/duel/RoomPlayer");
  const { useRoomCards, setRoomCardsFetcher, resetRoomCards } = await import("../src/lib/identity/useRoomCards");
  const { Standings } = await import("../src/components/duel/Standings");
  const { RoundResultsTable } = await import("../src/components/duel/RoundResultsTable");
  const { Podium } = await import("../src/components/duel/Podium");
  type RoomCards = import("../src/lib/identity/roomCards").RoomCards;
  type Standing = import("../src/lib/duel/scoring").Standing;
  type PlayerLooks = import("../src/lib/duel/playerLook").PlayerLooks;

  const $$ = (root: ParentNode, sel: string) => [...root.querySelectorAll(sel)] as unknown as HTMLElement[];
  const settle = async (ms = 30) => act(async () => void (await new Promise((r) => setTimeout(r, ms))));

  const N = 10;
  const seats = Array.from({ length: N }, (_, i) => ({ id: `seat-${i + 1}`, player_slot: i + 1 }));
  const LONG = "Abcdefghijklmnop"; // 16 characters, the longest username
  const nameOf = (slot: number) => (slot === 1 ? LONG : slot === 2 ? "Kiddo" : `Guest${slot}`);
  const card = (colour: number, extra: Partial<import("../src/design/identity/nameplate").NameplateCard> = {}) => ({
    avatarId: "captain-joulz",
    colour,
    gem: null,
    cardArt: "card-art.joulz-navy",
    frame: "frame.plain",
    nameColour: null,
    badges: [],
    title: null,
    ...extra,
  });
  const CARDS: RoomCards = {
    "seat-1": { card: card(7, { cardArt: "card-art.grid", frame: "frame.gold", nameColour: "name-colour.gold-leaf", badges: ["friendly"], title: "rookie" }), playerNumber: 42, tier: "volt" },
    "seat-2": { card: card(12), playerNumber: 44, tier: null },
  };
  let fetches = 0;
  setRoomCardsFetcher(async () => {
    fetches++;
    return CARDS;
  });
  const looks: PlayerLooks = new Map(seats.map((s) => [s.player_slot, { colour: (s.player_slot - 1) % 10, icon: null }]));
  const rows: Standing[] = seats.map((s, i) => ({
    slot: s.player_slot,
    name: nameOf(s.player_slot),
    total: 900 - i * 50,
    roundScore: 150 - i * 10,
    position: i + 1,
    previousPosition: i + 1,
    status: "active",
    summary: "Solved",
    detail: [],
    roundCorrect: true,
  })) as unknown as Standing[];

  let setSeats: ((next: typeof seats) => void) | null = null;
  let setPhase: ((next: number) => void) | null = null;
  function Room({ screen }: { screen: (phase: number) => React.ReactNode }) {
    const [now, setNow] = useState(seats);
    const [phase, setP] = useState(0);
    setSeats = setNow;
    setPhase = setP;
    const cards = useRoomCards("room-1", now.map((s) => s.id));
    RP.usePublishRoomCards(cards, now);
    return React.createElement(React.Fragment, null, screen(phase));
  }
  async function mount(screen: (phase: number) => React.ReactNode) {
    const el = document.createElement("div") as unknown as HTMLElement;
    document.body.appendChild(el as unknown as Node);
    const root = createRoot(el as unknown as Element);
    await act(async () => root.render(React.createElement(RP.RoomCardsHost, null, React.createElement(Room, { screen }))));
    await settle(60);
    return { el, root };
  }

  await section("standings", async () => {
    resetRoomCards();
    fetches = 0;
    const { el, root } = await mount((phase) =>
      React.createElement(Standings, { round: 2 + phase, totalRounds: 6, rows, looks, mySlot: 3, autoSeconds: 10, continueState: { kind: "waiting" } as never }),
    );
    for (let i = 1; i <= 4; i++) {
      await act(async () => setPhase!(i));
      await settle();
    }
    check(fetches === 1, `one card fetch for the room across five renders and phase moves (${fetches})`);
    const items = $$(el, "ul.rs-list > li");
    check(items.length === N, `a full room of ${N}: every row drawn`);
    const strips = $$(el, "ul.rs-list > li [data-card-strip]");
    check(strips.length === 2, `the two accounts draw their card strip (${strips.length})`);
    const host = items[0]!;
    const hostStrip = host.querySelector("[data-card-strip]");
    check(hostStrip?.getAttribute("data-card-art") === "card-art.grid" && hostStrip.getAttribute("data-frame") === "frame.gold" && hostStrip.getAttribute("data-name-colour") === "name-colour.gold-leaf", "every cosmetic: card art, frame, name colour on the strip");
    check(!!host.querySelector("[data-card-tier='volt']") && !!host.querySelector("[data-card-badge='friendly']"), "the tier emblem and badges on the strip");
    check((host.querySelector("[data-card-name]")?.textContent ?? "") === LONG && host.querySelector("[data-card-name]")?.hasAttribute("data-ellipsis") === true, "a 16-character name, ellipsised when it must be");
    check(!!items[1]!.querySelector("[data-card-strip]"), "the under-18 is shown with their card inside the room");
    check(!el.textContent!.includes("Hidden player") && !el.querySelector("[data-hidden-player]"), "nobody is Hidden player inside their own room");
    const guest = items[4]!;
    check(guest.querySelector("[data-nameplate='plain'] [data-player-badge]")?.textContent === "G" && !guest.querySelector("[data-card-strip]"), "a guest keeps colour and initial");
    check(items.every((li) => [...li.querySelectorAll(".rs-total, [data-medal], .rs-move")].every((n) => !n.closest(".pcard-strip, .nameplate"))), "scores, places and arrows sit outside every strip");
    check(!el.querySelector("[data-card-sheet]"), "no card open before a tap");
    const open = host.querySelector("[data-open-card]") as HTMLElement | null;
    check(!!open && !guest.querySelector("[data-open-card]"), "an account row opens a card; a guest row opens nothing");
    await act(async () => open?.click());
    await settle();
    const sheet = document.querySelector("[data-card-sheet]");
    check(!!sheet && !!sheet.querySelector(".pcard:not(.pcard-strip)") && (sheet.textContent ?? "").includes(LONG), "a tap opens the full card (PlayerCard) in the shared sheet");
    await act(async () => root.unmount());
    el.remove();
    document.querySelectorAll("[data-card-sheet]").forEach((n) => n.remove());
  });

  await section("a join refetches", async () => {
    resetRoomCards();
    fetches = 0;
    const { el, root } = await mount(() =>
      React.createElement(RoundResultsTable, { roundTitle: ["Round 2", "Gemstone"], rows, looks, mySlot: 3, autoSeconds: 10, finalRound: false, continueState: { kind: "waiting" } as never, times: new Map(), clockMs: 90_000 }),
    );
    check(fetches === 1, "one fetch on the round leaderboard");
    check($$(el, "ol.rs-list > li [data-card-strip]").length === 2, "the round leaderboard draws the account strips");
    check($$(el, "ol.rs-list > li").every((li) => [...li.querySelectorAll(".rs-total")].every((n) => !n.closest(".pcard-strip, .nameplate"))), "round scores sit outside every strip");
    await act(async () => setSeats!([...seats, { id: "seat-11", player_slot: 11 }]));
    await settle(60);
    check(fetches === 2, `someone joining fetches the room's cards once more (${fetches})`);
    await act(async () => root.unmount());
    el.remove();
  });

  await section("podium", async () => {
    resetRoomCards();
    const { el, root } = await mount(() =>
      React.createElement(Podium, { rows, looks, mySlot: 3, results: [], roundOrder: [], isHost: false, busy: false, onPlayAgain: () => {} }),
    );
    const top = $$(el, "[data-podium-cards] > li");
    check(top.length === 3, "the podium's top three as cards");
    check(!!top[0]!.querySelector(".pcard:not(.pcard-strip):not(.pcard-mini)") && !!top[1]!.querySelector(".pcard:not(.pcard-strip):not(.pcard-mini)"), "the accounts on the podium are full cards (PlayerCard)");
    check(!!top[2]!.querySelector("[data-nameplate='plain']") && !top[2]!.querySelector("[data-open-card]"), "a guest on the podium keeps colour and initial, opening nothing");
    check(top.every((li) => !li.querySelector(".th-score, [data-medal]")), "no score or medal on a podium card");
    await act(async () => root.unmount());
    el.remove();
  });

  await section("chat mini card", async () => {
    resetRoomCards();
    const { el, root } = await mount(() =>
      React.createElement("div", null, React.createElement(RP.RoomMiniCard, { slot: 1, name: LONG, look: looks.get(1), size: 20 }), React.createElement(RP.RoomMiniCard, { slot: 5, name: "Guest5", look: looks.get(5), size: 20 })),
    );
    check(!!el.querySelector("[data-mini-card][data-card-art='card-art.grid']"), "an account's chat line draws their mini card");
    check(el.querySelectorAll("[data-player-badge]").length === 1, "a guest's chat line keeps colour and initial");
    await act(async () => root.unmount());
    el.remove();
  });

  setRoomCardsFetcher(null);
  check(consoleErrors.length === 0, `no React errors (${consoleErrors.slice(0, 2).join(" | ")})`);
}

/* ------------------------------------------------------------------ 3. statically */

{
  const read = (p: string) => readFileSync(p, "utf8");
  check(!existsSync("src/components/daily/DailyBoard.tsx"), "the old public Daily board component is gone");
  const dailyRoute = read("src/routes/daily.tsx");
  check(!/DailyBoard\b/.test(dailyRoute.replace(/DailyBoardView/g, "")) && /to: "\/daily-board"/.test(dailyRoute) && /onBoard=\{openTop100\}/.test(dailyRoute), "/daily and its results open the Daily top 100 (no old board)");
  check(/ownDailyLine\(await dailyBoard\(/.test(read("src/lib/duel/daily.functions.ts")), "the old board call answers only the caller's own line (ownDailyLine)");
  const { ownDailyLine } = await import("../src/lib/duel/daily");
  const line = ownDailyLine({ day: "2026-11-13", open: true, count: 30, rows: [{ rank: 1, name: "Kiddo", total: 900, colour: 1, icon: null, isMe: false }, { rank: 2, name: "Me", total: 800, colour: 2, icon: null, isMe: true }], me: { rank: 2, total: 800, rounds: [], finished: true, name: "Me" } } as never);
  check(line.rows.length === 1 && line.rows[0]!.name === "Me" && !JSON.stringify(line).includes("Kiddo"), "ownDailyLine drops every other player's row");
  // No badge, challenge or Joules rule reads the old board (server code or migrations).
  const ruleFiles = [
    ...["src/lib/badges", "src/lib/challenges", "src/lib/pass", "src/lib/rated", "src/lib/tournaments", "src/lib/seasons"].flatMap((dir) => (existsSync(dir) ? listFiles(dir) : [])),
    ...listFiles("supabase/migrations").filter((f) => /badge|pass|challenge|joules|season/i.test(f)),
  ];
  const readers = ruleFiles.filter((f) => /dailyBoardFn|\bdailyBoard\(|components\/daily\/DailyBoard/.test(read(f)));
  check(ruleFiles.length > 20 && readers.length === 0, `no badge, challenge or Joules rule reads the old Daily board (${readers.join() || `${ruleFiles.length} files`})`);
  const profile = read("src/routes/profile.tsx");
  check(!/LookPicker|aria-label="Your look"/.test(profile) && /data-look-moved/.test(profile) && /\/customise/.test(profile), "Profile has no look picker and points to Customise");
  check(/data-look-toggle/.test(read("src/components/duel/RoomLobby.tsx")) && /rememberLook\(look\)/.test(read("src/lib/duel/api.ts")), "a guest still picks their colour in the lobby, remembered for the next room");
  check(/rememberedLook\(\)\.colour/.test(read("src/components/account/SignUpFlow.tsx")), "sign-up starts from the guest's remembered colour (it carries into the loadout)");
  check(/look: rememberedLook\(\)/.test(read("src/lib/duel/api.ts")), "every room still seats a device on its remembered look (nobody's look changes)");
  const server = read("src/lib/identity/roomCards.server.ts");
  check((server.match(/\.user_id\b/g) ?? []).length === 2 && /export function cardIdOf/.test(server), "the room's card reads take ids from seats through one helper (cardIdOf; the other read is the caller's seat check)");
  for (const file of ["Standings", "DuelOverall", "RoomPanel", "RoomChat", "PodiumAwards", "RoundResult", "RoundResultsTable", "AnswerReveal"])
    check(!/import \{ PlayerBadge \}/.test(read(`src/components/duel/${file}.tsx`)), `${file} draws players only through the shared pieces`);
}

function listFiles(dir: string): string[] {
  const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = `${dir}/${name}`;
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else if (/\.(ts|tsx|sql)$/.test(name)) out.push(p);
  }
  return out;
}

/* ------------------------------------------------------------------ 4. LiveTag contrast */

{
  const tokens = readFileSync("src/design/tokens.css", "utf8");
  const hex = (name: string) => tokens.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))?.[1] ?? "";
  const lum = (h: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x! + 0.05) / (y! + 0.05);
  };
  const css = readFileSync("src/design/components.css", "utf8");
  const live = css.slice(css.indexOf(".jz-live {"), css.indexOf("}", css.indexOf(".jz-live {")));
  const fg = live.match(/\bcolor:\s*var\(--([a-z0-9-]+)\)/)?.[1] ?? "";
  const r = ratio(hex(fg), hex("jz-red"));
  check(!!hex(fg) && r >= 4.5, `the LiveTag's text on its red is at least 4.5:1 (${fg} ${r.toFixed(2)}:1)`);
  check(!/\.jz-live\s*\{[^}]*color:\s*var\(--jz-(text|white)\)/.test(css), "the LiveTag is never white text on its red");
}

console.error = origError;
console.log = quietLog;
if (failures.length) {
  console.log(`FAIL: ${failures.length} of ${passes + failures.length} checks failed`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`PASS: identity-everywhere-check, ${passes} checks`);
