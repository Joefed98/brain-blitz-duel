/**
 * tournament-plates-check (wave 4, W4b; Joe's rule of 11 Nov 2026: a player's card, avatar and frame show wherever they
 * appear). Proves the tournament boards' nameplates:
 *
 *  1. On a real database (scripts/server-fn-harness.ts, every migration applied): platesFor draws an account from its
 *     own public card (card art, frame, avatar, colour, name colour, badges, title), a guest as colour and initial, an
 *     under-18 as "Hidden player" on a plain neutral disc to everyone but themselves (Joe, 12 Nov 2026: no initial, no
 *     colour, nothing of the account in the answer); a failed age read hides everyone else (fails closed); the Arena and Score Attack boards carry every
 *     row's plate in the board's own answer (one call per page), the pinned row included; the duel opponent too.
 *  2. The emblem: W3a's shown tier mapped to the Emblem (Top 500 as Lightning with its number), none in placement.
 *  3. In happy-dom: the strip draws the card art band, the frame, the avatar, the name colour, the emblem and the badges
 *     inside the name area only, never round a place or a score; guests get a colour-and-initial disc, hidden players a
 *     plain neutral disc with nothing to open, both with no cosmetics; a tap opens an account's or guest's card (PlayerCard) in a sheet; a re-render leaves the DOM unchanged.
 *  4. Statically: the board screens draw every row through TournamentPlate and fetch nothing more for it; the plate
 *     builder reads W3a's tiers only (never records or finishes a rated match).
 */
import { readFileSync } from "node:fs";

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
    check(a.kind === "card" && a.name === "Ana_Gold", "an account is drawn under its username from its own card (never the row's stored name)");
    if (a.kind === "card") {
      check(a.look.cardArt === "card-art.grid" && a.look.frame === "frame.gold" && a.look.nameColour === "name-colour.gold-leaf", "the account's equipped card art, frame and name colour");
      check(a.look.colour === 7 && typeof a.look.avatarId === "string" && a.look.avatarId.length > 0 && a.look.playerNumber === 42, "its avatar, colour and player number");
      check(a.look.badges.join() === "friendly" && a.look.title === "Rookie", "its card badges and title (C2's card)");
      check(a.look.emblem === null, "no emblem before a rated match (W3a's tier hides placement)");
    }
    const p = got.get(PLAIN)!;
    check(p.kind === "card" && p.look.cardArt === "card-art.joulz-navy" && p.look.frame === "frame.plain" && p.look.nameColour === null && p.look.badges.length === 0, "a new account: the default card art and frame, plain name, no badges");
    const k = got.get(KID)!;
    check(k.kind === "hidden" && k.name === HIDDEN_PLAYER_NAME, "an under-18 seen by another: Hidden player");
    check(JSON.stringify(k) === JSON.stringify({ kind: "hidden", name: HIDDEN_PLAYER_NAME }) && JSON.stringify(k) === JSON.stringify(plates.HIDDEN_PLATE), "a hidden player's plate is exactly { kind, name }: no username, initial, colour, cosmetics or badges (Joe, 12 Nov 2026)");
    const g = got.get(GUEST)!;
    check(g.kind === "guest" && g.name === "Gus" && g.colour === 9 && plates.plateInitial(g) === "G", "a guest: their room name on colour and initial");
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
    check(got.get(ADULT)!.kind === "hidden" && got.get(KID)!.kind === "hidden" && got.get(VIEW)!.kind === "card", "a failed age read hides every other player (the viewer keeps their card)");
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
    check(!!board && board.rows.length === 3 && board.rows.every((r) => r.plate && r.name === r.plate.name), "every Arena row carries its plate in the board's own answer");
    const kidRow = board?.rows.find((r) => r.userId === KID);
    check(kidRow?.plate.kind === "hidden" && kidRow.name === HIDDEN_PLAYER_NAME && !JSON.stringify(board).includes("Kiddo"), "the Arena board never sends a hidden player's username");
    check(JSON.stringify(kidRow?.plate) === JSON.stringify(plates.HIDDEN_PLATE), "the Arena board's hidden row carries no initial or colour");
    check(board?.me?.plate.kind === "card" && board.me.plate.name === "Viewer", "the pinned row is the viewer's own card");
    const viaFn = await callServerFn(fns.arenaBoardFn, { eventId: arenaId }, userToken(VIEW));
    check(!!viaFn && Array.isArray(viaFn.rows) && viaFn.rows.every((r: { plate?: unknown }) => !!r.plate), "arenaBoardFn (the page's one call) answers with the plates");
  });
}

