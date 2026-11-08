/**
 * daily-colour-check (8 Nov 2026, the live "Can’t reach us" on the Daily Puzzle): since the colour wheel (31 Oct) a
 * player's colour can be 0–31, but async_attempts.colour is CHECK 0–9 (20261021130000), so a daily or challenge start
 * with a wheel colour of 10 or more was refused by the database and the phone showed "Can’t reach us".
 *
 *   1. The server: with the old check in force (a client that refuses as Postgres does, 23514), a start with colour 12
 *      succeeds and stores no colour; colours 0–9 are kept; any other database error still throws; a challenge's
 *      copied attempt does the same.
 *   2. The SQL (on a local PostgreSQL when installed): under 20261021130000 alone, colour 12 is refused (the live bug);
 *      after 20261108130000_async_attempt_colours.sql, 0–31 are stored and 32 is refused.
 *
 *   bun scripts/daily-colour-check.ts
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { importFinishedAttempt, startAttempt, ASYNC_STORED_COLOUR_MAX } from "../src/lib/duel/asyncRoom.server";
import { ensureDailyRoom } from "../src/lib/duel/daily.server";
import { memoryDb } from "./fixtures/memoryDb";

const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else failures.push(message);
};
const quietly = async <T>(fn: () => Promise<T>): Promise<T> => {
  const saved = [console.log, console.warn, console.error];
  console.log = console.warn = console.error = () => {};
  try {
    return await fn();
  } finally {
    [console.log, console.warn, console.error] = saved;
  }
};

const UNIQUE = {
  async_rooms: ["room_key"], async_attempts: ["room_id", "user_id"], async_results: ["attempt_id", "round_number"],
  async_events: ["attempt_id", "round_number", "event"], async_room_secrets: ["room_id"],
};
/** memoryDb with async_attempts' live check: colour 0–9 or null, else 23514 as Postgres answers. */
function oldCheckDb(otherError?: { code: string; message: string }) {
  const db = memoryDb({ async_rooms: [], async_attempts: [], async_results: [], async_events: [], async_room_secrets: [] }, { unique: UNIQUE });
  const from = db.client.from.bind(db.client);
  let refused = 0;
  (db.client as { from: (t: string) => unknown }).from = (table: string) => {
    const q = from(table) as { insert: (row: unknown) => unknown };
    if (table !== "async_attempts") return q;
    const insert = q.insert.bind(q);
    return {
      ...q,
      insert: (row: { colour?: number | null }) => {
        if (otherError) return Promise.resolve({ data: null, error: otherError });
        if (row.colour !== null && row.colour !== undefined && (row.colour < 0 || row.colour > 9)) {
          refused++;
          return Promise.resolve({ data: null, error: { code: "23514", message: 'new row for relation "async_attempts" violates check constraint "async_attempts_colour_check"' } });
        }
        return insert(row);
      },
    };
  };
  return { db, refusedCount: () => refused };
}

const NOW = Date.parse("2026-11-08T12:00:00Z");

/* ------------------------------------------------------------------ 1. the server ---- */
{
  check(ASYNC_STORED_COLOUR_MAX === 9, "the old check's top colour is 9");
  const { db, refusedCount } = oldCheckDb();
  const room = await quietly(() => ensureDailyRoom(db.client, "puzzle", NOW, "u1"));
  const wheel = await quietly(() => startAttempt(db.client, room, "wheel", { name: "Joe", colour: 12, icon: null }, NOW));
  const stored = db.tables.async_attempts!.find((r) => r["user_id"] === "wheel");
  check(wheel.ok && wheel.created && stored !== undefined && stored["colour"] === null && refusedCount() === 1, `a wheel colour (12) starts the daily and is stored as no colour (${wheel.ok ? "started" : wheel.message})`);
  check(wheel.ok && wheel.attempt.colour === null, "the attempt handed back is the stored one (no colour)");
  for (const colour of [0, 9, null]) {
    const r = await quietly(() => startAttempt(db.client, room, `c${colour}`, { name: "Sam", colour, icon: null }, NOW));
    const row = db.tables.async_attempts!.find((x) => x["user_id"] === `c${colour}`);
    check(r.ok && row?.["colour"] === colour, `colour ${colour} is kept`);
  }
  const again = await quietly(() => startAttempt(db.client, room, "wheel", { name: "Joe", colour: 12, icon: null }, NOW + 1000));
  check(again.ok && !again.created, "a second start returns the same attempt");
  // Any other database error still refuses the start (no silent retry).
  const broken = oldCheckDb({ code: "57014", message: "canceling statement due to statement timeout" });
  const room2 = await quietly(() => ensureDailyRoom(broken.db.client, "puzzle", NOW, "u1"));
  let threw = false;
  try {
    await quietly(() => startAttempt(broken.db.client, room2, "x", { name: "Al", colour: 12, icon: null }, NOW));
  } catch {
    threw = true;
  }
  check(threw, "another database error still refuses the start");
  // A challenge made from a room copies each player's colour: the same rule.
  const copied = await quietly(() =>
    importFinishedAttempt(db.client, room, { userId: "copied", name: "Bo", colour: 20, icon: null }, [], NOW + 2000),
  );
  const copiedRow = db.tables.async_attempts!.find((r) => r["user_id"] === "copied");
  check(copiedRow !== undefined && copiedRow["colour"] === null, `a challenge's copied attempt with colour 20 is stored with no colour (${String(copied)})`);
}

