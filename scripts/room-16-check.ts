/**
 * room-16-check (31 Oct 2026): rooms of up to 16 players and the colour wheel.
 *
 *  1. The cap: MAX_PLAYERS is 16 and the server's seat rule (roomSeats.ts, what joinRoomFn calls)
 *     seats 16 players in slots 1–16, refuses the 17th with "That room is full (16 players).", gives a
 *     leaver's seat to the next join, and seats 16 in a room stored with the old max_players 10. Before
 *     the migration (the database's old 1–10 slot range), the 11th join's refusal becomes "full (10
 *     players)" through RoomSeatsError, never an error.
 *  2. Colours in a room of 16: the real server code (insertPlayerWithLook, changePlayerLook) seats
 *     random rooms of 16 with remembered colours that often clash, joins racing in pairs and lobby
 *     changes, on an in-memory duel_players with the unique colour index: every phone's resolved
 *     colours (resolvePlayerLooks, any row order) are distinct, and a lobby change to a taken colour
 *     is refused. Before the migration, wheel colours past 9 are seated as no colour (slot colours).
 *  3. The nearest free swatch: a player whose default is taken gets the free swatch nearest to it
 *     (ΔE2000, brute force over every free swatch), through pickJoinColour and the server's seat.
 *  4. The wheel: 32 swatches, every pair at least 14 ΔE2000 apart, 4.5:1 on the background and under
 *     the glyph, each in exactly one of the three rings, the October ten first.
 *  5. Apex's ghosts: at most 3 are drawn, the nearest along the track (nearestRacingGhosts), and the
 *     renderer's draw loop reads only those.
 *  6. The arcade chart draws the top 8 by score plus this player in rooms of 11–16 (chartShown); rooms
 *     of up to 10 still draw everyone.
 *  7. In Chromium (the real routes through the safe-area harness, scripts/theme-screens.ts
 *     ROOM_16_SCREENS) at 414×896 as an iPhone 11 home-screen app and 375×667: the lobby's 16 players
 *     in two columns, the lobby's and Profile's colour wheels (32 swatches of 44 px that never overlap,
 *     the 15 taken ones greyed out and not tappable in the lobby), the round results and standings
 *     (compact rows, my 12th-place row pinned in view at the list's top and bottom scroll), the arcade
 *     reveal (top 8 and me; the chart never overlaps the parts card under four part lines), the
 *     podium (the top three, "Your place: 12th of 16" and my row), no page wider than the screen, and
 *     initials on every player's badge on every one of those screens.
 *
 *   bun scripts/room-16-check.ts [--no-browser]
 */
import { existsSync, readFileSync } from "node:fs";

import {
  CVD_SAFE_COLOURS,
  PLAYER_COLOURS,
  PLAYER_COLOUR_MIN_DE,
  BADGE_GLYPH,
  WHEEL_RINGS,
  colourDistance,
  colourWheel,
  nearestFreeColour,
  pickJoinColour,
  playerInitial,
  resolvePlayerLooks,
} from "../src/lib/duel/playerLook";
import {
  RoomSeatsError,
  changePlayerLook,
  forgetLookColumns,
  insertPlayerWithLook,
} from "../src/lib/duel/playerLook.server";
import { firstFreeSlot, seatFor } from "../src/lib/duel/roomSeats";
import { MAX_PLAYERS, roomCapacity, type DuelPlayerRow } from "../src/lib/duel/types";
import { CHART_ALL_UP_TO, CHART_TOP, chartShown } from "../src/lib/duel/arcadeChart";
import { RACING_GHOSTS_SHOWN, nearestRacingGhosts } from "../src/lib/arcade/racing.renderer";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else if (failures.length < 60) failures.push(message);
  else if (failures.length === 60) failures.push("… more failures not shown");
}

