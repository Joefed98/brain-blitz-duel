/**
 * security-hardening-check (Nov 2026): access rules and server-side checks that must stay as they are. One section
 * each; no browser (~5 s, plus a local PostgreSQL pass when the binaries are installed).
 *
 *   1. Async rooms: phones read the daily rooms' window columns only; a challenge's room is never listed directly.
 *      Async attempts: a phone reads its own, and other players' only once finished.
 *   2. Profile's challenge list answers only for challenges the caller made or has an attempt in, under its own
 *      per-user bucket.
 *   3. Room reactions are shown only from players in the room's own list (named from it), never from someone who
 *      left or was muted by the host; Apex's ghost cars only under a room slot's key, one per other seat, the quiet
 *      ones forgotten.
 *   4. A room round's live word and move checks take a per-user bucket.
 *   5. The offline worker keeps same-origin app files by path only (a request with a query string is not kept).
 *   6. Check-only window stand-ins are read through checkOverride, which a production build turns off.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, label: string): void {
  if (ok) passes += 1;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}
const src = (path: string) => readFileSync(path, "utf8");
/** One server function's text, from its export to the next export. */
function fnText(file: string, name: string): string {
  const text = src(file);
  const at = text.indexOf(`export const ${name}`);
  if (at < 0) return "";
  const next = text.indexOf("\nexport ", at + 10);
  return text.slice(at, next < 0 ? undefined : next);
}

/* ------------------------------------------------------------------ 1. async rooms' read policy ---- */
const MIGRATION = "20261111225000_async_rooms_read_daily.sql";
const migrations = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
{
  check(migrations.includes(MIGRATION), "1: the async rooms read-policy migration exists");
  const sql = src(`supabase/migrations/${MIGRATION}`);
  check(/CREATE POLICY async_rooms_read ON public\.async_rooms FOR SELECT TO authenticated\s+USING \(kind IN \('daily_puzzle', 'daily_arcade'\)\)/.test(sql), "1: the policy lets phones read the daily kinds only");
  check(!/\b(DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM|UPDATE\s)/i.test(sql) && !/GRANT\s+(INSERT|UPDATE|DELETE|ALL)[^;]*TO\s+(anon|authenticated)/i.test(sql), "1: the migration touches no data and grants phones no write");
  const att = src("supabase/migrations/20261111225100_async_attempts_read_finished.sql");
  check(/USING \(user_id = auth\.uid\(\) OR \(finished_at IS NOT NULL AND public\.async_board_open\(room_id\)\)\)/.test(att), "1: other players' attempts are readable only once finished");
  const later = migrations.filter((f) => f > MIGRATION && /async_rooms_read/.test(src(`supabase/migrations/${f}`)));
  check(later.length === 0 || later.every((f) => /kind IN \('daily_puzzle', 'daily_arcade'\)/.test(src(`supabase/migrations/${f}`))), `1: no later migration widens the policy again (${later.join(", ") || "none"})`);
  // Nothing in the app reads the async tables with a phone's token: only the server's data layer does.
  const phoneReads: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(entry.name) && !/\.server\.ts$/.test(entry.name) && !/integrations\/supabase\/types\.ts$/.test(path)) {
        if (/from\("async_(rooms|attempts)"\)/.test(src(path))) phoneReads.push(path);
      }
    }
  };
  walk("src");
  check(phoneReads.length === 0, `1: no phone-side module queries async_rooms or async_attempts (${phoneReads.join(", ") || "none"})`);
}

