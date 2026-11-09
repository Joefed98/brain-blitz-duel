/**
 * migrations-check (Wave 0, 9 Nov 2026; docs/supabase-move/migrations-ci.md): the automatic migration applier
 * (scripts/migrate-lib.ts, scripts/migrate.ts), on a throwaway local PostgreSQL. ~5 s, no browser.
 *
 * 1. The destructive guard: DROP TABLE, DROP COLUMN, TRUNCATE, DELETE / UPDATE without WHERE are found at the top
 *    level and in DO blocks, never in comments, strings or function bodies, never for ON DELETE / FOR UPDATE /
 *    DROP CONSTRAINT and the like; the approval line lets a file through. The history's three destructive files
 *    are found (so the guard is the one that would have stopped them).
 * 2. Transaction control (a file with its own COMMIT, VACUUM or CONCURRENTLY) is refused; plpgsql BEGIN isn't.
 * 3. On local PostgreSQL: every repository migration applies from scratch with its history row, a second run
 *    applies none; a failing file rolls back with its history row and later files are not tried; a refused file
 *    applies nothing at all; a version already recorded fails before the file's SQL runs.
 * 4. `migrate.ts --live` against a stand-in for the Management API's query endpoint (backed by the same local
 *    database): it applies pending files, exits non-zero and stops on an error, refuses a destructive file,
 *    refuses missing secrets and a project ref that isn't SUPABASE_URL's, and never prints the token.
 * 5. Notices and warnings: psql's are read with their DETAIL and HINT lines; `migrate.ts --local` prints a test
 *    migration's RAISE WARNING and RAISE NOTICE under its file (a failing file's too, before FAILED); `migrate.ts
 *    --live`, whose API answers rows only, prints what `migration_log.note` kept during each file, as a GitHub
 *    annotation and in the run summary for a warning.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  EDIT_APPROVAL_RE,
  HISTORY_SETUP,
  applyPending,
  guardMigration,
  listMigrations,
  psqlNotes,
  transactionControl,
  wrapMigration,
  type Migration,
  type MigrationDb,
} from "./migrate-lib";
import { postgresBin, startLocalDb, type LocalDb } from "./server-fn-harness";

let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) passes++;
  else failures.push(label);
}

/* ---------------------------------------------------------------- 1. the guard */

const kinds = (sql: string) => guardMigration(sql).findings.map((f) => f.kind);
const flagged: [string, string][] = [
  ["DROP TABLE public.x;", "DROP TABLE"],
  ["drop table if exists public.x cascade;", "DROP TABLE"],
  ['DROP TABLE "Weird";', "DROP TABLE"],
  ["ALTER TABLE public.duels DROP COLUMN puzzles;", "DROP COLUMN"],
  ["ALTER TABLE public.duels DROP COLUMN IF EXISTS add_memory;", "DROP COLUMN"],
  ["ALTER TABLE public.duels DROP add_memory;", "DROP COLUMN"],
  ["ALTER TABLE t ADD COLUMN a int, DROP COLUMN b;", "DROP COLUMN"],
  ["TRUNCATE public.round_results;", "TRUNCATE"],
  ["truncate table a, b restart identity;", "TRUNCATE"],
  ["DELETE FROM public.duels;", "DELETE without WHERE"],
  ["delete from public.duels\n-- WHERE id = 1\n;", "DELETE without WHERE"],
  ["DELETE FROM t USING u;", "DELETE without WHERE"],
  ["UPDATE public.duels SET status = 'x';", "UPDATE without WHERE"],
  ["UPDATE ONLY public.duels d SET status = 'x';", "UPDATE without WHERE"],
  ["UPDATE t SET a = 'WHERE';", "UPDATE without WHERE"],
  ["WITH gone AS (DELETE FROM t RETURNING id) SELECT count(*) FROM gone;", "DELETE without WHERE"],
  ["DO $$ BEGIN DELETE FROM public.duels; END $$;", "DELETE without WHERE"],
  ["DO $x$ BEGIN IF true THEN TRUNCATE t; END IF; END $x$;", "TRUNCATE"],
  ["UPDATE a SET x = 1 WHERE id = 2; UPDATE b SET y = 2;", "UPDATE without WHERE"],
];
for (const [sql, kind] of flagged) check(kinds(sql).includes(kind), `guard finds ${kind} in: ${sql}`);

