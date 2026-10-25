/**
 * player-looks-check (17 Oct 2026): player colours, icons and podium awards (presentation and room
 * data only).
 *
 *  1. The palette: ten distinct colours, each at least 4.5:1 against the app background and under
 *     the badge's near-black glyph, and every pair at least 10 ΔE2000 apart with normal vision and
 *     simulated protanopia, deuteranopia and tritanopia (Machado 2009, full severity).
 *  2. The icon set: sixteen ids, each drawn, each matching the migration's id constraint.
 *  3. Colours are unique in a room: the real server code (playerLook.server.ts) seats random rooms
 *     of 2–10 players, with remembered colours (often clashing), joins racing in pairs, players
 *     leaving and lobby changes, against an in-memory duel_players with the migration's unique
 *     index; every phone's resolved colours (resolvePlayerLooks) are distinct, whatever order the
 *     rows arrive in, and a free remembered colour is honoured.
 *  4. Before the migration (no colour/icon columns) players are still seated, rows carry no colour
 *     and every phone shows distinct slot colours; the lobby picker stays hidden.
 *  5. Play again keeps every colour: rematchFn stores slot colours, restart_duel_room (the latest
 *     definition in supabase/migrations) never touches colour or icon, and the resolved colours of
 *     the players who stay are identical before and after, in rooms seated before, after and across
 *     the migration.
 *  6. No new client write access: the migration adds no grant or policy, and the client API never
 *     writes duel_players.
 *  6b. Where PostgreSQL is installed (as for beta-recording-check), every migration is applied to a
 *     local database: the unique index refuses a second player with a colour, the range and id
 *     constraints hold, rooms are independent, the real restart_duel_room keeps every colour and
 *     icon, a player's own room still reads them, and clients still can't write them.
 *  7. Awards are the same for every player (any row order gives the same awards; nothing takes a
 *     viewer), only appear when earned (fixtures for each award either side of its threshold, and
 *     every award in 300 random rooms re-proved from the results), need a real achievement (18 Oct
 *     2026: Fastest Finger a full solve of 110+ (120+ until 19 Oct) in half the clock, So Close a genuinely small gap,
 *     Comeback Kid a climb of 2+ onto the podium, none of it in two-player rooms), go to the better
 *     figure first, then players who didn't win, and break ties the fixed way.
 *
 *   bun scripts/player-looks-check.ts
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  PLAYER_COLOURS,
  PLAYER_ICON_IDS,
  BADGE_GLYPH,
  isPlayerColour,
  lookColumnsPresent,
  resolvePlayerLooks,
} from "../src/lib/duel/playerLook";
import {
  changePlayerLook,
  forgetLookColumns,
  insertPlayerWithLook,
  persistAutoColours,
} from "../src/lib/duel/playerLook.server";
import { PLAYER_ICON_ART } from "../src/components/duel/playerIcons";
import { COMEBACK_MAX_FINAL_PLACE, COMEBACK_MIN_PLACES, FASTEST_MAX_SHARE, FASTEST_MIN_SCORE, podiumAwards, type AwardRound, type PodiumAward } from "../src/lib/duel/podiumAwards";
import { isGenuinelyClose, nearMissInfo } from "../src/lib/duel/nearMiss";
import { standings } from "../src/lib/duel/scoring";
import { roundMaxFor, scaledToMax } from "../src/lib/duel/roundMax";
import type { DuelPlayerRow, RoundResultRow } from "../src/lib/duel/types";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else if (failures.length < 40) failures.push(message);
  else if (failures.length === 40) failures.push("… more failures not shown");
}

let seed = 20261017;
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

/* ------------------------------------------------------------------ 1. palette */

const BG = "#0B0B0F";
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const luminance = (h: string) => {
  const [r, g, b] = rgb(h).map(lin) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};
