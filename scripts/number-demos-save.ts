/**
 * Saves the Number games' intro demos (scripts/fixtures/number-demos.json, recorded by number-demos-record.ts) through
 * the app's own Save demo server function (savePuzzleDemoFn), never by writing the database directly. Never prompts.
 *
 *   DEMOS_URL=<origin> INTRO_DEMO_KEY=<key> [DEMOS_GAMES=target,numline] bun scripts/number-demos-save.ts [--dry] [--games=a,b]
 *
 * DEMOS_URL: the running app whose database the demos go to (its server must hold INTRO_DEMO_PRIVATE_KEY; a production
 * build also needs INTRO_DEMO_SAVES=1). A dev server used for saves needs more memory than the default:
 * NODE_OPTIONS=--max-old-space-size=6144 bun run dev. INTRO_DEMO_KEY: the demo key (never printed). DEMOS_GAMES or
 * --games: only these games (flags win over the environment). DEMOS_DRY=1 or --dry: everything but the save (the
 * deal is fetched and compared, the key is checked with checkDemoKeyFn; a refused key fails the dry run).
 *
 * For each game it opens DEMOS_URL in headless Chromium, asks the server for the fixed intro example exactly as the app
 * does (practiceGenerateFn with example: true, no level: Normal) and refuses to save unless the deal is exactly the
 * fixture's puzzle (the demo's taps were recorded on that board). Prints OK or FAIL per game with the reason.
 * Exit 0: every game saved (or, dry, ready to save); 1: any failed; 2: DEMOS_URL or INTRO_DEMO_KEY missing.
 */
import { existsSync, readFileSync } from "node:fs";

const FIXTURE = "scripts/fixtures/number-demos.json";
/** The app's practice server functions, imported in the page from the running app's own dev server. */
const FUNCTIONS = "/src/lib/duel/practice.functions.ts";

/** Key-order-free JSON, so a deal from the server compares with the fixture's whatever order its keys came in. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

export interface SaveOptions {
  url: string | null;
  key: string | null;
  games: string[] | null;
  dry: boolean;
}

/** The options from flags and the environment (flags win). */
export function saveOptions(argv: string[], env: Record<string, string | undefined>): SaveOptions {
  const flag = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const list = (s: string | undefined) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : null);
  const dryFlag = argv.includes("--dry") ? true : argv.includes("--no-dry") ? false : null;
  return {
    url: (flag("url") ?? env["DEMOS_URL"] ?? "").replace(/\/$/, "") || null,
    key: env["INTRO_DEMO_KEY"] || null,
    games: list(flag("games")) ?? list(env["DEMOS_GAMES"]),
    dry: dryFlag ?? (env["DEMOS_DRY"] === "1" || env["DEMOS_DRY"] === "true"),
  };
}

/** A message with every copy of the key taken out. */
export const scrub = (text: string, key: string) => (key ? text.split(key).join("[key]") : text).split("\n")[0]!.slice(0, 300);

if (import.meta.main) {
  const opts = saveOptions(process.argv.slice(2), process.env);
  if (!opts.url || !opts.key) {
    console.log(`FAIL: ${!opts.url ? "DEMOS_URL" : "INTRO_DEMO_KEY"} is not set`);
    process.exit(2);
  }
  const key = opts.key;
  const demos = (JSON.parse(readFileSync(FIXTURE, "utf8")) as { demos: Record<string, { puzzle: unknown; log: unknown }> }).demos;
  const games = opts.games ?? Object.keys(demos);
  const { chromium } = await import("playwright");
  const executablePath = [process.env["PLAYWRIGHT_CHROMIUM"], "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find((p) => p && existsSync(p));
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  let failed = 0;
  try {
    const page = await (await browser.newContext()).newPage();
    await page.goto(`${opts.url}/terms`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    if (opts.dry) {
      const ok = await page.evaluate(async ({ k, FNS }) => {
        const fns = (await import(/* @vite-ignore */ FNS)) as { checkDemoKeyFn: (a: { data: { key: string } }) => Promise<{ ok: boolean }> };
        return (await fns.checkDemoKeyFn({ data: { key: k } })).ok;
      }, { k: key, FNS: FUNCTIONS }).catch(() => null);
      if (ok) console.log("OK key: accepted (dry run: nothing is saved)");
      else {
        failed++;
        console.log(`FAIL key: ${ok === null ? "could not be checked" : "refused"} (dry run: nothing is saved)`);
      }
    }
    for (const game of games) {
      const demo = demos[game];
      if (!demo) {
        failed++;
        console.log(`FAIL ${game}: not in ${FIXTURE}`);
        continue;
      }
      try {
        const dealt = await page.evaluate(async ({ type, FNS }) => {
          const fns = (await import(/* @vite-ignore */ FNS)) as {
            practiceGenerateFn: (a: { data: { type: string; example: boolean } }) => Promise<{ puzzle: unknown; sealed: string }>;
          };
          return fns.practiceGenerateFn({ data: { type, example: true } });
        }, { type: game, FNS: FUNCTIONS });
        if (canonical(dealt.puzzle) !== canonical(demo.puzzle)) {
          failed++;
          console.log(`FAIL ${game}: the server's intro example is not the board the demo was recorded on (re-record with number-demos-record.ts)`);
          continue;
        }
        if (opts.dry) {
          console.log(`OK ${game}: the example matches (dry run, not saved)`);
          continue;
        }
        await page.evaluate(
          async ({ puzzle, sealed, log, k, FNS }) => {
            const fns = (await import(/* @vite-ignore */ FNS)) as {
              savePuzzleDemoFn: (a: { data: { puzzle: unknown; sealed: string; log: unknown; dev: boolean; key: string } }) => Promise<unknown>;
            };
            await fns.savePuzzleDemoFn({ data: { puzzle, sealed, log, dev: true, key: k } });
          },
          { puzzle: dealt.puzzle, sealed: dealt.sealed, log: demo.log, k: key, FNS: FUNCTIONS },
        );
        console.log(`OK ${game}: saved`);
      } catch (error) {
        failed++;
        console.log(`FAIL ${game}: ${scrub(String((error as Error).message ?? error), key)}`);
      }
    }
  } finally {
    await browser.close();
  }
  process.exit(failed ? 1 : 0);
}