const clean = [
  "CREATE TABLE t (a int REFERENCES u ON DELETE CASCADE ON UPDATE SET NULL);",
  "ALTER TABLE t DROP CONSTRAINT IF EXISTS t_check;",
  "ALTER TABLE t DROP CONSTRAINT t_check, ADD CONSTRAINT t_check CHECK (a > 0);",
  "ALTER TABLE t ALTER COLUMN a DROP DEFAULT, ALTER COLUMN b DROP NOT NULL;",
  "ALTER TABLE t ALTER COLUMN a DROP IDENTITY IF EXISTS;",
  "ALTER PUBLICATION supabase_realtime DROP TABLE public.duel_players;",
  "DROP POLICY IF EXISTS p ON t; DROP FUNCTION IF EXISTS f(); DROP INDEX IF EXISTS i; DROP TRIGGER x ON t;",
  "CREATE POLICY p ON t FOR DELETE USING (true); CREATE POLICY q ON t FOR UPDATE USING (true);",
  "CREATE TRIGGER x BEFORE UPDATE OR DELETE ON t FOR EACH ROW EXECUTE FUNCTION f();",
  "GRANT SELECT, UPDATE (a), DELETE ON t TO service_role; REVOKE DELETE ON t FROM anon;",
  "SELECT * FROM t FOR UPDATE;",
  "DELETE FROM t WHERE created_at < now() - interval '1 day';",
  "UPDATE t SET a = 1 WHERE a IS NULL;",
  "UPDATE t AS x SET a = 1 FROM u WHERE u.id = x.id;",
  "-- DROP TABLE t;\n/* TRUNCATE t; /* nested */ DELETE FROM t; */ SELECT 1;",
  "COMMENT ON TABLE t IS 'DROP TABLE t; DELETE FROM t; TRUNCATE t';",
  "INSERT INTO t (txt) VALUES (E'it\\'s; DROP TABLE t');",
  "CREATE FUNCTION f() RETURNS void LANGUAGE sql AS $$ DELETE FROM public.rate_limits $$;",
  "CREATE OR REPLACE FUNCTION g() RETURNS void LANGUAGE plpgsql AS $fn$ BEGIN TRUNCATE x; UPDATE y SET a = 1; END $fn$;",
  "SELECT $1, $2;",
];
for (const sql of clean) check(kinds(sql).length === 0, `guard passes: ${sql} (found ${kinds(sql).join(", ")})`);

check(guardMigration("-- destructive: approved by Joe\nDROP TABLE t;").approved, "the approval line approves");
check(guardMigration("DROP TABLE t;\n  --   Destructive: Approved by Joe  \n").approved, "the approval line: any case, spacing");
check(!guardMigration("-- destructive: approved by Joe? not really\nDROP TABLE t;").approved, "a longer line doesn't approve");
check(!guardMigration("SELECT '-- destructive: approved by Joe';\nDROP TABLE t;").approved, "the line inside a string doesn't approve");
check(!guardMigration("DROP TABLE t; -- destructive: approved by Joe").approved, "the line after a statement doesn't approve");

check(EDIT_APPROVAL_RE.test("SELECT 1;\n-- edited: not applied live, approved by Joe\n"), "the edit line is recognised");
check(!EDIT_APPROVAL_RE.test("-- destructive: approved by Joe\n"), "the destructive line isn't the edit line");

const history = listMigrations();
const destructive = history.filter((m) => guardMigration(m.sql).findings.length).map((m) => m.version);
check(
  JSON.stringify(destructive) === JSON.stringify(["20260909205823", "20261003000000", "20261003234626"]),
  `the history's destructive files are the three known ones (found ${destructive.join(", ")})`,
);
check(history.every((m) => transactionControl(m.sql).length === 0), "no repository migration has its own transaction control");

