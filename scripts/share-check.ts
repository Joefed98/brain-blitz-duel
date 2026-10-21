/**
 * share-check (21 Oct 2026, presentation and beta recording only): sharing a room's result from its
 * final screen (src/lib/share/, src/components/share/, supabase/migrations/20261021120000).
 *
 *  1. Text and link: "I came 2nd in a 6-round {APP_NAME} room – 612 pts. Play: <link>"; the link is
 *     the room's own (/duel/CODE?ref=share) while the room is open (not disbanded, host still in it)
 *     and the app's home (/?ref=share) once it isn't; no place ("I played …") after leaving.
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
import {
  roomShareData,
  roomShareLine,
  roomShareLink,
  roomStillOpen,
} from "../src/lib/share/roomShare";
import { shareResult, shareText } from "../src/lib/share/shareResult";
import {
  noteShareArrival,
  noteShareFinish,
  resetShareArrivalMemory,
} from "../src/lib/share/shareRef";
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
function room(opts: { hostLeft?: boolean; disbanded?: boolean; meLeft?: boolean } = {}) {
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
    status: "finished",
    phase: "result",
    host_user_id: "u1",
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
const open = roomShareData({ ...room(), origin: ORIGIN });
check(
  open.place === 2 && open.total === 612 && open.rounds === 6 && open.players === 6,
  `place/total/rounds/players ${open.place}/${open.total}/${open.rounds}/${open.players}`,
);
const expected = `I came 2nd in a 6-round ${APP_NAME} room – 612 pts. Play: ${ORIGIN}/duel/ABCD?ref=share`;
check(
  shareText(open.lines, open.link) === expected,
  `open room text: "${shareText(open.lines, open.link)}"`,
);
check(open.linksRoom, "an open room's share does not link the room");
const hostLeft = roomShareData({ ...room({ hostLeft: true }), origin: ORIGIN });
check(
  hostLeft.link === `${ORIGIN}/?ref=share` && !hostLeft.linksRoom,
  `host left: link ${hostLeft.link}`,
);
check(
  shareText(hostLeft.lines, hostLeft.link) ===
    `I came 1st in a 6-round ${APP_NAME} room – 612 pts. Play: ${ORIGIN}/?ref=share`,
  `host left (Jo now first): "${shareText(hostLeft.lines, hostLeft.link)}"`,
);
const disbanded = roomShareData({ ...room({ disbanded: true }), origin: ORIGIN });
check(disbanded.link === `${ORIGIN}/?ref=share`, `disbanded room: link ${disbanded.link}`);
check(
  roomStillOpen(room().duel, room().players) &&
    !roomStillOpen(room({ disbanded: true }).duel, room().players),
  "roomStillOpen rule",
);
check(
  roomShareLink(`${ORIGIN}/`, "WXYZ", true) === `${ORIGIN}/duel/WXYZ?ref=share`,
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
  open.top.map((t) => `${t.place}:${t.name}:${t.total}`).join(",") ===
    "1:Ali:700,2:Jo:612,3:Sam:540",
  `top three ${JSON.stringify(open.top)}`,
);
check(open.games.join(",") === ORDER.join(","), "card games are not the round order");

/* ------------------------------------------------------------ 2. no answer content */

check(!JSON.stringify(open).includes(SECRET), "the share data carries answer or puzzle content");
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
  drawResultCard(ctx, open);
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
    !noteShareFinish(open, record) && sent.length === 0,
    "a finish without a shared-link arrival was recorded",
  );
  check(
    noteShareArrival({ search: "?ref=share", pathname: "/duel/abcd" }, record),
    "an arrival from a shared room link was not recorded",
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
    noteShareFinish(open, record) &&
      sent[1]?.event === "arrival_finished" &&
      sent[1].duelId === DUEL_ID &&
      sent[1].place === 2,
    `finish ${JSON.stringify(sent[1])}`,
  );
  check(!noteShareFinish(open, record) && sent.length === 2, "a second finish was recorded");
  resetShareArrivalMemory();
  // Memory only here (no window): forgetting it is a fresh device.
  const home: ShareEventInput[] = [];
  noteShareArrival({ search: "?x=1&ref=share", pathname: "/" }, (e) => void home.push(e));
  check(
    home[0]?.landing === "home" && home[0].roomCode === null,
    `home arrival ${JSON.stringify(home[0])}`,
  );
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
  ])
    check(new RegExp(`\\n  ${column} `).test(sql), `the migration lacks the ${column} column`);
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
  for (const f of ["src/components/duel/Podium.tsx", "src/components/duel/FinalResult.tsx"])
    check(/\{share\}/.test(readFileSync(f, "utf8")), `${f} doesn't draw the Share button`);
  for (const f of [
    "src/lib/share/shareResult.ts",
    "src/lib/share/roomShare.ts",
    "src/lib/share/resultCard.ts",
    "src/lib/share/shareRef.ts",
    "src/components/share/ShareResultButton.tsx",
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
  `PASS: ${passes} checks (text and link for open and closed rooms, no answer content in the data or card, share sheet and clipboard fallback, arrival and finish recorded once, server rows and migration, wiring, Share on the podium and two-player result in Chromium)`,
);
process.exit(0);
