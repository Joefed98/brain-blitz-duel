/**
 * share-check (21 Oct 2026, presentation and beta recording only): sharing a room's result from its
 * final screen (src/lib/share/, src/components/share/, supabase/migrations/20261021120000).
 *
 *  1. Text and link: "I came 2nd in a 6-round {APP_NAME} room – 612 pts. Play: <link>"; the link is
 *     always the room's own (/duel/CODE?ref=share), and where it leads is decided when it's opened:
 *     the lobby's join while a newcomer can join (lobby, not disbanded, a seat free), else a
 *     redirect to the home (/?ref=share&room=CODE) and its welcome card, never "This game has
 *     finished". In Chromium the same link opened while the room is finished (or full) reaches the
 *     home and the card; opened after Play again, the lobby's join and no card. No place
 *     ("I played …") after leaving.
 *  2. No answer content: a room whose answers, extras and puzzles carry a marker shares nothing of
 *     it — not in the share data, and not in any text the card draws (the real card drawn on
 *     @napi-rs/canvas, every fillText captured), which carries the app name, place, total, the top
 *     three, the round games and the room code.
 *  3. shareResult(): the share sheet gets the title and the text with the link (never also `url`),
 *     the PNG attached only where files can be shared; a cancel is "cancelled" (nothing copied); no
 *     share sheet, or one that refuses, copies the text and link ("copied").
 *  4. The ref recorded: an arrival from ?ref=share is sent once per device (room or home landing),
 *     its first finished room once; a plain visit sends nothing; the server's row keeps only
 *     well-formed values (shareEventRow) and a failed write never throws; the migration creates
 *     share_events with RLS on and no client grants, and isn't needed for the app to work.
 *  5. Wiring: the podium and the two-player result pass the room's Share button, the root route
 *     counts arrivals, and the share code takes the app's name only from APP_NAME.
 *  6. In headless Chromium (the real room route, scripts/safe-area-harness.tsx), podium (10 players)
 *     and final results (2 players) at 414×896 as an iPhone 11 home-screen app: Share is beside Play
 *     again, the skin's teal button, uppercase, one line, ≥ 44 px; with no share sheet a tap copies
 *     the exact text and link and shows "Copied"; with a share sheet a tap shares the text and a
 *     1080×1350 PNG; every tap is recorded with the room and place.
 *
 *   bun scripts/share-check.ts [--shots=<dir>]   (saves the podium screenshots and the card)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createCanvas } from "@napi-rs/canvas";

import { APP_NAME } from "../src/lib/brand";
import { CARD_H, CARD_W, drawResultCard } from "../src/lib/share/resultCard";
import { roomShareData, roomShareLine, roomShareLink } from "../src/lib/share/roomShare";
import { shareResult, shareText } from "../src/lib/share/shareResult";
import {
  noteShareArrival,
  noteShareFinish,
  noteShareWelcome,
  resetShareArrivalMemory,
  noteShareLobbyArrival,
  shareHomeSearch,
  shareLinkJoinable,
  shareWelcomeDue,
} from "../src/lib/share/shareRef";
import { nextPublicLabel } from "../src/lib/share/welcome";
import type { ShareEventInput } from "../src/lib/duel/share.functions";
import { recordShareEvent, shareEventRow } from "../src/lib/duel/betaRecord.server";
import type { DuelPlayerRow, DuelRow, RoundResultRow } from "../src/lib/duel/types";

const args = process.argv.slice(2);
const SHOTS = args.find((a) => a.startsWith("--shots="))?.slice(8);
const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}

/* ------------------------------------------------------------ a finished room */

const SECRET = "ZZSECRETANSWERZZ";
const DUEL_ID = "6f1c2a4e-0b7d-4c3e-9a51-2d8e7f0a1b23";
const ORDER = ["sudoku", "matchup", "tilegrid", "flood", "reaction", "hover"] as const;
function room(
  opts: {
    hostLeft?: boolean;
    disbanded?: boolean;
    meLeft?: boolean;
    status?: string;
    maxPlayers?: number;
  } = {},
) {
  const names = ["Ali", "Jo", "Sam", "Priya", "Kai", "Morgan"];
  const players = names.map(
    (name, i) =>
      ({
        id: `p${i + 1}`,
        duel_id: DUEL_ID,
        player_slot: i + 1,
        display_name: name,
        user_id: `u${i + 1}`,
        status: (i === 0 && opts.hostLeft) || (i === 1 && opts.meLeft) ? "left" : "active",
        ready_round: 6,
        intro_ready_round: 6,
        muted_by_host: false,
        last_reaction_at: null,
        last_seen_at: "2026-10-21T12:00:00Z",
        joined_at: "2026-10-21T11:50:00Z",
      }) as unknown as DuelPlayerRow,
  );
  // Totals over six rounds: Ali 700, Jo 612, Sam 540, Priya 420, Kai 300, Morgan 180.
  const totals = [700, 612, 540, 420, 300, 180];
  const results: RoundResultRow[] = players.flatMap((p, i) =>
    ORDER.map(
      (_, r) =>
        ({
          id: `r${i}-${r}`,
          duel_id: DUEL_ID,
          player_slot: p.player_slot,
          round_number: r + 1,
          score: r === 0 ? totals[i]! - 5 * Math.floor(totals[i]! / 6) : Math.floor(totals[i]! / 6),
          is_correct: true,
          ms_remaining: 1000,
          submitted_at: "2026-10-21T12:00:00Z",
          answer: `${SECRET}-answer`,
          reaction_avg_ms: null,
          correct_count: null,
          errors: null,
          extra: { secret: SECRET, moves: [SECRET] },
        }) as unknown as RoundResultRow,
    ),
  );
  const duel = {
    id: DUEL_ID,
    room_code: "ABCD",
    status: opts.status ?? "finished",
    phase: "result",
    host_user_id: "u1",
    max_players: opts.maxPlayers ?? 10,
    disbanded_at: opts.disbanded ? "2026-10-21T12:01:00Z" : null,
    round_count: 6,
    round_order: [...ORDER],
    puzzles_public: ORDER.map((type) => ({ type, board: SECRET, solution: SECRET })),
    tournament_history: [],
    current_round: 6,
  } as unknown as DuelRow;
  return { duel, players, results, me: players[1]! };
}