/* ------------------------------------------------------------------ 2. the emblem */

await section("emblem", async () => {
  check(plates.plateEmblemOf(null) === null, "no tier: no emblem");
  const volt = plates.plateEmblemOf({ tier: "volt", division: "II", rank: null, label: "Volt II" });
  check(volt?.tier === "volt" && volt.division === 2 && volt.label === "Volt II", "a tier and division map to the Emblem (II is two diamonds)");
  const top = plates.plateEmblemOf({ tier: "top500", division: null, rank: 37, label: "Top 500 #37" });
  check(top?.tier === "lightning" && top.rank === 37 && top.division === undefined, "Top 500 is the Lightning shield with its number");
  check(plates.plateEmblemOf({ tier: "nonsense", division: null, rank: null, label: "x" }) === null, "an unknown tier draws no emblem");
});

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
const { TournamentPlate } = await import("../src/components/tournaments/TournamentPlate");
type PlateView = import("../src/lib/identity/plates").PlateView;

const CARD: PlateView = {
  kind: "card",
  name: "Ana_Gold",
  look: {
    avatarId: "captain-joulz",
    colour: 7,
    gem: null,
    cardArt: "card-art.grid",
    frame: "frame.gold",
    nameColour: "name-colour.gold-leaf",
    playerNumber: 42,
    title: "Rookie",
    badges: ["friendly"],
    emblem: { tier: "volt", division: 2, label: "Volt II" },
  },
};
const GUEST_PLATE: PlateView = { kind: "guest", name: "Gus", colour: 9 };
const HIDDEN: PlateView = plates.HIDDEN_PLATE;

const host = document.createElement("div");
document.body.appendChild(host as unknown as Node);
const root = createRoot(host as unknown as HTMLElement);
const Row = ({ plate, you = false }: { plate: PlateView; you?: boolean }) =>
  React.createElement(
    "li",
    { "data-row": "" },
    React.createElement("span", { className: "tn-place" }, "1"),
    React.createElement("span", { className: "jz-row-text" }, React.createElement(TournamentPlate, { plate, you })),
    React.createElement("span", { className: "tn-points" }, "6"),
  );
const draw = async (els: React.ReactElement) => act(async () => root.render(els));
const $ = (sel: string) => document.querySelector(sel) as unknown as HTMLElement | null;

await section("strip", async () => {
  await draw(React.createElement("ol", null, React.createElement(Row, { plate: CARD, you: true })));
  const plate = $("[data-tn-plate='card']");
  const area = plate?.querySelector("[data-plate-area]") as HTMLElement | null;
  check(!!plate && plate.tagName === "BUTTON", "the strip is a button (a tap opens the card)");
  check(!!area?.querySelector("[data-plate-band]") && plate?.getAttribute("data-card-art") === "card-art.grid" && plate?.getAttribute("data-frame") === "frame.gold", "the card art band with the frame over it, from the plate");
  check(!!area?.querySelector("[data-plate-avatar='captain-joulz'] svg"), "the avatar inside the name area");
  check(area?.querySelector("[data-plate-name]")?.getAttribute("data-name-colour") === "name-colour.gold-leaf" && area?.textContent?.includes("Ana_Gold") === true, "the username in its name colour");
  check(!!area?.querySelector("[data-jz='emblem'][data-tier='volt']"), "the rated emblem inside the name area");
  check(area?.querySelector("[data-plate-badges]")?.getAttribute("data-plate-badges") === "friendly", "the card's badges inside the name area");
  const li = $("[data-row]")!;
  const place = li.querySelector(".tn-place")!;
  const points = li.querySelector(".tn-points")!;
  check(!area?.contains(place as Node) && !area?.contains(points as Node) && !place.querySelector("svg, img") && !points.querySelector("svg, img"), "the place and the score sit outside the name area, with no cosmetics behind them");
  check(document.querySelectorAll("svg").length === [...document.querySelectorAll("svg")].filter((s) => area?.contains(s as unknown as Node)).length, "every drawn piece of art is inside the name area");
  check(plate?.textContent?.includes("(you)") === true, "the viewer's own row says (you)");
  const before = host.innerHTML;
  await draw(React.createElement("ol", null, React.createElement(Row, { plate: CARD, you: true })));
  check(host.innerHTML === before, "an unchanged re-render leaves the DOM as it was (working rule 6)");
  await act(async () => void plate?.click());
  const sheet = document.querySelector("[data-plate-card='card']");
  const full = sheet?.querySelector("[data-player-card]");
  check(!!full && full.getAttribute("data-frame") === "frame.gold" && full.getAttribute("data-card-art") === "card-art.grid" && full.getAttribute("data-name-colour") === "name-colour.gold-leaf", "a tap opens the player's full card in a sheet");
  check(!!full?.querySelector("[data-card-badge='friendly']") && full?.querySelector("[data-card-title]")?.textContent === "Rookie", "the full card has their badges and title");
  await draw(React.createElement("ol", null));
});