function postgresBin(): string | null {
  const root = "/usr/lib/postgresql";
  if (!existsSync(root)) return null;
  for (const version of readdirSync(root).sort().reverse()) {
    const bin = join(root, version, "bin");
    if (["initdb", "pg_ctl", "psql"].every((b) => existsSync(join(bin, b)))) return bin;
  }
  return null;
}
{
  const bin = postgresBin();
  if (!bin) console.log("  NOTE no PostgreSQL binaries found: section 1's SQL was checked as text only");
  else {
    const dir = mkdtempSync(join(tmpdir(), "security-hardening-"));
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
        chmodSync(file, 0o666);
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
      let applied = 0;
      for (const file of migrations) {
        const out = psql(src(`supabase/migrations/${file}`));
        if (!out.ok) {
          check(false, `1 SQL: migration ${file} applies (${out.err.split("\n").find((l) => /ERROR/.test(l)) ?? ""})`);
          break;
        }
        applied++;
      }
      check(applied === migrations.length, `1 SQL: all ${migrations.length} migrations apply in order`);
      const set = psql(`
        INSERT INTO public.async_rooms (id, kind, room_key, day, seed, round_order, round_count, puzzles_public, opens_at, closes_at) VALUES
          ('10000000-0000-0000-0000-000000000001', 'daily_puzzle', 'daily_puzzle:today', current_date, 1, '["flow"]', 1, '[{"type":"flow"}]', now() - interval '1 hour', now() + interval '1 hour'),
          ('10000000-0000-0000-0000-000000000002', 'daily_arcade', 'daily_arcade:today', current_date, 2, '["breaker"]', 1, '[{"type":"breaker"}]', now() - interval '1 hour', now() + interval '1 hour'),
          ('10000000-0000-0000-0000-000000000003', 'challenge', 'challenge:ABCDEF', NULL, 3, '["flow"]', 1, '[{"type":"flow"}]', now(), now() + interval '7 days');`);
      check(set.ok, `1 SQL: test rooms set up (${set.err})`);
      const as = (sql: string) => psql(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false); ${sql}`);
      const last = (r: { out: string }) => r.out.split("\n").pop() ?? "";
      const listed = as(`SELECT string_agg(kind, ',' ORDER BY kind) FROM public.async_rooms`);
      check(listed.ok && last(listed) === "daily_arcade,daily_puzzle", `1 SQL: a phone lists the daily rooms and no challenge room (${last(listed) || listed.err})`);
      const byKey = as(`SELECT count(*) FROM public.async_rooms WHERE room_key LIKE 'challenge:%'`);
      check(byKey.ok && last(byKey) === "0", "1 SQL: a challenge's room can't be found by its key");
      const windowCols = as(`SELECT id, kind, room_key, day, round_count, opens_at, closes_at FROM public.async_rooms`);
      check(windowCols.ok, "1 SQL: the daily rooms' window columns stay readable");
      const puzzles = as(`SELECT puzzles_public FROM public.async_rooms LIMIT 1`);
      check(!puzzles.ok && /permission denied/.test(puzzles.err), "1 SQL: no room's puzzles are readable");
      const att = psql(`
        INSERT INTO public.async_attempts (room_id, user_id, display_name, finished_at) VALUES
          ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'Me', now()),
          ('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'Done', now()),
          ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c', 'Playing', NULL);`);
      check(att.ok, `1 SQL: test attempts set up (${att.err})`);
      const board = as(`SELECT string_agg(display_name, ',' ORDER BY display_name) FROM public.async_attempts`);
      check(board.ok && last(board) === "Done,Me", `1 SQL: a phone reads its own attempt and finished ones, never one still playing (${last(board) || board.err})`);
      const playing = psql(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-00000000000c', false); SELECT string_agg(display_name, ',' ORDER BY display_name) FROM public.async_attempts`);
      check(playing.ok && last(playing) === "Playing", `1 SQL: a phone still playing reads only its own attempt (${last(playing) || playing.err})`);
      const anon = psql(`SET ROLE anon; SELECT count(*) FROM public.async_rooms`);
      check(!anon.ok, "1 SQL: a signed-out client reads nothing");
    } catch (err) {
      console.log(`  NOTE local PostgreSQL unavailable (${err instanceof Error ? err.message.split("\n")[0] : String(err)}): section 1's SQL was checked as text only`);
    } finally {
      if (started) run(join(bin, "pg_ctl"), ["-D", data, "-m", "immediate", "stop"]);
      rmSync(dir, { recursive: true, force: true });
    }
  }
}

