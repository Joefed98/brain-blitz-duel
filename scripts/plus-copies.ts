/**
 * The two functions Joulz Plus re-makes with one added condition (wave 2 E2): C2's public.badge_facts and D2's
 * public.pass_activity, each copied into supabase/migrations/20261113200000_joulz_plus.sql with `daily_archive`
 * rooms left out (an archive replay never counts for a badge or Joules).
 *
 * The copy must be exactly the function's latest definition before that migration, plus the one condition, so no
 * later change to C2's or D2's function is silently overwritten. And whatever is defined after it must keep the
 * condition, so the archive never starts counting again.
 *
 *   bun scripts/plus-copies.ts            proves both (plus-check runs the same, `copiesReport`)
 *   bun scripts/plus-copies.ts --write    rebuilds both copies in the Plus migration from the current text (only while
 *                                         that migration is unmerged: a merged migration is never edited; a later
 *                                         change then needs a new migration carrying the condition)
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(import.meta.dir, "../supabase/migrations");
export const PLUS_MIGRATION = "20261113200000_joulz_plus.sql";

interface Copied {
  name: string;
  /** The DO block's tag in the Plus migration. */
  tag: string;
  /** The line the condition goes after (exactly once in the function) and the condition itself. */
  after: string;
  condition: string;
}

export const COPIED: readonly Copied[] = [
  {
    name: "badge_facts",
    tag: "badges",
    after: "     WHERE ar.user_id = p_user_id\n",
    condition: "       AND ro.kind <> 'daily_archive'\n",
  },
  {
    name: "pass_activity",
    tag: "joules",
    after: "      LEFT JOIN public.challenges c ON c.room_id = t.room_id\n     WHERE t.user_id = p_user_id\n",
    condition: "       AND ar.kind <> 'daily_archive'\n",
  },
];

const files = () => readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

/** Every top-level `CREATE OR REPLACE FUNCTION public.<name>(` … `$$;` in a file (its $$-quoted definitions). */
function definitions(sql: string, name: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\(`, "g");
  for (const m of sql.matchAll(re)) {
    const start = m.index!;
    const body = sql.indexOf("AS $$", start);
    const end = sql.indexOf("$$;", body + 5);
    if (body < 0 || end < 0) continue;
    out.push(sql.slice(start, end + 3));
  }
  return out;
}

/** The copy as it should be: the latest definition before the Plus migration, with the condition. */
export function expectedCopy(c: Copied): { source: string; text: string } | { error: string } {
  let source = "";
  let def = "";
  for (const f of files()) {
    if (f >= PLUS_MIGRATION) break;
    const found = definitions(readFileSync(join(DIR, f), "utf8"), c.name);
    if (found.length) {
      source = f;
      def = found.at(-1)!;
    }
  }
  if (!def) return { error: `${c.name}: no definition before ${PLUS_MIGRATION}` };
  if (def.split(c.after).length !== 2) return { error: `${c.name}: its shape changed in ${source} (the line the condition follows isn't there once); rebuild the copy by hand` };
  const text = def.replace(c.after, c.after + c.condition).replace("AS $$", "AS $body$").replace(/\$\$;$/, "$body$");
  return { source, text };
}

/** The copy the Plus migration holds now. */
export function heldCopy(c: Copied, sql: string = readFileSync(join(DIR, PLUS_MIGRATION), "utf8")): string | null {
  const block = new RegExp(`DO \\$${c.tag}\\$[\\s\\S]*?EXECUTE \\$fn\\$\\n([\\s\\S]*?)\\n  \\$fn\\$;[\\s\\S]*?END\\n\\$${c.tag}\\$;`).exec(sql);
  return block ? block[1]! : null;
}

/** Problems with the copies, or none. */
export function copiesReport(): string[] {
  const problems: string[] = [];
  const all = files();
  for (const c of COPIED) {
    const want = expectedCopy(c);
    if ("error" in want) {
      problems.push(want.error);
      continue;
    }
    const held = heldCopy(c);
    if (held === null) problems.push(`${c.name}: no copy in ${PLUS_MIGRATION}`);
    else if (held !== want.text)
      problems.push(`${c.name}: the copy in ${PLUS_MIGRATION} differs from ${want.source} plus the archive condition (run bun scripts/plus-copies.ts --write while it is unmerged)`);
    // Whatever defines it after the Plus migration must keep the condition.
    for (const f of all.filter((f) => f > PLUS_MIGRATION)) {
      for (const def of definitions(readFileSync(join(DIR, f), "utf8"), c.name))
        if (!def.includes(c.condition.trim())) problems.push(`${c.name}: ${f} defines it again without the daily_archive condition`);
    }
  }
  return problems;
}

if (import.meta.main) {
  if (process.argv.includes("--write")) {
    let sql = readFileSync(join(DIR, PLUS_MIGRATION), "utf8");
    for (const c of COPIED) {
      const want = expectedCopy(c);
      if ("error" in want) {
        console.error(`plus-copies: ${want.error}`);
        process.exit(1);
      }
      const held = heldCopy(c, sql);
      if (held === null) {
        console.error(`plus-copies: no ${c.name} block in ${PLUS_MIGRATION}`);
        process.exit(1);
      }
      sql = sql.replace(held, want.text);
      console.log(`plus-copies: ${c.name} rebuilt from ${want.source}`);
    }
    writeFileSync(join(DIR, PLUS_MIGRATION), sql);
  }
  const problems = copiesReport();
  for (const p of problems) console.log(`  FAIL ${p}`);
  console.log(problems.length ? "FAIL" : "plus-copies: both copies are their source plus the archive condition");
  process.exit(problems.length ? 1 : 0);
}