const VISION: Record<string, number[][]> = {
  normal: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
function lab(linear: number[]): [number, number, number] {
  const [r, g, b] = linear.map((v) => Math.min(1, Math.max(0, v))) as [number, number, number];
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
function deltaE2000([L1, a1, b1]: number[], [L2, a2, b2]: number[]): number {
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1!, b1!), C2 = Math.hypot(a2!, b2!), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1!, ap2 = (1 + G) * a2!;
  const Cp1 = Math.hypot(ap1, b1!), Cp2 = Math.hypot(ap2, b2!);
  const hue = (x: number, y: number) => ((Math.atan2(y, x) / rad) + 360) % 360;
  const hp1 = hue(ap1, b1!), hp2 = hue(ap2, b2!);
  let dh = hp2 - hp1;
  if (Cp1 * Cp2 === 0) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dL = L2! - L1!, dC = Cp2 - Cp1, dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh / 2) * rad);
  const Lb = (L1! + L2!) / 2, Cpb = (Cp1 + Cp2) / 2;
  let hb = hp1 + hp2;
  if (Cp1 * Cp2 !== 0) hb = Math.abs(hp1 - hp2) > 180 ? (hp1 + hp2 + 360) / 2 : (hp1 + hp2) / 2;
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad);
  const SL = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2), SC = 1 + 0.045 * Cpb, SH = 1 + 0.015 * Cpb * T;
  const RT = -2 * Math.sqrt(Cpb ** 7 / (Cpb ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hb - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}
const seen = (hex: string, m: number[][]) => {
  const l = rgb(hex).map(lin);
  return lab(m.map((row) => row[0]! * l[0]! + row[1]! * l[1]! + row[2]! * l[2]!));
};

const hexes = PLAYER_COLOURS.map((c) => c.hex);
check(PLAYER_COLOURS.length === 10, `palette has ${PLAYER_COLOURS.length} colours, want 10`);
check(new Set(hexes).size === hexes.length, "palette colours are not distinct");
check(new Set(PLAYER_COLOURS.map((c) => c.name)).size === hexes.length, "palette names are not distinct");
for (const { name, hex } of PLAYER_COLOURS) {
  check(contrast(hex, BG) >= 4.5, `${name} ${hex}: ${contrast(hex, BG).toFixed(2)}:1 on the background, want 4.5`);
  check(contrast(hex, BADGE_GLYPH) >= 4.5, `${name} ${hex}: glyph ${contrast(hex, BADGE_GLYPH).toFixed(2)}:1, want 4.5`);
}
const visionMins: string[] = [];
for (const [vision, matrix] of Object.entries(VISION)) {
  let min = Infinity, pair = "";
  for (let i = 0; i < hexes.length; i++)
    for (let j = i + 1; j < hexes.length; j++) {
      const d = deltaE2000(seen(hexes[i]!, matrix), seen(hexes[j]!, matrix));
      if (d < min) [min, pair] = [d, `${PLAYER_COLOURS[i]!.name}/${PLAYER_COLOURS[j]!.name}`];
    }
  visionMins.push(`${vision} ${min.toFixed(1)} (${pair})`);
  check(min >= 10, `${vision}: ${pair} only ${min.toFixed(1)} ΔE2000 apart, want 10`);
}

/* ------------------------------------------------------------------ 2. icons */

check(PLAYER_ICON_IDS.length === 16, `${PLAYER_ICON_IDS.length} icons, want 16`);
check(new Set(PLAYER_ICON_IDS).size === PLAYER_ICON_IDS.length, "icon ids are not distinct");
for (const id of PLAYER_ICON_IDS) {
  check(/^[a-z]{1,16}$/.test(id), `icon id ${id} breaks the migration's constraint`);
  check(!!PLAYER_ICON_ART[id]?.art && !!PLAYER_ICON_ART[id]?.label, `icon ${id} has no art`);
}
check(Object.keys(PLAYER_ICON_ART).length === PLAYER_ICON_IDS.length, "icon art lists ids not in PLAYER_ICON_IDS");
// Joe, 17 Oct 2026: no gambling symbols in the set (the Die became the Compass).
for (const id of PLAYER_ICON_IDS)
  check(!/^(die|dice|chip|chips|card|cards|coin|coins|slot|slots|roulette)$/.test(id), `icon ${id} is a gambling symbol`);
check((PLAYER_ICON_IDS as readonly string[]).includes("compass"), "the Compass icon is missing");

/* ------------------------------------------------------------------ in-memory duel_players */

type Row = Record<string, unknown>;
const CLASH = (index: string) => ({ code: "23505", message: `duplicate key value violates unique constraint "${index}"` });

/** duel_players with its unique indexes (slot, user and, with the migration, the room's colours). */
function playersDb(columns: boolean) {
  const rows: Row[] = [];
  const clash = (candidate: Row, self?: Row) => {
    for (const row of rows) {
      if (row === self || row["duel_id"] !== candidate["duel_id"]) continue;
      if (row["player_slot"] === candidate["player_slot"]) return CLASH("duel_players_duel_slot_key");
      if (row["user_id"] === candidate["user_id"]) return CLASH("duel_players_duel_user_key");
      if (columns && candidate["colour"] != null && row["colour"] === candidate["colour"])
        return CLASH("duel_players_duel_colour_key");
    }
    return null;
  };
  const missingColumn = (values: Row) =>
    !columns && ("colour" in values || "icon" in values)
      ? { code: "PGRST204", message: "Could not find the 'colour' column of 'duel_players' in the schema cache" }
      : null;
  const client = {
    from(table: string) {
      if (table !== "duel_players") throw new Error(`unexpected table ${table}`);
      return {
        select(cols = "*") {
          const tests: ((row: Row) => boolean)[] = [];
          const q = {
            eq: (k: string, v: unknown) => (tests.push((r) => r[k] === v), q),
            order: () => q,
            limit: () => q,
            then: (resolve: (r: { data: Row[] | null; error: unknown }) => void) => {
              if (!columns && /colour|icon/.test(cols)) return resolve({ data: null, error: missingColumn({ colour: 0 }) });
              resolve({ data: rows.filter((r) => tests.every((t) => t(r))).map((r) => structuredClone(r)), error: null });
            },
          };
          return q;
        },
        insert(values: Row) {
          const error = missingColumn(values) ?? clash(values);
          if (!error) rows.push(structuredClone({ id: `id-${values["duel_id"]}-${values["player_slot"]}`, ...values }));
          return Promise.resolve({ data: null, error });
        },
        update(values: Row) {
          const tests: ((row: Row) => boolean)[] = [];
          const q = {
            eq: (k: string, v: unknown) => (tests.push((r) => r[k] === v), q),
            is: (k: string, v: unknown) => (tests.push((r) => (r[k] ?? null) === v), q),
            then: (resolve: (r: { data: null; error: unknown }) => void) => {
              const error0 = missingColumn(values);
              if (error0) return resolve({ data: null, error: error0 });
              for (const row of rows.filter((r) => tests.every((t) => t(r)))) {
                const error = clash({ ...row, ...values }, row);
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

function distinctColours(players: DuelPlayerRow[], where: string): boolean {
  const looks = resolvePlayerLooks(players);
  const colours = [...looks.values()].map((l) => l.colour);
  const ok = new Set(colours).size === colours.length && colours.every(isPlayerColour);
  check(ok, `${where}: colours not unique (${colours.join(",")})`);
  // Every phone resolves the same, whatever order the rows arrive in.
  const again = resolvePlayerLooks(shuffle(players));
  check(
    [...looks].every(([slot, look]) => again.get(slot)?.colour === look.colour && again.get(slot)?.icon === look.icon),
    `${where}: resolved looks depend on row order`,
  );
  return ok;
}

const seat = (client: unknown, room: string, slot: number, look: { colour?: number; icon?: string | null }) =>
  insertPlayerWithLook(
    client,
    { duel_id: room, player_slot: slot, user_id: `${room}-u${slot}`, display_name: `P${slot}`, status: "active" },
    look,
  );
const remembered = () => ({
  ...(rand() < 0.75 ? { colour: int(10) } : rand() < 0.5 ? { colour: 42 } : {}),
  icon: rand() < 0.6 ? PLAYER_ICON_IDS[int(16)]! : rand() < 0.5 ? null : "not-an-icon",
});

/* ------------------------------------------------------------------ 3. unique colours (server code) */

let rooms = 0;
forgetLookColumns();
{
  const db = playersDb(true);
  for (let r = 0; r < 250; r++) {
    const room = `room${r}`;
    const count = 2 + int(9);
    const prefs = Array.from({ length: count }, remembered);
    // Joins arrive one at a time and, every so often, two at once (their reads interleave).
    let slot = 1;
    while (slot <= count) {
      if (slot < count && rand() < 0.35) {
        await Promise.all([seat(db.client, room, slot, prefs[slot - 1]!), seat(db.client, room, slot + 1, prefs[slot]!)]);
        slot += 2;
      } else {
        const before = resolvePlayerLooks(asPlayers(db.rows, room));
        const want = prefs[slot - 1]!.colour;
        await seat(db.client, room, slot, prefs[slot - 1]!);
        const mine = asPlayers(db.rows, room).find((p) => p.player_slot === slot);
        const free = isPlayerColour(want) && ![...before.values()].some((l) => l.colour === want);
        if (free) check(mine?.colour === want, `${room} slot ${slot}: free remembered colour ${want} not honoured`);
        slot++;
      }
    }
    const players = asPlayers(db.rows, room);
    check(players.length === count, `${room}: ${players.length} of ${count} players seated`);
    check(players.every((p) => isPlayerColour(p.colour)), `${room}: a player was seated without a stored colour`);
    check(
      players.every((p) => p.icon === null || (PLAYER_ICON_IDS as readonly string[]).includes(p.icon as string)),
      `${room}: an invalid icon was stored`,
    );
    distinctColours(players, `${room} after joins`);
    {
      const icons = players.map((p) => p.icon).filter(Boolean);
      check(new Set(icons).size === icons.length, `${room}: two players joined with the same icon`);
    }
    // Lobby changes: random requests, taken ones refused, free ones applied.
    for (let k = 0; k < 6; k++) {
      const me = players[int(players.length)]!;
      const current = asPlayers(db.rows, room);
      const want = int(11) - (rand() < 0.1 ? 3 : 0);
      const holder = current.find((p) => p.colour === want && p.player_slot !== me.player_slot);
      const icon = rand() < 0.5 ? PLAYER_ICON_IDS[int(16)]! : undefined;
      const iconHolder = icon && current.find((p) => p.icon === icon && p.player_slot !== me.player_slot);
      const result = await changePlayerLook(db.client, current.find((p) => p.player_slot === me.player_slot)!, {
        colour: want,
        ...(icon ? { icon } : {}),
      });
      if (!isPlayerColour(want)) check(!result.ok, `${room}: colour ${want} accepted`);
      else if (holder) check(!result.ok, `${room}: slot ${me.player_slot} took ${holder.player_slot}'s colour ${want}`);
      else if (iconHolder) check(!result.ok, `${room}: slot ${me.player_slot} took ${iconHolder.player_slot}'s icon ${icon}`);
      else check(result.ok, `${room}: free colour ${want} refused (${result.ok ? "" : result.message})`);
      distinctColours(asPlayers(db.rows, room), `${room} after a lobby change`);
      const icons = asPlayers(db.rows, room).map((p) => p.icon).filter(Boolean);
      check(new Set(icons).size === icons.length, `${room}: two players share an icon after a lobby change`);
    }
    check(!(await changePlayerLook(db.client, players[0]!, { icon: "skull" })).ok, `${room}: unknown icon accepted`);
    // Someone leaves (keeps their row and colour until Play again).
    const leaver = db.rows.find((row) => row["duel_id"] === room && row["player_slot"] === count);
    if (leaver && count > 2) leaver["status"] = "left";
    distinctColours(asPlayers(db.rows, room), `${room} after a leave`);
    rooms++;
  }
}

/* ------------------------------------------------------------------ 4. before the migration */

forgetLookColumns();
{
  const db = playersDb(false);
  for (let r = 0; r < 40; r++) {
    const room = `old${r}`;
    const count = 2 + int(9);
    for (let slot = 1; slot <= count; slot++) await seat(db.client, room, slot, remembered());
    const players = asPlayers(db.rows, room);
    check(players.length === count, `${room} (no columns): ${players.length} of ${count} seated`);
    check(players.every((p) => !("colour" in p) && !("icon" in p)), `${room} (no columns): a row carries a look`);
    check(!lookColumnsPresent(players), `${room} (no columns): the lobby would show the picker`);
    const looks = resolvePlayerLooks(players);
    check(
      players.every((p) => looks.get(p.player_slot)?.colour === p.player_slot - 1 && looks.get(p.player_slot)?.icon === null),
      `${room} (no columns): not slot colours with initials`,
    );
    distinctColours(players, `${room} (no columns)`);
    const change = await changePlayerLook(db.client, players[0]!, { colour: 5 });
    check(!change.ok, `${room} (no columns): a lobby change was accepted`);
  }
}
forgetLookColumns();

/* ------------------------------------------------------------------ 5. Play again */

const migrations = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
const restartDefs = migrations.filter((f) => /CREATE OR REPLACE FUNCTION public\.restart_duel_room/.test(readFileSync(`supabase/migrations/${f}`, "utf8")));
const latestRestart = restartDefs[restartDefs.length - 1]!;
const restartSql = readFileSync(`supabase/migrations/${latestRestart}`, "utf8");
const restartStart = restartSql.lastIndexOf("CREATE OR REPLACE FUNCTION public.restart_duel_room");
const restartBody = restartSql.slice(restartStart, restartSql.indexOf("$$;", restartSql.indexOf("$$", restartStart) + 2));
check(!/\bcolour\b|\bicon\b/i.test(restartBody), `${latestRestart}: restart_duel_room touches colour or icon`);
check(/DELETE FROM public\.duel_players WHERE duel_id = p_room_id AND status = 'left'/.test(restartBody), `${latestRestart}: restart no longer removes only left players (re-check this simulation)`);
const functionsSrc = readFileSync("src/lib/duel/duel.functions.ts", "utf8");
const rematch = functionsSrc.slice(functionsSrc.indexOf("export const rematchFn"), functionsSrc.indexOf("export const checkWordFn"));
check(
  rematch.indexOf("persistAutoColours(client, roomPlayers)") > 0 && rematch.indexOf("persistAutoColours") < rematch.indexOf("restart_duel_room"),
  "rematchFn no longer stores slot colours (every row, left included) before restart_duel_room",
);

/** restart_duel_room's effect on duel_players: left rows go, the rest are reset to active. */
function restart(rows: Row[], room: string) {
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i]!["duel_id"] === room && rows[i]!["status"] === "left") rows.splice(i, 1);
  for (const row of rows) if (row["duel_id"] === room) Object.assign(row, { status: "active", ready_round: 0, intro_ready_round: 0 });
}
for (const mode of ["after", "across", "before"] as const) {
  forgetLookColumns();
  for (let r = 0; r < 60; r++) {
    // "across": seated before the migration, Play again after it.
    const db = playersDb(mode !== "before");
    const room = `again-${mode}${r}`;
    const count = 2 + int(9);
    for (let slot = 1; slot <= count; slot++) {
      if (mode === "across") db.rows.push({ id: `x${slot}`, duel_id: room, player_slot: slot, user_id: `u${slot}`, display_name: `P${slot}`, status: "active", colour: null, icon: null });
      else await seat(db.client, room, slot, remembered());
    }
    // In the "across" rooms a couple of players chose a colour after the migration.
    if (mode === "across")
      for (let k = 0; k < 2; k++) {
        const me = asPlayers(db.rows, room)[int(count)]!;
        await changePlayerLook(db.client, me, { colour: int(10) });
      }
    for (const row of db.rows) if (row["player_slot"] !== 1 && rand() < 0.25) row["status"] = "left";
    const before = resolvePlayerLooks(asPlayers(db.rows, room));
    if (mode !== "before") await persistAutoColours(db.client, asPlayers(db.rows, room));
    restart(db.rows, room);
    const stayed = asPlayers(db.rows, room);
    const after = resolvePlayerLooks(stayed);
    check(
      stayed.every((p) => after.get(p.player_slot)?.colour === before.get(p.player_slot)?.colour && after.get(p.player_slot)?.icon === before.get(p.player_slot)?.icon),
      `${room}: Play again changed a colour or icon`,
    );
    distinctColours(stayed, `${room} after Play again`);
    // The next game's lobby: a newcomer still gets a colour no one has.
    await seat(db.client, room, count + 1 > 10 ? 10 : count + 1, { colour: before.get(1)?.colour ?? 0 });
    distinctColours(asPlayers(db.rows, room), `${room} newcomer after Play again`);
  }
}
forgetLookColumns();

/* ------------------------------------------------------------------ 6. no new client writes */

const migrationFile = migrations.find((f) => /player_colour_icon/.test(f));
check(!!migrationFile, "no player colour/icon migration in supabase/migrations");
if (migrationFile) {
  const sql = readFileSync(`supabase/migrations/${migrationFile}`, "utf8").replace(/--.*$/gm, "");
  check(/ADD COLUMN IF NOT EXISTS colour smallint/.test(sql) && /ADD COLUMN IF NOT EXISTS icon text/.test(sql), `${migrationFile}: columns missing`);
  check(/CREATE UNIQUE INDEX IF NOT EXISTS duel_players_duel_colour_key\s+ON public\.duel_players \(duel_id, colour\)/.test(sql), `${migrationFile}: no unique (duel_id, colour) index`);
  check(/BETWEEN 0 AND 9/.test(sql), `${migrationFile}: no colour range check`);
  check(!/\b(GRANT|POLICY|DISABLE ROW LEVEL SECURITY)\b/i.test(sql), `${migrationFile}: changes grants or policies`);
}
for (const file of ["src/lib/duel/api.ts", "src/lib/duel/playerLook.ts", "src/components/duel/RoomLobby.tsx"]) {
  const src = readFileSync(file, "utf8");
  check(!/from\("duel_players"\)\s*\.(insert|update|upsert|delete)/.test(src), `${file} writes duel_players from the client`);
}


/* ------------------------------------------------------------------ 6b. the migration, run for real */

function postgresBin(): string | null {
  const root = "/usr/lib/postgresql";
  if (!existsSync(root)) return null;
  for (const version of readdirSync(root).sort().reverse()) {
    const bin = join(root, version, "bin");
    if (["initdb", "pg_ctl", "psql"].every((tool) => existsSync(join(bin, tool)))) return bin;
  }
  return null;
}
let sqlNote = "SQL checked as text only (no PostgreSQL binaries)";
const bin = postgresBin();
if (bin) {
  const dir = mkdtempSync(join(tmpdir(), "player-looks-"));
  chmodSync(dir, 0o777);
  const asRoot = process.getuid?.() === 0;
  const run = (cmd: string, args: string[]) =>
    asRoot
      ? spawnSync("runuser", ["-u", "postgres", "--", cmd, ...args], { encoding: "utf8" })
      : spawnSync(cmd, args, { encoding: "utf8" });
  const data = join(dir, "data");
  let started = false;
  try {
    const init = run(join(bin, "initdb"), ["-D", data, "-A", "trust", "-U", "postgres"]);
    if (init.status !== 0) throw new Error(`initdb: ${init.stderr}`);
    const up = run(join(bin, "pg_ctl"), ["-D", data, "-o", `-k ${dir} -c listen_addresses='' -c fsync=off`, "-l", join(dir, "log"), "-w", "start"]);
    if (up.status !== 0) throw new Error(`pg_ctl: ${up.stderr}${up.stdout}`);
    started = true;
    const psql = (sql: string, user = "postgres") => {
      const file = join(dir, "q.sql");
      writeFileSync(file, sql);
      const out = spawnSync(join(bin, "psql"), ["-h", dir, "-U", user, "-d", "postgres", "-X", "-q", "-tA", "-v", "ON_ERROR_STOP=1", "-f", file], { encoding: "utf8" });
      return { ok: out.status === 0, out: (out.stdout ?? "").trim(), err: (out.stderr ?? "").trim() };
    };
    const stub = psql(`
      CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
      CREATE ROLE client_probe LOGIN IN ROLE anon, authenticated;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, created_at timestamptz DEFAULT now(), last_sign_in_at timestamptz, is_anonymous boolean DEFAULT true);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      SET client_min_messages = error; CREATE PUBLICATION supabase_realtime;`);
    if (!stub.ok) throw new Error(`stub: ${stub.err}`);
    let applied = 0;
    for (const file of migrations) {
      const out = psql(readFileSync(`supabase/migrations/${file}`, "utf8"));
      check(out.ok, `SQL: migration ${file} applies (${out.err.split("\n").find((l) => /ERROR/.test(l)) ?? ""})`);
      if (!out.ok) break;
      applied++;
    }
    const ROOM = "22222222-2222-2222-2222-222222222222";
    const OTHER = "33333333-3333-3333-3333-333333333333";
    const user = (n: number) => `b0000000-0000-0000-0000-00000000000${n}`;
    const setup = psql(`
      INSERT INTO public.duels (id, room_code, status, host_user_id, round_order) VALUES
        ('${ROOM}', 'LOOK', 'waiting', '${user(1)}', '[]'::jsonb), ('${OTHER}', 'LOOX', 'waiting', '${user(5)}', '[]'::jsonb);
      INSERT INTO public.duel_players (duel_id, player_slot, user_id, display_name, status, colour, icon) VALUES
        ('${ROOM}', 1, '${user(1)}', 'Host', 'active', 4, 'bolt'), ('${ROOM}', 2, '${user(2)}', 'Stay', 'active', 7, NULL),
        ('${ROOM}', 3, '${user(3)}', 'Gone', 'left', 2, 'moon'), ('${ROOM}', 4, '${user(4)}', 'Old', 'active', NULL, NULL),
        ('${OTHER}', 1, '${user(5)}', 'Elsewhere', 'active', 4, 'bolt');`);
    check(setup.ok, `SQL: rooms set up with colours (${setup.err})`);
    const refused = (sql: string, why: RegExp, what: string) => {
      const out = psql(sql);
      check(!out.ok && why.test(out.err), `SQL: ${what} was not refused (${out.ok ? "accepted" : out.err.split("\n")[0]})`);
    };
    refused(`INSERT INTO public.duel_players (duel_id, player_slot, user_id, display_name, status, colour) VALUES ('${ROOM}', 5, '${user(6)}', 'Dup', 'active', 7)`, /duel_players_duel_colour_key/, "a second player with the same colour");
    refused(`UPDATE public.duel_players SET colour = 4 WHERE duel_id = '${ROOM}' AND player_slot = 2`, /duel_players_duel_colour_key/, "changing to a colour someone holds");
    refused(`UPDATE public.duel_players SET colour = 2 WHERE duel_id = '${ROOM}' AND player_slot = 2`, /duel_players_duel_colour_key/, "taking a colour a left player still holds");
    refused(`UPDATE public.duel_players SET colour = 10 WHERE duel_id = '${ROOM}' AND player_slot = 2`, /duel_players_colour_range/, "colour 10");
    refused(`UPDATE public.duel_players SET icon = 'Not An Icon' WHERE duel_id = '${ROOM}' AND player_slot = 2`, /duel_players_icon_id/, "an icon that is not an id");
    check(psql(`UPDATE public.duel_players SET colour = 3, icon = 'wave' WHERE duel_id = '${ROOM}' AND player_slot = 4`).ok, "SQL: a free colour and an icon were refused");
    check(psql(`INSERT INTO public.duel_players (duel_id, player_slot, user_id, display_name, status) VALUES ('${ROOM}', 5, '${user(7)}', 'NoLook', 'active')`).ok, "SQL: two rows without a colour clash");
    const looksIn = (room: string) =>
      psql(`SELECT string_agg(player_slot || ':' || coalesce(colour::text, '-') || ':' || coalesce(icon, '-'), ',' ORDER BY player_slot) FROM public.duel_players WHERE duel_id = '${room}'`).out;
    const before = looksIn(ROOM);
    check(psql(`UPDATE public.duels SET status = 'finished' WHERE id = '${ROOM}'`).ok, "SQL: room not finished");
    const restarted = psql(`SELECT public.restart_duel_room('${ROOM}', '${user(1)}')`);
    check(restarted.ok && restarted.out === "t", `SQL: restart_duel_room failed (${restarted.err})`);
    const after = looksIn(ROOM);
    const expected = before.split(",").filter((entry) => !entry.startsWith("3:")).join(",");
    check(after === expected, `SQL: Play again changed colours or icons (${before} → ${after})`);
    check(looksIn(OTHER) === "1:4:bolt", "SQL: another room's colours changed");
    const read = psql(`SELECT set_config('request.jwt.claim.sub', '${user(2)}', false); SELECT string_agg(coalesce(colour::text, '-'), ',' ORDER BY player_slot) FROM public.duel_players WHERE duel_id = '${ROOM}'`, "client_probe");
    check(read.ok && read.out.split("\n").pop() === "4,7,3,-", `SQL: a player can't read their room's colours (${read.out || read.err})`);
    const write = psql(`SELECT set_config('request.jwt.claim.sub', '${user(2)}', false); UPDATE public.duel_players SET colour = 9 WHERE user_id = '${user(2)}'`, "client_probe");
    check(!write.ok && /permission denied/.test(write.err), `SQL: a client could write their colour (${write.ok ? "accepted" : write.err})`);
    sqlNote = `applied ${applied}/${migrations.length} migrations to a local PostgreSQL`;
  } catch (err) {
    sqlNote = `local PostgreSQL unavailable (${err instanceof Error ? err.message.split("\n")[0] : String(err)}): SQL checked as text only`;
  } finally {
    if (started) run(join(bin, "pg_ctl"), ["-D", data, "-m", "immediate", "stop"]);
    rmSync(dir, { recursive: true, force: true });
  }
}

/* ------------------------------------------------------------------ 7. awards */

const player = (slot: number, extra: Partial<DuelPlayerRow> = {}): DuelPlayerRow => ({
  id: `p${slot}`, duel_id: "room", player_slot: slot, display_name: `P${slot}`, user_id: `u${slot}`,
  ready_round: 0, intro_ready_round: 0, muted_by_host: false, last_reaction_at: null,
  last_seen_at: "2026-10-17T12:00:00Z", status: "active", joined_at: "2026-10-17T11:00:00Z", ...extra,
});
const result = (slot: number, round: number, score: number, extra: Partial<RoundResultRow> = {}): RoundResultRow => ({
  id: `r${slot}-${round}`, duel_id: "room", player_slot: slot, round_number: round, answer: "",
  is_correct: score >= 100, ms_remaining: 10_000, reaction_avg_ms: null, correct_count: null, errors: null,
  extra: null, score, submitted_at: "2026-10-17T12:00:00Z", ...extra,
} as RoundResultRow);
const PUZZLE: AwardRound = { type: "sudoku", name: "Box Six", timeLimitMs: 60_000, timed: true };
const HOVER: AwardRound = { type: "hover", name: "Hover", timeLimitMs: 75_000, timed: false };
const find = (awards: PodiumAward[], id: string) => awards.find((a) => a.id === id);
/**
 * Figures below are written on the 150 scale and follow each game's own maximum (roundMax.ts): a perfect
 * is the game's maximum (150 today, 200 once its expansion raises it), a threshold scales with it.
 */
const PMAX = roundMaxFor(PUZZLE.type);
const HMAX = roundMaxFor(HOVER.type);
const ps = (onScale150: number) => scaledToMax(PUZZLE.type, onScale150);

// Perfectionist: needs a perfect (the game's maximum); the most perfects wins it; on equal counts, someone who didn't win.
{
  const players = [1, 2, 3].map((s) => player(s));
  const none = podiumAwards(players, [result(1, 1, PMAX - 1), result(2, 1, 120), result(3, 1, 90)], [PUZZLE]);
  check(!find(none, "perfect"), `Perfectionist without a ${PMAX}`);
  const winnerOnly = podiumAwards(players, [result(1, 1, PMAX), result(2, 1, 120), result(3, 1, 90)], [PUZZLE]);
  check(find(winnerOnly, "perfect")?.slot === 1, `Perfectionist: only the winner has a ${PMAX}, so the winner gets it`);
  const both = podiumAwards(players, [
    result(1, 1, PMAX), result(1, 2, PMAX), result(1, 3, PMAX),
    result(2, 1, PMAX), result(2, 2, 40), result(2, 3, 40),
    result(3, 1, PMAX), result(3, 2, 30), result(3, 3, 30),
  ], [PUZZLE, PUZZLE, PUZZLE]);
  check(find(both, "perfect")?.slot === 1, `Perfectionist: 3 perfects must beat 1 (got ${find(both, "perfect")?.slot})`);
  const level = podiumAwards(players, [
    result(1, 1, PMAX), result(1, 2, 100),
    result(2, 1, PMAX), result(2, 2, 40),
    result(3, 1, PMAX), result(3, 2, 30),
  ], [PUZZLE, PUZZLE]);
  check(find(level, "perfect")?.slot === 2, `Perfectionist: equal counts go to a non-winner, then the better final place (got ${find(level, "perfect")?.slot})`);
}
// Comeback Kid: a climb of 2 or more, not 1.
{
  const players = [1, 2, 3, 4].map((s) => player(s));
  const rounds = [PUZZLE, PUZZLE];
  // After round 1: 1,2,3,4 in order. Final: slot 3 climbs to 2nd (1 place) / slot 4 to 2nd (2 places).
  const one = podiumAwards(players, [
    result(1, 1, 100), result(2, 1, 90), result(3, 1, 80), result(4, 1, 70),
    result(1, 2, 100), result(2, 2, 0), result(3, 2, 20), result(4, 2, 0),
  ], rounds);
  check(!find(one, "comeback"), "Comeback Kid for a climb of 1");
  const two = podiumAwards(players, [
    result(1, 1, 100), result(2, 1, 90), result(3, 1, 80), result(4, 1, 70),
    result(1, 2, 100), result(2, 2, 0), result(3, 2, 0), result(4, 2, 30),
  ], rounds);
  check(find(two, "comeback")?.slot === 4 && /From 4th after round 1 to 2nd/.test(find(two, "comeback")!.line), `Comeback Kid: 4th → 2nd not awarded (${JSON.stringify(find(two, "comeback"))})`);
  check(COMEBACK_MIN_PLACES === 2, "Comeback Kid threshold is not 2 places");
  // A climb of 2 that ends off the podium (6th → 4th) is not a comeback.
  const six = [1, 2, 3, 4, 5, 6].map((s) => player(s));
  const offPodium = podiumAwards(six, [
    ...[1, 2, 3, 4, 5, 6].map((s) => result(s, 1, 160 - 20 * s)),
    ...[1, 2, 3, 4, 5, 6].map((s) => result(s, 2, s === 6 ? 45 : 0)),
  ], rounds);
  check(!find(offPodium, "comeback"), `Comeback Kid for a climb off the podium (${JSON.stringify(find(offPodium, "comeback"))})`);
  // Two players: never (2nd → 1st is just winning).
  const pair = podiumAwards([player(1), player(2)], [result(1, 1, 100), result(2, 1, 0), result(1, 2, 0), result(2, 2, 150)], rounds);
  check(!find(pair, "comeback"), "Comeback Kid in a two-player room");
}
// So Close: needs a near miss.
{
  const players = [1, 2, 3].map((s) => player(s));
  const clean = podiumAwards(players, [1, 2, 3].map((s) => result(s, 1, 50 * s, { extra: { gates: 20, totalGates: 20 } })), [HOVER]);
  check(!find(clean, "close"), "So Close with no near miss");
  const miss = podiumAwards(players, [1, 2, 3].map((s) => result(s, 1, 50 * s, { extra: s === 2 ? { gates: 19, totalGates: 20 } : null })), [HOVER]);
  check(find(miss, "close")?.slot === 2 && /1 barrier from the end/.test(find(miss, "close")!.line), "So Close: a near miss not awarded");
  // A big gap is a results line, never So Close: 5 of 20 barriers left, 4 of 4 mazes, 200 m of 500.
  const far = podiumAwards(players, [1, 2, 3].map((s) => result(s, 1, 50 * s, { extra: s === 2 ? { gates: 15, totalGates: 20 } : null })), [HOVER]);
  check(!find(far, "close"), "So Close for 5 of 20 barriers left");
  const fifth = podiumAwards(players, [1, 2, 3].map((s) => result(s, 1, 50 * s, { extra: s === 2 ? { gates: 16, totalGates: 20 } : null })), [HOVER]);
  check(find(fifth, "close")?.slot === 2, "So Close: a fifth of the count left (4 of 20) not awarded");
  const TILT: AwardRound = { type: "tilt", name: "Tilt", timeLimitMs: 75_000, timed: false };
  const noMazes = podiumAwards(players, [1, 2, 3].map((s) => result(s, 1, 40 * s, { extra: s === 2 ? { mazes: 0 } : null })), [TILT]);
  check(!find(noMazes, "close"), "So Close for no maze finished");
  const SWING: AwardRound = { type: "swing", name: "Grappler", timeLimitMs: 75_000, timed: false };
  const metres = (m: number) => podiumAwards(players, [1, 2, 3].map((s) => result(s, 1, 40 * s, { extra: s === 2 ? { metres: m } : null })), [SWING]);
  check(!find(metres(300), "close"), "So Close for 200 m short of 500");
  check(find(metres(460), "close")?.slot === 2, "So Close: 40 m short of 500 not awarded");
  // A perfect (the game's maximum) is never a near miss.
  const full = podiumAwards(players, [1, 2, 3].map((s) => result(s, 1, s === 2 ? HMAX : 40, { extra: s === 2 ? { gates: 19, totalGates: 20 } : null })), [HOVER]);
  check(!find(full, "close"), `So Close on a ${HMAX}`);
}
// Fastest Finger: a full solve scoring 110+ (FASTEST_MIN_SCORE, on the 150 scale: scaled to the game's maximum) in at
// most half the clock; arcade runs and reactions never.
{
  const players = [1, 2, 3].map((s) => player(s));
  const arcade = podiumAwards(players, [1, 2, 3].map((s) => result(s, 1, 150, { ms_remaining: 70_000 })), [HOVER]);
  check(!find(arcade, "fastest"), "Fastest Finger from an arcade run");
  const reaction = podiumAwards(players, [1, 2, 3].map((s) => result(s, 1, 140, { reaction_avg_ms: 250 })), [PUZZLE]);
  check(!find(reaction, "fastest"), "Fastest Finger from a reaction round");
  const zero = podiumAwards(players, [1, 2, 3].map((s) => result(s, 1, 0, { is_correct: false, ms_remaining: 50_000 })), [PUZZLE]);
  check(!find(zero, "fastest"), "Fastest Finger with no correct or scoring finish");
  const timed = podiumAwards(players, [
    result(1, 1, ps(150), { ms_remaining: 50_000 }), // the winner, fastest of all
    result(2, 1, ps(120), { ms_remaining: 30_000 }),
    result(3, 1, ps(130), { ms_remaining: 40_000 }),
  ], [PUZZLE]);
  check(find(timed, "fastest")?.slot === 1, `Fastest Finger: the quickest solve wins it, winner or not (got ${find(timed, "fastest")?.slot})`);
  check(find(timed, "fastest")?.line === "Box Six in 10.0s", `Fastest Finger line: ${find(timed, "fastest")?.line}`);
  // Speed alone is not enough: a quick unsolved answer, a solve below 110, a solve using over half the clock.
  const quickWrong = podiumAwards(players, [1, 2, 3].map((s) => result(s, 1, s === 2 ? ps(110) : 60, { is_correct: false, ms_remaining: 55_000 })), [PUZZLE]);
  check(!find(quickWrong, "fastest"), "Fastest Finger for a quick round-topping answer that was not a solve");
  check(FASTEST_MIN_SCORE === 110, `Fastest Finger's threshold is ${FASTEST_MIN_SCORE}, not 110`);
  // The threshold for this game, worked out here: 110 of 150 scaled to its maximum (110 at 150, 147 at 200).
  const FMIN = Math.round((FASTEST_MIN_SCORE * PMAX) / 150);
  const lowScore = podiumAwards(players, [1, 2, 3].map((s) => result(s, 1, s === 2 ? FMIN - 1 : 60, { is_correct: s === 2, ms_remaining: 55_000 })), [PUZZLE]);
  check(!find(lowScore, "fastest"), `Fastest Finger for a solve scoring under ${FMIN}`);
  const atThreshold = podiumAwards(players, [1, 2, 3].map((s) => result(s, 1, s === 2 ? FMIN : 60, { is_correct: s === 2, ms_remaining: 55_000 })), [PUZZLE]);
  check(find(atThreshold, "fastest")?.slot === 2, `No Fastest Finger for a quick full solve scoring exactly ${FMIN}`);
  const slow = podiumAwards(players, [1, 2, 3].map((s) => result(s, 1, s === 2 ? ps(125) : 60, { is_correct: s === 2, ms_remaining: 25_000 })), [PUZZLE]);
  check(!find(slow, "fastest"), "Fastest Finger for a solve using over half the clock");
  const unknown = podiumAwards(players, [1, 2, 3].map((s) => result(s, 1, s === 2 ? ps(140) : 60, { is_correct: s === 2, ms_remaining: 0 })), [PUZZLE]);
  check(!find(unknown, "fastest"), "Fastest Finger with no stored finishing time");
}
// Too few players or rounds: nothing.
check(podiumAwards([player(1)], [result(1, 1, 150)], [PUZZLE]).length === 0, "awards in a one-player room");
check(podiumAwards([player(1), player(2)], [], []).length === 0, "awards with no rounds");

// 300 random rooms: same for everyone, only when earned.
const KINDS: AwardRound[] = [
  PUZZLE,
  HOVER,
  { type: "reaction", name: "Flash", timeLimitMs: 30_000, timed: false },
  { type: "tilt", name: "Tilt", timeLimitMs: 75_000, timed: false },
  { type: "flood", name: "Colour Flood", timeLimitMs: 45_000, timed: true },
];
let awardsShown = 0;
const awardCounts: Record<string, number> = {};
for (let r = 0; r < 300; r++) {
  const count = 2 + int(9);
  const roundCount = 1 + int(7);
  const rounds = Array.from({ length: roundCount }, () => KINDS[int(KINDS.length)]!);
  const players = Array.from({ length: count }, (_, i) => player(i + 1, rand() < 0.08 ? { status: "inactive" } : {}));
  const results: RoundResultRow[] = [];
  rounds.forEach((round, index) =>
    players.forEach((p) => {
      if (rand() < 0.08) return; // no answer
      const max = roundMaxFor(round.type);
      const score = rand() < 0.15 ? max : int(max);
      results.push(
        result(p.player_slot, index + 1, score, {
          ms_remaining: int(round.timeLimitMs),
          reaction_avg_ms: round.type === "reaction" ? 200 + int(300) : null,
          extra: round.type === "hover" ? { gates: 16 + int(5), totalGates: 20 } : round.type === "tilt" ? { mazes: int(5) } : null,
        }),
      );
    }),
  );
  const awards = podiumAwards(players, results, rounds);
  const key = JSON.stringify(awards);
  for (let k = 0; k < 4; k++)
    check(JSON.stringify(podiumAwards(shuffle(players), shuffle(results), rounds)) === key, `room ${r}: awards depend on row order`);
  check(new Set(awards.map((a) => a.id)).size === awards.length, `room ${r}: an award shown twice`);
  awardsShown += awards.length;
  const final = standings(players, results, rounds.length);
  const place = new Map(final.map((s) => [s.slot, s.position]));
  for (const award of awards) {
    awardCounts[award.id] = (awardCounts[award.id] ?? 0) + 1;
    const mine = results.filter((x) => x.player_slot === award.slot);
    if (award.id === "perfect") {
      // A perfect is the round's game's maximum (150 today, 200 once raised).
      const perfect = (x: RoundResultRow) => x.score >= roundMaxFor(rounds[x.round_number - 1]!.type);
      const n = mine.filter(perfect).length;
      check(n >= 1, `room ${r}: Perfectionist with no perfect score`);
      const best = Math.max(...players.map((p) => results.filter((x) => x.player_slot === p.player_slot && perfect(x)).length));
      check(n === best, `room ${r}: Perfectionist not the most perfect scores in the room`);
    }
    if (award.id === "close") {
      const n = rounds.filter((round, i) => {
        const row = mine.find((x) => x.round_number === i + 1);
        return row && row.score < roundMaxFor(round.type) && isGenuinelyClose(nearMissInfo(round.type as never, row.extra as Record<string, unknown> | null));
      }).length;
      check(n >= 1, `room ${r}: So Close with no genuinely close near miss`);
    }
    if (award.id === "comeback") {
      let worst = 0;
      for (let round = 1; round < rounds.length; round++)
        worst = Math.max(worst, standings(players, results, round).find((s) => s.slot === award.slot)!.position);
      check(worst - place.get(award.slot)! >= COMEBACK_MIN_PLACES, `room ${r}: Comeback Kid climbed only ${worst - place.get(award.slot)!}`);
      check(place.get(award.slot)! <= COMEBACK_MAX_FINAL_PLACE && players.length >= 3, `room ${r}: Comeback Kid off the podium or in a two-player room`);
    }
    if (award.id === "fastest") {
      const ok = rounds.some((round, i) => {
        if (!round.timed) return false;
        const row = mine.find((x) => x.round_number === i + 1);
        return row && row.reaction_avg_ms === null && row.is_correct && row.score >= FASTEST_MIN_SCORE &&
          row.ms_remaining > 0 && round.timeLimitMs - row.ms_remaining <= round.timeLimitMs * FASTEST_MAX_SHARE;
      });
      check(ok, `room ${r}: Fastest Finger without a fast, good, full solve`);
    }
  }
}
for (const id of ["perfect", "fastest", "comeback", "close"])
  check((awardCounts[id] ?? 0) > 0, `no ${id} award in 300 random rooms (the generator no longer exercises it)`);

/* ------------------------------------------------------------------ summary */

console.log(`palette: ${PLAYER_COLOURS.map((c) => `${c.name} ${c.hex}`).join(", ")}`);
console.log(`closest pairs (ΔE2000): ${visionMins.join("; ")}`);
console.log(sqlNote);
console.log(`${rooms} rooms seated with the columns, 40 without, 180 through Play again; ${awardsShown} awards in 300 random rooms (${Object.entries(awardCounts).map(([k, v]) => `${k} ${v}`).join(", ")})`);
if (failures.length) {
  console.log(`FAIL: ${failures.length} of ${passes + failures.length} checks failed`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`PASS: ${passes} checks`);