/* ------------------------------------------------------------------ 2. the challenge list ---- */
{
  type Row = Record<string, unknown>;
  const tables: Record<string, Row[]> = {
    challenges: [
      { room_id: "r-made", code: "MADE22", created_by: "me", round_count: 3, created_at: "2026-11-01T10:00:00Z", expires_at: "2026-11-30T10:00:00Z" },
      { room_id: "r-played", code: "PLAY22", created_by: "sam", round_count: 3, created_at: "2026-11-02T10:00:00Z", expires_at: "2026-11-30T10:00:00Z" },
      { room_id: "r-other", code: "OTHR22", created_by: "kim", round_count: 3, created_at: "2026-11-03T10:00:00Z", expires_at: "2026-11-30T10:00:00Z" },
    ],
    async_attempts: [
      { id: "a1", room_id: "r-made", user_id: "me", display_name: "Me", started_at: "2026-11-01T10:00:00Z", finished_at: "2026-11-01T10:10:00Z", total_score: 400 },
      { id: "a2", room_id: "r-played", user_id: "sam", display_name: "Sam", started_at: "2026-11-02T10:00:00Z", finished_at: "2026-11-02T10:10:00Z", total_score: 500 },
      { id: "a3", room_id: "r-played", user_id: "me", display_name: "Me", started_at: "2026-11-02T11:00:00Z", finished_at: null, total_score: 0 },
      { id: "a4", room_id: "r-other", user_id: "kim", display_name: "Kim", started_at: "2026-11-03T10:00:00Z", finished_at: "2026-11-03T10:10:00Z", total_score: 612 },
    ],
  };
  const query = (table: string) => {
    const filters: [string, unknown][] = [];
    const result = () => (tables[table] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v));
    const q = {
      select: () => q,
      eq: (k: string, v: unknown) => (filters.push([k, v]), q),
      order: () => q,
      limit: () => q,
      maybeSingle: async () => ({ data: result()[0] ?? null, error: null }),
      single: async () => ({ data: result()[0] ?? null, error: null }),
      then: (resolve: (v: { data: Row[]; error: null }) => unknown) => resolve({ data: result(), error: null }),
    };
    return q;
  };
  const client = { from: query } as never;
  const { myChallenges } = await import("../src/lib/duel/challenge.server");
  const now = Date.parse("2026-11-05T10:00:00Z");
  const mine = await myChallenges(client, "me", ["PLAY22", "OTHR22"], now);
  const codes = mine.map((c) => c.code).sort();
  check(codes.join(",") === "MADE22,PLAY22", `2: the list holds the caller's own and the one they played, never another's (${codes.join(",")})`);
  const stranger = await myChallenges(client, "nobody", ["MADE22", "PLAY22", "OTHR22"], now);
  check(stranger.length === 0, `2: a device with no attempt in any of them gets none back (${stranger.length})`);
  const fn = fnText("src/lib/duel/challenge.functions.ts", "myChallengesFn");
  check(/withinRateLimit\(client, context\.userId, CHALLENGE_LIST_LIMIT\)/.test(fn) && fn.indexOf("CHALLENGE_LIST_LIMIT)") < fn.indexOf("myChallenges(client"), "2: myChallengesFn takes its per-user bucket before reading");
  const { CHALLENGE_LIST_LIMIT } = await import("../src/lib/duel/rateLimit.server");
  check(CHALLENGE_LIST_LIMIT.max > 0 && CHALLENGE_LIST_LIMIT.max <= 120 && CHALLENGE_LIST_LIMIT.windowSeconds >= 600, `2: the list's bucket is at most 120 per 10 minutes (${CHALLENGE_LIST_LIMIT.max}/${CHALLENGE_LIST_LIMIT.windowSeconds}s)`);
}

