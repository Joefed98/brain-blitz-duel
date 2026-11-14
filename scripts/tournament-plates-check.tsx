/**
 * tournament-plates-check (wave 4, W4b; Joe's rule of 11 Nov 2026: a player's card, avatar and frame show wherever they
 * appear). Proves the tournament boards' nameplates:
 *
 *  1. On a real database (scripts/server-fn-harness.ts, every migration applied): platesFor draws an account from its
 *     own public card (card art, frame, avatar, colour, name colour, badges, title), a guest as colour and initial, an
 *     under-18 as "Hidden player" on a plain neutral disc to everyone but themselves (Joe, 12 Nov 2026: no initial, no
 *     colour, nothing of the account in the answer); a failed age read hides everyone else (fails closed); the Arena and Score Attack boards carry every
 *     row's plate in the board's own answer (one call per page), the pinned row included; the duel opponent too.
 *  2. The emblem: the plate carries W3a's shown tier id (none in placement), and the shared strip draws it.
 *  3. In happy-dom, on the real board rows (TournamentEvent's PlateRow): the shared NameplateStrip (W4a, @/design/identity;
 *     docs/nameplate.md) draws the card art band, the frame, the avatar, the name colour, the emblem and the badges
 *     inside the name area only, never round a place or a score; guests get a colour-and-initial disc, hidden players a
 *     plain neutral disc, both with no cosmetics and nothing to open (the shared rule: only a card opens); a tap opens an
 *     account's full card (PlayerCard) in the shared sheet; a re-render leaves the DOM unchanged.
 *  4. Statically: the board screens draw every row through the shared NameplateStrip (TournamentPlate is gone) and fetch
 *     nothing more for it; the plate builder is the shared nameplatesFor plus one profile read and W3a's tiers (never
 *     records or finishes a rated match).
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
  if (/^\s*(FAIL|NOTE)|^tournament-plates-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};

const plates = await import("../src/lib/identity/plates");
const { HIDDEN_PLAYER_NAME } = plates;

/* ------------------------------------------------------------------ 1. on a real database */

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ADULT = uid(1); // cosmetics, badges
const PLAIN = uid(2); // a new account: the default card
const KID = uid(3); // 15 today
const GUEST = uid(4); // no profile
const VIEW = uid(5); // the viewer

if (!postgresBin()) {
  if (process.env["CI"]) check(false, "no PostgreSQL binaries on the CI runner");
  else quietLog("  NOTE no PostgreSQL binaries found: the database part didn't run (CI runs it)");
} else {
  let db: LocalDb | null = null;
  let rest: RestServer | null = null;
  try {
    db = startLocalDb("tournament-plates-check-");
    check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
    rest = await startRestServer(db.socketDir);
    process.env["SUPABASE_URL"] = rest.url;
    process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
    await installServerFnPlugin();
    await runDb(db);
  } catch (err) {
    check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await rest?.stop();
    db?.stop();
  }
}

