/**
 * The server-function harness (7 Nov 2026, docs/audit-nov-2026/build-health.md item 3): runs the app's real
 * `createServerFn` handlers, with their real middleware (`requireSupabaseAuth`) and the real supabase-js clients
 * (`client.server.ts`, the middleware's user client), against a local PostgreSQL 16 with every migration in
 * `supabase/migrations` applied in order.
 *
 * Three stand-ins, nothing else:
 *
 * 1. **The Start compiler's server split.** Without Vite, `.handler(fn)` keeps `fn` as the client stub and has
 *    no server implementation. `installServerFnPlugin()` replaces `@tanstack/react-start`'s `createServerFn` with
 *    one that passes the handler as both, which is what the compiled server bundle does, so
 *    `fn.__executeServer()` runs the middleware chain and the handler exactly as a request would.
 * 2. **The request.** `callServerFn()` runs that inside Start's request and start contexts (`requestHandler`,
 *    `runWithStartContext`), so `getRequest()` sees the caller's `Authorization: Bearer <jwt>`.
 * 3. **Supabase's HTTP APIs.** A small local server speaks the subset of PostgREST (`/rest/v1`) and GoTrue
 *    (`/auth/v1/user`) the server code uses, over the local database. Every request is its own transaction as
 *    PostgREST makes it: `SET LOCAL ROLE` from the bearer token's `role` claim (`service_role`, which bypasses RLS,
 *    `authenticated` or `anon`) and `request.jwt.claims` / `request.jwt.claim.sub` set, so RLS policies, column
 *    grants and `auth.uid()` apply as they do on Supabase. Anything outside the subset answers an error naming
 *    it (`PGRST_HARNESS`), so a new query shape fails loudly here instead of passing.
 *
 * Tokens are HS256 JWTs signed with a test secret; the auth endpoint verifies the signature and that the user
 * exists in `auth.users`. Nothing here is imported by the app.
 */

import { spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/* ------------------------------------------------------------------ PostgreSQL */

export function postgresBin(): string | null {
  const root = "/usr/lib/postgresql";
  if (!existsSync(root)) return null;
  for (const version of readdirSync(root).sort().reverse()) {
    const bin = join(root, version, "bin");
    if (["initdb", "pg_ctl", "psql"].every((b) => existsSync(join(bin, b)))) return bin;
  }
  return null;
}

/**
 * Supabase's own setup, as far as the migrations and the server code reach: the three API roles, `auth.users`,
 * `auth.uid()` / `auth.role()` / `auth.jwt()` as GoTrue defines them, the realtime publication, and the default
 * privileges Supabase gives the API roles on `public` (migrations then revoke what clients must not have).
 */
const SUPABASE_STUB = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
  CREATE ROLE authenticator NOINHERIT LOGIN; GRANT anon, authenticated, service_role TO authenticator;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY, created_at timestamptz DEFAULT now(), last_sign_in_at timestamptz, is_anonymous boolean DEFAULT true, email text);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
    SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')) $$;
  CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
    SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
  SET client_min_messages = error; CREATE PUBLICATION supabase_realtime;`;

export interface LocalDb {
  /** Directory holding the socket (`.s.PGSQL.5432`). */
  socketDir: string;
  /** Runs SQL as the superuser through psql. */
  psql(sql: string): { ok: boolean; out: string; err: string };
  /** Migrations applied, in order. */
  applied: string[];
  /** The first migration that failed, with its error line. */
  failed: { file: string; error: string } | null;
  stop(): void;
}

/**
 * Starts a throwaway cluster and applies every migration in order. Throws if PostgreSQL can't start.
 * `applyMigrations: false` stops after Supabase's setup (the stub), for scripts/migrate.ts's own applier.
 */
export function startLocalDb(
  prefix = "server-fn-",
  { applyMigrations = true }: { applyMigrations?: boolean } = {},
): LocalDb {
  const bin = postgresBin();
  if (!bin) throw new Error("no PostgreSQL binaries");
  const dir = mkdtempSync(join(tmpdir(), prefix));
  chmodSync(dir, 0o777);
  const asRoot = process.getuid?.() === 0;
  const run = (cmd: string, args: string[]) =>
    asRoot
      ? spawnSync("runuser", ["-u", "postgres", "--", cmd, ...args], { encoding: "utf8" })
      : spawnSync(cmd, args, { encoding: "utf8" });
  const data = join(dir, "data");
  let started = false;
  const stop = () => {
    if (started) run(join(bin, "pg_ctl"), ["-D", data, "-m", "immediate", "stop"]);
    started = false;
    rmSync(dir, { recursive: true, force: true });
  };
  try {
    const init = run(join(bin, "initdb"), ["-D", data, "-A", "trust", "-U", "postgres"]);
    if (init.status !== 0) throw new Error(`initdb failed: ${init.stderr}`);
    const up = run(join(bin, "pg_ctl"), [
      "-D",
      data,
      "-o",
      `-k ${dir} -c listen_addresses='' -c fsync=off -c max_connections=60`,
      "-l",
      join(dir, "log"),
      "-w",
      "start",
    ]);
    if (up.status !== 0) throw new Error(`pg_ctl: ${up.stderr}`);
    started = true;
    let n = 0;
    const psql = (sql: string) => {
      const file = join(dir, `q${n++}.sql`);
      writeFileSync(file, sql);
      const out = spawnSync(
        join(bin, "psql"),
        [
          "-h",
          dir,
          "-U",
          "postgres",
          "-d",
          "postgres",
          "-X",
          "-q",
          "-tA",
          "-v",
          "ON_ERROR_STOP=1",
          "-f",
          file,
        ],
        { encoding: "utf8" },
      );
      rmSync(file, { force: true });
      return {
        ok: out.status === 0,
        out: (out.stdout ?? "").trim(),
        err: (out.stderr ?? "").trim(),
      };
    };
    const stub = psql(SUPABASE_STUB);
    if (!stub.ok) throw new Error(`stub: ${stub.err}`);
    const applied: string[] = [];
    let failed: LocalDb["failed"] = null;
    for (const file of applyMigrations
      ? readdirSync("supabase/migrations")
          .filter((f) => f.endsWith(".sql"))
          .sort()
      : []) {
      const out = psql(readFileSync(`supabase/migrations/${file}`, "utf8"));
      if (!out.ok) {
        failed = { file, error: out.err.split("\n").find((l) => /ERROR/.test(l)) ?? out.err };
        break;
      }
      applied.push(file);
    }
    return { socketDir: dir, psql, applied, failed, stop };
  } catch (err) {
    stop();
    throw err;
  }
}

/* ------------------------------------------------------------------------ JWTs */

export const JWT_SECRET = "server-fn-harness-secret-not-for-production-use-0000";

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

export function signJwt(claims: Record<string, unknown>): string {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(claims));
  const sig = createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

export function verifyJwt(token: string): Record<string, unknown> | null {
  const [head, body, sig] = token.split(".");
  if (!head || !body || !sig) return null;
  const want = createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url");
  if (want !== sig) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    if (typeof claims["exp"] === "number" && claims["exp"] * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

const HOUR = 3600;
export const SERVICE_KEY = signJwt({
  role: "service_role",
  iss: "supabase",
  iat: 1,
  exp: 4102444800,
});
export const ANON_KEY = signJwt({ role: "anon", iss: "supabase", iat: 1, exp: 4102444800 });

/** A signed-in (anonymous) device's access token, as GoTrue issues it. */
export function userToken(userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  return signJwt({
    sub: userId,
    role: "authenticated",
    aud: "authenticated",
    is_anonymous: true,
    iat: now,
    exp: now + HOUR,
    session_id: userId,
  });
}

/** A permanent account's access token for a new session (accounts, 10 Nov 2026): not anonymous, its own session id. */
export function accountToken(userId: string, sessionId: string = crypto.randomUUID()): string {
  const now = Math.floor(Date.now() / 1000);
  return signJwt({
    sub: userId,
    role: "authenticated",
    aud: "authenticated",
    is_anonymous: false,
    iat: now,
    exp: now + HOUR,
    session_id: sessionId,
  });
}

/** One email the GoTrue stand-in "sent" (accounts): what Supabase would mail, with its 6-digit code. */
export interface SentMail {
  to: string;
  /** The template Supabase would use: email_change (linking an email to a guest) or magic_link (signing in). */
  template: "email_change" | "magic_link";
  token: string;
  userId: string;
}

/* ------------------------------------------------------- PostgREST stand-in */

// postgres.js (a dev dependency) over the socket.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = any;

interface RestError {
  status: number;
  body: { code: string; message: string; details: string | null; hint: string | null };
}

const ident = (name: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw harnessError(`identifier ${JSON.stringify(name)}`);
  return `"${name}"`;
};

function harnessError(what: string): RestError {
  return {
    status: 400,
    body: {
      code: "PGRST_HARNESS",
      message: `server-fn harness: unsupported ${what}`,
      details: null,
      hint: null,
    },
  };
}

/** PostgreSQL error → PostgREST's HTTP status (PostgREST's own table, for the codes that come up). */
function pgStatus(code: string, authenticated: boolean): number {
  if (code === "23505" || code === "23503") return 409;
  if (code === "42501") return authenticated ? 403 : 401;
  if (code === "42P01" || code === "42883") return 404;
  if (code === "P0001") return 400;
  return 400;
}

interface Request0 {
  method: string;
  table: string;
  params: URLSearchParams;
  prefer: string[];
  accept: string;
  body: unknown;
}

type Columns = Map<string, string>;

export interface RestServer {
  url: string;
  /** Emails the GoTrue stand-in sent (accounts), oldest first. */
  mail: SentMail[];
  /** Every request served: method, path and status (for diagnosing a failing flow). */
  log: { method: string; path: string; status: number; role: string; error?: string }[];
  /**
   * Supabase Auth's settings for anonymous sign-in (safety, 10 Nov 2026), off by default as on a fresh project:
   * `captchaSecret` turns on captcha protection (Cloudflare's published test secrets only: 1x… passes, 2x… and 3x…
   * fail, as Cloudflare's siteverify answers for them); `beforeUserCreated` names the public Postgres function set as
   * the Before User Created hook (called with GoTrue's payload: metadata.ip_address from X-Forwarded-For).
   */
  auth: { captchaSecret: string | null; beforeUserCreated: string | null };
  stop(): Promise<void>;
}

/** Cloudflare Turnstile's published test secret keys and what siteverify answers for any token with each. */
export const TURNSTILE_TEST_SECRETS = {
  pass: "1x0000000000000000000000000000000AA",
  fail: "2x0000000000000000000000000000000AA",
  spent: "3x0000000000000000000000000000000AA",
} as const;

/** siteverify as Cloudflare answers it for the test secrets (a token is required; anything works with a test secret). */
export function turnstileTestVerify(secret: string, token: string): { success: boolean; "error-codes": string[] } {
  if (!token) return { success: false, "error-codes": ["missing-input-response"] };
  if (secret === TURNSTILE_TEST_SECRETS.pass) return { success: true, "error-codes": [] };
  if (secret === TURNSTILE_TEST_SECRETS.fail) return { success: false, "error-codes": ["invalid-input-response"] };
  if (secret === TURNSTILE_TEST_SECRETS.spent) return { success: false, "error-codes": ["timeout-or-duplicate"] };
  throw new Error("server-fn harness: only Cloudflare's test secrets are served");
}

export async function startRestServer(socketDir: string): Promise<RestServer> {
  const postgres = (await import("postgres")).default;
  const sql: Sql = postgres({
    path: join(socketDir, ".s.PGSQL.5432"),
    user: "postgres",
    database: "postgres",
    max: 40,
    onnotice: () => {},
  });
  const columnCache = new Map<string, Columns>();
  const pkCache = new Map<string, string[]>();
  const fnCache = new Map<
    string,
    { args: Map<string, string>; retset: boolean; rettype: string } | null
  >();

  async function columns(table: string): Promise<Columns> {
    const hit = columnCache.get(table);
    if (hit) return hit;
    const rows = await sql`SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type
      FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ${table} AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum`;
    const map: Columns = new Map(rows.map((r: { name: string; type: string }) => [r.name, r.type]));
    if (map.size > 0) columnCache.set(table, map);
    return map;
  }
  async function primaryKey(table: string): Promise<string[]> {
    const hit = pkCache.get(table);
    if (hit) return hit;
    const rows = await sql`SELECT a.attname AS name FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = ${`public.${table}`}::regclass AND i.indisprimary`;
    const pk = rows.map((r: { name: string }) => r.name);
    pkCache.set(table, pk);
    return pk;
  }
  async function fnInfo(name: string) {
    if (fnCache.has(name)) return fnCache.get(name)!;
    const rows =
      await sql`SELECT array_to_json(p.proargnames) AS names, array_to_json(p.proargtypes::regtype[]::text[]) AS types, p.proretset AS retset,
        format_type(p.prorettype, NULL) AS rettype
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = ${name}`;
    if (rows.length !== 1) {
      fnCache.set(name, null);
      return null;
    }
    const row = rows[0] as {
      names: string[] | null;
      types: string[];
      retset: boolean;
      rettype: string;
    };
    const args = new Map<string, string>();
    row.types.forEach((type, i) => args.set(row.names?.[i] ?? `$${i + 1}`, type));
    const info = { args, retset: row.retset, rettype: row.rettype };
    fnCache.set(name, info);
    return info;
  }

  /** `select=` → a column list over the alias `t`. */
  function selectList(select: string | null, cols: Columns): string {
    const raw = (select ?? "*").trim() || "*";
    if (raw === "*") return "t.*";
    return raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        if (/[(!]/.test(part))
          throw harnessError(`select ${JSON.stringify(part)} (embedded resources)`);
        const [alias, column] = part.includes(":")
          ? (part.split(":") as [string, string])
          : [part, part];
        if (!cols.has(column))
          throw {
            status: 400,
            body: {
              code: "42703",
              message: `column ${column} does not exist`,
              details: null,
              hint: null,
            },
          } satisfies RestError;
        return alias === column ? `t.${ident(column)}` : `t.${ident(column)} AS ${ident(alias)}`;
      })
      .join(", ");
  }

  /** Filters (`col=op.value`) → a WHERE clause; values typed as the column, as PostgREST does. */
  function where(params: URLSearchParams, cols: Columns, values: unknown[], alias = ""): string {
    const reserved = new Set(["select", "order", "limit", "offset", "columns", "on_conflict"]);
    const clauses: string[] = [];
    const prefix = alias ? `${alias}.` : "";
    for (const [key, raw] of params) {
      if (reserved.has(key)) continue;
      if (key === "or" || key === "and") throw harnessError(`filter ${key}=`);
      const type = cols.get(key);
      if (!type)
        throw {
          status: 400,
          body: {
            code: "42703",
            message: `column ${key} does not exist`,
            details: null,
            hint: null,
          },
        } satisfies RestError;
      let expr = raw;
      let negate = false;
      if (expr.startsWith("not.")) {
        negate = true;
        expr = expr.slice(4);
      }
      const dot = expr.indexOf(".");
      const op = dot < 0 ? expr : expr.slice(0, dot);
      const value = dot < 0 ? "" : expr.slice(dot + 1);
      const col = `${prefix}${ident(key)}`;
      const param = (v: string) => {
        values.push(v);
        return `$${values.length}::text::${type}`;
      };
      let clause: string;
      const cmp: Record<string, string> = {
        eq: "=",
        neq: "<>",
        lt: "<",
        lte: "<=",
        gt: ">",
        gte: ">=",
      };
      if (op in cmp) clause = `${col} ${cmp[op]} ${param(value)}`;
      else if (op === "is") {
        const v = value.toLowerCase();
        if (!["null", "true", "false", "unknown"].includes(v)) throw harnessError(`is.${value}`);
        clause = `${col} IS ${v.toUpperCase()}`;
      } else if (op === "in") {
        const inner = value.replace(/^\(/, "").replace(/\)$/, "");
        const items = inner === "" ? [] : inner.split(",").map((s) => s.replace(/^"(.*)"$/, "$1"));
        clause = items.length ? `${col} IN (${items.map(param).join(", ")})` : "false";
      } else if (op === "like" || op === "ilike") {
        values.push(value.replace(/\*/g, "%"));
        clause = `${col}::text ${op === "like" ? "LIKE" : "ILIKE"} $${values.length}::text`;
      } else throw harnessError(`filter operator ${op}`);
      clauses.push(negate ? `NOT (${clause})` : clause);
    }
    return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  }

  function orderBy(order: string | null, cols: Columns, alias: string): string {
    if (!order) return "";
    const parts = order.split(",").map((term) => {
      const [col = "", ...mods] = term.split(".");
      if (!cols.has(col)) throw harnessError(`order column ${col}`);
      let out = `${alias}.${ident(col)}`;
      for (const mod of mods) {
        if (mod === "asc") out += " ASC";
        else if (mod === "desc") out += " DESC";
        else if (mod === "nullsfirst") out += " NULLS FIRST";
        else if (mod === "nullslast") out += " NULLS LAST";
        else throw harnessError(`order modifier ${mod}`);
      }
      return out;
    });
    return `ORDER BY ${parts.join(", ")}`;
  }

  function limitOffset(params: URLSearchParams, values: unknown[]): string {
    let out = "";
    const limit = params.get("limit");
    const offset = params.get("offset");
    if (limit !== null) {
      values.push(Number.parseInt(limit, 10));
      out += ` LIMIT $${values.length}::int`;
    }
    if (offset !== null) {
      values.push(Number.parseInt(offset, 10));
      out += ` OFFSET $${values.length}::int`;
    }
    return out;
  }

  /** Builds and runs one request's statement inside `tx`; answers [status, json body or null]. */
  async function handle(tx: Sql, req: Request0): Promise<[number, unknown]> {
    const { method, table, params, prefer, accept } = req;
    const representation = prefer.includes("return=representation");
    const values: unknown[] = [];

    if (table.startsWith("rpc/")) {
      const name = table.slice(4);
      const info = await fnInfo(name);
      if (!info)
        return [
          404,
          {
            code: "PGRST202",
            message: `Could not find the function public.${name}`,
            details: null,
            hint: null,
          },
        ];
      const args = (method === "GET" ? Object.fromEntries(params) : (req.body ?? {})) as Record<
        string,
        unknown
      >;
      const named = Object.entries(args).map(([key, value]) => {
        const type = info.args.get(key);
        if (!type) throw harnessError(`rpc ${name} argument ${key}`);
        values.push(
          value === null || value === undefined
            ? null
            : Array.isArray(value) && type.endsWith("[]")
              ? // PostgREST passes a JSON array to an array argument as that array (accounts' uuid[] argument).
                `{${value.map((v) => (v === null ? "NULL" : `"${String(v).replace(/["\\]/g, "\\$&")}"`)).join(",")}}`
              : typeof value === "object"
                ? JSON.stringify(value)
                : String(value),
        );
        return `${ident(key)} => $${values.length}::text::${type}`;
      });
      const call = `public.${ident(name)}(${named.join(", ")})`;
      const text = info.retset
        ? `SELECT coalesce(json_agg(r), '[]'::json) AS body FROM ${call} r`
        : info.rettype === "void"
          ? `SELECT ${call}, null::json AS body`
          : `SELECT to_json(${call}) AS body`;
      const rows = await tx.unsafe(text, values);
      if (prefer.includes("return=minimal")) return [204, null];
      return [200, rows[0]?.body ?? null];
    }

    const cols = await columns(table);
    if (cols.size === 0)
      return [
        404,
        {
          code: "42P01",
          message: `relation "public.${table}" does not exist`,
          details: null,
          hint: null,
        },
      ];
    const target = `public.${ident(table)}`;
    const list = selectList(params.get("select"), cols);
    const wrap = (inner: string, tail = "") =>
      `SELECT coalesce(json_agg(x), '[]'::json) AS body FROM (SELECT ${list} FROM (${inner}) t ${tail}) x`;

    let text: string;
    if (method === "GET" || method === "HEAD") {
      const filter = where(params, cols, values, "t");
      const order = orderBy(params.get("order"), cols, "t");
      text = `SELECT coalesce(json_agg(x), '[]'::json) AS body FROM (SELECT ${list} FROM ${target} t ${filter} ${order}${limitOffset(params, values)}) x`;
    } else if (method === "POST") {
      const rows = (Array.isArray(req.body) ? req.body : [req.body]) as Record<string, unknown>[];
      const keyList =
        params
          .get("columns")
          ?.split(",")
          .map((c) => c.replace(/^"(.*)"$/, "$1")) ?? Object.keys(rows[0] ?? {});
      for (const key of keyList)
        if (!cols.has(key))
          return [
            400,
            {
              code: "PGRST204",
              message: `Could not find the '${key}' column of '${table}' in the schema cache`,
              details: null,
              hint: null,
            },
          ];
      if (
        rows.some(
          (row) => Object.keys(row).length !== keyList.length || !keyList.every((k) => k in row),
        )
      )
        throw harnessError("insert rows with different keys (missing=default per row)");
      values.push(JSON.stringify(rows));
      const colSql = keyList.map(ident).join(", ");
      let conflict = "";
      const resolution = prefer.find((p) => p.startsWith("resolution="));
      if (resolution) {
        const on =
          params
            .get("on_conflict")
            ?.split(",")
            .map((c) => c.trim()) ?? (await primaryKey(table));
        const updates = keyList.filter((k) => !on.includes(k));
        conflict =
          resolution === "resolution=ignore-duplicates" || updates.length === 0
            ? ` ON CONFLICT (${on.map(ident).join(", ")}) DO NOTHING`
            : ` ON CONFLICT (${on.map(ident).join(", ")}) DO UPDATE SET ${updates.map((k) => `${ident(k)} = EXCLUDED.${ident(k)}`).join(", ")}`;
      }
      const insert = `INSERT INTO ${target} (${colSql}) SELECT ${colSql} FROM json_populate_recordset(null::${target}, $1::text::json)${conflict} RETURNING *`;
      text = `WITH w AS (${insert}) ${wrap("SELECT * FROM w")}`;
    } else if (method === "PATCH") {
      const patch = (req.body ?? {}) as Record<string, unknown>;
      const keys = Object.keys(patch);
      for (const key of keys)
        if (!cols.has(key))
          return [
            400,
            {
              code: "PGRST204",
              message: `Could not find the '${key}' column of '${table}' in the schema cache`,
              details: null,
              hint: null,
            },
          ];
      if (keys.length === 0) throw harnessError("empty update");
      values.push(JSON.stringify(patch));
      const set = keys.map((k) => `${ident(k)} = p.${ident(k)}`).join(", ");
      const filter = where(params, cols, values, target);
      const update = `UPDATE ${target} SET ${set} FROM (SELECT * FROM json_populate_record(null::${target}, $1::text::json)) p ${filter} RETURNING ${target}.*`;
      text = `WITH w AS (${update}) ${wrap("SELECT * FROM w")}`;
    } else if (method === "DELETE") {
      const filter = where(params, cols, values);
      text = `WITH w AS (DELETE FROM ${target} ${filter} RETURNING *) ${wrap("SELECT * FROM w")}`;
    } else throw harnessError(`method ${method}`);

    const out = await tx.unsafe(text, values);
    const body = (out[0]?.body ?? []) as unknown[];
    const objectWanted = accept.startsWith("application/vnd.pgrst.object+json");
    if (method !== "GET" && method !== "HEAD" && !representation && !objectWanted)
      return [method === "POST" ? 201 : 204, null];
    if (objectWanted) {
      if (body.length !== 1)
        return [
          406,
          {
            code: "PGRST116",
            message: "JSON object requested, multiple (or no) rows returned",
            details: `The result contains ${body.length} rows`,
            hint: null,
          },
        ];
      return [method === "POST" ? 201 : 200, body[0]];
    }
    return [method === "POST" ? 201 : 200, body];
  }

  const log: RestServer["log"] = [];

  /* GoTrue's account calls (accounts, 10 Nov 2026), as Supabase Auth answers them: linking an email to the anonymous
     user (PUT /user, then POST /verify type email_change: same id, no longer anonymous), signing in by code (POST /otp,
     never creating a user when create_user is false, then POST /verify type email), signing out everywhere (POST
     /logout?scope=global: every session of the user revoked, so /user refuses their tokens) and the admin lookup
     (GET /admin/users/:id, service role only). Codes are 6 digits, in `mail`. */
  const mail: SentMail[] = [];
  const pendingEmail = new Map<string, { email: string; token: string }>();
  const pendingSignIn = new Map<string, { userId: string; token: string }>();
  const revokedSessions = new Set<string>();
  const sessionsOf = new Map<string, Set<string>>();
  const authError = (status: number, errorCode: string, msg: string) =>
    Response.json({ code: status, error_code: errorCode, msg }, { status });
  const sixDigits = () => String(100000 + Math.floor(Math.random() * 900000));

  type AuthRow = { id: string; created_at: Date; is_anonymous: boolean; email: string | null; last_sign_in_at: Date | null };
  async function authRow(id: string): Promise<AuthRow | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const rows = await sql`SELECT id, created_at, is_anonymous, email, last_sign_in_at FROM auth.users WHERE id = ${id}::uuid`;
    return (rows[0] as AuthRow | undefined) ?? null;
  }
  function userJson(row: AuthRow) {
    return {
      id: row.id,
      aud: "authenticated",
      role: "authenticated",
      email: row.email ?? "",
      is_anonymous: row.is_anonymous,
      created_at: row.created_at,
      last_sign_in_at: row.last_sign_in_at,
      app_metadata: row.email ? { provider: "email", providers: ["email"] } : {},
      user_metadata: {},
      identities: row.email
        ? [{ id: row.id, user_id: row.id, provider: "email", identity_data: { email: row.email, sub: row.id } }]
        : [],
    };
  }
  function sessionFor(row: AuthRow) {
    const sessionId = crypto.randomUUID();
    if (!sessionsOf.has(row.id)) sessionsOf.set(row.id, new Set());
    sessionsOf.get(row.id)!.add(sessionId);
    const access = row.is_anonymous ? userToken(row.id) : accountToken(row.id, sessionId);
    return {
      access_token: access,
      token_type: "bearer",
      expires_in: HOUR,
      expires_at: Math.floor(Date.now() / 1000) + HOUR,
      refresh_token: `refresh-${sessionId}`,
      user: userJson(row),
    };
  }
  /** The user a bearer token names, or the refusal GoTrue gives (bad token, unknown user, revoked session). */
  async function bearerUser(token: string): Promise<AuthRow | Response> {
    const claims = verifyJwt(token);
    if (!claims || typeof claims["sub"] !== "string") return authError(403, "bad_jwt", "invalid JWT");
    const sessionId = String(claims["session_id"] ?? claims["sub"]);
    if (revokedSessions.has(sessionId)) return authError(403, "session_not_found", "Session from session_id claim in JWT does not exist");
    const row = await authRow(claims["sub"]);
    if (!row) return authError(403, "user_not_found", "User from sub claim in JWT does not exist");
    return row;
  }

  async function userFor(token: string): Promise<Response> {
    const row = await bearerUser(token);
    return row instanceof Response ? row : Response.json(userJson(row));
  }

  const authSettings: RestServer["auth"] = { captchaSecret: null, beforeUserCreated: null };

  async function authRoute(request: Request, url: URL, bearer: string): Promise<Response> {
    const path = url.pathname.slice("/auth/v1".length);
    const body = (request.method === "GET" ? {} : await request.json().catch(() => ({}))) as Record<string, unknown>;
    /* Anonymous sign-in (safety, 10 Nov 2026), as GoTrue serves POST /signup with no email or phone: captcha first
       (gotrue_meta_security.captcha_token), then the Before User Created hook, then the user and its session. */
    if (path === "/signup" && request.method === "POST") {
      if (body["email"] || body["phone"] || body["password"])
        return authError(400, "validation_failed", "server-fn harness: only anonymous sign-up is served");
      const meta = (body["gotrue_meta_security"] ?? {}) as Record<string, unknown>;
      if (authSettings.captchaSecret) {
        const token = String(meta["captcha_token"] ?? "");
        if (!token) return authError(400, "captcha_failed", "captcha protection: request disallowed (no captcha response)");
        if (!turnstileTestVerify(authSettings.captchaSecret, token).success)
          return authError(400, "captcha_failed", "captcha protection: request disallowed (invalid-input-response)");
      }
      const id = crypto.randomUUID();
      if (authSettings.beforeUserCreated) {
        const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || "127.0.0.1";
        const event = {
          metadata: { uuid: crypto.randomUUID(), time: new Date().toISOString(), name: "before-user-created", ip_address: ip },
          user: { id, aud: "authenticated", role: "authenticated", is_anonymous: true, app_metadata: {}, user_metadata: {} },
        };
        const rows = await sql.unsafe(`SELECT public.${ident(authSettings.beforeUserCreated)}($1::text::jsonb) AS out`, [JSON.stringify(event)]);
        const out = (rows[0] as { out: { error?: { http_code?: number; message?: string } } } | undefined)?.out ?? {};
        if (out.error) return authError(out.error.http_code ?? 400, "hook_rejected", out.error.message ?? "rejected by hook");
      }
      await sql`INSERT INTO auth.users (id, is_anonymous, last_sign_in_at) VALUES (${id}::uuid, true, now())`;
      return Response.json(sessionFor((await authRow(id))!));
    }
    if (path === "/user" && request.method === "GET") return userFor(bearer);
    if (path === "/user" && request.method === "PUT") {
      const row = await bearerUser(bearer);
      if (row instanceof Response) return row;
      const email = String(body["email"] ?? "").trim().toLowerCase();
      if (!email || Object.keys(body).some((k) => !["email", "data", "code_challenge", "code_challenge_method"].includes(k)))
        return authError(400, "validation_failed", `server-fn harness: unsupported user update ${Object.keys(body).join(",")}`);
      const taken = await sql`SELECT 1 FROM auth.users WHERE lower(email) = ${email} AND id <> ${row.id}::uuid`;
      if (taken.length) return authError(422, "email_exists", "A user with this email address has already been registered");
      const token = sixDigits();
      pendingEmail.set(row.id, { email, token });
      mail.push({ to: email, template: "email_change", token, userId: row.id });
      return Response.json(userJson(row));
    }
    if (path === "/otp" && request.method === "POST") {
      const email = String(body["email"] ?? "").trim().toLowerCase();
      const rows = await sql`SELECT id FROM auth.users WHERE lower(email) = ${email}`;
      if (!rows.length) {
        if (body["create_user"] === false) return authError(422, "otp_disabled", "Signups not allowed for otp");
        return authError(400, "validation_failed", "server-fn harness: OTP sign-up isn't served (guests link instead)");
      }
      const token = sixDigits();
      const userId = (rows[0] as { id: string }).id;
      pendingSignIn.set(email, { userId, token });
      mail.push({ to: email, template: "magic_link", token, userId });
      return Response.json({});
    }
    if (path === "/verify" && request.method === "POST") {
      const email = String(body["email"] ?? "").trim().toLowerCase();
      const token = String(body["token"] ?? "");
      const expired = () => authError(403, "otp_expired", "Token has expired or is invalid");
      if (body["type"] === "email_change") {
        const entry = [...pendingEmail].find(([, p]) => p.email === email && p.token === token);
        if (!entry) return expired();
        const [userId] = entry;
        pendingEmail.delete(userId);
        await sql`UPDATE auth.users SET email = ${email}, is_anonymous = false, last_sign_in_at = now() WHERE id = ${userId}::uuid`;
        return Response.json(sessionFor((await authRow(userId))!));
      }
      if (body["type"] === "email") {
        const entry = pendingSignIn.get(email);
        if (!entry || entry.token !== token) return expired();
        pendingSignIn.delete(email);
        await sql`UPDATE auth.users SET last_sign_in_at = now() WHERE id = ${entry.userId}::uuid`;
        return Response.json(sessionFor((await authRow(entry.userId))!));
      }
      return authError(400, "validation_failed", `server-fn harness: unsupported verify type ${String(body["type"])}`);
    }
    if (path === "/logout" && request.method === "POST") {
      const claims = verifyJwt(bearer);
      if (!claims || typeof claims["sub"] !== "string") return authError(403, "bad_jwt", "invalid JWT");
      const scope = url.searchParams.get("scope") ?? "global";
      const own = String(claims["session_id"] ?? claims["sub"]);
      if (scope === "global") {
        revokedSessions.add(claims["sub"]);
        for (const id of sessionsOf.get(claims["sub"]) ?? []) revokedSessions.add(id);
      }
      revokedSessions.add(own);
      return new Response(null, { status: 204 });
    }
    const admin = /^\/admin\/users\/([0-9a-f-]{36})$/i.exec(path);
    if (admin && request.method === "GET") {
      if (verifyJwt(bearer)?.["role"] !== "service_role") return authError(403, "not_admin", "User not allowed");
      const row = await authRow(admin[1]!);
      return row ? Response.json(userJson(row)) : authError(404, "user_not_found", "User not found");
    }
    return Response.json(
      { code: "PGRST_HARNESS", message: `server-fn harness: unsupported auth call ${request.method} ${url.pathname}` },
      { status: 404 },
    );
  }

  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(request) {
      const url = new URL(request.url);
      const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
      if (url.pathname.startsWith("/auth/v1/")) return authRoute(request, url, bearer);
      if (!url.pathname.startsWith("/rest/v1/"))
        return Response.json(
          { code: "PGRST_HARNESS", message: `server-fn harness: unsupported path ${url.pathname}` },
          { status: 404 },
        );
      const apikey = request.headers.get("apikey") ?? "";
      if (!verifyJwt(apikey)) return Response.json({ message: "Invalid API key" }, { status: 401 });
      const claims = verifyJwt(bearer || apikey);
      if (!claims)
        return Response.json(
          { code: "PGRST301", message: "JWT invalid", details: null, hint: null },
          { status: 401 },
        );
      const role = String(claims["role"] ?? "anon");
      if (!["anon", "authenticated", "service_role"].includes(role))
        return Response.json({ code: "PGRST_HARNESS", message: `role ${role}` }, { status: 401 });
      const text = await request.text();
      const req: Request0 = {
        method: request.method,
        table: decodeURIComponent(url.pathname.slice("/rest/v1/".length)),
        params: url.searchParams,
        prefer: (request.headers.get("prefer") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        accept: request.headers.get("accept") ?? "application/json",
        body: text ? JSON.parse(text) : undefined,
      };
      const entry: RestServer["log"][number] = {
        method: req.method,
        path: `${url.pathname}${url.search}`,
        status: 0,
        role,
      };
      log.push(entry);
      try {
        const [status, body] = await sql.begin(async (tx: Sql) => {
          await tx.unsafe(`SET LOCAL ROLE ${role}`);
          await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify(claims)}, true),
            set_config('request.jwt.claim.sub', ${String(claims["sub"] ?? "")}, true),
            set_config('request.jwt.claim.role', ${role}, true)`;
          return handle(tx, req);
        });
        entry.status = status;
        return body === null ? new Response(null, { status }) : Response.json(body, { status });
      } catch (err) {
        const rest = err as Partial<RestError> & {
          code?: string;
          message?: string;
          detail?: string;
          hint?: string;
        };
        if (rest.status && rest.body) {
          entry.status = rest.status;
          entry.error = rest.body.message;
          return Response.json(rest.body, { status: rest.status });
        }
        const code = String(rest.code ?? "XX000");
        const status = pgStatus(code, role === "authenticated");
        entry.status = status;
        entry.error = rest.message;
        return Response.json(
          {
            code,
            message: rest.message ?? String(err),
            details: rest.detail ?? null,
            hint: rest.hint ?? null,
          },
          { status },
        );
      }
    },
  });
  return {
    url: `http://127.0.0.1:${server.port}`,
    mail,
    log,
    auth: authSettings,
    async stop() {
      server.stop(true);
      await sql.end({ timeout: 2 });
    },
  };
}