/* ------------------------------------------------------------------ 3. reactions and ghost cars ---- */
{
  const { acceptReaction } = await import("../src/lib/duel/reactionRoster");
  const roster = [
    { user_id: "u1", display_name: "Ali", status: "active", muted_by_host: false },
    { user_id: "u2", display_name: "Bo", status: "left", muted_by_host: false },
    { user_id: "u3", display_name: "Cy", status: "active", muted_by_host: true },
    { user_id: "u4", display_name: "Dee", status: "inactive", muted_by_host: false },
  ];
  // Changed with Joe's approval, 14 Nov 2026 (routine consequence of the approved playerId rename): lines 207–215.
  const ok = acceptReaction({ emoji: "🔥", playerId: "u1", name: "Host" }, roster);
  check(!!ok && ok.name === "Ali" && ok.playerId === "u1", "3: a player's reaction is named from the room's list, not the message");
  check(acceptReaction({ emoji: "🔥", playerId: "zz", name: "Ali" }, roster) === null, "3: a reaction from someone not in the room is dropped");
  check(acceptReaction({ emoji: "🔥", playerId: "u2", name: "Bo" }, roster) === null, "3: a reaction from a player who left is dropped");
  check(acceptReaction({ emoji: "🔥", playerId: "u3", name: "Cy" }, roster) === null, "3: a reaction from a player the host muted is dropped");
  check(acceptReaction({ emoji: "🔥", playerId: "u4" }, roster)?.name === "Dee", "3: a player who only went quiet still reacts");
  check(acceptReaction({ emoji: "hello <b>", playerId: "u1" }, roster) === null && acceptReaction({ emoji: 5, playerId: "u1" }, roster) === null, "3: only the fixed emoji set");
  check(acceptReaction({ emoji: "🔥", playerId: 7 }, roster) === null && acceptReaction(null, roster) === null, "3: a malformed reaction is dropped, not thrown");
  const early = acceptReaction({ emoji: "🔥", playerId: "u9", name: "x".repeat(40) }, null);
  check(!!early && early.name.length <= 16, "3: before the list loads, the message's name is cut to a guest name's length");
  const chat = src("src/lib/duel/useRoomChat.ts");
  check(/acceptReaction\(payload, rosterRef\.current\)/.test(chat) && !/payload as \{ emoji\?: string; name\?: string; userId\?: string \}/.test(chat), "3: the room chat hook runs every received reaction through acceptReaction");
  // Changed with Joe's approval, 13 Nov 2026: the room screen passes its own key (seatKey.ts, Security C1b: phones read no account ids).
  check(/useRoomChat\(duel\?\.id \?\? null, myKey, chatActive, players\)/.test(src("src/routes/duel.$code.tsx")), "3: the room screen hands the chat hook its player list");

  const ghosts = await import("../src/lib/duel/raceGhosts");
  const { MAX_PLAYERS } = await import("../src/lib/duel/types");
  check(ghosts.isGhostKey("1") && ghosts.isGhostKey(String(MAX_PLAYERS)) && !ghosts.isGhostKey(String(MAX_PLAYERS + 1)) && !ghosts.isGhostKey("0") && !ghosts.isGhostKey("abc") && !ghosts.isGhostKey(3) && !ghosts.isGhostKey("01"), "3: a ghost's key must be a room slot");
  const map = new Map<string, { at: number }>([["1", { at: 0 }], ["2", { at: 10_000 }]]);
  ghosts.pruneGhosts(map, 10_000 + ghosts.GHOST_STALE_MS - 1);
  check(!map.has("1") && map.has("2"), "3: a quiet ghost is forgotten, a live one kept");
  const g = src("src/lib/duel/raceGhosts.ts");
  check(/isGhostKey\(p\.key\)/.test(g) && /seen\.size >= MAX_PLAYERS - 1/.test(g) && /pruneGhosts\(seen, now\)/.test(g), "3: the ghost channel takes slot keys only, holds one per other seat and drops the quiet ones");
}