async function runDb(db: LocalDb): Promise<void> {
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };
  // Changed with Joe's approval, 14 Nov 2026 (Security C3: tournament rows and the Arena opponent name players by public id).
  const pub = (account: string): string => q(`SELECT public.public_id_of('${account}')`);
  const { platesFor } = await import("../src/lib/identity/plates.server");
  const server = await import("../src/lib/tournaments/tournaments.server");
  const fns = await import("../src/lib/tournaments/tournaments.functions");
  const { adminDb } = await import("../src/lib/data/db.server");
  const { setRatingsBackend } = await import("../src/lib/rated/ratingsAdapter.server");
  const rules = await import("../src/lib/tournaments/rules");
  const client = await adminDb();
  setRatingsBackend({
    matchRating: async () => ({ rating: 1500, placement: false }),
    recordRatedMatch: async () => {
      throw new Error("plates must never record a rated match");
    },
    startingRating: 1500,
    beginnerMax: 1500,
  });

  const kidBorn = new Date(Date.now() - 15 * 365.25 * 86_400_000).toISOString().slice(0, 10);
  q(`INSERT INTO auth.users (id) VALUES ${[ADULT, PLAIN, KID, GUEST, VIEW].map((u) => `('${u}')`).join(", ")}`);
  q(`SET session_replication_role = replica; INSERT INTO public.profiles (user_id, username, username_key, colour, date_of_birth, player_number) VALUES
    ('${ADULT}', 'Ana_Gold', 'ana_gold', 7, DATE '1990-01-01', 42),
    ('${PLAIN}', 'Plainer', 'plainer', 3, DATE '1991-01-01', 43),
    ('${KID}', 'Kiddo', 'kiddo', 12, DATE '${kidBorn}', 44),
    ('${VIEW}', 'Viewer', 'viewer', 5, DATE '1992-01-01', 45)`);
  q(`INSERT INTO shop.testers (user_id, note) SELECT u, 'plates-check' FROM unnest(ARRAY['${ADULT}','${PLAIN}','${KID}','${VIEW}']::uuid[]) u ON CONFLICT DO NOTHING`);
  for (const [item, slot] of [["card-art.grid", "card-art"], ["frame.gold", "frame"], ["name-colour.gold-leaf", "name-colour"]] as const) {
    q(`SELECT public.economy_grant_item('${ADULT}', '${item}', 'grant')`);
    check(q(`SELECT public.economy_equip('${ADULT}', '${slot}', '${item}')`) === "equipped", `the check's account equips ${item}`);
  }
  q(`SELECT public.badge_award('${ADULT}', 'friendly', '{}'::jsonb)`);
  q(`SELECT public.badge_set_card('${ADULT}', ARRAY['friendly'])`);

  const now = Date.now();
  const rows = [
    { userId: ADULT, name: "stale" },
    { userId: PLAIN, name: "stale" },
    { userId: KID, name: "Kiddo" },
    { userId: GUEST, name: "Gus", colour: 9 },
    { userId: VIEW, name: "stale" },
  ];

  await section("plates", async () => {
    const got = await platesFor(client, VIEW, rows, now);
    const a = got.get(ADULT)!;
    check(a.kind === "card" && a.name === "Ana_Gold", "an account is drawn under its username from its own profile (never the row's stored name)");
    if (a.kind === "card") {
      check(a.card.cardArt === "card-art.grid" && a.card.frame === "frame.gold" && a.card.nameColour === "name-colour.gold-leaf", "the account's equipped card art, frame and name colour");
      check(a.card.colour === 7 && typeof a.card.avatarId === "string" && a.card.avatarId.length > 0 && a.playerNumber === 42, "its avatar, colour and player number");
      check(a.card.badges.join() === "friendly" && a.card.title === "rookie", "its card badges and title (C2's card; the sheet writes the title's name)");
      check((a.tier ?? null) === null, "no emblem before a rated match (W3a's tier hides placement)");
    }
    const p = got.get(PLAIN)!;
    check(p.kind === "card" && p.card.cardArt === "card-art.joulz-navy" && p.card.frame === "frame.plain" && p.card.nameColour === null && p.card.badges.length === 0, "a new account: the default card art and frame, plain name, no badges");
    const k = got.get(KID)!;
    check(k.kind === "hidden" && plates.plateName(k) === HIDDEN_PLAYER_NAME, "an under-18 seen by another: Hidden player");
    check(JSON.stringify(k) === JSON.stringify({ kind: "hidden" }) && JSON.stringify(k) === JSON.stringify(plates.HIDDEN_PLATE), "a hidden player's plate is exactly { kind }: no username, initial, colour, cosmetics or badges (Joe, 12 Nov 2026)");
    const g = got.get(GUEST)!;
    check(g.kind === "plain" && g.name === "Gus" && g.colour === 9, "a guest: their room name on colour and initial");
    const self = (await platesFor(client, KID, rows, now)).get(KID)!;
    check(self.kind === "card" && self.name === "Kiddo", "an under-18 sees their own card");
  });

  await section("fails closed", async () => {
    const broken = {
      ...client,
      from: (t: string) => (t === "profiles" ? { select: () => ({ in: async () => ({ data: null, error: { message: "down" } }) }) } : client.from(t as never)),
      rpc: client.rpc.bind(client),
    } as unknown as typeof client;
    const got = await platesFor(broken, VIEW, rows, now);
    check(got.get(ADULT)!.kind === "hidden" && got.get(KID)!.kind === "hidden" && got.get(VIEW)!.kind !== "hidden", "a failed age read hides every other player (the viewer keeps their own row)");
    const noCards = {
      ...client,
      from: (t: string) => client.from(t as never),
      rpc: (fn: string, ...rest: unknown[]) => (fn === "economy_public_cards" ? Promise.resolve({ data: null, error: { message: "down" } }) : (client.rpc as (...a: unknown[]) => unknown)(fn, ...rest)),
    } as unknown as typeof client;
    const plain = await platesFor(noCards, VIEW, rows, now);
    const ana = plain.get(ADULT)!;
    check(ana.kind === "plain" && ana.name === "Ana_Gold" && ana.colour === null && plain.get(KID)!.kind === "hidden", "a failed card read: the username on a plain disc, no cosmetics; hidden players stay hidden");
  });

  await section("boards", async () => {
    const day = "2026-12-04";
    const arenaId = `arena:${day}:1300`;
    const ev = rules.scheduledEvent(arenaId)!;
    await server.ensureEvent(client, arenaId);
    for (const u of [ADULT, KID, VIEW]) {
      q(`INSERT INTO public.tournament_entries (event_id, user_id, entry) VALUES ('${arenaId}', '${u}', 'free') ON CONFLICT DO NOTHING`);
    }
    q(`INSERT INTO public.tournament_arena_players (event_id, user_id, points, wins, streak, played) VALUES
      ('${arenaId}', '${ADULT}', 6, 3, 3, 3), ('${arenaId}', '${KID}', 4, 2, 0, 3), ('${arenaId}', '${VIEW}', 2, 1, 0, 2)
      ON CONFLICT DO NOTHING`);
    const at = ev.startsAt + 60_000;
    const board = await server.arenaBoard(client, VIEW, arenaId, at);
    check(!!board && board.rows.length === 3 && board.rows.every((r) => r.plate && r.name === plates.plateName(r.plate)), "every Arena row carries its plate in the board's own answer");
    const kidRow = board?.rows.find((r) => r.playerId === pub(KID));
    check(kidRow?.plate.kind === "hidden" && kidRow.name === HIDDEN_PLAYER_NAME && !JSON.stringify(board).includes("Kiddo"), "the Arena board never sends a hidden player's username");
    check(JSON.stringify(kidRow?.plate) === JSON.stringify(plates.HIDDEN_PLATE), "the Arena board's hidden row carries no initial or colour");
    check(board?.me?.plate.kind === "card" && board.me.plate.name === "Viewer", "the pinned row is the viewer's own card");
    const viaFn = await callServerFn(fns.arenaBoardFn, { eventId: arenaId }, userToken(VIEW));
    check(!!viaFn && Array.isArray(viaFn.rows) && viaFn.rows.every((r: { plate?: unknown }) => !!r.plate), "arenaBoardFn (the page's one call) answers with the plates");
  });
}