await section("a hidden under-18", async () => {
  await draw(React.createElement("ol", null, React.createElement(Row, { plate: HIDDEN })));
  const el = $("[data-tn-plate='hidden']")!;
  const disc = el.querySelector("[data-plate-hidden]") as HTMLElement | null;
  check(!!disc && (disc.textContent ?? "") === "" && !disc.getAttribute("style") && !el.querySelector("[data-plate-initial]"), "a hidden under-18: a plain neutral disc, no initial and no colour");
  check(!el.querySelector("svg") && !el.querySelector("img") && !el.querySelector("[data-jz='emblem']") && !el.getAttribute("data-frame"), "a hidden under-18: no card art, frame, avatar, emblem or badges");
  check(el.textContent === HIDDEN_PLAYER_NAME, "a hidden under-18 shows Hidden player");
  check(el.tagName !== "BUTTON" && !el.querySelector("button"), "a hidden player's strip opens nothing (no card to show)");
  await act(async () => void el.click());
  check(!document.querySelector("[data-plate-card]"), "a tap on a hidden player opens no card");
  await draw(React.createElement("ol", null));
});

for (const [label, plate, initial, colour] of [["a guest", GUEST_PLATE, "G", 9]] as const) {
  await section(label, async () => {
    await draw(React.createElement("ol", null, React.createElement(Row, { plate })));
    const el = $(`[data-tn-plate='${plate.kind}']`)!;
    const disc = el.querySelector("[data-plate-initial]") as HTMLElement | null;
    check(disc?.textContent === initial && (disc?.getAttribute("style") ?? "").includes(`--jz-player-${colour}`), `${label} keeps colour and initial`);
    check(!el.querySelector("svg") && !el.querySelector("img") && !el.querySelector("[data-jz='emblem']") && !el.getAttribute("data-frame"), `${label}: no card art, frame, avatar, emblem or badges`);
    check(el.textContent?.includes(plate.name) === true, `${label} shows ${plate.name}`);
    await act(async () => void el.click());
    const full = document.querySelector(`[data-plate-card='${plate.kind}'] [data-player-card]`);
    check(full?.getAttribute("data-avatar") === "initial" && full?.getAttribute("data-frame") === "frame.plain", `${label}'s card: the plain guest card with the initial`);
    await draw(React.createElement("ol", null));
  });
}

/* ------------------------------------------------------------------ 4. statically */

await section("wiring", async () => {
  const screen = readFileSync("src/components/tournaments/TournamentEvent.tsx", "utf8");
  check((screen.match(/<TournamentPlate plate=\{r\.plate\}/g) ?? []).length === 2 && !/jz-row-title">\{r\.isMe \? "You" : r\.name\}/.test(screen), "both boards draw every row through TournamentPlate");
  const strip = readFileSync("src/components/tournaments/TournamentPlate.tsx", "utf8");
  check(!/tournamentsBackend|getPublicCard|cardBadgesFn|createServerFn|\.functions"/.test(strip), "the strip fetches nothing: its plate comes with the board (one call per page)");
  const builder = readFileSync("src/lib/identity/plates.server.ts", "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  check(/shownTiersFor/.test(builder) && !/recordRatedMatch|finishRatedMatch|rewards\.server|insert|update|upsert|delete\(/i.test(builder), "the plate builder only reads W3a's tiers (never records or finishes a rated match, writes nothing)");
  check(/publicCardsFor\(client, ids\)/.test(builder) && /cardBadgesFor\(client, ids\)/.test(builder) && !/readPublicCards|readBadgePublicCards/.test(builder), "the plates are built on #385's publicCardsFor and C2's cardBadgesFor (the one way every row in the app reads a player)");
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