/* ------------------------------------------------------------------ 4. room checks ---- */
{
  const rl = await import("../src/lib/duel/rateLimit.server");
  check(rl.ROOM_CHECK_LIMIT.max > 0 && rl.ROOM_CHECK_LIMIT.max <= rl.IP_PRACTICE_CHECK_LIMIT.max && rl.ROOM_CHECK_LIMIT.windowSeconds >= 600, `4: room checks have a bounded per-user bucket (${rl.ROOM_CHECK_LIMIT.max}/${rl.ROOM_CHECK_LIMIT.windowSeconds}s)`);
  for (const name of ["checkWordFn", "checkMovesFn"]) {
    const text = fnText("src/lib/duel/duel.functions.ts", name);
    const at = text.indexOf("withinRateLimit(client, context.userId, ROOM_CHECK_LIMIT)");
    check(at > 0 && at < text.indexOf("puzzles_public[") && /if \(!allowed\) return/.test(text), `4: ${name} takes the room-check bucket before it checks anything`);
  }
}

/* ------------------------------------------------------------------ 5. the offline worker's app cache ---- */
{
  const { offlineWorkerSource } = await import("../src/lib/offline/swPlugin");
  const ORIGIN = "https://joulz.uk";
  const stores = new Map<string, Map<string, Response>>();
  const keyOf = (r: string | Request) => (typeof r === "string" ? new URL(r, ORIGIN).href : r.url);
  const open = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name)!;
    return {
      async match(r: string | Request, opts?: { ignoreSearch?: boolean }) {
        const k = keyOf(r);
        for (const [key, v] of m) if (key === k || (opts?.ignoreSearch && key.split("?")[0] === k.split("?")[0])) return v.clone();
        return undefined;
      },
      async put(r: string | Request, v: Response) {
        m.set(keyOf(r), v);
      },
      async delete(r: string | Request) {
        return m.delete(keyOf(r));
      },
      async keys() {
        return [...m.keys()].map((k) => new Request(k));
      },
    };
  };
  const cacheStorage = {
    open: async (name: string) => open(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    has: async (name: string) => stores.has(name),
    async match(r: string | Request, opts?: { ignoreSearch?: boolean }) {
      for (const name of stores.keys()) {
        const hit = await open(name).match(r, opts);
        if (hit) return hit;
      }
      return undefined;
    },
  };
  const fakeFetch = async () => new Response("x", { status: 200 });
  const own = new Map<string, (event: unknown) => void>();
  const self = {
    addEventListener: (type: string, fn: (event: unknown) => void) => own.set(type, fn),
    location: { origin: ORIGIN, search: "" },
    navigator: {},
    clients: { claim: async () => {}, matchAll: async () => [] },
    skipWaiting: async () => {},
  };
  const source = offlineWorkerSource({ version: "test", bundleFiles: ["assets/app-AbCdEfGh12.js"], publicFiles: ["/icon-192.png", "/sounds/a.mp3"] });
  new Function("self", "caches", "fetch", "Request", "Response", "crypto", "URL", source)(self, cacheStorage, fakeFetch, Request, Response, globalThis.crypto, URL);
  const get = async (path: string) => {
    let p: Promise<unknown> = Promise.resolve();
    own.get("fetch")!({ request: new Request(ORIGIN + path), respondWith: (x: Promise<unknown>) => (p = x) });
    await p;
    await new Promise((r) => setTimeout(r, 5));
  };
  for (let i = 0; i < 25; i++) await get(`/icon-192.png?n=${i}`);
  await get("/icon-192.png");
  await get("/sounds/a.mp3?v=1");
  const app = stores.get("joulz-app-test");
  const appKeys = app ? [...app.keys()] : [];
  check(appKeys.length === 1 && appKeys[0] === `${ORIGIN}/icon-192.png`, `5: 25 requests with a query string keep nothing; the plain path is kept once (${appKeys.length} kept)`);
  const media = stores.get("joulz-media-v1");
  check(!!media && [...media.keys()].some((k) => k === `${ORIGIN}/sounds/a.mp3`), "5: media is still kept once played, by path");
}