/* ------------------------------------------------------------------ 2. the emblem (drawn in section 3) */

/* ------------------------------------------------------------------ 3. the strip in happy-dom */

const { Window } = await import("happy-dom");
const win = new Window({ url: "https://joulz.uk/", width: 390, height: 844 });
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "KeyboardEvent", "PointerEvent", "MouseEvent", "HTMLButtonElement", "HTMLAnchorElement", "HTMLInputElement", "SVGElement", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame", "localStorage", "sessionStorage", "MutationObserver", "CustomEvent", "location", "history", "scrollTo", "DOMParser", "InputEvent"] as const) {
  const value = (win as unknown as Record<string, unknown>)[key];
  const bind = typeof value === "function" && !/^[A-Z]/.test(key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: bind ? (value as (...a: unknown[]) => unknown).bind(win) : value });
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
(win as unknown as { ResizeObserver: unknown }).ResizeObserver = (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { PlateRow } = await import("../src/components/tournaments/TournamentEvent");
const { NameplateSheet, useNameplateSheet } = await import("../src/design/identity");
type PlateView = import("../src/lib/identity/plates").PlateView;

const CARD: PlateView = {
  kind: "card",
  name: "Ana_Gold",
  card: {
    avatarId: "captain-joulz",
    colour: 7,
    gem: null,
    cardArt: "card-art.grid",
    frame: "frame.gold",
    nameColour: "name-colour.gold-leaf",
    title: "rookie",
    badges: ["friendly"],
  },
  playerNumber: 42,
  tier: "volt",
};
const TOP: PlateView = { ...CARD, tier: "top500" } as PlateView;
const GUEST_PLATE: PlateView = { kind: "plain", name: "Gus", colour: 9 };
const HIDDEN: PlateView = plates.HIDDEN_PLATE;

const host = document.createElement("div");
document.body.appendChild(host as unknown as Node);
const root = createRoot(host as unknown as HTMLElement);
type OpenRow = { plate: PlateView; line: string };
/** The board as TournamentEvent draws it: the row, and the shared sheet it opens. */
function Board({ plate, you = false }: { plate: PlateView; you?: boolean }) {
  const [open, openRow, close] = useNameplateSheet<OpenRow>();
  return React.createElement(
    React.Fragment,
    null,
    React.createElement("ol", null, React.createElement(PlateRow, { place: 1, plate, isMe: you, sub: "3 wins", value: "6", valueLabel: "6 points", onOpen: openRow, data: { "data-arena-row": 1 } })),
    React.createElement(NameplateSheet, { player: open?.plate ?? null, onClose: close }, open?.line),
  );
}
const draw = async (els: React.ReactElement) => act(async () => root.render(els));
const $ = (sel: string) => document.querySelector(sel) as unknown as HTMLElement | null;

await section("strip", async () => {
  await draw(React.createElement(Board, { plate: CARD, you: true }));
  const li = $("[data-arena-row]")!;
  const button = li.querySelector("button[data-open-card]") as HTMLElement | null;
  const area = li.querySelector("[data-nameplate='card'] [data-card-strip]") as HTMLElement | null;
  check(!!button && !!area && button.contains(area as Node), "the row opens the card (a button round the shared strip, never the strip itself)");
  check(!!area?.querySelector(".pcard-svg") && area?.getAttribute("data-card-art") === "card-art.grid" && area?.getAttribute("data-frame") === "frame.gold", "the card art band with the frame over it, from the plate");
  check(area?.getAttribute("data-avatar") === "captain-joulz" && !!area?.querySelector(".pcard-av svg"), "the avatar inside the name area");
  check(area?.getAttribute("data-name-colour") === "name-colour.gold-leaf" && area?.querySelector("[data-card-name]")?.textContent === "Ana_Gold (you)", "the username in its name colour, the viewer's own row saying (you)");
  check(!!area?.querySelector("[data-card-tier='volt'] [data-jz='emblem']"), "the rated emblem inside the name area");
  check(area?.querySelector("[data-card-badges]")?.getAttribute("data-card-badges") === "friendly", "the card's badges inside the name area");
  const place = li.querySelector(".tn-place")!;
  const points = li.querySelector(".tn-points")!;
  check(!area?.contains(place as Node) && !area?.contains(points as Node) && !place.querySelector("svg, img") && !points.querySelector("svg, img"), "the place and the score sit outside the name area, with no cosmetics behind them");
  check(document.querySelectorAll("svg").length === [...document.querySelectorAll("svg")].filter((x) => area?.contains(x as unknown as Node)).length, "every drawn piece of art is inside the name area");
  const before = host.innerHTML;
  await draw(React.createElement(Board, { plate: CARD, you: true }));
  check(host.innerHTML === before, "an unchanged re-render leaves the DOM as it was (working rule 6)");
  await act(async () => void button?.click());
  const full = document.querySelector("[data-card-sheet] [data-player-card]");
  check(!!full && full.getAttribute("data-frame") === "frame.gold" && full.getAttribute("data-card-art") === "card-art.grid" && full.getAttribute("data-name-colour") === "name-colour.gold-leaf", "a tap opens the player's full card in a sheet");
  check(!!full?.querySelector("[data-card-badge='friendly']") && full?.querySelector("[data-card-title]")?.textContent === "Rookie", "the full card has their badges and title");
  check(document.querySelector("[data-card-sheet] .nameplate-sheet-line")?.textContent === "1st · 6 points", "the sheet's line is the row's place and points");
  await draw(React.createElement("ol", null));
  await draw(React.createElement(Board, { plate: TOP }));
  check(!!$("[data-card-tier='top500']"), "a Top 500 player's strip draws the Top 500 emblem");
  await draw(React.createElement("ol", null));
});

await section("a hidden under-18", async () => {
  await draw(React.createElement(Board, { plate: HIDDEN }));
  const li = $("[data-arena-row]")!;
  const el = li.querySelector("[data-nameplate='hidden']") as HTMLElement;
  const disc = el.querySelector("[data-hidden-disc]") as HTMLElement | null;
  check(!!disc && (disc.textContent ?? "") === "" && !disc.getAttribute("style") && !el.querySelector("[data-initial], [data-player-badge]"), "a hidden under-18: a plain neutral disc, no initial and no colour");
  check(!el.querySelector("svg") && !el.querySelector("img") && !el.querySelector("[data-jz='emblem']") && !el.querySelector("[data-frame]"), "a hidden under-18: no card art, frame, avatar, emblem or badges");
  check(el.textContent === HIDDEN_PLAYER_NAME && li.hasAttribute("data-hidden-player"), "a hidden under-18 shows Hidden player");
  check(!li.querySelector("button"), "a hidden player's row opens nothing (no card to show)");
  await act(async () => void (li as HTMLElement).click());
  check(!document.querySelector("[data-card-sheet]"), "a tap on a hidden player opens no card");
  await draw(React.createElement("ol", null));
});

await section("a guest", async () => {
  await draw(React.createElement(Board, { plate: GUEST_PLATE }));
  const li = $("[data-arena-row]")!;
  const el = li.querySelector("[data-nameplate='plain']") as HTMLElement;
  check(el.querySelector("[data-player-badge]")?.getAttribute("data-player-badge") === "9", "a guest keeps colour and initial");
  check(!el.querySelector("[data-card-strip]") && !el.querySelector("img") && !el.querySelector("[data-jz='emblem']") && !el.querySelector("[data-frame]"), "a guest: no card art, frame, avatar, emblem or badges");
  check(el.textContent?.includes("Gus") === true, "a guest shows Gus");
  check(!li.querySelector("button"), "a guest's row opens nothing (the shared nameplate rule: only a card opens)");
  await draw(React.createElement("ol", null));
});

/* ------------------------------------------------------------------ 4. statically */

await section("wiring", async () => {
  const screen = readFileSync("src/components/tournaments/TournamentEvent.tsx", "utf8");
  check((screen.match(/<PlateRow\b/g) ?? []).length === 2 && (screen.match(/plate=\{r\.plate\}/g) ?? []).length === 2 && /<NameplateStrip player=\{plate\}/.test(screen) && !/jz-row-title">\{r\.isMe \? "You" : r\.name\}/.test(screen), "both boards draw every row through the shared NameplateStrip");
  check(!existsSync("src/components/tournaments/TournamentPlate.tsx") && !/TournamentPlate|tn-plate/.test(screen + readFileSync("src/polish-layout/tournaments.css", "utf8")), "TournamentPlate and its styles are gone (one strip in the app)");
  check(!/tournamentsBackend\(\)\.then\(\(b\) => b\?\.(publicCard|cardBadges)|getPublicCard|cardBadgesFn/.test(screen), "the rows fetch nothing: their plates come with the board (one call per page)");
  const builder = readFileSync("src/lib/identity/plates.server.ts", "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  check(/shownTiersFor/.test(builder) && !/recordRatedMatch|finishRatedMatch|rewards\.server|insert|update|upsert|delete\(/i.test(builder), "the plate builder only reads W3a's tiers (never records or finishes a rated match, writes nothing)");
  check(/nameplatesFor\(client, ids\)/.test(builder) && !/publicCardsFor|cardBadgesFor|readPublicCards|readBadgePublicCards/.test(builder), "the plates are built on the shared nameplatesFor (#385's publicCardsFor and C2's cardBadgesFor; docs/nameplate.md)");
  const server = readFileSync("src/lib/tournaments/tournaments.server.ts", "utf8");
  check(/platesFor\(\s*client,\s*userId,/.test(server) && /scoreAttackRows\(client, userId/.test(server) && /opponentOf\(client, userId, other\)/.test(server), "the Arena board, the Score Attack board and the duel opponent all go through platesFor");
});

console.log = quietLog;
console.log(`tournament-plates-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: every board row draws its player's card strip; guests keep colour and initial, hidden under-18s a plain disc.");
process.exit(0);
