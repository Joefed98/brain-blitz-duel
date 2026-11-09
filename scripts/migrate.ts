/**
 * Applies supabase/migrations (Wave 0, 9 Nov 2026; docs/supabase-move/migrations-ci.md; logic in migrate-lib.ts).
 *
 *   bun scripts/migrate.ts --live [--dry-run]   the London project, through the Management API (deploy on main)
 *   bun scripts/migrate.ts --local              a throwaway local PostgreSQL, every file from scratch, then again
 *                                               to prove a second run applies nothing (PRs, and main before --live)
 *   bun scripts/migrate.ts --pr-guard=<ref>     files added since <ref> through the destructive guard; changed,
 *                                               renamed or deleted older files fail (they are never re-applied)
 *
 * --live reads SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF from the environment (and SUPABASE_URL, when set, to
 * prove it names the same project). No value is ever printed. Exits non-zero on any refusal or error, so the
 * deploy step after it doesn't run.
 */

import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import {
  EDIT_APPROVAL_RE,
  HISTORY_SETUP,
  MIGRATIONS_DIR,
  applyOk,
  applyPending,
  guardMigration,
  listMigrations,
  transactionControl,
  type ApplyResult,
  type MigrationDb,
} from "./migrate-lib";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) =>
  args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

function summary(lines: string[]) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) appendFileSync(file, `${lines.join("\n")}\n`);
}

function report(title: string, r: ApplyResult, dryRun = false) {
  const lines = [`### ${title}`];
  if (r.refused.length) lines.push(`- **Refused** (nothing applied): ${r.refused.map((x) => `\`${x.file}\``).join(", ")}`);
  else if (r.failed) lines.push(`- **Failed**: \`${r.failed.file}\` (rolled back; later files not tried)`);
  else if (!r.pending.length) lines.push("- Nothing pending.");
  else
    lines.push(
      `- ${dryRun ? "Would apply" : "Applied"} ${r.pending.length}: ${r.pending.map((m) => `\`${m.file}\``).join(", ")}`,
    );
  for (const f of r.outOfOrder) lines.push(`- Older than the newest recorded version: \`${f}\``);
  summary(lines);
}

/* ------------------------------------------------------------------- --live */