/* ------------------------------------------------------------------ 6. check-only stand-ins ---- */
{
  const helper = src("src/lib/checkOverride.ts");
  check(/if \(import\.meta\.env\.PROD\) return undefined;/.test(helper) && helper.indexOf("import.meta.env.PROD") < helper.indexOf("window as unknown"), "6: checkOverride returns nothing in a production build before reading window");
  // Vite replaces the literal `import.meta.env.PROD` with true in a production build: do the same and run it.
  const transpiler = new Bun.Transpiler({ loader: "ts" });
  const asBuilt = (prod: string) =>
    transpiler.transformSync(helper.replaceAll("import.meta.env.PROD", prod)).replace(/export\s+function/g, "function").replace(/export\s+type[^;]+;/g, "") + "\nreturn checkOverride;";
  const prodFn = new Function("window", asBuilt("true")) as (w: unknown) => (name: string) => unknown;
  const devFn = new Function("window", asBuilt("false")) as (w: unknown) => (name: string) => unknown;
  const page = { __DUELZ_BETA_CONFIG__: { TALLY_URL: "https://example.test" }, __DUELZ_FIRST_OPEN__: true };
  check(prodFn(page)("__DUELZ_BETA_CONFIG__") === undefined && prodFn(page)("__DUELZ_FIRST_OPEN__") === undefined, "6: built for production, a page's stand-ins are ignored");
  check(devFn(page)("__DUELZ_FIRST_OPEN__") === true, "6: on a dev server the checks' stand-ins still work");

  // Every window.__DUELZ_…__ read in src goes through checkOverride, but the three switches that are off for players
  // by their own rule (auditInput: dev only; shopSwitch and badgesApi: their own PROD test; packs: only under navigator.webdriver).
  const OWN_RULE: Record<string, RegExp> = {
    "src/lib/arcade/auditInput.ts": /if \(!import\.meta\.env\.DEV \|\| typeof window === "undefined"\) return null;/,
    "src/lib/identity/shopSwitch.ts": /if \(import\.meta\.env\.PROD\) return null;/,
    "src/lib/badges/badgesApi.ts": /navigator\.webdriver !== true\) return false;\n\s*if \(import\.meta\.env\.PROD\) return true;/,
    "src/lib/offline/packs.ts": /navigator\.webdriver === true && \(window as \{ __DUELZ_ALLOW_PACKS__\?: boolean \}\)\.__DUELZ_ALLOW_PACKS__ !== true/,
  };
  const direct: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(entry.name) && path !== join("src", "lib", "checkOverride.ts")) {
        const code = src(path)
          .split("\n")
          .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
          .join("\n");
        if (/\.__DUELZ_[A-Z_]+__/.test(code) && !(path in OWN_RULE)) direct.push(path);
      }
    }
  };
  walk("src");
  check(direct.length === 0, `6: no module reads a window stand-in directly (${direct.join(", ") || "none"})`);
  for (const [path, rule] of Object.entries(OWN_RULE)) check(rule.test(src(path)), `6: ${path} keeps its own rule for players`);
  const names = [...helper.matchAll(/"(__DUELZ_[A-Z_]+__)"/g)].map((m) => m[1]!);
  const used = new Set<string>();
  const collect = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) collect(path);
      else if (/\.(ts|tsx)$/.test(entry.name)) for (const m of src(path).matchAll(/checkOverride(?:<[^>]*>)?\("(__DUELZ_[A-Z_]+__)"\)/g)) used.add(m[1]!);
    }
  };
  collect("src");
  check([...used].every((n) => names.includes(n)) && used.size >= 8, `6: every stand-in read is a named one (${used.size} in use)`);
}

console.log(`security-hardening-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: async room reads, the challenge list, reactions and ghosts, room-check buckets, the offline app cache and check-only stand-ins.");