/* ------------------------------------------------------- 2. transaction control */

for (const sql of ["BEGIN; SELECT 1; COMMIT;", "VACUUM t;", "CREATE INDEX CONCURRENTLY i ON t (a);", "commit;", "START TRANSACTION;"])
  check(transactionControl(sql).length > 0, `transaction control found in: ${sql}`);
check(
  transactionControl("CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $$ BEGIN COMMIT; END $$; DO $$ BEGIN NULL; END $$;").length === 0,
  "plpgsql BEGIN / END in bodies isn't transaction control",
);

/* ----------------------------------------------------- 3. local PostgreSQL */

function localDb(pg: LocalDb): MigrationDb {
  return {
    async appliedVersions() {
      const setup = pg.psql(HISTORY_SETUP);
      if (!setup.ok) throw new Error(setup.err);
      const out = pg.psql("SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;");
      if (!out.ok) throw new Error(out.err);
      return new Set(out.out.split("\n").filter(Boolean));
    },
    async exec(sql) {
      const out = pg.psql(sql);
      if (!out.ok) throw new Error(out.err);
    },
  };
}
const quiet = { log: () => {} };
const mig = (version: string, name: string, sql: string): Migration => ({ file: `${version}_${name}.sql`, version, name, sql });
const one = (pg: LocalDb, sql: string) => pg.psql(sql).out;

/* ------------------------------------------------------- 5a. psql's notes */

{
  const stderr = [
    "psql:/tmp/x/q3.sql:7: NOTICE:  relation \"t\" already exists, skipping",
    "psql:/tmp/x/q3.sql:9: WARNING:  kept 3 rows",
    "DETAIL:  ids 1, 2, 3",
    "HINT:  see the doc",
    "CONTEXT:  PL/pgSQL function inline_code_block line 3 at RAISE",
    "WARNING:  two lines",
    "second line",
    "psql:/tmp/x/q3.sql:12: ERROR:  boom",
  ].join("\n");
  const notes = psqlNotes(stderr);
  check(
    JSON.stringify(notes) ===
      JSON.stringify([
        { level: "NOTICE", message: 'relation "t" already exists, skipping' },
        { level: "WARNING", message: "kept 3 rows (detail: ids 1, 2, 3) (hint: see the doc)" },
        { level: "WARNING", message: "two lines\nsecond line" },
      ]),
    `psql's NOTICE and WARNING lines are read, with DETAIL and HINT, never CONTEXT or ERROR (${JSON.stringify(notes)})`,
  );
  check(psqlNotes("").length === 0, "no stderr, no notes");
  const logged: string[] = [];
  const r = await applyPending(
    { appliedVersions: async () => new Set(), exec: async () => [{ level: "WARNING", message: "from the fake" }] },
    [{ file: "50000000000001_n.sql", version: "50000000000001", name: "n", sql: "SELECT 1;" }],
    { log: (l) => logged.push(l) },
  );
  check(
    r.notes.length === 1 && r.notes[0]!.file === "50000000000001_n.sql" && logged.some((l) => l.includes("WARNING from 50000000000001_n.sql: from the fake")),
    `applyPending keeps and prints each file's notes (${logged.join(" | ")})`,
  );
}

