/**
 * Database migrations, applied automatically (Wave 0, 9 Nov 2026; docs/supabase-move/migrations-ci.md).
 *
 * One applier for the live London project (Supabase Management API, `POST /v1/projects/{ref}/database/query`, as
 * docs/supabase-move/runbook.md 1.2 did by hand) and for a throwaway local PostgreSQL (the PR proof). Both run the
 * same SQL for each file, built by `wrapMigration`:
 *
 *   BEGIN;
 *   INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES (…);  -- first, so a
 *   <the file>                                                                                  -- version already
 *   COMMIT;                                                                                     -- recorded fails
 *                                                                                               -- before any DDL
 *
 * Files whose version is already in the history are skipped; the rest are applied in file-name order, one
 * transaction each, stopping at the first error (that file rolls back with its history row; later files are not
 * tried). Before anything is applied, every pending file goes through `guardMigration` (destructive statements)
 * and `transactionControl` (a file that commits or vacuums by itself can't be wrapped); one refusal applies none.
 *
 * Node built-ins only: scripts/migrate.ts runs it on CI with no `bun install`.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const MIGRATIONS_DIR = "supabase/migrations";

/** The approval line that lets a destructive migration through (a whole line of its own, any case). */
export const APPROVAL_RE = /^[ \t]*--[ \t]*destructive:[ \t]*approved by Joe[ \t]*$/im;

/**
 * Lets a PR change a merged migration: only for one that failed on main and so was never recorded live (the
 * deploy summary says which). A recorded file is never re-run, so any other edit would silently do nothing.
 */
export const EDIT_APPROVAL_RE = /^[ \t]*--[ \t]*edited:[ \t]*not applied live, approved by Joe[ \t]*$/im;

export interface Migration {
  file: string;
  /** The digits before the first "_" (what `supabase db push` records). */
  version: string;
  /** The rest of the file name, without ".sql". */
  name: string;
  sql: string;
}

const FILE_RE = /^(\d+)_(.+)\.sql$/;

/** Every `.sql` file in the directory, sorted by file name. Throws on a badly named file or a repeated version. */
export function listMigrations(dir = MIGRATIONS_DIR): Migration[] {
  const out: Migration[] = [];
  const seen = new Map<string, string>();
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const m = FILE_RE.exec(file);
    if (!m) throw new Error(`${file}: a migration's name must be <digits>_<name>.sql`);
    const [, version, name] = m;
    const other = seen.get(version);
    if (other) throw new Error(`${file}: version ${version} is also ${other}`);
    seen.set(version, file);
    out.push({ file, version, name, sql: readFileSync(join(dir, file), "utf8") });
  }
  return out;
}

/* ---------------------------------------------------------------- the lexer */

interface Lexed {
  /** Top-level SQL with comments removed and every quoted string or dollar body replaced by a placeholder. */
  top: string;
  /** Dollar-quoted bodies, by placeholder index (lexed the same way, so DO blocks can be read). */
  bodies: string[];
}

/** Strips comments and quoted text so keywords are only matched where PostgreSQL would run them. */
export function lex(sql: string): Lexed {
  const bodies: string[] = [];
  let top = "";
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    const next = sql[i + 1];
    if (c === "-" && next === "-") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end;
      top += " ";
    } else if (c === "/" && next === "*") {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth > 0) {
        if (sql[i] === "/" && sql[i + 1] === "*") (depth++, (i += 2));
        else if (sql[i] === "*" && sql[i + 1] === "/") (depth--, (i += 2));
        else i++;
      }
      top += " ";
    } else if (c === "'" || c === '"') {
      // '…' and "…", with doubled quotes inside (E'…' backslash escapes are handled too).
      const escapes = c === "'" && /[eE]$/.test(sql.slice(Math.max(0, i - 1), i));
      i++;
      while (i < sql.length) {
        if (escapes && sql[i] === "\\") i += 2;
        else if (sql[i] === c && sql[i + 1] === c) i += 2;
        else if (sql[i] === c) break;
        else i++;
      }
      i++;
      // A quoted identifier is kept as a plain word so "DROP TABLE "x"" still reads as a drop.
      top += c === '"' ? " qid " : " 'str' ";
    } else if (c === "$") {
      const tag = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (tag && !/[A-Za-z0-9_]/.test(sql[i - 1] ?? "")) {
        const open = tag[0];
        const close = sql.indexOf(open, i + open.length);
        const end = close === -1 ? sql.length : close;
        bodies.push(sql.slice(i + open.length, end));
        top += ` $body${bodies.length - 1}$ `;
        i = close === -1 ? sql.length : close + open.length;
      } else {
        top += c;
        i++;
      }
    } else {
      top += c;
      i++;
    }
  }
  return { top, bodies };
}

