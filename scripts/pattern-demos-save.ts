/**
 * pattern-demos-save (15 Nov 2026): saves the Pattern overhaul's intro demos (scripts/fixtures/pattern-demos.json)
 * through a running dev server, exactly as the reveal's "Save as intro demo" button does. Never prompts.
 *
 *   DEMOS_URL=http://127.0.0.1:5173 INTRO_DEMO_KEY=… bun scripts/pattern-demos-save.ts [--dry] [--games=a,b]
 *   bun scripts/pattern-demos-save.ts --url=<origin> --key=<key> [--dry] [--games=a,b]
 *
 * Settings: DEMOS_URL (a dev server's origin; production builds name their server functions by hash, so only a dev
 * server is reachable), INTRO_DEMO_KEY (the server's own key), DEMOS_GAMES (comma list, default every game in the
 * fixture), DEMOS_DRY=1. A flag wins over its variable.
 *
 * For each game:
 *   1. asks the server for the fixed intro example (practiceGenerateFn with example: true) and refuses (FAIL) unless the
 *      deal's public half is exactly the fixture's puzzle (Lightbender's build time aside, pattern-demos-lib.ts);
 *   2. saves the fixture's touch log on that sealed deal (savePuzzleDemoFn: puzzle, sealed, log, dev, key, as
 *      SaveDemoButton sends them), so the stored row is the fixture's row;
 *   3. reads the game's intro demo back (getIntroDemoFn) and fails unless the server now serves the saved touches.
 * --dry does 1 only (and checks the key once) and saves nothing. Prints OK or FAIL a game. Exit 0 when every game is OK,
 * 1 if any failed, 2 if the URL or the key is missing. The key is never printed.
 */
import { fromCrossJSON, toJSONAsync } from "seroval";

import { canonicalJson, comparablePuzzle, loadPatternDemos, puzzleDifferences, type PatternDemo } from "./pattern-demos-lib";

/** The server functions the script calls, by the names the app exports them under. */
export type DemoFn = "checkDemoKeyFn" | "practiceGenerateFn" | "savePuzzleDemoFn" | "getIntroDemoFn";

/** One call to a server function: resolves to its result, rejects with what it threw. */
export type DemoCall = (fn: DemoFn, data: Record<string, unknown>) => Promise<unknown>;

const FILES: Record<DemoFn, string> = {
  checkDemoKeyFn: "/src/lib/duel/practice.functions.ts",
  practiceGenerateFn: "/src/lib/duel/practice.functions.ts",
  savePuzzleDemoFn: "/src/lib/duel/practice.functions.ts",
  getIntroDemoFn: "/src/lib/duel/introDemo.functions.ts",
};
const GETS = new Set<DemoFn>(["getIntroDemoFn"]);

/** A dev server's id for a server function (TanStack Start in development: the file and export, base64url). */
export function devServerFnId(fn: DemoFn): string {
  return Buffer.from(JSON.stringify({ file: `${FILES[fn]}?tss-serverfn-split`, export: `${fn}_createServerFn_handler` })).toString("base64url");
}

/** The request a call makes against a dev server at `origin` (what the app's own fetcher sends). */
export async function devServerRequest(origin: string, fn: DemoFn, data: Record<string, unknown>): Promise<{ url: string; init: RequestInit }> {
  const payload = JSON.stringify(await toJSONAsync({ data }));
  const root = origin.replace(/\/+$/, "");
  const base = `${root}/_serverFn/${devServerFnId(fn)}`;
  // As the app's own pages call them: same-origin (the server refuses a server-function call from another origin).
  const headers: Record<string, string> = { "x-tsr-serverFn": "true", accept: "application/json", origin: new URL(root).origin };
  if (GETS.has(fn)) return { url: `${base}?${new URLSearchParams({ payload })}`, init: { method: "GET", headers } };
  return { url: base, init: { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: payload } };
}

/** Calls server functions on a dev server over HTTP. */
export function devServerCall(origin: string): DemoCall {
  return async (fn, data) => {
    const { url, init } = await devServerRequest(origin, fn, data);
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(180_000) });
    const text = await res.text();
    if (!res.headers.get("x-tss-serialized")) throw new Error(`${fn}: HTTP ${res.status} without a server-function answer`);
    const out = fromCrossJSON(JSON.parse(text), { refs: new Map() } as never) as { result?: unknown; error?: unknown };
    if (out.error) throw out.error instanceof Error ? out.error : new Error(String(out.error));
    return out.result;
  };
}

export interface SaveOptions {
  call: DemoCall;
  key: string;
  dry: boolean;
  demos: PatternDemo[];
  /** Where each OK / FAIL line goes (stdout by default). */
  print?: (line: string) => void;
}

export interface SaveResult {
  game: string;
  ok: boolean;
  line: string;
}