if (!postgresBin()) {
  check(!process.env.CI, "PostgreSQL binaries are present (required on CI)");
  console.log("NOTE: no PostgreSQL binaries; the database parts were skipped");
} else {
  // 3a. Every repository migration, from scratch, through the wrapper; then none pending.
  {
    const pg = startLocalDb("migrations-check-", { applyMigrations: false });
    try {
      const db = localDb(pg);
      const r = await applyPending(db, history, { guard: false, ...quiet });
      check(r.failed === null && r.applied.length === history.length, `every migration applies from scratch (${r.failed?.file}: ${r.failed?.error})`);
      check(one(pg, "SELECT count(*) FROM supabase_migrations.schema_migrations;") === String(history.length), "one history row a file");
      const latest = history.at(-1)!;
      check(
        one(pg, `SELECT name || '|' || (statements[1] = ${"$q$" + latest.sql + "$q$"}) FROM supabase_migrations.schema_migrations WHERE version = '${latest.version}';`) ===
          `${latest.name}|true`,
        "a history row carries the file's name and its SQL",
      );
      check(one(pg, "SELECT to_regclass('public.duel_presence') IS NOT NULL;") === "t", "the latest migration's table exists");
      const again = await applyPending(db, history, quiet);
      check(again.pending.length === 0 && again.refused.length === 0, "a second run has nothing pending (and the guard sees no new file)");
      // The same guard on live would refuse the three old destructive files if the history were empty.
      const fresh = await applyPending({ appliedVersions: async () => new Set(), exec: async () => {} }, history, { dryRun: true, ...quiet });
      check(fresh.refused.length === 3 && fresh.applied.length === 0, "with no history, the guard refuses the three destructive files before anything runs");
    } finally {
      pg.stop();
    }
  }

  // 3b. Stop on the first error; refusals apply nothing; a recorded version fails before the file runs.
  {
    const pg = startLocalDb("migrations-check-", { applyMigrations: false });
    try {
      const db = localDb(pg);
      const first = mig("30000000000001", "first", "CREATE TABLE public.mc_first (a int);");
      const broken = mig("30000000000002", "broken", "CREATE TABLE public.mc_broken (a int);\nSELECT no_such_function();");
      const later = mig("30000000000003", "later", "CREATE TABLE public.mc_later (a int);");
      let r = await applyPending(db, [first, broken, later], quiet);
      check(r.applied.map((m) => m.version).join() === first.version, "applies up to the failing file");
      check(r.failed?.file === broken.file && /no_such_function/.test(r.failed.error), "names the failing file and its error");
      check(one(pg, "SELECT to_regclass('public.mc_broken') IS NULL AND to_regclass('public.mc_later') IS NULL;") === "t", "the failing file rolled back, the later one not tried");
      check(one(pg, "SELECT string_agg(version, ',' ORDER BY version) FROM supabase_migrations.schema_migrations;") === first.version, "no history row for the failed or untried files");
      const fixed = { ...broken, sql: "CREATE TABLE public.mc_broken (a int);" };
      r = await applyPending(db, [first, fixed, later], quiet);
      check(r.applied.length === 2 && r.failed === null, "after the fix, the rest apply in order");

      const destructive = mig("30000000000004", "drop", "DROP TABLE public.mc_first;");
      const after = mig("30000000000005", "after", "CREATE TABLE public.mc_after (a int);");
      r = await applyPending(db, [first, fixed, later, after, destructive], quiet);
      check(r.refused.length === 1 && r.applied.length === 0, "a destructive pending file refuses the whole run");
      check(one(pg, "SELECT to_regclass('public.mc_after') IS NULL AND to_regclass('public.mc_first') IS NOT NULL;") === "t", "nothing ran after a refusal");
      const approved = { ...destructive, sql: `-- destructive: approved by Joe\n${destructive.sql}` };
      r = await applyPending(db, [first, fixed, later, after, approved], quiet);
      check(r.applied.length === 2 && one(pg, "SELECT to_regclass('public.mc_first') IS NULL;") === "t", "with the approval line it applies");

      const control = mig("30000000000006", "control", "CREATE TABLE public.mc_c (a int);\nCOMMIT;");
      r = await applyPending(db, [control], quiet);
      check(r.refused.length === 1 && one(pg, "SELECT to_regclass('public.mc_c') IS NULL;") === "t", "a file with its own COMMIT is refused");

      const dup = mig("30000000000001", "first", "CREATE TABLE public.mc_dup (a int);");
      check(!pg.psql(wrapMigration(dup)).ok, "applying a recorded version again fails");
      check(one(pg, "SELECT to_regclass('public.mc_dup') IS NULL;") === "t", "…before the file's SQL ran (the history row goes first)");

      const dollars = mig("30000000000007", "dollars", "CREATE FUNCTION public.mc_f() RETURNS text LANGUAGE sql AS $joulz_migration$ SELECT 'x' $joulz_migration$;\n-- ends on a comment");
      r = await applyPending(db, [dollars], quiet);
      check(r.applied.length === 1 && one(pg, "SELECT public.mc_f();") === "x", "a file using the wrapper's own dollar tag, ending on a comment, applies");
    } finally {
      pg.stop();
    }
  }

  // 4. migrate.ts --live against a stand-in Management API on the same kind of database.
  {
    const pg = startLocalDb("migrations-check-", { applyMigrations: false });
    const dir = mkdtempSync(join(tmpdir(), "migrations-check-live-"));
    const TOKEN = "sbp_check_token_never_printed_0123456789";
    const REF = "abcdefghijklmnopqrst";
    let calls = 0;
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        calls++;
        const url = new URL(req.url);
        if (req.headers.get("authorization") !== `Bearer ${TOKEN}`) return Response.json({ message: "Unauthorized" }, { status: 401 });
        if (url.pathname !== `/v1/projects/${REF}/database/query` || req.method !== "POST") return new Response("not found", { status: 404 });
        const { query } = (await req.json()) as { query: string };
        // psql -tA prints rows; the endpoint answers JSON rows. The applier reads `present` and `version` only.
        const out = pg.psql(query);
        if (!out.ok) return Response.json({ message: out.err.split("\n").find((l) => /ERROR/.test(l)) ?? out.err }, { status: 400 });
        if (/AS present/.test(query)) return Response.json([{ present: out.out === "t" }]);
        if (/SELECT version FROM/.test(query)) return Response.json(out.out.split("\n").filter(Boolean).map((version) => ({ version })));
        return Response.json([]);
      },
    });
    const write = (name: string, sql: string) => writeFileSync(join(dir, name), sql);
    // Async: the stand-in server answers from this process, so a blocking spawn would deadlock.
    const live = async (env: Record<string, string>, ...extra: string[]) => {
      const proc = Bun.spawn(["bun", "scripts/migrate.ts", "--live", ...extra], {
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, GITHUB_STEP_SUMMARY: "", MIGRATIONS_DIR_OVERRIDE: dir, SUPABASE_MANAGEMENT_API: `http://127.0.0.1:${server.port}`, ...env },
      });
      const [stdout, stderr, status] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
      return { status, text: `${stdout}${stderr}` };
    };
    const secrets = { SUPABASE_ACCESS_TOKEN: TOKEN, SUPABASE_PROJECT_REF: REF, SUPABASE_URL: `https://${REF}.supabase.co` };
    try {
      write("40000000000001_a.sql", "CREATE TABLE public.mc_live_a (a int);");
      write("40000000000002_b.sql", "CREATE TABLE public.mc_live_b (a int);");
      let r = await live(secrets, "--dry-run");
      check(r.status === 0 && /would apply 40000000000001_a\.sql/.test(r.text) && one(pg, "SELECT to_regclass('public.mc_live_a') IS NULL;") === "t", `--dry-run lists and applies nothing (${r.text})`);
      r = await live(secrets);
      check(r.status === 0 && one(pg, "SELECT count(*) FROM supabase_migrations.schema_migrations;") === "2", `--live applies pending files with their history (${r.text})`);
      check(!r.text.includes(TOKEN), "the token is never printed");
      r = await live(secrets);
      check(r.status === 0 && /0 pending/.test(r.text), "a second run has nothing pending");
      write("40000000000003_c.sql", "SELECT no_such_function();");
      write("40000000000004_d.sql", "CREATE TABLE public.mc_live_d (a int);");
      r = await live(secrets);
      check(r.status !== 0 && /FAILED 40000000000003_c\.sql/.test(r.text) && one(pg, "SELECT to_regclass('public.mc_live_d') IS NULL;") === "t", `an error exits non-zero and stops (${r.text})`);
      write("40000000000003_c.sql", "TRUNCATE public.mc_live_a;");
      r = await live(secrets);
      check(r.status !== 0 && /REFUSED 40000000000003_c\.sql/.test(r.text) && /TRUNCATE/.test(r.text), "a destructive file exits non-zero");
      r = await live({ ...secrets, SUPABASE_ACCESS_TOKEN: "" });
      check(r.status !== 0 && /Missing GitHub secret\(s\): SUPABASE_ACCESS_TOKEN/.test(r.text), "a missing token exits non-zero, by name");
      r = await live({ ...secrets, SUPABASE_URL: "https://zzzzzzzzzzzzzzzzzzzz.supabase.co" });
      check(r.status !== 0 && /does not match SUPABASE_URL/.test(r.text), "a ref that isn't SUPABASE_URL's project exits non-zero");
      const before = calls;
      r = await live({ ...secrets, SUPABASE_ACCESS_TOKEN: "sbp_wrong" });
      check(r.status !== 0 && /refused/.test(r.text) && calls > before && !r.text.includes("sbp_wrong"), `a refused token exits non-zero without printing it (${r.text})`);
    } finally {
      server.stop(true);
      pg.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  }
}