/* ------------------------------------------------------------ 1. text and link */

const ORIGIN = "https://brain-blitz-duel.lovable.app";
const ROOM_LINK = `${ORIGIN}/duel/ABCD?ref=share`;
// The link is always the room's: where it leads is decided when it's opened (below, and in Chromium).
const finished = roomShareData({ ...room(), origin: ORIGIN });
check(
  finished.place === 2 && finished.total === 612 && finished.rounds === 6 && finished.players === 6,
  `place/total/rounds/players ${finished.place}/${finished.total}/${finished.rounds}/${finished.players}`,
);
const expected = `I came 2nd in a 6-round ${APP_NAME} room – 612 pts. Play: ${ROOM_LINK}`;
check(
  shareText(finished.lines, finished.link) === expected,
  `finished room: "${shareText(finished.lines, finished.link)}"`,
);
const hostLeft = roomShareData({ ...room({ hostLeft: true }), origin: ORIGIN });
check(
  shareText(hostLeft.lines, hostLeft.link) ===
    `I came 1st in a 6-round ${APP_NAME} room – 612 pts. Play: ${ROOM_LINK}`,
  `host left (Jo now first): "${shareText(hostLeft.lines, hostLeft.link)}"`,
);
for (const opts of [{ disbanded: true }, { status: "in_progress" }, { status: "waiting" }])
  check(
    roomShareData({ ...room(opts), origin: ORIGIN }).link === ROOM_LINK,
    `the link depends on the room's state when shared (${JSON.stringify(opts)})`,
  );
const lobby = roomShareData({ ...room({ status: "waiting" }), origin: ORIGIN });
// When it's opened: the lobby with a seat free → the lobby; anything else → the home and its card.
const preview = (state: string, playerCount = 3, maxPlayers = 10) =>
  ({ found: true, roomCode: "ABCD", state, playerCount, maxPlayers }) as const;
check(shareLinkJoinable(preview("lobby")), "an open lobby's link doesn't lead to the lobby");
check(
  !shareLinkJoinable(preview("finished")),
  'a finished room\'s link leads to the room ("This game has finished")',
);
check(!shareLinkJoinable(preview("playing")), "a started game's link leads to the room");
check(!shareLinkJoinable(preview("disbanded")), "a disbanded room's link leads to the room");
check(!shareLinkJoinable(preview("lobby", 10, 10)), "a full lobby's link leads to the room");
check(!shareLinkJoinable({ found: false }), "a missing room's link leads to the room");
check(
  JSON.stringify(shareHomeSearch("abcd")) === JSON.stringify({ ref: "share", room: "ABCD" }),
  `redirect query ${JSON.stringify(shareHomeSearch("abcd"))}`,
);
check(
  roomShareLink(`${ORIGIN}/`, "WXYZ") === `${ORIGIN}/duel/WXYZ?ref=share`,
  "a trailing slash on the origin doubles the slash",
);
check(
  roomShareLine(null, 7, 90) === `I played a 7-round ${APP_NAME} room – 90 pts.`,
  `no place: "${roomShareLine(null, 7, 90)}"`,
);
check(roomShareLine(11, 6, 1) === `I came 11th in a 6-round ${APP_NAME} room – 1 pts.`, "11th");
const meLeft = roomShareData({ ...room({ meLeft: true }), origin: ORIGIN });
check(
  meLeft.place === null && meLeft.lines[0]!.startsWith("I played"),
  `left before the end: "${meLeft.lines[0]}"`,
);
check(
  finished.top.map((t) => `${t.place}:${t.name}:${t.total}`).join(",") ===
    "1:Ali:700,2:Jo:612,3:Sam:540",
  `top three ${JSON.stringify(finished.top)}`,
);
check(finished.games.join(",") === ORDER.join(","), "card games are not the round order");

/* ------------------------------------------------------------ 2. no answer content */

check(
  ![finished, lobby].some((d) => JSON.stringify(d).includes(SECRET)),
  "the share data carries answer or puzzle content",
);
const drawn: string[] = [];
const canvas = createCanvas(CARD_W, CARD_H);
const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
const realFill = ctx.fillText.bind(ctx);
ctx.fillText = ((text: string, x: number, y: number) => {
  drawn.push(String(text));
  realFill(text, x, y);
}) as typeof ctx.fillText;
let drawError = "";
try {
  drawResultCard(ctx, finished);
} catch (error) {
  drawError = String(error);
}
check(!drawError, `the card fails to draw: ${drawError}`);
const all = drawn.join(" | ");
check(!all.includes(SECRET), "the card draws answer or puzzle content");
check(
  all.includes(APP_NAME.slice(0, -1)) && all.includes(APP_NAME.slice(-1)),
  `the card lacks the app name: ${all}`,
);
check(
  drawn.includes("2ND") && drawn.includes("612 pts"),
  `the card lacks the place or total: ${all}`,
);
check(
  ["Ali", "Jo", "Sam"].every((n) => drawn.includes(n)) && !drawn.includes("Priya"),
  `the card's top three: ${all}`,
);
check(drawn.includes("ROOM ABCD"), `the card lacks the room code: ${all}`);
const png = canvas.toBuffer("image/png");
check(png.length > 10_000, "the card is blank");
if (SHOTS) {
  mkdirSync(SHOTS, { recursive: true });
  writeFileSync(join(SHOTS, "card-node-canvas.png"), png);
}