async function live() {
  const token = process.env.SUPABASE_ACCESS_TOKEN ?? "";
  const ref = process.env.SUPABASE_PROJECT_REF ?? "";
  const missing = [!token && "SUPABASE_ACCESS_TOKEN", !ref && "SUPABASE_PROJECT_REF"].filter(Boolean);
  if (missing.length) {
    console.log(`::error::Missing GitHub secret(s): ${missing.join(" ")}`);
    process.exit(1);
  }
  if (!/^[a-z0-9]{20}$/.test(ref)) {
    console.log("::error::SUPABASE_PROJECT_REF is not a 20-character project ref (lower-case letters and digits)");
    process.exit(1);
  }
  const url = process.env.SUPABASE_URL;
  if (url && url !== `https://${ref}.supabase.co`) {
    console.log("::error::SUPABASE_PROJECT_REF does not match SUPABASE_URL's project: migrations would go elsewhere");
    process.exit(1);
  }
  // SUPABASE_MANAGEMENT_API is for migrations-check's stand-in server only; the deploy never sets it.
  const api = process.env.SUPABASE_MANAGEMENT_API || "https://api.supabase.com";
  const endpoint = `${api}/v1/projects/${ref}/database/query`;
  const query = async (sql: string): Promise<unknown> => {
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: sql }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (err) {
      throw new Error(`request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    const text = await res.text();
    if (!res.ok) {
      let message = text;
      try {
        message = (JSON.parse(text) as { message?: string }).message ?? text;
      } catch {
        /* not JSON */
      }
      if (res.status === 401 || res.status === 403)
        message = `HTTP ${res.status}: the access token was refused for this project (${message.slice(0, 200)})`;
      else message = `HTTP ${res.status}: ${message.slice(0, 2000)}`;
      throw new Error(message);
    }
    return text ? JSON.parse(text) : [];
  };
  const db: MigrationDb = {
    async appliedVersions() {
      const present = (await query(
        "SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS present",
      )) as { present: boolean }[];
      if (!present[0]?.present) await query(HISTORY_SETUP);
      const rows = (await query(
        "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version",
      )) as { version: string }[];
      return new Set(rows.map((r) => String(r.version)));
    },
    async exec(sql) {
      await query(sql);
    },
  };
  const dryRun = flag("dry-run");
  let r: ApplyResult;
  try {
    // MIGRATIONS_DIR_OVERRIDE is for migrations-check only; the deploy reads supabase/migrations.
    r = await applyPending(db, listMigrations(process.env.MIGRATIONS_DIR_OVERRIDE || undefined), { dryRun });
  } catch (err) {
    console.log(`::error::Couldn't read the migration history: ${err instanceof Error ? err.message : String(err)}`);
    summary(["### Database migrations (live)", "- **Couldn't read the migration history**"]);
    process.exit(1);
  }
  report(`Database migrations (live${dryRun ? ", dry run" : ""})`, r, dryRun);
  if (!applyOk(r)) {
    console.log(`::error::Migrations stopped: ${r.failed ? r.failed.file : r.refused.map((x) => x.file).join(", ")}`);
    process.exit(1);
  }
}

/* ------------------------------------------------------------------ --local */

async function local() {
  const { startLocalDb, postgresBin } = await import("./server-fn-harness");
  if (!postgresBin()) {
    console.log("::error::No PostgreSQL binaries under /usr/lib/postgresql (GitHub's ubuntu runners have them)");
    process.exit(1);
  }
  const pg = startLocalDb("migrate-local-", { applyMigrations: false });
  try {
    const db: MigrationDb = {
      async appliedVersions() {
        const setup = pg.psql(HISTORY_SETUP);
        if (!setup.ok) throw new Error(setup.err);
        const out = pg.psql("SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;");
        if (!out.ok) throw new Error(out.err);
        return new Set(out.out.split("\n").filter(Boolean));
      },
      async exec(sql) {
        const out = pg.psql(sql);
        if (!out.ok) throw new Error(out.err.split("\n").find((l) => /ERROR/.test(l)) ?? out.err);
      },
    };
    const all = listMigrations();
    // Every file from scratch, the 2026 history's destructive ones included (all applied live long ago), so the
    // destructive guard is off here; --pr-guard and --live apply it to new files.
    const first = await applyPending(db, all, { guard: false });
    report("Database migrations (local PostgreSQL)", first);
    if (!applyOk(first) || first.applied.length !== all.length) {
      console.log("::error::The migrations don't apply cleanly to a fresh local PostgreSQL");
      process.exit(1);
    }
    const again = await applyPending(db, all, { guard: false });
    if (!applyOk(again) || again.pending.length !== 0) {
      console.log("::error::A second run found pending migrations: the history rows weren't recorded");
      process.exit(1);
    }
    console.log(`All ${all.length} migrations apply on a fresh PostgreSQL; a second run applies none.`);
  } finally {
    pg.stop();
  }
}

/* --------------------------------------------------------------- --pr-guard */

function prGuard(base: string) {
  const git = (...a: string[]) => {
    const out = spawnSync("git", a, { encoding: "utf8" });
    if (out.status !== 0) throw new Error(`git ${a.join(" ")}: ${out.stderr.trim()}`);
    return out.stdout;
  };
  const changes = git("diff", "--name-status", "--no-renames", `${base}...HEAD`, "--", MIGRATIONS_DIR)
    .split("\n")
    .filter(Boolean)
    .map((l) => l.split("\t") as [string, string]);
  const errors: string[] = [];
  const baseVersions = git("ls-tree", "--name-only", base, `${MIGRATIONS_DIR}/`)
    .split("\n")
    .map((p) => /\/(\d+)_[^/]*\.sql$/.exec(p)?.[1])
    .filter((v): v is string => !!v)
    .sort();
  const newestBase = baseVersions.at(-1) ?? "";
  const all = new Map(listMigrations().map((m) => [m.file, m]));
  const added: string[] = [];
  for (const [status, path] of changes) {
    const file = path.slice(MIGRATIONS_DIR.length + 1);
    if (!file.endsWith(".sql")) continue;
    if (status === "M" && EDIT_APPROVAL_RE.test(all.get(file)?.sql ?? "")) {
      console.log(`::warning::${file} is a merged migration changed with the "not applied live" line; make sure it failed on main`);
    } else if (status !== "A") {
      errors.push(
        `${file} is ${status === "D" ? "deleted" : "changed"}: a merged migration is applied once and never re-run; put the change in a new file (or, for a file that failed on main and was never applied, add the line "-- edited: not applied live, approved by Joe")`,
      );
      continue;
    }
    // New files, and approved edits of merged ones, go through the guard.
    const m = all.get(file);
    if (!m) continue;
    added.push(file);
    const g = guardMigration(m.sql);
    if (g.findings.length && !g.approved)
      for (const f of g.findings) errors.push(`${file}: ${f.kind}: ${f.statement}`);
    else if (g.findings.length) console.log(`${file}: destructive, approved by Joe (${g.findings.map((f) => f.kind).join(", ")})`);
    for (const t of transactionControl(m.sql)) errors.push(`${file}: can't run inside the migration's transaction: ${t}`);
    if (status === "A" && m.version <= newestBase)
      console.log(`::warning::${file} is older than main's newest migration (${newestBase}); it will still be applied, in file order`);
  }
  console.log(`New migrations in this PR: ${added.length ? added.join(", ") : "none"}.`);
  const lines = ["### Migration guard", `- New migrations: ${added.length ? added.map((f) => `\`${f}\``).join(", ") : "none"}`];
  for (const e of errors) {
    console.log(`::error::${e}`);
    lines.push(`- **${e}**`);
  }
  summary(lines);
  if (errors.length) {
    console.log('A deliberate destructive migration needs the line "-- destructive: approved by Joe" in the file.');
    process.exit(1);
  }
}

/* -------------------------------------------------------------------- main */

const guardBase = value("pr-guard");
if (flag("live")) await live();
else if (flag("local")) await local();
else if (guardBase) prGuard(guardBase);
else {
  console.log("usage: bun scripts/migrate.ts --live [--dry-run] | --local | --pr-guard=<base ref>");
  process.exit(2);
}