/** Saves (or, dry, checks) each demo; never throws. */
export async function saveDemos({ call, key, dry, demos, print = (line) => console.log(line) }: SaveOptions): Promise<SaveResult[]> {
  // A message from the server, never with the key in it.
  const said = (err: unknown) => (err instanceof Error ? err.message : String(err)).split(key).join("[key]").split("\n")[0]!.slice(0, 200);
  const results: SaveResult[] = [];
  const report = (game: string, ok: boolean, text: string) => {
    const line = `${ok ? "OK" : "FAIL"} ${game}: ${text}`;
    results.push({ game, ok, line });
    print(line);
  };
  let keyOk = false;
  let keyText = "";
  try {
    keyOk = ((await call("checkDemoKeyFn", { key })) as { ok?: boolean } | null)?.ok === true;
    if (!keyOk) keyText = "the server refused the key (wrong key, no INTRO_DEMO_KEY on the server, or too many tries)";
  } catch (err) {
    keyText = `the key check failed: ${said(err)}`;
  }
  for (const demo of demos) {
    if (!keyOk) {
      report(demo.game, false, keyText);
      continue;
    }
    let deal: { puzzle?: unknown; sealed?: unknown };
    try {
      deal = (await call("practiceGenerateFn", { type: demo.game, example: true })) as typeof deal;
    } catch (err) {
      report(demo.game, false, `no example deal: ${said(err)}`);
      continue;
    }
    const diff = puzzleDifferences(deal?.puzzle, demo.row.puzzle);
    if (diff.length || typeof deal?.sealed !== "string") {
      report(demo.game, false, `refused: the server's intro example is not the fixture's (differs in ${diff.join(", ") || "sealed"}); nothing saved`);
      continue;
    }
    if (dry) {
      report(demo.game, true, `dry run: the example deal matches (${demo.stamp.key} ${demo.stamp.rev}, ${demo.row.input_log.actions.length} touches); nothing saved`);
      continue;
    }
    try {
      const saved = (await call("savePuzzleDemoFn", { puzzle: deal.puzzle, sealed: deal.sealed, log: demo.row.input_log, dev: true, key })) as { ok?: boolean } | null;
      if (saved?.ok !== true) throw new Error("the server did not confirm the save");
    } catch (err) {
      report(demo.game, false, `save refused: ${said(err)}`);
      continue;
    }
    try {
      const served = (await call("getIntroDemoFn", { type: demo.game })) as { input_log?: unknown; puzzle?: unknown } | null;
      // Stored as jsonb, so compared value for value (the key order is the database's).
      const same =
        served &&
        canonicalJson(served.input_log) === canonicalJson(demo.row.input_log) &&
        canonicalJson(comparablePuzzle(served.puzzle)) === canonicalJson(comparablePuzzle(demo.row.puzzle));
      if (!same) throw new Error("the intro serves another demo");
    } catch (err) {
      report(demo.game, false, `saved, but the read-back failed: ${said(err)}`);
      continue;
    }
    report(demo.game, true, `saved on ${demo.stamp.key} ${demo.stamp.rev} (${demo.row.input_log.actions.length} touches) and served back`);
  }
  return results;
}

/** The settings from flags and the environment (a flag wins over its variable). */
export function readSettings(argv: string[], env: Record<string, string | undefined>) {
  const flag = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const url = flag("url") ?? env["DEMOS_URL"] ?? "";
  const key = flag("key") ?? env["INTRO_DEMO_KEY"] ?? "";
  const games = (flag("games") ?? env["DEMOS_GAMES"] ?? "").split(",").map((g) => g.trim()).filter(Boolean);
  const dryFlag = argv.includes("--dry") ? true : argv.includes("--no-dry") ? false : null;
  const dry = dryFlag ?? ["1", "true", "yes"].includes((env["DEMOS_DRY"] ?? "").toLowerCase());
  return { url, key, games, dry };
}

export async function main(argv: string[], env: Record<string, string | undefined>): Promise<number> {
  const { url, key, games, dry } = readSettings(argv, env);
  if (!url || !key) {
    console.log(`FAIL: ${!url ? "DEMOS_URL (or --url=)" : "INTRO_DEMO_KEY (or --key=)"} is missing`);
    return 2;
  }
  const all = loadPatternDemos();
  const unknown = games.filter((g) => !all.some((d) => d.game === g));
  if (unknown.length) {
    for (const g of unknown) console.log(`FAIL ${g}: not in scripts/fixtures/pattern-demos.json`);
    return 1;
  }
  const demos = games.length ? all.filter((d) => games.includes(d.game)) : all;
  console.log(`pattern-demos-save: ${demos.length} demo${demos.length === 1 ? "" : "s"} ${dry ? "checked (dry run)" : "to save"} through ${url}`);
  const results = await saveDemos({ call: devServerCall(url), key, dry, demos });
  const failed = results.filter((r) => !r.ok).length;
  console.log(`pattern-demos-save: ${results.length - failed} OK, ${failed} failed`);
  return failed ? 1 : 0;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2), process.env));