/* ------------------------------------------------------------ 3. shareResult */

const file = new File([new Uint8Array([1, 2, 3])], "card.png", { type: "image/png" });
{
  const shared: ShareData[] = [];
  const outcome = await shareResult(
    { title: "T", lines: ["Line one"], link: "https://x.test/?ref=share", image: file },
    {
      share: async (d: ShareData) => void shared.push(d),
      canShare: () => true,
      clipboard: undefined as never,
    },
  );
  check(outcome === "shared", `share sheet outcome ${outcome}`);
  check(
    shared[0]?.text === "Line one Play: https://x.test/?ref=share" && shared[0]?.title === "T",
    `share sheet text ${JSON.stringify(shared[0])}`,
  );
  check(
    !("url" in (shared[0] ?? {})),
    "the link is also sent as url (some targets would show it twice)",
  );
  check(shared[0]?.files?.[0] === file, "the image is not attached where files can be shared");
}
{
  const shared: ShareData[] = [];
  await shareResult(
    { title: "T", lines: ["L"], link: "https://x.test", image: file },
    {
      share: async (d: ShareData) => void shared.push(d),
      canShare: () => false,
      clipboard: undefined as never,
    },
  );
  check(
    shared.length === 1 && !shared[0]!.files,
    "the image is attached where files can't be shared",
  );
}
{
  let copied = "";
  const outcome = await shareResult(
    { title: "T", lines: ["L"], link: "https://x.test" },
    {
      share: async () => Promise.reject(Object.assign(new Error("x"), { name: "AbortError" })),
      clipboard: { writeText: async (t: string) => void (copied = t) } as never,
    },
  );
  check(outcome === "cancelled" && copied === "", `cancel: ${outcome}, copied "${copied}"`);
}
for (const nav of ["none", "refused"] as const) {
  let copied = "";
  const outcome = await shareResult(
    { title: "T", lines: ["I came 2nd."], link: "https://x.test/duel/ABCD?ref=share" },
    {
      ...(nav === "refused"
        ? {
            share: async () =>
              Promise.reject(Object.assign(new Error("x"), { name: "NotAllowedError" })),
          }
        : {}),
      clipboard: { writeText: async (t: string) => void (copied = t) } as never,
    },
  );
  check(
    outcome === "copied" && copied === "I came 2nd. Play: https://x.test/duel/ABCD?ref=share",
    `clipboard fallback (${nav}): ${outcome}, "${copied}"`,
  );
}

/* ------------------------------------------------------------ 4. the ref recorded */

