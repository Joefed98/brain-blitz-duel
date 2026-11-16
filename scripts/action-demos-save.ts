/**
 * Saves the six Action games' intro demos (scripts/fixtures/action-demos.json, recorded by
 * scripts/action-demos-record.ts) through the app's own save, exactly as the practice reveal's "Save demo" button does:
 * for each game, a sealed practice deal from `practiceGenerateFn` (`example: true`, the intro example), then
 * `saveIntroDemoFn` with that deal and the stored run, then `getIntroDemoFn` reads it back through the stop rules. It
 * never writes the database itself, and refuses a game whose dev server deals another stamp or another example than
 * the stored run was recorded on.
 *
 * Joe runs it once against a dev server (`bun run dev`) whose environment points at the live project and holds
 * INTRO_DEMO_KEY (the server takes demo saves in development, or with INTRO_DEMO_SAVES=1):
 *
 *   bun scripts/action-demos-save.ts --url=http://localhost:8080 --key=<INTRO_DEMO_KEY> [games…] [--dry]
 *
 * Non-interactive (Joe, 15 Nov 2026: the captain's GitHub workflow saves them after the final deploy): every option can
 * come from the environment instead, flags winning, and nothing is ever prompted for:
 *
 *   ACTION_DEMOS_URL=<server origin> INTRO_DEMO_KEY=<key> [ACTION_DEMOS_GAMES=flip,orbit] [ACTION_DEMOS_DRY=1] \
 *     bun scripts/action-demos-save.ts
 *
 * The shared names every *-demos-save.ts takes, DEMOS_URL, DEMOS_GAMES and DEMOS_DRY=1, work too (an ACTION_ one wins).
 *
 * The server must be a dev server (the function ids are read from its client modules), e.g. one the workflow starts with
 * `NODE_OPTIONS=--max-old-space-size=6144 bun run dev` on the live project's environment. The key is never printed. Exit codes: 0 all OK, 1 any game failed, 2 missing URL or key (usage).
 *
 * `--dry` deals and compares only (nothing saved). The calls go over HTTP with TanStack Start's own client fetcher, to
 * the ids the dev server's client module names (the same requests the phone makes). scripts/action-demos-check.ts runs
 * `saveActionDemos` through the server-function harness on a local PostgreSQL (the real handlers end to end).
 */
import { readFileSync } from "node:fs";
import { ACTION_DEMO_REVS } from "../src/lib/duel/introDemo.functions";
import type { PuzzleData } from "../src/lib/duel/types";
import { ACTION_DEMO_FIXTURE, ACTION_DEMO_TYPES, puzzleDigest, stampOf, type ActionDemoFile, type ActionDemoType } from "./action-demos-lib";

/** The three server functions the save uses, by export name. */
export type DemoCall = (fn: "practiceGenerateFn" | "saveIntroDemoFn" | "getIntroDemoFn", data: Record<string, unknown>) => Promise<unknown>;

export interface SaveOutcome {
  type: ActionDemoType;
  ok: boolean;
  text: string;
}

export async function saveActionDemos(call: DemoCall, opts: { key: string; games?: readonly ActionDemoType[]; dry?: boolean; file?: ActionDemoFile }): Promise<SaveOutcome[]> {
  const file = opts.file ?? (JSON.parse(readFileSync(ACTION_DEMO_FIXTURE, "utf8")) as ActionDemoFile);
  const out: SaveOutcome[] = [];
  for (const type of opts.games?.length ? opts.games : ACTION_DEMO_TYPES) {
    const entry = file.demos[type];
    const fail = (text: string) => out.push({ type, ok: false, text });
    if (!entry) {
      fail("no stored run (bun scripts/action-demos-record.ts " + type + ")");
      continue;
    }
    if (entry.stamp !== ACTION_DEMO_REVS[type]) {
      fail(`the stored run is on stamp ${entry.stamp}, but the intro plays only ${ACTION_DEMO_REVS[type]} (re-record)`);
      continue;
    }
    try {
      const deal = (await call("practiceGenerateFn", { type, example: true })) as { puzzle: PuzzleData; sealed: string };
      const stamp = stampOf(type, deal.puzzle);
      if (stamp !== entry.stamp) {
        fail(`the server deals stamp ${stamp}, the stored run is on ${entry.stamp} (merge main, or re-record)`);
        continue;
      }
      const digest = puzzleDigest(deal.puzzle);
      if (digest !== entry.digest) {
        fail(`the server's intro example (${digest}) is not the one the run was recorded on (${entry.digest}); re-record`);
        continue;
      }
      if (opts.dry) {
        out.push({ type, ok: true, text: `would save (stamp ${stamp}, ${entry.score} points, ${entry.run.length} chars)` });
        continue;
      }
      await call("saveIntroDemoFn", { puzzle: deal.puzzle, sealed: deal.sealed, answer: entry.run, dev: true, key: opts.key });
      const back = (await call("getIntroDemoFn", { type })) as { puzzle: PuzzleData; input_log: { run?: string } } | null;
      if (!back) fail("saved, but the read back returned no demo (a stop rule refused it)");
      else if (back.input_log.run !== entry.run || puzzleDigest(back.puzzle) !== entry.digest) fail("saved, but the read back is another demo");
      else out.push({ type, ok: true, text: `saved on stamp ${stamp} (${entry.score} points), plays` });
    } catch (err) {
      fail(err instanceof Error ? err.message : String(err));
    }
  }
  return out;
}