/* ------------------------------------------------------------------ 2. the SQL ---- */
function postgresBin(): string | null {
  const root = "/usr/lib/postgresql";
  if (!existsSync(root)) return null;
  for (const version of readdirSync(root).sort().reverse()) {
    const bin = join(root, version, "bin");
    if (["initdb", "pg_ctl", "psql"].every((b) => existsSync(join(bin, b)))) return bin;
  }
  return null;
}
const FIX = "20261108130000_async_attempt_colours.sql";
const migrations = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
check(migrations.includes(FIX), "the colour migration is in supabase/migrations");
const fixText = readFileSync(`supabase/migrations/${FIX}`, "utf8");
check(!/\b(UPDATE|DELETE)\b/i.test(fixText.replace(/--.*$/gm, "")), "the migration rewrites no stored row");
const bin = postgresBin();
if (!bin) console.log("  NOTE no PostgreSQL binaries found: the SQL was checked as text only");
else {
  const dir = mkdtempSync(join(tmpdir(), "daily-colour-check-"));
  chmodSync(dir, 0o777);
  const asRoot = process.getuid?.() === 0;
  const run = (cmd: string, args: string[]) =>
    asRoot ? spawnSync("runuser", ["-u", "postgres", "--", cmd, ...args], { encoding: "utf8" }) : spawnSync(cmd, args, { encoding: "utf8" });
  const data = join(dir, "data");
  let started = false;
  try {
    if (run(join(bin, "initdb"), ["-D", data, "-A", "trust", "-U", "postgres"]).status !== 0) throw new Error("initdb failed");
    const up = run(join(bin, "pg_ctl"), ["-D", data, "-o", `-k ${dir} -c listen_addresses='' -c fsync=off`, "-l", join(dir, "log"), "-w", "start"]);
    if (up.status !== 0) throw new Error(`pg_ctl: ${up.stderr}`);
    started = true;
    const psql = (sql: string) => {
      const file = join(dir, "q.sql");
      writeFileSync(file, sql);
      const out = spawnSync(join(bin, "psql"), ["-h", dir, "-U", "postgres", "-d", "postgres", "-X", "-q", "-tA", "-v", "ON_ERROR_STOP=1", "-f", file], { encoding: "utf8" });
      return { ok: out.status === 0, out: (out.stdout ?? "").trim(), err: (out.stderr ?? "").trim() };
    };
    const stub = psql(`
      CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, created_at timestamptz DEFAULT now(), last_sign_in_at timestamptz, is_anonymous boolean DEFAULT true);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO anon, authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
      SET client_min_messages = error; CREATE PUBLICATION supabase_realtime;`);
    if (!stub.ok) throw new Error(`stub: ${stub.err}`);
    // Every migration up to the daily's (what the live database holds), then the daily's own rows.
    let applied = true;
    for (const file of migrations.filter((f) => f <= "20261021130000_async_rooms_daily.sql")) {
      const out = psql(readFileSync(`supabase/migrations/${file}`, "utf8"));
      if (!out.ok) {
        check(false, `SQL: ${file} applies (${out.err.split("\n").find((l) => /ERROR/.test(l)) ?? ""})`);
        applied = false;
        break;
      }
    }
    if (applied) {
      const ROOM = "10000000-0000-0000-0000-000000000001";
      const room = psql(`INSERT INTO public.async_rooms (id, kind, room_key, day, seed, round_order, round_count, puzzles_public, opens_at, closes_at)
        VALUES ('${ROOM}', 'daily_puzzle', 'daily_puzzle:today', current_date, 1, '["flow"]', 1, '[{"type":"flow"}]', now() - interval '1 hour', now() + interval '1 hour');`);
      check(room.ok, `SQL: a daily room (${room.err})`);
      const attempt = (n: number, colour: number) =>
        psql(`INSERT INTO public.async_attempts (room_id, user_id, display_name, colour) VALUES ('${ROOM}', '00000000-0000-4000-8000-${String(n).padStart(12, "0")}', 'Joe', ${colour});`);
      const before = attempt(1, 12);
      check(!before.ok && /check constraint/i.test(before.err), "SQL: under the daily's migration alone, colour 12 is refused (the live bug)");
      check(attempt(2, 9).ok, "SQL: colour 9 is stored before the fix");
      const fix = psql(fixText);
      check(fix.ok, `SQL: ${FIX} applies (${fix.err})`);
      check(psql(fixText).ok, "SQL: and applies again (idempotent)");
      check(attempt(3, 12).ok && attempt(4, 31).ok && attempt(5, 0).ok, "SQL: after it, colours 0, 12 and 31 are stored");
      check(!attempt(6, 32).ok && !attempt(7, -1).ok, "SQL: 32 and -1 are still refused");
      const nulls = psql(`INSERT INTO public.async_attempts (room_id, user_id, display_name, colour) VALUES ('${ROOM}', '00000000-0000-4000-8000-000000000008', 'Al', NULL);`);
      check(nulls.ok, "SQL: no colour is still allowed");
      // The whole set applies in order too (the fix after every later migration).
      const rest = migrations.filter((f) => f > "20261021130000_async_rooms_daily.sql" && f !== FIX);
      let restOk = true;
      for (const file of rest) if (!psql(readFileSync(`supabase/migrations/${file}`, "utf8")).ok) restOk = false;
      check(restOk && psql(fixText).ok, "SQL: every later migration and the fix apply on top");
    }
  } catch (err) {
    console.log(`  NOTE local PostgreSQL unavailable (${err instanceof Error ? err.message.split("\n")[0] : String(err)}): the SQL was checked as text only`);
  } finally {
    if (started) run(join(bin, "pg_ctl"), ["-D", data, "-m", "immediate", "stop"]);
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(`daily-colour-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(`FAIL: ${failures.length} problems`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("PASS: wheel colours start the daily and challenges, before and after the colour migration");
process.exit(0);