{
  const sent: ShareEventInput[] = [];
  const record = (e: ShareEventInput) => void sent.push(e);
  resetShareArrivalMemory();
  check(
    !noteShareArrival({ search: "", pathname: "/" }, record) && sent.length === 0,
    "a plain visit was recorded",
  );
  check(
    !noteShareFinish(finished, record) && sent.length === 0,
    "a finish without a shared-link arrival was recorded",
  );
  check(
    !noteShareArrival({ search: "?ref=share", pathname: "/duel/abcd" }, record) &&
      sent.length === 0,
    "a room link's arrival was counted before the room decided where it leads",
  );
  check(
    noteShareLobbyArrival("abcd", record),
    "an arrival from a shared room link opened in its lobby was not recorded",
  );
  check(
    sent[0]?.event === "arrival" && sent[0].landing === "room" && sent[0].roomCode === "ABCD",
    `arrival ${JSON.stringify(sent[0])}`,
  );
  check(
    !noteShareArrival({ search: "?ref=share", pathname: "/" }, record) && sent.length === 1,
    "a second arrival on the same device was recorded",
  );
  check(
    noteShareFinish(finished, record) &&
      sent[1]?.event === "arrival_finished" &&
      sent[1].duelId === DUEL_ID &&
      sent[1].place === 2,
    `finish ${JSON.stringify(sent[1])}`,
  );
  check(!noteShareFinish(finished, record) && sent.length === 2, "a second finish was recorded");
  resetShareArrivalMemory();
  // Memory only here (no window): forgetting it is a fresh device.
  const home: ShareEventInput[] = [];
  noteShareArrival({ search: "?ref=share&room=abcd", pathname: "/" }, (e) => void home.push(e));
  check(
    home[0]?.landing === "home" && home[0].roomCode === "ABCD",
    `redirected home arrival ${JSON.stringify(home[0])}`,
  );
  resetShareArrivalMemory();
  const bare: ShareEventInput[] = [];
  noteShareArrival({ search: "?ref=share&room=x'", pathname: "/" }, (e) => void bare.push(e));
  check(bare[0]?.roomCode === null, `a malformed room code kept: ${JSON.stringify(bare[0])}`);
}
{
  const tap = shareEventRow("user-1", {
    event: "share_tap",
    duelId: DUEL_ID,
    gameIndex: 0,
    roomCode: "ABCD",
    place: 2,
    players: 6,
    rounds: 6,
    method: "copy",
  });
  check(
    JSON.stringify(tap) ===
      JSON.stringify({
        user_id: "user-1",
        event: "share_tap",
        duel_id: DUEL_ID,
        game_index: 0,
        room_code: "ABCD",
        place: 2,
        players: 6,
        rounds: 6,
        method: "copy",
        landing: null,
        welcome: null,
      }),
    `tap row ${JSON.stringify(tap)}`,
  );
  const bad = shareEventRow("user-1", {
    event: "share_tap",
    duelId: "not-a-uuid",
    place: 99,
    players: 0,
    roomCode: "abcd'; drop",
    method: "sms",
  });
  check(
    !!bad &&
      bad.duel_id === null &&
      bad.place === null &&
      bad.players === null &&
      bad.room_code === null &&
      bad.method === null,
    `malformed values kept: ${JSON.stringify(bad)}`,
  );
  check(shareEventRow("user-1", { event: "answer" }) === null, "an unknown event made a row");
  const arrival = shareEventRow("user-1", {
    event: "arrival",
    landing: "room",
    roomCode: "ABCD",
    place: 1,
    duelId: DUEL_ID,
  });
  check(
    arrival?.landing === "room" && arrival.place === null && arrival.duel_id === null,
    `arrival row ${JSON.stringify(arrival)}`,
  );
  const inserted: { table: string; row: unknown }[] = [];
  await recordShareEvent(
    {
      from: (table: string) => ({
        insert: async (row: unknown) => (inserted.push({ table, row }), { error: null }),
      }),
    },
    tap!,
  );
  check(
    inserted[0]?.table === "share_events" && inserted[0].row === tap,
    "the row is not written to share_events",
  );
  const warn = console.warn;
  console.warn = () => undefined;
  let threw = false;
  try {
    await recordShareEvent(
      {
        from: () => ({
          insert: async () => ({
            error: { code: "42P01", message: 'relation "share_events" does not exist' },
          }),
        }),
      },
      tap!,
    );
    await recordShareEvent(
      {
        from: () => {
          throw new Error("down");
        },
      },
      tap!,
    );
  } catch {
    threw = true;
  }
  console.warn = warn;
  check(!threw, "a failed write (migration not applied) throws");
}
{
  const sql = readFileSync("supabase/migrations/20261021120000_beta_share_events.sql", "utf8");
  check(
    /CREATE TABLE IF NOT EXISTS public\.share_events/.test(sql),
    "the migration doesn't create share_events",
  );
  check(
    /ENABLE ROW LEVEL SECURITY/.test(sql) &&
      /REVOKE ALL ON public\.share_events FROM PUBLIC, anon, authenticated/.test(sql) &&
      !/CREATE POLICY/i.test(sql),
    "share_events is readable or writable by clients",
  );
  for (const column of [
    "user_id",
    "event",
    "duel_id",
    "game_index",
    "room_code",
    "place",
    "players",
    "rounds",
    "method",
    "landing",
    "welcome",
  ])
    check(new RegExp(`\\n  ${column} `).test(sql), `the migration lacks the ${column} column`);
  check(
    /share_events_welcome_once[\s\S]*\(user_id, welcome\) WHERE event = 'arrival_welcome'/.test(
      sql,
    ) && /'arrival_welcome'\)\)/.test(sql),
    "arrival_welcome is not in the migration as one row per device and value",
  );
  check(
    /share_events_arrival_once[\s\S]*WHERE event = 'arrival'/.test(sql),
    "an arrival is not one row per device",
  );
  const types = readFileSync("src/integrations/supabase/types.ts", "utf8");
  check(
    !types.includes("share_events"),
    "generated types name share_events (only Lovable regenerates them, after applying)",
  );
}

/* ------------------------------------------------------------ 4b. the welcome card's rule */

{
  const sent: ShareEventInput[] = [];
  const record = (e: ShareEventInput) => void sent.push(e);
  // A finished room's share links the home: that arrival is due the card, once.
  resetShareArrivalMemory();
  check(
    shareWelcomeDue({ search: "?ref=share", pathname: "/" }, record),
    "a home arrival is not shown the welcome",
  );
  check(
    sent.length === 1 && sent[0]?.event === "arrival",
    `the welcome didn't count the arrival first: ${JSON.stringify(sent)}`,
  );
  check(
    noteShareWelcome("shown", record) && !noteShareWelcome("shown", record),
    "the card's showing is not counted once",
  );
  check(
    shareWelcomeDue({ search: "?ref=share", pathname: "/" }, record),
    "the card is gone before it was closed on the arrival's visit",
  );
  check(
    noteShareWelcome("practice", record) && !noteShareWelcome("dismissed", record),
    "the card's close is not counted once",
  );
  check(
    !shareWelcomeDue({ search: "?ref=share", pathname: "/" }, record),
    "the card shows again after it was closed",
  );
  check(
    JSON.stringify(sent.slice(1)) ===
      JSON.stringify([
        { event: "arrival_welcome", welcome: "shown" },
        { event: "arrival_welcome", welcome: "practice" },
      ]),
    `welcome events ${JSON.stringify(sent.slice(1))}`,
  );
  // A later page load (the arrival already stored) never shows it again: the browser part reloads.
  // An open lobby's share lands a newcomer in the room: no card (the lobby is the welcome).
  resetShareArrivalMemory();
  const lobbyEvents: ShareEventInput[] = [];
  noteShareLobbyArrival("ABCD", (e) => void lobbyEvents.push(e));
  check(
    !shareWelcomeDue({ search: "?ref=share", pathname: "/" }, (e) => void lobbyEvents.push(e)),
    "a room-lobby arrival is due the welcome card when it goes home",
  );
  check(
    lobbyEvents.length === 1 && lobbyEvents[0]?.landing === "room",
    `room arrival ${JSON.stringify(lobbyEvents)}`,
  );
  resetShareArrivalMemory();
  check(
    !shareWelcomeDue({ search: "", pathname: "/" }, () => undefined),
    "a plain visit is due the welcome card",
  );
  resetShareArrivalMemory();
  const game = {
    startsAt: Date.UTC(2026, 9, 24, 18, 0),
    lobbyAt: 0,
    date: "2026-10-24",
    time: "19:00",
    lobbyOpens: "18:45",
    rounds: 6,
    roomCode: "PLAY",
  };
  const label = nextPublicLabel(game as never, Date.UTC(2026, 9, 21, 12));
  check(/^NEXT PUBLIC GAME: SAT 24 OCT 7:00 PM$/.test(label), `public game button "${label}"`);
  const row = shareEventRow("user-1", {
    event: "arrival_welcome",
    welcome: "public",
    duelId: DUEL_ID,
    roomCode: "ABCD",
    place: 1,
  });
  check(
    row?.welcome === "public" &&
      row.duel_id === null &&
      row.room_code === null &&
      row.place === null,
    `welcome row ${JSON.stringify(row)}`,
  );
  check(
    shareEventRow("user-1", { event: "arrival_welcome", welcome: "clicked" }) === null,
    "a malformed welcome made a row",
  );
  check(
    shareEventRow("user-1", { event: "share_tap", welcome: "shown" })?.welcome === null,
    "a tap row kept a welcome",
  );
}