/* ------------------------------------------------------- server functions */

let pluginInstalled = false;

/**
 * Makes `@tanstack/react-start`'s `createServerFn` behave as the compiled server bundle's: the handler is the
 * server implementation (`serverFn`) as well as the extracted function. Call before importing any
 * `*.functions.ts` module. Everything else in the package is the real export.
 */
export async function installServerFnPlugin(): Promise<void> {
  if (pluginInstalled) return;
  pluginInstalled = true;
  const realPath = resolve("node_modules/@tanstack/react-start/dist/esm/index.js");
  const real = (await import(realPath)) as Record<string, unknown> & {
    createServerFn: (...args: unknown[]) => unknown;
  };
  Bun.plugin({
    name: "server-fn-harness",
    setup(build) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wrap = (builder: any): any => {
        const fn = (opts: unknown) => wrap(builder(opts));
        return Object.assign(fn, builder, {
          middleware: (m: unknown) => wrap(builder.middleware(m)),
          inputValidator: (v: unknown) => wrap(builder.inputValidator(v)),
          validator: (v: unknown) => wrap(builder.validator(v)),
          handler: (h: unknown) => builder.handler(h, h),
        });
      };
      const exports = {
        ...real,
        createServerFn: (...args: unknown[]) => wrap(real.createServerFn(...args)),
      };
      build.module("@tanstack/react-start", () => ({ exports, loader: "object" }));
    },
  });
}

