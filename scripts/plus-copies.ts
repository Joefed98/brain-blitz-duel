/**
 * The two functions Joulz Plus re-makes (wave 2 E2): C2's public.badge_facts and D2's public.pass_activity, each
 * copied into supabase/migrations/20261113200000_joulz_plus.sql with exactly two conditions added wherever a run is
 * read: `daily_archive` rooms left out (an archive replay never counts for a badge or Joules) and runs the server
 * flagged left out (extra.flagged true: never a badge or Joules, nor the finish of a room or attempt holding one).
 *
 * The copy must be exactly the function's latest definition before that migration, plus these conditions, so no
 * later change to C2's or D2's function is silently overwritten. And whatever is defined after it must keep both.
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

/** One condition added after a line that occurs exactly once in the function. */
interface Insertion {
  after: string;
  add: string;
}

interface Copied {
  name: string;
  /** The DO block's tag in the Plus migration. */
  tag: string;
  /** Every condition added, in order (each `after` exactly once in the earlier text). */
  insertions: readonly Insertion[];
}

/**
 * The two conditions (Joe, 11 and 13 Nov 2026), each wherever a run is read:
 *   1. a Daily archive replay (async room kind 'daily_archive') never counts;
 *   2. a run the server flagged (its stored grade's extra.flagged true) never counts, and a room's or async attempt's
 *      finish never counts for a player with a flagged run in it (the finish is earned by the runs). Another player's
 *      own runs in the same room still count: the condition reads each row's own grade.
 */
export const ARCHIVE = "'daily_archive'";
export const FLAGGED = "->> 'flagged'";

export const COPIED: readonly Copied[] = [
  {
    name: "badge_facts",
    tag: "badges",
    insertions: [
      {
        after: "      JOIN public.duels d ON d.id = r.duel_id\n     WHERE p.user_id = p_user_id\n",
        add: "       AND coalesce(r.extra ->> 'flagged', 'false') <> 'true'\n",
      },
      {
        after: "      FROM public.round_results_archive a\n     WHERE a.user_id = p_user_id\n",
        add: "       AND coalesce(a.extra ->> 'flagged', 'false') <> 'true'\n",
      },
      {
        after: "     WHERE ar.user_id = p_user_id\n",
        add: "       AND ro.kind <> 'daily_archive'\n       AND coalesce(ar.extra ->> 'flagged', 'false') <> 'true'\n",
      },
    ],
  },
  {
    name: "pass_activity",
    tag: "joules",
    insertions: [
      {
        after: "      JOIN public.duels d ON d.id = r.duel_id\n     WHERE r.submitted_at >= p_from AND r.submitted_at < p_to\n",
        add: "       AND coalesce(r.extra ->> 'flagged', 'false') <> 'true'\n",
      },
      {
        after: "    SELECT 'room_round', 'room_round:' || a.id, a.submitted_at, a.game_id, a.score, NULL::date\n      FROM public.round_results_archive a\n     WHERE a.user_id = p_user_id AND a.submitted_at >= p_from AND a.submitted_at < p_to\n",
        add: "       AND coalesce(a.extra ->> 'flagged', 'false') <> 'true'\n",
      },
      {
        after: "     WHERE d.status = 'finished' AND jsonb_typeof(d.round_order) = 'array' AND jsonb_array_length(d.round_order) > 0\n       AND r.submitted_at >= p_from AND r.submitted_at < p_to\n",
        add: "       AND NOT EXISTS (SELECT 1 FROM public.round_results f WHERE f.duel_id = d.id AND f.player_slot = p.player_slot\n                         AND coalesce(f.extra ->> 'flagged', 'false') = 'true')\n",
      },
      {
        after: "                              WHERE b.duel_id = a.duel_id AND b.game_index = a.game_index)\n",
        add: "       AND NOT EXISTS (SELECT 1 FROM public.round_results_archive f WHERE f.duel_id = a.duel_id AND f.game_index = a.game_index\n                         AND f.user_id = a.user_id AND coalesce(f.extra ->> 'flagged', 'false') = 'true')\n",
      },
      {
        after: "      LEFT JOIN public.challenges c ON c.room_id = t.room_id\n     WHERE t.user_id = p_user_id\n",
        add: "       AND ar.kind <> 'daily_archive'\n",
      },
      {
        after: "     WHERE NOT coalesce(t.imported, false)\n       AND coalesce(r.answered_at, r.started_at) >= p_from AND coalesce(r.answered_at, r.started_at) < p_to\n",
        add: "       AND coalesce(r.extra ->> 'flagged', 'false') <> 'true'\n",
      },
      {
        after: "     WHERE t.finished_at IS NOT NULL AND NOT coalesce(t.imported, false)\n       AND t.finished_at >= p_from AND t.finished_at < p_to\n",
        add: "       AND NOT EXISTS (SELECT 1 FROM public.async_results f WHERE f.attempt_id = t.id\n                         AND coalesce(f.extra ->> 'flagged', 'false') = 'true')\n",
      },
    ],
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

/** The copy as it should be: the latest definition before the Plus migration, with every insertion. */
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
  let text = def;
  for (const ins of c.insertions) {
    if (def.split(ins.after).length !== 2)
      return { error: `${c.name}: its shape changed in ${source} (a line a condition follows isn't there exactly once); rebuild the copy by hand` };
    text = text.replace(ins.after, ins.after + ins.add);
  }
  text = text.replace("AS $$", "AS $body$").replace(/\$\$;$/, "$body$");
  return { source, text };
}

/** How many times each condition must appear in a definition that keeps them (the copy's own counts). */
export function conditionCounts(c: Copied): { archive: number; flagged: number } {
  const all = c.insertions.map((i) => i.add).join("");
  return { archive: all.split(ARCHIVE).length - 1, flagged: all.split(FLAGGED).length - 1 };
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
      problems.push(`${c.name}: the copy in ${PLUS_MIGRATION} differs from ${want.source} plus the archive and flagged-run conditions (run bun scripts/plus-copies.ts --write while it is unmerged)`);
    // Whatever defines it after the Plus migration must keep both conditions (at least as often as the copy has them).
    const need = conditionCounts(c);
    for (const f of all.filter((f) => f > PLUS_MIGRATION)) {
      for (const def of definitions(readFileSync(join(DIR, f), "utf8"), c.name)) {
        if (def.split(ARCHIVE).length - 1 < need.archive) problems.push(`${c.name}: ${f} defines it again without the daily_archive condition`);
        if (def.split(FLAGGED).length - 1 < need.flagged) problems.push(`${c.name}: ${f} defines it again without the flagged-run condition`);
      }
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
  console.log(problems.length ? "FAIL" : "plus-copies: both copies are their source plus the archive and flagged-run conditions");
  process.exit(problems.length ? 1 : 0);
}