/* ------------------------------------------------------------ 5. wiring */

{
  const route = readFileSync("src/routes/duel.$code.tsx", "utf8");
  check(
    (
      route.match(
        /share=\{<RoomShareButton duel=\{duel\} players=\{players\} results=\{results\} me=\{me\} \/>\}/g,
      ) ?? []
    ).length === 2,
    "the podium and the two-player result don't both pass the Share button",
  );
  const root = readFileSync("src/routes/__root.tsx", "utf8");
  check(/noteShareArrival\(window\.location\)/.test(root), "the root route doesn't count arrivals");
  const home = readFileSync("src/routes/index.tsx", "utf8");
  check(
    home.indexOf("<ShareWelcomeCard") > 0 &&
      home.indexOf("<ShareWelcomeCard") < home.indexOf("Play live with friends"),
    "the Play tab doesn't show the welcome card at its top",
  );
  check(
    !/ShareWelcomeCard/.test(route),
    "the room route shows the welcome card (the lobby is the welcome)",
  );
  check(
    /isShareRef\(window\.location\.search\)\) markOnboardingSeen\(\)/.test(home),
    "a shared-link arrival still gets the first-time intro over the welcome card",
  );
  for (const f of ["src/components/duel/Podium.tsx", "src/components/duel/FinalResult.tsx"])
    check(/\{share\}/.test(readFileSync(f, "utf8")), `${f} doesn't draw the Share button`);
  for (const f of [
    "src/lib/share/shareResult.ts",
    "src/lib/share/roomShare.ts",
    "src/lib/share/resultCard.ts",
    "src/lib/share/shareRef.ts",
    "src/components/share/ShareResultButton.tsx",
    "src/components/share/ShareWelcomeCard.tsx",
    "src/lib/share/welcome.ts",
  ])
    check(
      !readFileSync(f, "utf8").includes(`"${APP_NAME}"`) &&
        !/["'`]Duelz["'`\s]/.test(
          readFileSync(f, "utf8").replace(/duelz-share-arrival|"Duelz Mono"/g, ""),
        ),
      `${f} spells the app's name instead of APP_NAME`,
    );
}

/* ------------------------------------------------------------ 6. the real screens in Chromium */