/* ============================================================ over HTTP, to a dev server */

const MODULES = { practiceGenerateFn: "/src/lib/duel/practice.functions.ts", saveIntroDemoFn: "/src/lib/duel/practice.functions.ts", getIntroDemoFn: "/src/lib/duel/introDemo.functions.ts" } as const;

/**
 * The dev server's server-function ids, read from its client modules (Vite serves each `*.functions.ts` compiled for the
 * browser, where every handler is `createClientRpc("<id>")`; a dev id is base64url JSON naming the file and export).
 */
async function functionIds(origin: string): Promise<Record<keyof typeof MODULES, string>> {
  const ids: Partial<Record<keyof typeof MODULES, string>> = {};
  for (const path of new Set(Object.values(MODULES))) {
    const res = await fetch(origin + path);
    if (!res.ok) throw new Error(`${origin}${path}: HTTP ${res.status} (is this a dev server, bun run dev?)`);
    const js = await res.text();
    for (const m of js.matchAll(/createClientRpc\(\s*["']([A-Za-z0-9_-]+)["']/g)) {
      let exp = "";
      try {
        exp = String((JSON.parse(Buffer.from(m[1]!, "base64url").toString("utf8")) as { export?: string }).export ?? "");
      } catch {
        continue;
      }
      for (const name of Object.keys(MODULES) as (keyof typeof MODULES)[]) if (MODULES[name] === path && (exp === name || exp.startsWith(`${name}_`))) ids[name] = m[1]!;
    }
  }
  for (const name of Object.keys(MODULES) as (keyof typeof MODULES)[]) if (!ids[name]) throw new Error(`no server function id for ${name} on ${origin} (a production build? run a dev server)`);
  return ids as Record<keyof typeof MODULES, string>;
}

export async function httpCall(origin: string): Promise<DemoCall> {
  const ids = await functionIds(origin);
  const { serverFnFetcher } = (await import("../node_modules/@tanstack/start-client-core/dist/esm/client-rpc/serverFnFetcher.js")) as {
    serverFnFetcher: (url: string, args: unknown[], handler: typeof fetch) => Promise<unknown>;
  };
  // The app's CSRF middleware takes same-origin calls only, so each carries the Origin a page on the dev server sends.
  // Outside a browser the fetcher reads Start's options from the server-side context (none here: no serialization
  // adapters, the phone's defaults), so each call runs inside an empty one.
  const { runWithStartContext } = (await import("@tanstack/start-storage-context")) as unknown as {
    runWithStartContext: <T>(ctx: unknown, fn: () => Promise<T>) => Promise<T>;
  };
  const context = { request: new Request(origin), contextAfterGlobalMiddlewares: {}, executedRequestMiddlewares: new Set(), startOptions: {} };
  return async (fn, data) => {
    const sent = { data, method: fn === "getIntroDemoFn" ? "GET" : "POST", headers: { origin } };
    const reply = (await runWithStartContext(context, () => serverFnFetcher(`${origin}/_serverFn/${ids[fn]}`, [sent], fetch))) as { result?: unknown; error?: unknown };
    // As createServerFn's client does: the handler's error is thrown, its result returned.
    if (reply && typeof reply === "object" && "error" in reply && reply.error) throw reply.error;
    return reply && typeof reply === "object" && "result" in reply ? reply.result : reply;
  };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  // ACTION_DEMOS_* first, then the shared DEMOS_* every *-demos-save.ts reads (the captain's workflow).
  const env = (name: string) => (process.env[`ACTION_${name}`] ?? "").trim() || (process.env[name] ?? "").trim();
  const url = (opt("url") ?? env("DEMOS_URL")).replace(/\/+$/, "");
  const key = opt("key") ?? (process.env["INTRO_DEMO_KEY"] ?? "").trim();
  const dry = args.includes("--dry") || /^(1|true|yes)$/i.test(env("DEMOS_DRY"));
  const fromArgs = args.filter((a) => !a.startsWith("--"));
  const games = (fromArgs.length ? fromArgs : env("DEMOS_GAMES").split(/[\s,]+/).filter(Boolean)) as ActionDemoType[];
  for (const g of games) if (!ACTION_DEMO_TYPES.includes(g)) throw new Error(`unknown game ${g} (one of ${ACTION_DEMO_TYPES.join(", ")})`);
  if (!url || (!key && !dry)) {
    console.log(
      "usage: bun scripts/action-demos-save.ts --url=<server origin> --key=<INTRO_DEMO_KEY> [games…] [--dry]\n" +
        "   or: ACTION_DEMOS_URL=… INTRO_DEMO_KEY=… [ACTION_DEMOS_GAMES=a,b] [ACTION_DEMOS_DRY=1] bun scripts/action-demos-save.ts",
    );
    process.exit(2);
  }
  const results = await saveActionDemos(await httpCall(url), { key, games, dry });
  for (const r of results) console.log(`  ${r.ok ? "OK  " : "FAIL"} ${r.type}: ${r.text}`);
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}