/* ------------------------------------------- 5b. notes through migrate.ts itself */

if (postgresBin()) {
  const runScript = async (mode: string, env: Record<string, string>) => {
    const proc = Bun.spawn(["bun", "scripts/migrate.ts", mode], { stdout: "pipe", stderr: "pipe", env: { ...process.env, ...env } });
    const [stdout, stderr, status] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
    return { status, text: `${stdout}${stderr}` };
  };
  const WARN_SQL = "DO $$ BEGIN RAISE NOTICE 'mc notice %', 'one'; RAISE WARNING 'mc warning %', 42; END $$;";

  // --local: a test migration's RAISE WARNING and RAISE NOTICE, printed under its file.
  {
    const dir = mkdtempSync(join(tmpdir(), "migrations-check-notes-"));
    const summaryFile = join(dir, "summary.md");
    try {
      writeFileSync(join(dir, "50000000000001_quiet.sql"), "CREATE TABLE public.mc_quiet (a int);");
      writeFileSync(join(dir, "50000000000002_warns.sql"), `CREATE TABLE public.mc_warns (a int);\n${WARN_SQL}`);
      let r = await runScript("--local", { MIGRATIONS_DIR_OVERRIDE: dir, GITHUB_STEP_SUMMARY: summaryFile });
      check(r.status === 0 && r.text.includes("WARNING from 50000000000002_warns.sql: mc warning 42"), `--local prints a migration's RAISE WARNING (${r.text})`);
      check(r.text.includes("NOTICE from 50000000000002_warns.sql: mc notice one"), "--local prints a migration's RAISE NOTICE");
      check(!/from 50000000000001_quiet\.sql/.test(r.text), "a file that raises nothing prints no notes");
      check(readFileSync(summaryFile, "utf8").includes("Warning from `50000000000002_warns.sql`: mc warning 42"), "--local's run summary lists the warning");
      check(!r.text.includes("::warning title="), "--local raises no GitHub annotation (a fresh database isn't London's)");
      writeFileSync(join(dir, "50000000000003_fails.sql"), "DO $$ BEGIN RAISE WARNING 'mc before the error'; END $$;\nSELECT no_such_function();");
      r = await runScript("--local", { MIGRATIONS_DIR_OVERRIDE: dir, GITHUB_STEP_SUMMARY: "" });
      const warnAt = r.text.indexOf("WARNING from 50000000000003_fails.sql: mc before the error");
      check(r.status !== 0 && warnAt >= 0 && warnAt < r.text.indexOf("FAILED 50000000000003_fails.sql"), `--local prints a failing file's warning before FAILED (${r.text})`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // --live: the stand-in answers rows only, as the Management API does; the notes come from migration_log.note.
  {
    const pg = startLocalDb("migrations-check-", { applyMigrations: false });
    const dir = mkdtempSync(join(tmpdir(), "migrations-check-live-notes-"));
    const summaryFile = join(dir, "..", `${dir.split("/").pop()}-summary.md`);
    const TOKEN = "sbp_check_token_never_printed_0123456789";
    const REF = "abcdefghijklmnopqrst";
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        if (req.headers.get("authorization") !== `Bearer ${TOKEN}`) return Response.json({ message: "Unauthorized" }, { status: 401 });
        const { query } = (await req.json()) as { query: string };
        const out = pg.psql(query);
        if (!out.ok) return Response.json({ message: out.err.split("\n").find((l) => /ERROR/.test(l)) ?? out.err }, { status: 400 });
        // Rows only: psql's stderr (the notices) is dropped, as the real endpoint drops them.
        if (/AS present/.test(query)) return Response.json([{ present: out.out === "t" }]);
        if (/SELECT version FROM/.test(query)) return Response.json(out.out.split("\n").filter(Boolean).map((version) => ({ version })));
        if (/AS newest FROM migration_log\.notes/.test(query)) return Response.json([{ newest: Number(out.out) }]);
        if (/FROM migration_log\.notes WHERE id >/.test(query))
          return Response.json(
            out.out.split("\n").filter(Boolean).map((line) => {
              const [id, level, ...rest] = line.split("|");
              return { id: Number(id), level, message: rest.join("|") };
            }),
          );
        return Response.json([]);
      },
    });
    const env = {
      SUPABASE_ACCESS_TOKEN: TOKEN,
      SUPABASE_PROJECT_REF: REF,
      SUPABASE_URL: `https://${REF}.supabase.co`,
      SUPABASE_MANAGEMENT_API: `http://127.0.0.1:${server.port}`,
      MIGRATIONS_DIR_OVERRIDE: dir,
      GITHUB_STEP_SUMMARY: summaryFile,
    };
    try {
      const helper = listMigrations().find((m) => m.name === "migration_log");
      check(!!helper, "the repository has the migration_log migration");
      writeFileSync(join(dir, helper!.file), helper!.sql);
      writeFileSync(join(dir, "50000000000011_plain.sql"), WARN_SQL);
      writeFileSync(
        join(dir, "50000000000012_noted.sql"),
        "CREATE TABLE public.mc_noted (a int);\nSELECT migration_log.note('warning', 'mc live warning');\nDO $$ BEGIN PERFORM migration_log.note('notice', format('mc live notice %s', 7)); END $$;",
      );
      writeFileSync(join(dir, "50000000000013_after.sql"), "SELECT migration_log.note('warning', 'mc second file');");
      const r = await runScript("--live", env);
      check(r.status === 0 && r.text.includes("WARNING from 50000000000012_noted.sql: mc live warning"), `--live prints a migration's warning through migration_log.note (${r.text})`);
      check(r.text.includes("NOTICE from 50000000000012_noted.sql: mc live notice 7"), "--live prints a noted notice, from plpgsql too");
      check(r.text.includes("::warning title=50000000000012_noted.sql::mc live warning"), "--live raises a GitHub annotation for the warning");
      check(readFileSync(summaryFile, "utf8").includes("Warning from `50000000000012_noted.sql`: mc live warning"), "--live's run summary lists the warning");
      check(
        r.text.includes("WARNING from 50000000000013_after.sql: mc second file") && !/from 50000000000013_after\.sql: mc live/.test(r.text),
        "each file prints only the notes it wrote",
      );
      check(one(pg, "SELECT count(*) FROM public.mc_noted;") === "0" && one(pg, "SELECT count(*) FROM supabase_migrations.schema_migrations;") === "4", "the noted files applied as any other, with their history");
      check(!r.text.includes(TOKEN), "the token is never printed");
    } finally {
      server.stop(true);
      pg.stop();
      rmSync(dir, { recursive: true, force: true });
      rmSync(summaryFile, { force: true });
    }
  }
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(`PASS: ${passes} checks (the destructive guard, transaction control, local apply and stop-on-error, migrate.ts --live on a stand-in API, notices and warnings local and live)`);