const CHROMIUM = [
  process.env.PLAYWRIGHT_CHROMIUM,
  "/opt/pw-browsers/chromium",
  "/usr/bin/chromium",
].find((p): p is string => !!p && existsSync(p));
if (!CHROMIUM) failures.push("environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
else {
  const { startSafeAreaServer } = await import("./safe-area-server");
  const { IPHONE11_APP } = await import("./device-emulation");
  const { THEME_SCREENS, openThemeScreen } = await import("./theme-screens");
  const server = await startSafeAreaServer({
    cacheDir: "node_modules/.vite-share",
    buildId: "share-check",
  });
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const viewport = {
    name: "414x896 home-screen app",
    w: IPHONE11_APP.w,
    h: IPHONE11_APP.h,
    app: true,
  };
  try {
    for (const [name, label] of [
      ["podium, 10 players", "podium"],
      ["final results, 2 players", "final"],
    ] as const) {
      const screen = THEME_SCREENS.find((s) => s.name === name)!;
      for (const mode of ["copy", "native"] as const) {
        const where = `${label} (${mode})`;
        const { context, page } = await openThemeScreen(
          browser,
          server.origin,
          screen,
          viewport,
          async (ctx) => {
            await ctx.addInitScript((m) => {
              const w = window as unknown as { __copied: string[]; __shared: unknown[] };
              w.__copied = [];
              w.__shared = [];
              Object.defineProperty(navigator, "clipboard", {
                configurable: true,
                value: { writeText: async (t: string) => void w.__copied.push(t) },
              });
              if (m === "copy") {
                Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
                Object.defineProperty(navigator, "canShare", {
                  configurable: true,
                  value: undefined,
                });
              } else {
                Object.defineProperty(navigator, "canShare", {
                  configurable: true,
                  value: (d: ShareData) => !!d,
                });
                Object.defineProperty(navigator, "share", {
                  configurable: true,
                  value: async (d: ShareData) => {
                    const files = await Promise.all(
                      [...(d.files ?? [])].map(
                        (f) =>
                          new Promise<{ name: string; type: string; url: string }>((resolve) => {
                            const r = new FileReader();
                            r.onload = () =>
                              resolve({ name: f.name, type: f.type, url: String(r.result) });
                            r.readAsDataURL(f);
                          }),
                      ),
                    );
                    w.__shared.push({ title: d.title, text: d.text, url: d.url, files });
                  },
                });
              }
            }, mode);
          },
        );
        try {
          const button = page.locator("[data-share-button]");
          check((await button.count()) === 1, `${where}: no Share button`);
          if ((await button.count()) !== 1) continue;
          const geo = await page.evaluate(() => {
            const b = document.querySelector("[data-share-button]") as HTMLElement;
            const again = [...document.querySelectorAll("button")].find((x) =>
              /play again/i.test(x.textContent ?? ""),
            );
            const r = b.getBoundingClientRect();
            const a = again?.getBoundingClientRect();
            const cs = getComputedStyle(b);
            const label = b.querySelector("span")!;
            const range = document.createRange();
            range.selectNodeContents(label);
            const lines = new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size;
            return {
              h: r.height,
              w: r.width,
              top: r.top,
              bottom: r.bottom,
              againTop: a?.top ?? null,
              againRight: a?.right ?? null,
              left: r.left,
              cls: b.className,
              transform: cs.textTransform,
              lines,
              text: b.textContent,
              vh: window.innerHeight,
              overflow: label.scrollWidth > label.clientWidth + 0.5,
            };
          });
          check(geo.h >= 44 && geo.w >= 44, `${where}: Share is ${geo.w}×${geo.h} px`);
          check(
            geo.againTop !== null &&
              Math.abs(geo.againTop - geo.top) < 1 &&
              geo.left >= (geo.againRight ?? 0),
            `${where}: Share is not beside Play again (${geo.againTop} vs ${geo.top})`,
          );
          check(
            /\bth-btn-teal\b/.test(geo.cls) && geo.transform === "uppercase",
            `${where}: Share is not the skin's uppercase teal button`,
          );
          check(
            geo.lines === 1 && !geo.overflow && geo.text === "Share",
            `${where}: Share label "${geo.text}" wraps or overflows`,
          );
          check(
            geo.bottom <= geo.vh,
            `${where}: Share is below the screen (${geo.bottom} > ${geo.vh})`,
          );
          if (SHOTS && mode === "copy")
            await page.screenshot({ path: join(SHOTS, `${label}-414x896.png`) });
          if (mode === "native")
            await page
              .waitForSelector("[data-share-image=ready]", { timeout: 20_000 })
              .catch(() => undefined);
          await button.click();
          await page.waitForTimeout(400);
          const out = await page.evaluate(() => {
            const w = window as unknown as {
              __copied: string[];
              __shared: {
                text: string;
                url?: string;
                files: { name: string; type: string; url: string }[];
              }[];
              __harness: { shareEvents?: Record<string, unknown>[] };
            };
            return {
              copied: w.__copied,
              shared: w.__shared,
              events: w.__harness.shareEvents ?? [],
              label: document.querySelector("[data-share-button]")?.textContent,
            };
          });
          // The harness's device is slot 1, the host and top scorer.
          const text = `I came 1st in a 6-round ${APP_NAME} room – `;
          // Always the room's own link; where it leads is decided when it's opened.
          const link = `${server.origin}/duel/SAFE?ref=share`;
          if (mode === "copy") {
            check(
              out.copied.length === 1 &&
                out.copied[0]!.startsWith(text) &&
                out.copied[0]!.endsWith(` pts. Play: ${link}`),
              `${where}: copied ${JSON.stringify(out.copied)}`,
            );
            check(
              out.label === "Copied",
              `${where}: the button shows "${out.label}" after copying`,
            );
            if (SHOTS) await page.screenshot({ path: join(SHOTS, `${label}-414x896-copied.png`) });
          } else {
            const s = out.shared[0];
            check(
              out.shared.length === 1 &&
                !!s &&
                s.text.startsWith(text) &&
                s.text.endsWith(` pts. Play: ${link}`) &&
                s.url === undefined,
              `${where}: shared ${JSON.stringify(s?.text)}`,
            );
            check(out.copied.length === 0, `${where}: copied as well as shared`);
            const card = s?.files?.[0];
            check(
              !!card && card.type === "image/png" && card.name.endsWith(".png"),
              `${where}: no PNG attached`,
            );
            if (card) {
              const bytes = Buffer.from(card.url.split(",")[1]!, "base64");
              const w = bytes.readUInt32BE(16);
              const h = bytes.readUInt32BE(20);
              check(w === CARD_W && h === CARD_H, `${where}: card is ${w}×${h}`);
              if (SHOTS) writeFileSync(join(SHOTS, `card-${label}.png`), bytes);
            }
          }
          const tap = out.events.find((e) => e["event"] === "share_tap");
          check(
            !!tap &&
              tap["duelId"] === "duel-theme" &&
              tap["roomCode"] === "SAFE" &&
              tap["place"] === 1 &&
              tap["method"] === mode,
            `${where}: share tap recorded as ${JSON.stringify(out.events)}`,
          );
        } finally {
          await context.close();
        }
      }
    }

    // The welcome card: a finished room's share links the home, so its newcomer lands there.
    type Ev = Record<string, unknown>;
    const events = (page: import("playwright").Page) =>
      page.evaluate(
        () =>
          (window as unknown as { __harness: { shareEvents?: Ev[] } }).__harness.shareEvents ?? [],
      );
    const welcomeEvents = (list: Ev[]) =>
      list.filter((e) => e["event"] === "arrival_welcome").map((e) => e["welcome"]);
    const probeCard = (page: import("playwright").Page) =>
      page.evaluate(() => {
        const card = document.querySelector("[data-share-welcome]") as HTMLElement | null;
        if (!card) return null;
        const h1 = [...document.querySelectorAll("h1")].find((h) =>
          /play live with friends/i.test(h.textContent ?? ""),
        );
        const lines = (el: Element) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return new Set(
            [...range.getClientRects()].filter((r) => r.width > 0.5).map((r) => Math.round(r.top)),
          ).size;
        };
        const items = [...card.querySelectorAll("h2, p, p > span, button")].map((el) => {
          const r = el.getBoundingClientRect();
          const h = el as HTMLElement;
          return {
            text: h.innerText.trim(),
            label: h.getAttribute("aria-label"),
            tag: el.tagName,
            cls: h.className,
            w: r.width,
            h: r.height,
            lines: lines(el),
            overflow: h.scrollWidth > h.clientWidth + 0.5,
            right: r.right,
          };
        });
        return {
          cls: card.className,
          top: card.getBoundingClientRect().top,
          h1Top: h1?.getBoundingClientRect().top ?? -1,
          items,
          vw: window.innerWidth,
          onboarding: !!document.querySelector("[data-onboarding]"),
        };
      });
    const judgeCard = (
      where: string,
      probe: Awaited<ReturnType<typeof probeCard>>,
      publicGame: boolean,
    ) => {
      check(!!probe, `${where}: no welcome card for a home arrival from a shared link`);
      if (!probe) return;
      check(
        probe.top < probe.h1Top,
        `${where}: the welcome card is not at the top of the Play tab`,
      );
      const heading = probe.items.find((i) => i.tag === "H2");
      check(
        heading?.text === `YOUR FRIEND PLAYED ${APP_NAME.toUpperCase()}`,
        `${where}: heading "${heading?.text}"`,
      );
      const line = probe.items.find((i) => i.tag === "P");
      check(
        line?.text.replace(/\s+/g, " ") ===
          "Quick multiplayer puzzle and arcade games. No sign-up.",
        `${where}: line "${line?.text}"`,
      );
      const buttons = probe.items.filter((i) => i.tag === "BUTTON");
      const practice = buttons.find((b) => b.text === "TRY A PRACTICE GAME");
      const pub = buttons.find((b) => b.text.startsWith("NEXT PUBLIC GAME: "));
      check(
        !!practice && /\bth-btn-gold\b/.test(practice.cls),
        `${where}: no gold TRY A PRACTICE GAME button`,
      );
      check(
        publicGame ? !!pub && /\bth-btn-teal\b/.test(pub.cls) : !pub,
        `${where}: public game button ${pub?.text ?? "missing"} (scheduled: ${publicGame})`,
      );
      check(!!buttons.find((b) => b.label === "Dismiss"), `${where}: no dismiss button`);
      check(/\bth-card\b/.test(probe.cls), `${where}: not a th-card`);
      for (const i of probe.items) {
        if (i.tag === "BUTTON")
          check(
            i.w >= 44 && i.h >= 44,
            `${where}: "${i.text || i.label}" is ${Math.round(i.w)}×${Math.round(i.h)} px`,
          );
        if (i.tag === "P")
          check(
            i.lines === 2 && !i.overflow && i.right <= probe.vw,
            `${where}: the line is not its two set lines`,
          );
        else if (i.text)
          check(
            i.lines === 1 && !i.overflow && i.right <= probe.vw,
            `${where}: "${i.text}" wraps or is cut off`,
          );
      }
      check(!probe.onboarding, `${where}: the first-time intro covers the welcome`);
    };
    const welcomeScreen = (query: string) => ({
      name: "welcome",
      mode: "home" as const,
      query,
      waitMs: 1200,
    });
    {
      // 414×896 home-screen app, a public game scheduled: shown, dismissed, never again after a reload.
      const { context, page } = await openThemeScreen(
        browser,
        server.origin,
        welcomeScreen("ref=share"),
        viewport,
      );
      try {
        judgeCard("welcome (414x896 app)", await probeCard(page), true);
        if (SHOTS) await page.screenshot({ path: join(SHOTS, "welcome-414x896.png") });
        const first = await events(page);
        check(
          first.some((e) => e["event"] === "arrival" && e["landing"] === "home"),
          `welcome: arrival not recorded as home: ${JSON.stringify(first)}`,
        );
        check(
          JSON.stringify(welcomeEvents(first)) === JSON.stringify(["shown"]),
          `welcome: shown events ${JSON.stringify(welcomeEvents(first))}`,
        );
        await page.locator("[data-share-welcome-dismiss]").click();
        await page.waitForTimeout(200);
        check(
          (await page.locator("[data-share-welcome]").count()) === 0,
          "welcome: the card stays after Dismiss",
        );
        check(
          JSON.stringify(welcomeEvents(await events(page))) ===
            JSON.stringify(["shown", "dismissed"]),
          `welcome: dismiss not recorded: ${JSON.stringify(await events(page))}`,
        );
        await page.reload();
        await page.waitForSelector("#root *", { timeout: 60_000 });
        await page.waitForTimeout(1200);
        check(
          (await page.locator("[data-share-welcome]").count()) === 0,
          "welcome: the card shows again on a later visit",
        );
        const again = await events(page);
        check(
          !again.some((e) => e["event"] === "arrival" || e["event"] === "arrival_welcome"),
          `welcome: a later visit recorded ${JSON.stringify(again)}`,
        );
      } finally {
        await context.close();
      }
    }
    {
      // 375×667, a public game scheduled: its button goes to Tournaments and is recorded.
      const small = { name: "375x667", w: 375, h: 667 };
      const { context, page } = await openThemeScreen(
        browser,
        server.origin,
        welcomeScreen("ref=share"),
        small,
      );
      try {
        judgeCard("welcome (375x667)", await probeCard(page), true);
        await page.locator("[data-share-welcome-public]").click();
        await page.waitForTimeout(200);
        check(
          JSON.stringify(welcomeEvents(await events(page))) === JSON.stringify(["shown", "public"]),
          `welcome (375x667): public tap not recorded: ${JSON.stringify(await events(page))}`,
        );
      } finally {
        await context.close();
      }
    }
    {
      // No public game scheduled: only the practice button, and its tap is recorded.
      const { context, page } = await openThemeScreen(
        browser,
        server.origin,
        welcomeScreen("ref=share"),
        viewport,
        async (ctx) => {
          await ctx.addInitScript(() => {
            (window as unknown as { __DUELZ_PUBLIC_GAMES__: unknown[] }).__DUELZ_PUBLIC_GAMES__ =
              [];
          });
        },
      );
      try {
        judgeCard("welcome, no public game", await probeCard(page), false);
        if (SHOTS)
          await page.screenshot({ path: join(SHOTS, "welcome-414x896-no-public-game.png") });
        await page.locator("[data-share-welcome-practice]").click();
        await page.waitForTimeout(200);
        check(
          JSON.stringify(welcomeEvents(await events(page))) ===
            JSON.stringify(["shown", "practice"]),
          `welcome, no public game: practice tap not recorded: ${JSON.stringify(await events(page))}`,
        );
      } finally {
        await context.close();
      }
    }
    {
      // A plain visit: no card.
      const { context, page } = await openThemeScreen(
        browser,
        server.origin,
        welcomeScreen(""),
        viewport,
      );
      try {
        check(
          (await page.locator("[data-share-welcome]").count()) === 0,
          "a plain visit shows the welcome card",
        );
      } finally {
        await context.close();
      }
    }
    // The same shared room link, decided when it's opened.
    const linkScreen = {
      ...THEME_SCREENS.find((x) => x.name === "link join")!,
      query: "ref=share",
    };
    const withPreview = (preview: unknown) => async (ctx: import("playwright").BrowserContext) => {
      await ctx.addInitScript((p) => {
        (window as unknown as { __harnessPreview: unknown }).__harnessPreview = p;
      }, preview);
    };
    const navigations = (page: import("playwright").Page) =>
      page.evaluate(
        () =>
          (window as unknown as { __harness: { navigations?: unknown[] } }).__harness.navigations ??
          [],
      );
    for (const [label, preview] of [
      [
        "finished",
        { found: true, roomCode: "SAFE", state: "finished", playerCount: 2, maxPlayers: 10 },
      ],
      [
        "full lobby",
        { found: true, roomCode: "SAFE", state: "lobby", playerCount: 10, maxPlayers: 10 },
      ],
    ] as const) {
      // Opened while the room is finished (or full): sent to the home with ?ref=share, then the card.
      const where = `link opened, ${label}`;
      const { context, page } = await openThemeScreen(
        browser,
        server.origin,
        linkScreen,
        viewport,
        withPreview(preview),
      );
      try {
        const went = await navigations(page);
        check(
          JSON.stringify(went) ===
            JSON.stringify([{ to: "/", search: { ref: "share", room: "SAFE" }, replace: true }]),
          `${where}: not sent to the home: ${JSON.stringify(went)}`,
        );
        check(
          (await page.locator("text=/has finished|has already started|Join room/i").count()) === 0,
          `${where}: the room's own message showed`,
        );
        check(
          !(await events(page)).some((e) => e["event"] === "arrival"),
          `${where}: counted as an arrival before reaching the home`,
        );
        // The redirect's destination, on the same device.
        await page.goto(`${server.origin}/safe-area.html?mode=home&ref=share&room=SAFE`);
        await page
          .waitForSelector("[data-share-welcome]", { timeout: 60_000 })
          .catch(() => undefined);
        judgeCard(`${where} → home`, await probeCard(page), true);
        if (SHOTS && label === "finished")
          await page.screenshot({ path: join(SHOTS, "welcome-414x896.png") });
        const arrival = (await events(page)).find((e) => e["event"] === "arrival");
        check(
          arrival?.["landing"] === "home" && arrival["roomCode"] === "SAFE",
          `${where}: arrival recorded as ${JSON.stringify(arrival)}`,
        );
      } finally {
        await context.close();
      }
    }
    {
      // The same link opened after the host pressed Play again (the lobby, a seat free): the lobby's join, no card.
      const where = "link opened after Play again";
      const { context, page } = await openThemeScreen(
        browser,
        server.origin,
        linkScreen,
        viewport,
        withPreview({
          found: true,
          roomCode: "SAFE",
          state: "lobby",
          playerCount: 3,
          maxPlayers: 10,
        }),
      );
      try {
        check(
          (await navigations(page)).length === 0,
          `${where}: redirected ${JSON.stringify(await navigations(page))}`,
        );
        check(
          (await page.locator("#link-name").count()) === 1,
          `${where}: the lobby's join isn't shown`,
        );
        check(
          (await page.locator("[data-share-welcome]").count()) === 0,
          `${where}: the welcome card shows`,
        );
        const arrival = (await events(page)).find((e) => e["event"] === "arrival");
        check(
          arrival?.["landing"] === "room" && arrival["roomCode"] === "SAFE",
          `${where}: arrival recorded as ${JSON.stringify(arrival)}`,
        );
        if (SHOTS)
          await page.screenshot({ path: join(SHOTS, "link-after-play-again-414x896.png") });
        // Going home afterwards on that visit: still no card (the lobby was the welcome).
        await page.goto(`${server.origin}/safe-area.html?mode=home&ref=share`);
        await page.waitForTimeout(1500);
        check(
          (await page.locator("[data-share-welcome]").count()) === 0,
          `${where}: the card shows on the home afterwards`,
        );
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(
  `PASS: ${passes} checks (the room link always shared, its destination decided when opened (finished or full: home and card; after Play again: the lobby), no answer content in the data or card, share sheet and clipboard fallback, arrival and finish recorded once, server rows and migration, wiring, Share on the podium and two-player result in Chromium)`,
);
process.exit(0);