let seed = 20261031;
function rand(): number {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
const int = (n: number) => Math.floor(rand() * n);
function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = int(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/* ------------------------------------------------------------------ 1. the cap */

check(MAX_PLAYERS === 16, `MAX_PLAYERS is ${MAX_PLAYERS}, want 16`);
type SeatRow = { player_slot: number; status: string };
{
  const seated: SeatRow[] = [];
  for (let n = 1; n <= 16; n++) {
    const seat = seatFor(seated, { max_players: 16 });
    check(seat.ok && seat.slot === n, `join ${n}: seat ${JSON.stringify(seat)}, want slot ${n}`);
    if (seat.ok) seated.push({ player_slot: seat.slot, status: "active" });
  }
  const seventeenth = seatFor(seated, { max_players: 16 });
  check(!seventeenth.ok && seventeenth.message === "That room is full (16 players).", `the 17th join: ${JSON.stringify(seventeenth)}`);
  // A room made before 16 (stored max_players 10) seats 16 too.
  check(roomCapacity({ max_players: 10 }) === 16 && firstFreeSlot(seated.slice(0, 10), roomCapacity({ max_players: 10 })) === 11, "a room stored with max_players 10 doesn't seat an 11th");
  const old = seatFor(seated, { max_players: 10 });
  check(!old.ok && old.message === "That room is full (16 players).", `an old room's 17th join: ${JSON.stringify(old)}`);
  // A leaver's seat goes to the next join; a left player never counts.
  const left = seated.map((p) => (p.player_slot === 7 ? { ...p, status: "left" } : p));
  const back = seatFor(left, { max_players: 16 });
  check(back.ok && back.slot === 7, `after slot 7 left, the next join got ${JSON.stringify(back)}`);
  check(!seatFor([...left, { player_slot: 7, status: "active" }], { max_players: 16 }).ok, "17 seated after a leaver's seat was retaken");
}
// The server wires it: joinRoomFn calls seatFor and maps RoomSeatsError to the full message.
{
  const src = readFileSync("src/lib/duel/duel.functions.ts", "utf8");
  check(/const seat = seatFor\(players, room\);\s*if \(!seat\.ok\) return \{ ok: false as const, message: seat\.message \};/.test(src), "joinRoomFn doesn't refuse through seatFor");
  check(/instanceof RoomSeatsError\) return \{ ok: false as const, message: roomFullMessage\(error\.seats\) \}/.test(src), "joinRoomFn doesn't turn the database's slot refusal into the full message");
  check(/max_players: MAX_PLAYERS/.test(src), "new rooms aren't stored with MAX_PLAYERS seats");
}

/* ------------------------------------------------------------------ in-memory duel_players */

type Row = Record<string, unknown>;
const CLASH = (index: string) => ({ code: "23505", message: `duplicate key value violates unique constraint "${index}"` });
const CHECK = (name: string) => ({ code: "23514", message: `new row for relation "duel_players" violates check constraint "${name}"` });

/**
 * duel_players with its unique indexes and check constraints. `migrated`: the 16-player migration
 * applied (slots 1–16, colours 0–31); otherwise the old 1–10 slots and 0–9 colours.
 */
function playersDb(migrated: boolean) {
  const rows: Row[] = [];
  const maxSlot = migrated ? 16 : 10;
  const maxColour = migrated ? PLAYER_COLOURS.length - 1 : 9;
  const invalid = (row: Row) => {
    const slot = row["player_slot"] as number;
    if (slot < 1 || slot > maxSlot) return CHECK("duel_players_slot_range");
    const colour = row["colour"];
    if (colour != null && ((colour as number) < 0 || (colour as number) > maxColour)) return CHECK("duel_players_colour_range");
    return null;
  };
  const clash = (candidate: Row, self?: Row) => {
    for (const row of rows) {
      if (row === self || row["duel_id"] !== candidate["duel_id"]) continue;
      if (row["player_slot"] === candidate["player_slot"]) return CLASH("duel_players_duel_slot_key");
      if (row["user_id"] === candidate["user_id"]) return CLASH("duel_players_duel_user_key");
      if (candidate["colour"] != null && row["colour"] === candidate["colour"]) return CLASH("duel_players_duel_colour_key");
    }
    return null;
  };
  const client = {
    from(table: string) {
      if (table !== "duel_players") throw new Error(`unexpected table ${table}`);
      return {
        select() {
          const tests: ((row: Row) => boolean)[] = [];
          const q = {
            eq: (k: string, v: unknown) => (tests.push((r) => r[k] === v), q),
            order: () => q,
            limit: () => q,
            then: (resolve: (r: { data: Row[] | null; error: unknown }) => void) =>
              resolve({ data: rows.filter((r) => tests.every((t) => t(r))).map((r) => structuredClone(r)), error: null }),
          };
          return q;
        },
        insert(values: Row) {
          const error = invalid(values) ?? clash(values);
          if (!error) rows.push(structuredClone({ id: `id-${values["duel_id"]}-${values["player_slot"]}`, ...values }));
          return Promise.resolve({ data: null, error });
        },
        update(values: Row) {
          const tests: ((row: Row) => boolean)[] = [];
          const q = {
            eq: (k: string, v: unknown) => (tests.push((r) => r[k] === v), q),
            is: (k: string, v: unknown) => (tests.push((r) => (r[k] ?? null) === v), q),
            then: (resolve: (r: { data: null; error: unknown }) => void) => {
              for (const row of rows.filter((r) => tests.every((t) => t(r)))) {
                const error = invalid({ ...row, ...values }) ?? clash({ ...row, ...values }, row);
                if (error) return resolve({ data: null, error });
                Object.assign(row, values);
              }
              resolve({ data: null, error: null });
            },
          };
          return q;
        },
      };
    },
  };
  return { client, rows };
}
const asPlayers = (rows: Row[], room: string) =>
  rows.filter((r) => r["duel_id"] === room).map((r) => ({ status: "active", ...r }) as unknown as DuelPlayerRow);
const seatRow = (room: string, slot: number) => ({
  duel_id: room,
  player_slot: slot,
  user_id: `${room}-u${slot}`,
  display_name: `P${slot}`,
  status: "active",
});
function distinct(players: DuelPlayerRow[]): boolean {
  for (const order of [players, [...players].reverse(), shuffle(players)]) {
    const colours = [...resolvePlayerLooks(order).values()].map((l) => l.colour);
    if (new Set(colours).size !== colours.length) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ 2. colours in a room of 16 */

forgetLookColumns();
for (let room = 0; room < 120; room++) {
  const id = `room-${room}`;
  const { client, rows } = playersDb(true);
  // Remembered colours bunched into a few swatches, so most joins clash.
  const favourites = [int(32), int(32), int(32)];
  const want = (slot: number) => (rand() < 0.15 ? undefined : favourites[int(3)]);
  let slot = 1;
  while (slot <= 16) {
    if (slot < 16 && rand() < 0.3) {
      // Two joins racing (both read the room before either is stored).
      await Promise.all([
        insertPlayerWithLook(client, seatRow(id, slot), { colour: want(slot) }),
        insertPlayerWithLook(client, seatRow(id, slot + 1), { colour: want(slot + 1) }),
      ]);
      slot += 2;
    } else {
      await insertPlayerWithLook(client, seatRow(id, slot), { colour: want(slot) });
      slot += 1;
    }
  }
  const seated = asPlayers(rows, id);
  check(seated.length === 16, `${id}: ${seated.length} seated, want 16`);
  check(distinct(seated), `${id}: two players resolve to the same colour`);
  check(seated.every((p) => typeof p.colour === "number"), `${id}: a player was seated without a stored colour`);
  // Lobby changes: a taken colour is refused, a free one is stored, colours stay distinct.
  for (let n = 0; n < 6; n++) {
    const players = asPlayers(rows, id);
    const me = players[int(players.length)]!;
    const target = int(PLAYER_COLOURS.length);
    const holder = players.find((p) => p.colour === target && p.player_slot !== me.player_slot);
    const out = await changePlayerLook(client, me, { colour: target });
    if (holder) check(!out.ok, `${id}: slot ${me.player_slot} took colour ${target} from slot ${holder.player_slot}`);
    else check(out.ok, `${id}: a free colour ${target} was refused (${JSON.stringify(out)})`);
    check(distinct(asPlayers(rows, id)), `${id}: colours clash after a lobby change`);
  }
}
// The 17th row the database could get (a race past the cap) is refused by the slot range.
{
  const { client } = playersDb(true);
  let threw: unknown = null;
  try {
    await insertPlayerWithLook(client, seatRow("cap", 17), { colour: 3 });
  } catch (error) {
    threw = error;
  }
  check(threw instanceof RoomSeatsError, "slot 17 wasn't refused as a full room");
}
// Before the migration: slots past 10 are refused as "full (10 players)"; wheel colours past 9 seat as no colour.
{
  forgetLookColumns();
  const { client, rows } = playersDb(false);
  for (let s = 1; s <= 10; s++) await insertPlayerWithLook(client, seatRow("old", s), { colour: 10 + s });
  const seated = asPlayers(rows, "old");
  check(seated.length === 10, `before the migration: ${seated.length} of 10 seated`);
  check(seated.every((p) => p.colour == null || (p.colour as number) <= 9), "before the migration: a colour past 9 was stored");
  check(distinct(seated), "before the migration: colours clash");
  let threw: unknown = null;
  try {
    await insertPlayerWithLook(client, seatRow("old", 11), {});
  } catch (error) {
    threw = error;
  }
  check(threw instanceof RoomSeatsError && (threw as RoomSeatsError).seats === 10 && (threw as Error).message === "That room is full (10 players).", `before the migration: the 11th join gave ${String(threw)}`);
  const changed = await changePlayerLook(client, seated[0]!, { colour: 20 });
  check(!changed.ok, "before the migration: a wheel colour past 9 was accepted in the lobby");
  forgetLookColumns();
}

/* ------------------------------------------------------------------ 3. the nearest free swatch */

for (let n = 0; n < 400; n++) {
  const players = shuffle(Array.from({ length: 16 }, (_, i) => i + 1))
    .slice(0, 1 + int(15))
    .map((slot, i) => ({ player_slot: slot, colour: (i * 7 + int(32)) % 32 }));
  const taken = new Set([...resolvePlayerLooks(players).values()].map((l) => l.colour));
  const preferred = int(32);
  const free = Array.from({ length: 32 }, (_, i) => i).filter((i) => !taken.has(i));
  const nearest = free.reduce((best, i) => (colourDistance(preferred, i) < colourDistance(preferred, best) ? i : best), free[0]!);
  const slot = Math.max(...players.map((p) => p.player_slot)) + 1;
  const got = pickJoinColour(players, slot, preferred);
  if (taken.has(preferred)) {
    check(got === nearest && nearestFreeColour(preferred, taken) === nearest, `default ${preferred} taken: got ${got}, nearest free is ${nearest}`);
    check(!taken.has(got), `default ${preferred} taken: got a taken colour ${got}`);
  } else check(got === preferred, `default ${preferred} free: got ${got}`);
}
{
  // Through the server's seat: two players with the same default; the second gets the nearest free swatch.
  forgetLookColumns();
  const { client, rows } = playersDb(true);
  await insertPlayerWithLook(client, seatRow("near", 1), { colour: 4 });
  await insertPlayerWithLook(client, seatRow("near", 2), { colour: 4 });
  const [a, b] = asPlayers(rows, "near").sort((x, y) => x.player_slot - y.player_slot);
  const expect = nearestFreeColour(4, new Set([4]));
  check(a?.colour === 4 && b?.colour === expect, `same default: slots got ${a?.colour} and ${b?.colour}, want 4 and ${expect} (${PLAYER_COLOURS[expect]?.name})`);
  check(expect !== 4 && colourDistance(4, expect) === Math.min(...Array.from({ length: 32 }, (_, i) => i).filter((i) => i !== 4).map((i) => colourDistance(4, i))), "the nearest swatch to Violet isn't the closest by ΔE2000");
  forgetLookColumns();
}

/* ------------------------------------------------------------------ 4. the wheel */

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (h: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};
check(PLAYER_COLOURS.length === 32, `${PLAYER_COLOURS.length} swatches, want 32`);
check(new Set(PLAYER_COLOURS.map((c) => c.hex)).size === 32 && new Set(PLAYER_COLOURS.map((c) => c.name)).size === 32, "swatches or their names repeat");
let minDe = Infinity;
for (let i = 0; i < 32; i++) for (let j = i + 1; j < 32; j++) minDe = Math.min(minDe, colourDistance(i, j));
check(minDe >= PLAYER_COLOUR_MIN_DE && PLAYER_COLOUR_MIN_DE >= 14, `closest swatches ${minDe.toFixed(2)} ΔE2000 apart, want ${PLAYER_COLOUR_MIN_DE} (at least 14)`);
for (const { name, hex } of PLAYER_COLOURS) {
  check(contrast(hex, "#0B0B0F") >= 4.5, `${name}: ${contrast(hex, "#0B0B0F").toFixed(2)}:1 on the background`);
  check(contrast(hex, BADGE_GLYPH) >= 4.5, `${name}: glyph ${contrast(hex, BADGE_GLYPH).toFixed(2)}:1`);
}
check(CVD_SAFE_COLOURS === 10 && PLAYER_COLOURS[0].name === "Lemon" && PLAYER_COLOURS[9].name === "Steel", "the October ten aren't the wheel's first ten");
{
  const wheel = colourWheel();
  check(wheel.length === 32 && new Set(wheel.map((s) => s.index)).size === 32, "the wheel doesn't place every swatch once");
  WHEEL_RINGS.forEach((count, ring) => check(wheel.filter((s) => s.ring === ring).length === count, `ring ${ring}: ${wheel.filter((s) => s.ring === ring).length}, want ${count}`));
  check(JSON.stringify(wheel) === JSON.stringify(colourWheel()), "the wheel's layout isn't the same every time");
}

/* ------------------------------------------------------------------ 5. Apex's ghosts */

check(RACING_GHOSTS_SHOWN === 3, `${RACING_GHOSTS_SHOWN} ghosts shown, want 3`);
for (let n = 0; n < 300; n++) {
  const me = int(200_000);
  const ghosts = Array.from({ length: 1 + int(15) }, (_, i) => ({ name: `G${i}`, colour: "#fff", s: int(200_000), x: int(2000) - 1000 }));
  const shown = nearestRacingGhosts(ghosts, me, 0);
  check(shown.length === Math.min(3, ghosts.length), `${ghosts.length} ghosts: ${shown.length} drawn`);
  const cut = Math.max(...shown.map((g) => Math.abs(g.s - me)));
  check(ghosts.filter((g) => !shown.includes(g)).every((g) => Math.abs(g.s - me) >= cut), `${ghosts.length} ghosts: a nearer ghost was left out`);
}
{
  const src = readFileSync("src/lib/arcade/racing.renderer.ts", "utf8");
  // The one place the module's ghost list is walked is through nearestRacingGhosts.
  check(/for \(const g of nearestRacingGhosts\(ghosts, state\.s, state\.x\)\)/.test(src), "the renderer's draw doesn't walk nearestRacingGhosts");
  check(!/\bof ghosts\b/.test(src), "the renderer walks every ghost");
  check(!/\bghosts\.(forEach|map)\(/.test(src), "the renderer iterates every ghost");
  const sim = readFileSync("src/lib/arcade/racing.ts", "utf8");
  check(!/ghost/i.test(sim.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, "")), "the racing sim mentions ghosts (display only)");
}

/* ------------------------------------------------------------------ 6. the chart's top 8 and me */

for (let n = 0; n < 200; n++) {
  const count = 2 + int(15);
  const mine = 1 + int(count);
  const players = Array.from({ length: count }, (_, i) => ({ slot: i + 1, isMe: i + 1 === mine, score: rand() < 0.1 ? null : int(201) }));
  const view = chartShown(players);
  const scored = players.filter((p) => p.score !== null).sort((a, b) => b.score! - a.score! || a.slot - b.slot);
  const me = players.find((p) => p.isMe)!;
  const top = count <= CHART_ALL_UP_TO ? scored : scored.slice(0, CHART_TOP);
  check(top.every((p) => view.shown.includes(p)), `chart (${count}): a top-${CHART_TOP} player is missing`);
  check(me.score === null ? !view.shown.includes(me) : view.shown.includes(me), `chart (${count}): this player isn't drawn`);
  check(view.shown.length === top.length + (me.score !== null && !top.includes(me) ? 1 : 0), `chart (${count}): ${view.shown.length} drawn`);
  check(view.hidden === scored.length - view.shown.length, `chart (${count}): hidden count ${view.hidden}`);
}

/* ------------------------------------------------------------------ 7. the screens */

const BROWSER = !process.argv.includes("--no-browser");
const CHROMIUM = ["/opt/pw-browsers/chromium", process.env.PLAYWRIGHT_CHROMIUM, "/usr/bin/chromium"].find((p) => p && existsSync(p));
let screensNote = "screens skipped (--no-browser)";
if (BROWSER) {
  const { startSafeAreaServer } = await import("./safe-area-server");
  const { ROOM_16_SCREENS, THEME_SCREENS, VIEWPORTS, fixThemeClock, openThemeScreen } = await import("./theme-screens");
  type Page = import("playwright").Page;
  const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-room16", buildId: "room-16-check" });
  fixThemeClock();
  const { chromium } = await import("playwright");
  const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  const viewports = VIEWPORTS.filter((v) => !v.desktop);
  const screens = [...ROOM_16_SCREENS(), THEME_SCREENS.find((s) => s.name === "profile, colour wheel")!];
  let drawn = 0;

  /** Page-wide: nothing wider than the screen, and every badge carries an initial (or icon) matching a name. */
  const common = async (page: Page, where: string, wantBadges: number) => {
    const wide = await page.evaluate(() => {
      const w = window.innerWidth;
      const over: string[] = [];
      if ((document.scrollingElement?.scrollWidth ?? 0) > w + 1) over.push(`page ${document.scrollingElement?.scrollWidth}px`);
      for (const el of document.querySelectorAll<HTMLElement>("[data-skin] *")) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || getComputedStyle(el).visibility === "hidden") continue;
        if (el.closest("svg, [data-backdrop], canvas")) continue;
        if (r.right > w + 1 || r.left < -1) over.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} ${Math.round(r.left)}–${Math.round(r.right)}`);
      }
      return over.slice(0, 4);
    });
    check(!wide.length, `${where}: wider than the screen (${wide.join("; ")})`);
    const badges = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("[data-player-badge]")].map((b) => ({ text: (b.textContent ?? "").trim(), svg: !!b.querySelector("svg") })),
    );
    check(badges.length >= wantBadges, `${where}: ${badges.length} player badges, want at least ${wantBadges}`);
    check(badges.every((b) => b.svg || /^\p{Lu}$|^\?$/u.test(b.text)), `${where}: a badge without an initial (${JSON.stringify(badges.find((b) => !(b.svg || /^\p{Lu}$/u.test(b.text))))})`);
  };

  /** My row stays in view (inside the screen and above the room footer) at the top and bottom of the page's scroll. */
  const pinned = async (page: Page, where: string) => {
    for (const end of ["top", "bottom"] as const) {
      const out = await page.evaluate(async (atEnd) => {
        const scroller = document.scrollingElement!;
        scroller.scrollTop = atEnd === "top" ? 0 : scroller.scrollHeight;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const row = document.querySelector<HTMLElement>("[data-pinned]");
        const footer = document.querySelector<HTMLElement>("[data-room-footer]");
        if (!row) return { ok: false, why: "no pinned row" };
        const r = row.getBoundingClientRect();
        const limit = footer ? footer.getBoundingClientRect().top : window.innerHeight;
        const list = row.parentElement!;
        return {
          ok: r.top >= -0.5 && r.bottom <= limit + 0.5 && r.height > 30,
          why: `row ${Math.round(r.top)}–${Math.round(r.bottom)}, footer at ${Math.round(limit)}, screen ${window.innerHeight}`,
          compact: list.hasAttribute("data-compact"),
          scrolls: scroller.scrollHeight > scroller.clientHeight + 1,
          text: row.textContent ?? "",
        };
      }, end);
      check(out.ok, `${where}: my row isn't in view at the ${end} of the scroll (${out.why})`);
      check(!!out.compact, `${where}: rows aren't compact with 16 players`);
      if (end === "top") check(!!out.scrolls, `${where}: 16 rows fit without scrolling, so the pin proves nothing (resize the fixture)`);
      check(/Me with a long name|Me with/.test(out.text ?? ""), `${where}: the pinned row isn't mine`);
    }
  };

  try {
    for (const screen of screens)
      for (const viewport of viewports) {
        const where = `${screen.name} (${viewport.name})`;
        try {
          const { context, page } = await openThemeScreen(browser, server.origin, screen, viewport);
          drawn++;
          if (screen.name === "lobby, 16 players") {
            const cells = await page.evaluate(() =>
              [...document.querySelectorAll<HTMLElement>("[data-lobby-player]")].map((c) => {
                const r = c.getBoundingClientRect();
                const name = c.querySelector(".rs-name")?.textContent ?? "";
                const badge = c.querySelector("[data-player-badge]")?.textContent ?? "";
                return { x: Math.round(r.left), w: r.width, h: r.height, name, badge };
              }),
            );
            check(cells.length === 16, `${where}: ${cells.length} players, want 16`);
            const columns = [...new Set(cells.map((c) => c.x))];
            check(columns.length === 2, `${where}: players in ${columns.length} columns, want 2`);
            check(cells.every((c) => c.h >= 44), `${where}: a player chip under 44 px tall`);
            check(cells.every((c) => c.badge === playerInitial(c.name)), `${where}: a chip's badge isn't its player's initial`);
            await common(page, where, 16);
          } else if (screen.name.includes("colour wheel")) {
            const wheel = await page.evaluate(() =>
              [...document.querySelectorAll<HTMLButtonElement>("[data-colour-wheel] [data-swatch]")].map((b) => {
                const r = b.getBoundingClientRect();
                return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, right: r.right, left: r.left, disabled: b.disabled, taken: b.hasAttribute("data-swatch-taken"), label: b.getAttribute("aria-label") ?? "", text: (b.textContent ?? "").trim() };
              }),
            );
            const lobby = screen.name.startsWith("lobby");
            check(wheel.length === 32, `${where}: ${wheel.length} swatches, want 32`);
            check(wheel.every((s) => s.w >= 44 && s.h >= 44), `${where}: a swatch under 44 px`);
            const vw = viewport.w;
            check(wheel.every((s) => s.left >= 0 && s.right <= vw), `${where}: a swatch off the screen`);
            let closest = Infinity;
            for (let i = 0; i < wheel.length; i++)
              for (let j = i + 1; j < wheel.length; j++) closest = Math.min(closest, Math.hypot(wheel[i]!.x - wheel[j]!.x, wheel[i]!.y - wheel[j]!.y));
            check(closest >= 44, `${where}: two swatches' tap targets overlap (${closest.toFixed(1)} px apart)`);
            const taken = wheel.filter((s) => s.taken);
            if (lobby) {
              check(taken.length === 15 && taken.every((s) => s.disabled && / taken by /.test(s.label)), `${where}: ${taken.length} swatches greyed out, want the 15 other players'`);
              check(taken.every((s) => /^\p{Lu}$/u.test(s.text)), `${where}: a taken swatch doesn't carry its holder's initial`);
              // A tap on a taken swatch changes nothing.
              const before = await page.locator("[data-swatch][aria-checked='true']").getAttribute("data-swatch");
              await page.locator("[data-swatch-taken]").first().click({ force: true });
              await page.waitForTimeout(150);
              check((await page.locator("[data-swatch][aria-checked='true']").getAttribute("data-swatch")) === before, `${where}: a taken swatch could be chosen`);
              const inView = await page.evaluate(() => {
                const r = document.querySelector("[data-colour-wheel]")!.getBoundingClientRect();
                return r.top < window.innerHeight && r.bottom > 0;
              });
              check(inView, `${where}: the wheel opened out of view`);
            } else check(taken.length === 0 && wheel.every((s) => !s.disabled), `${where}: Profile greys out swatches`);
            await common(page, where, lobby ? 16 : 1);
          } else if (screen.name.startsWith("round leaderboard") || screen.name.startsWith("standings")) {
            await pinned(page, where);
            await common(page, where, 16);
          } else if (screen.name.startsWith("answer reveal")) {
            // 1 Nov 2026 (Joe: the breakdown squashed the chart): the breakdown is one line until tapped; the chart
            // keeps its full height and the reveal does not scroll. Then, opened, everything below holds as before.
            const folded = await page.evaluate(() => {
              const column = document.querySelector<HTMLElement>("[data-reveal-column]");
              const summary = document.querySelector<HTMLElement>("[data-reveal-summary]");
              const panel = document.querySelector("[data-chart-panel]")?.getBoundingClientRect();
              const tiles = document.querySelector<HTMLElement>("[data-reveal-tiles]");
              return {
                summary: summary?.getAttribute("data-reveal-summary") ?? null,
                summaryText: summary?.textContent ?? "",
                summaryH: summary?.getBoundingClientRect().height ?? 0,
                tilesShown: !!tiles && tiles.getBoundingClientRect().height > 0,
                scrolls: column ? column.scrollHeight > column.clientHeight + 1 : true,
                heights: column ? `${column.scrollHeight}/${column.clientHeight}: ${[...column.children].map((c) => Math.round(c.getBoundingClientRect().height)).join(", ")}` : "",
                panelH: panel?.height ?? 0,
              };
            });
            check(folded.summary === "closed", `${where}: the breakdown isn't one folded line (${folded.summary})`);
            // 3 Nov 2026 (Joe's audit): the folded line is the fixture's first line in plain words ("12 / 40" reads "12 of 40"),
            // with a clear "See breakdown" under it.
            check(folded.summaryText.startsWith("Core 112 of 150") && folded.summaryText.endsWith("See breakdown"), `${where}: the folded line reads ${JSON.stringify(folded.summaryText)} (want the fixture's first line, then "See breakdown")`);
            check(folded.summaryH >= 44, `${where}: the breakdown's tap target is ${folded.summaryH}px tall`);
            check(!folded.tilesShown, `${where}: the parts card shows before the breakdown is opened`);
            check(!folded.scrolls, `${where}: the folded reveal scrolls (${folded.heights})`);
            await page.locator("[data-reveal-summary]").click();
            await page.waitForTimeout(300);
            const opened = await page.evaluate(() => document.querySelector("[data-reveal-summary]")?.getAttribute("data-reveal-summary") ?? null);
            check(opened === "open", `${where}: a tap doesn't open the breakdown (${opened})`);
            const r = await page.evaluate(() => {
              const panel = document.querySelector("[data-chart-panel]")?.getBoundingClientRect();
              const body = document.querySelector("[data-chart-body]")?.getBoundingClientRect();
              const tiles = document.querySelector("[data-reveal-tiles]")?.getBoundingClientRect();
              const markers = [...document.querySelectorAll<HTMLElement>("[data-chart-marker]")];
              return {
                panelBottom: panel?.bottom ?? null,
                bodyBottom: body?.bottom ?? null,
                tilesTop: tiles?.top ?? null,
                markers: markers.length,
                you: !!document.querySelector("[data-chart-you]"),
                hidden: document.querySelector("[data-chart-hidden]")?.getAttribute("data-chart-hidden") ?? null,
                // Every text in the chart but its scale labels: never a digit (no score is shown).
                digits: [...document.querySelectorAll("[data-arcade-chart] :is(p, span):not([data-chart-label])")].map((e) => e.textContent ?? "").filter((t) => /\d/.test(t)),
                // One breakdown row a stored part line (3 Nov 2026: rows in plain words, each keeping its stored line).
                lines: [...document.querySelectorAll("[data-reveal-breakdown] li[data-line]")].filter((li) => /\d+ \/ \d+/.test(li.getAttribute("data-line") ?? "")).length,
                markersInPanel: markers.every((m) => {
                  const b = m.getBoundingClientRect();
                  return !panel || (b.top >= panel.top - 0.5 && b.bottom <= panel.bottom + 0.5);
                }),
              };
            });
            check(r.lines === 4, `${where}: ${r.lines} part lines drawn, want the fixture's 4`);
            check(r.markers === CHART_TOP + 1 && r.you, `${where}: ${r.markers} chart markers (you ${r.you}), want the top ${CHART_TOP} and you`);
            check(r.hidden === "7", `${where}: hidden count ${r.hidden}, want 7`);
            check(!r.digits.length, `${where}: the chart shows a number (${r.digits.slice(0, 3).join(" | ")})`);
            check(r.panelBottom !== null && r.tilesTop !== null && r.panelBottom <= r.tilesTop + 0.5, `${where}: the chart panel (bottom ${r.panelBottom}) overlaps the parts card (top ${r.tilesTop})`);
            check(r.bodyBottom !== null && r.panelBottom !== null && r.bodyBottom <= r.panelBottom + 0.5, `${where}: the chart (bottom ${r.bodyBottom}) runs out of its panel (bottom ${r.panelBottom})`);
            check(r.markersInPanel, `${where}: a chart marker outside its panel`);
            await common(page, where, CHART_TOP + 1);
          } else if (screen.name.startsWith("podium")) {
            const p = await page.evaluate(() => {
              const list = document.querySelector("[data-podium-list]");
              const rows = [...(list?.querySelectorAll(":scope > li") ?? [])];
              return {
                state: list?.getAttribute("data-podium-list") ?? null,
                playerRows: rows.filter((li) => li.querySelector("[data-player-badge]")).map((li) => li.textContent ?? ""),
                placeLine: document.querySelector("[data-podium-place-line]")?.textContent ?? null,
                all: !!document.querySelector("[data-podium-all]"),
              };
            });
            check(p.state === "top", `${where}: the podium list isn't the top three (${p.state})`);
            check(p.playerRows.length === 4 && /Me with/.test(p.playerRows[3] ?? ""), `${where}: ${p.playerRows.length} player rows (want the top three and mine)`);
            check(p.placeLine === "Your place: 12th of 16", `${where}: place line ${JSON.stringify(p.placeLine)}`);
            check(p.all, `${where}: no way to see all 16`);
            await common(page, where, 3 + 4);
            await page.locator("[data-podium-all]").click();
            await page.waitForTimeout(300);
            const all = await page.evaluate(() => [...document.querySelectorAll("[data-podium-list] > li [data-player-badge]")].length);
            check(all === 16, `${where}: "See all" shows ${all} players`);
            await common(page, `${where}, all`, 16 + 3);
          }
          await context.close();
        } catch (error) {
          check(false, `${where}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
        }
      }
  } finally {
    await browser.close();
    await server.close();
  }
  screensNote = `${drawn} screens drawn at ${viewports.map((v) => v.name).join(" and ")}`;
}

console.log(`room-16-check: ${passes} checks passed; ${screensNote}; closest swatches ${minDe.toFixed(1)} ΔE2000`);
if (failures.length) {
  for (const f of failures) console.log(`  ${f}`);
  console.log(`FAIL: ${failures.length} problem(s) with rooms of 16`);
  process.exit(1);
}
console.log("PASS");
process.exit(0);