export class ServerFnError extends Error {}

/**
 * Calls a server function as a POST from a device holding `token` (or none), inside Start's request context.
 * Resolves to the handler's result; rejects with what the handler (or a middleware) threw.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function callServerFn<T = any>(
  fn: unknown,
  data: unknown,
  token: string | null,
): Promise<T> {
  const { requestHandler } = await import("@tanstack/react-start/server");
  const { runWithStartContext } = await import("@tanstack/start-storage-context");
  const exec = (
    fn as { __executeServer?: (opts: unknown) => Promise<{ result: unknown; error: unknown }> }
  ).__executeServer;
  if (!exec)
    throw new ServerFnError(
      "not a server function (was installServerFnPlugin() called before importing it?)",
    );
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers["authorization"] = `Bearer ${token}`;
  let out: { result: unknown; error: unknown } | undefined;
  let thrown: unknown;
  const handler = requestHandler(async (request: Request) => {
    try {
      out = await runWithStartContext(
        {
          request,
          contextAfterGlobalMiddlewares: {},
          executedRequestMiddlewares: new Set(),
          startOptions: {},
        } as unknown as Parameters<typeof runWithStartContext>[0],
        () => exec({ data, method: "POST", context: {} }),
      );
    } catch (err) {
      thrown = err;
    }
    return new Response("ok");
  });
  await handler(new Request("http://harness.local/_serverFn/call", { method: "POST", headers }));
  if (thrown) throw thrown;
  if (!out) throw new ServerFnError("server function produced no result");
  if (out.error) throw out.error;
  return out.result as T;
}