/** Splits lexed SQL into statements (placeholders keep `;` inside strings and bodies out of the split). */
function statements(top: string): string[] {
  return top
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/* ----------------------------------------------------------------- the guard */

export interface GuardFinding {
  kind: "DROP TABLE" | "DROP COLUMN" | "TRUNCATE" | "DELETE without WHERE" | "UPDATE without WHERE";
  /** The statement, shortened, for the error message. */
  statement: string;
}

const UPDATE_RE = /\bUPDATE\s+(?:ONLY\s+)?[\w.]+(?:\s*\*)?(?:\s+(?:AS\s+)?\w+)?\s+SET\b/gi;
const DELETE_RE = /\bDELETE\s+FROM\b/gi;
/** ALTER TABLE … DROP [COLUMN] [IF EXISTS] col: any DROP in an ALTER TABLE that isn't one of the other actions. */
const ALTER_DROP_RE =
  /\bDROP\s+(?!CONSTRAINT\b|DEFAULT\b|NOT\s+NULL\b|IDENTITY\b|EXPRESSION\b)(?:COLUMN\b|IF\s+EXISTS\s+\w|\w)/gi;

function scanStatement(stmt: string, push: (kind: GuardFinding["kind"]) => void) {
  // A statement starts the text, or follows plpgsql's BEGIN / THEN / ELSE / LOOP inside a DO block.
  const starts = (re: string) => new RegExp(`(?:^|\\b(?:BEGIN|THEN|ELSE|LOOP)\\s+)${re}`, "i").test(stmt);
  if (starts("DROP\\s+TABLE\\b")) push("DROP TABLE");
  if (starts("TRUNCATE\\b")) push("TRUNCATE");
  if (starts("ALTER\\s+TABLE\\b")) {
    for (const _ of stmt.matchAll(ALTER_DROP_RE)) push("DROP COLUMN");
  }
  // DELETE / UPDATE anywhere in the statement (CTEs included): each needs a WHERE after it in the same statement.
  for (const [re, kind] of [
    [DELETE_RE, "DELETE without WHERE"],
    [UPDATE_RE, "UPDATE without WHERE"],
  ] as const) {
    for (const m of stmt.matchAll(re)) {
      const rest = stmt.slice((m.index ?? 0) + m[0].length);
      // The WHERE must come before the next DELETE/UPDATE/INSERT/SELECT that starts a new clause of its own.
      const upto = rest.split(/\b(?:DELETE\s+FROM|UPDATE\s+\S+\s+SET|INSERT\s+INTO)\b/i)[0];
      if (!/\bWHERE\b/i.test(upto)) push(kind);
    }
  }
}

/**
 * Destructive statements in a migration: DROP TABLE, DROP COLUMN, TRUNCATE, DELETE or UPDATE with no WHERE.
 * Read where they would run when the file is applied: top-level statements and the bodies of DO blocks; a
 * function's body (CREATE FUNCTION … AS $$ … $$) is code for later and is not read. Comments and string literals
 * never count. An empty list, or a file with the approval line (`APPROVAL_RE`), passes.
 */
export function guardMigration(sql: string): { findings: GuardFinding[]; approved: boolean } {
  const findings: GuardFinding[] = [];
  const { top, bodies } = lex(sql);
  const scan = (text: string, bodyList: string[], depth: number) => {
    for (const stmt of statements(text)) {
      scanStatement(stmt, (kind) => findings.push({ kind, statement: shorten(stmt) }));
      if (depth < 4 && /^DO\b/i.test(stmt)) {
        for (const m of stmt.matchAll(/\$body(\d+)\$/g)) {
          const inner = lex(bodyList[Number(m[1])] ?? "");
          scan(inner.top, inner.bodies, depth + 1);
        }
      }
    }
  };
  scan(top, bodies, 0);
  return { findings, approved: APPROVAL_RE.test(sql) };
}

/** Top-level transaction control or commands that can't run in a transaction: the wrapper can't hold them. */
export function transactionControl(sql: string): string[] {
  const bad: string[] = [];
  for (const stmt of statements(lex(sql).top)) {
    if (
      /^(BEGIN|COMMIT|ROLLBACK|END|START\s+TRANSACTION|SAVEPOINT|RELEASE|ABORT|VACUUM)\b/i.test(stmt) ||
      /\bCONCURRENTLY\b/i.test(stmt) ||
      /^(CREATE|DROP)\s+DATABASE\b/i.test(stmt) ||
      /^ALTER\s+SYSTEM\b/i.test(stmt)
    )
      bad.push(shorten(stmt));
  }
  return bad;
}

function shorten(stmt: string): string {
  return stmt.length > 110 ? `${stmt.slice(0, 107)}…` : stmt;
}

/* ---------------------------------------------------------------- the applier */

/** The history table, as the Supabase CLI makes it (it adds any newer columns itself). */
export const HISTORY_SETUP = `CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version text NOT NULL PRIMARY KEY, statements text[], name text);`;

/**
 * Where `migration_log.note(level, message)` (migration 20261110120000_migration_log.sql) keeps a migration's notes:
 * the live run reads back the rows written during each file, since the Management API doesn't return notices.
 */
export const NOTES_TABLE = "migration_log.notes";

/** A dollar-quote tag that doesn't occur in the text. */
function dollar(text: string): string {
  for (let n = 0; ; n++) {
    const tag = `$joulz_migration${n || ""}$`;
    if (!text.includes(tag)) return `${tag}${text}${tag}`;
  }
}

/** The one transaction a migration runs in: its history row first, then the file, then COMMIT. */
export function wrapMigration(m: Migration): string {
  return [
    "BEGIN;",
    `INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES (${dollar(m.version)}, ${dollar(m.name)}, ARRAY[${dollar(m.sql)}]);`,
    m.sql,
    ";",
    "COMMIT;",
    "",
  ].join("\n");
}

/** A notice or warning a migration raised (RAISE NOTICE / RAISE WARNING, or `migration_log.note`). */
export interface MigrationNote {
  level: "NOTICE" | "WARNING";
  message: string;
}

/** A failed run's error, with the notes the file raised before it failed (when the database could report them). */
export class MigrationError extends Error {
  constructor(
    message: string,
    readonly notes: MigrationNote[] = [],
  ) {
    super(message);
  }
}

export interface MigrationDb {
  /** Versions already recorded in supabase_migrations.schema_migrations (the table made first if missing). */
  appliedVersions(): Promise<Set<string>>;
  /**
   * Runs SQL; rejects with the database's error message (a `MigrationError` carries the notes raised before it).
   * Resolves with the notices and warnings the SQL raised, when the database reports them.
   */
  exec(sql: string): Promise<MigrationNote[] | void>;
}

/**
 * The NOTICE and WARNING messages in psql's stderr (`psql:<file>:<line>: WARNING:  text`, or without the prefix),
 * each with its DETAIL and HINT lines; CONTEXT lines (where in plpgsql it was raised) are left out.
 */
export function psqlNotes(stderr: string): MigrationNote[] {
  const notes: MigrationNote[] = [];
  let last: MigrationNote | null = null;
  for (const line of stderr.split("\n")) {
    const m = /^(?:psql:.*?:\d+: )?(NOTICE|WARNING|DETAIL|HINT|CONTEXT|ERROR|[A-Z]+):\s+(.*)$/.exec(line);
    if (!m) {
      // A message's own later lines (RAISE with a newline in its text).
      if (last && line && !/^psql:/.test(line)) last.message += `\n${line}`;
      continue;
    }
    const [, kind, text] = m as unknown as [string, string, string];
    if (kind === "NOTICE" || kind === "WARNING") notes.push((last = { level: kind, message: text }));
    else if ((kind === "DETAIL" || kind === "HINT") && last) last.message += ` (${kind.toLowerCase()}: ${text})`;
    else last = null;
  }
  return notes;
}

export interface ApplyResult {
  pending: Migration[];
  applied: Migration[];
  /** Pending files refused before anything ran (guard or transaction control). */
  refused: { file: string; reasons: string[] }[];
  /** The file that failed, if one did; nothing after it was tried. */
  failed: { file: string; error: string } | null;
  /** Pending files older than the newest applied one (applied all the same, in order). */
  outOfOrder: string[];
  /** The notices and warnings each file raised, in order (a failed file's too, where the database reported them). */
  notes: (MigrationNote & { file: string })[];
}

/** Every pending file's refusal reasons (empty when it may run). */
export function refusalsFor(pending: Migration[], guard = true): ApplyResult["refused"] {
  const refused: ApplyResult["refused"] = [];
  for (const m of pending) {
    const reasons: string[] = [];
    const g = guard ? guardMigration(m.sql) : { findings: [], approved: true };
    if (g.findings.length && !g.approved)
      for (const f of g.findings) reasons.push(`${f.kind}: ${f.statement}`);
    for (const t of transactionControl(m.sql))
      reasons.push(`can't run inside the migration's transaction: ${t}`);
    if (reasons.length) refused.push({ file: m.file, reasons });
  }
  return refused;
}

export async function applyPending(
  db: MigrationDb,
  migrations: Migration[],
  {
    dryRun = false,
    /** False only for the local from-scratch proof: the old destructive files are long applied live. */
    guard = true,
    log = (line: string) => console.log(line),
  } = {},
): Promise<ApplyResult> {
  const done = await db.appliedVersions();
  const pending = migrations.filter((m) => !done.has(m.version));
  const newest = [...done].sort().at(-1) ?? "";
  const outOfOrder = pending.filter((m) => m.version < newest).map((m) => m.file);
  const result: ApplyResult = { pending, applied: [], refused: [], failed: null, outOfOrder, notes: [] };
  log(`${done.size} migration(s) recorded; ${pending.length} pending.`);
  for (const f of outOfOrder)
    log(`WARNING ${f} is older than the newest recorded version (${newest}); applying it in file order.`);
  result.refused = refusalsFor(pending, guard);
  if (result.refused.length) {
    for (const r of result.refused) {
      log(`REFUSED ${r.file}:`);
      for (const reason of r.reasons) log(`  - ${reason}`);
    }
    log(
      `Nothing applied. A deliberate destructive migration needs the line "-- destructive: approved by Joe" in the file.`,
    );
    return result;
  }
  for (const m of pending) {
    if (dryRun) {
      log(`would apply ${m.file}`);
      continue;
    }
    const noted = (notes: MigrationNote[] | void) => {
      for (const n of notes ?? []) {
        result.notes.push({ file: m.file, ...n });
        log(`  ${n.level} from ${m.file}: ${n.message}`);
      }
    };
    try {
      noted(await db.exec(wrapMigration(m)));
    } catch (err) {
      if (err instanceof MigrationError) noted(err.notes);
      result.failed = { file: m.file, error: err instanceof Error ? err.message : String(err) };
      log(`FAILED ${m.file} (rolled back; nothing after it was tried): ${result.failed.error}`);
      return result;
    }
    result.applied.push(m);
    log(`applied ${m.file}`);
  }
  return result;
}

/** True when the run applied everything pending (or, on a dry run, would have). */
export function applyOk(r: ApplyResult): boolean {
  return r.refused.length === 0 && r.failed === null;
}
