/**
 * Saves the Attention intro demos (scripts/fixtures/attention-demos.json) through the app's own Save demo server
 * function (savePuzzleDemoFn) on a running dev server, for the manual "Save intro demos" workflow after the final
 * merge. Never prompts, never prints a secret.
 *
 *   DEMOS_URL=http://127.0.0.1:8080 INTRO_DEMO_KEY=… bun scripts/attention-demos-save.ts [--url=…] [--games=a,b] [--dry]
 *
 * Settings (a flag wins over its variable):
 *   --url / DEMOS_URL        the dev server's origin (its server must hold the same INTRO_DEMO_KEY and allow demo saves);
 *   INTRO_DEMO_KEY           the private intro-demo key (a variable only, so it never sits in a command line);
 *   --games / DEMOS_GAMES    a comma list of games to save (default all six);
 *   --dry / DEMOS_DRY=1      ask the server for each deal and compare it with the fixture, save nothing (no key needed).
 *
 * For each game it asks the server for the game's intro example (practiceGenerateFn, example: true: the one deal with a
 * fixed seed, sealed as the example), refuses to save unless the server's deal is exactly the fixture's puzzle, then
 * saves the fixture's touches on that sealed deal. Prints OK or FAIL a game. The dev server needs a large heap:
 * NODE_OPTIONS=--max-old-space-size=6144.
 *
 * Exit codes: 0 every game OK; 1 a game failed (deal mismatch, refused key, a save error); 2 nothing tried (missing
 * DEMOS_URL or INTRO_DEMO_KEY, an unknown game, the server unreachable, the fixture unreadable).
 */
import { existsSync, readFileSync } from "node:fs";
import { DEMO_GAMES, DEMOS_FIXTURE, type DemoGame, type DemoRow } from "./attention-demos-lib";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (hit === undefined) return undefined;
  return hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : "1";
};
const url = (flag("url") ?? process.env["DEMOS_URL"] ?? "").replace(/\/$/, "");
const key = process.env["INTRO_DEMO_KEY"] ?? "";
const dry = (flag("dry") ?? process.env["DEMOS_DRY"] ?? "") === "1";
const gamesText = flag("games") ?? process.env["DEMOS_GAMES"] ?? DEMO_GAMES.join(",");

/** Any text that might echo the key, with the key taken out. */
const scrub = (text: string): string => (key ? text.split(key).join("[key]") : text).slice(0, 300);
function giveUp(message: string): never {
  console.log(`FAIL ${scrub(message)}`);
  process.exit(2);
}

if (!url) giveUp("DEMOS_URL (or --url) is not set");
if (!dry && !key) giveUp("INTRO_DEMO_KEY is not set (or pass --dry to compare only)");
const games = gamesText.split(",").map((g) => g.trim()).filter(Boolean);
for (const g of games) if (!(DEMO_GAMES as readonly string[]).includes(g)) giveUp(`unknown game "${g}" (known: ${DEMO_GAMES.join(", ")})`);

let rows: DemoRow[] = [];
try {
  rows = (JSON.parse(readFileSync(DEMOS_FIXTURE, "utf8")) as { rows: DemoRow[] }).rows;
} catch (e) {
  giveUp(`the fixture could not be read: ${(e as Error).message}`);
}
try {
  const res = await fetch(`${url}/practice`);
  if (!res.ok) giveUp(`the dev server answered ${res.status} at ${url}`);
} catch {
  giveUp(`the dev server is not reachable at ${url}`);
}

const { chromium } = await import("playwright");
const executablePath = [process.env["PLAYWRIGHT_CHROMIUM"], "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find((p) => p && existsSync(p));
let browser: Awaited<ReturnType<typeof chromium.launch>>;
try {
  browser = await chromium.launch(executablePath ? { executablePath } : {});
} catch (e) {
  giveUp(`no browser to drive the dev server: ${(e as Error).message.split("\n")[0]}`);
}
let failed = 0;
try {
  const page = await browser.newPage();
  await page.goto(`${url}/practice`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  if (!dry) {
    const keyOk = await page.evaluate(async (k) => {
      const m = (await import(/* @vite-ignore */ "/src/lib/duel/practice.functions.ts")) as {
        checkDemoKeyFn: (o: { data: { key: string } }) => Promise<{ ok: boolean }>;
      };
      return (await m.checkDemoKeyFn({ data: { key: k } })).ok;
    }, key);
    if (!keyOk) {
      console.log("FAIL the server refused INTRO_DEMO_KEY (it must match the dev server's own)");
      process.exit(1);
    }
  }
  for (const game of games as DemoGame[]) {
    const row = rows.find((r) => r.game_type === game);
    if (!row) {
      failed++;
      console.log(`FAIL ${game}: no demo in the fixture`);
      continue;
    }
    try {
      const outcome = await page.evaluate(
        async ({ game, row, key, dry }) => {
          const m = (await import(/* @vite-ignore */ "/src/lib/duel/practice.functions.ts")) as {
            practiceGenerateFn: (o: { data: { type: string; example: boolean } }) => Promise<{ puzzle: unknown; sealed: string }>;
            savePuzzleDemoFn: (o: { data: { puzzle: unknown; sealed: string; log: unknown; dev: boolean; key: string } }) => Promise<{ ok: boolean }>;
          };
          const deal = await m.practiceGenerateFn({ data: { type: game, example: true } });
          if (JSON.stringify(deal.puzzle) !== JSON.stringify(row.puzzle)) return { ok: false, why: "the server's example deal is not the fixture's (re-record the demos)" };
          if (dry) return { ok: true, why: "deal matches (dry run, nothing saved)" };
          const saved = await m.savePuzzleDemoFn({ data: { puzzle: deal.puzzle, sealed: deal.sealed, log: row.input_log, dev: true, key } });
          return saved.ok ? { ok: true, why: `saved (${row.input_log.actions.length} touches, ${row.score} points)` } : { ok: false, why: "the server did not save it" };
        },
        { game, row, key, dry },
      );
      if (!outcome.ok) failed++;
      console.log(`${outcome.ok ? "OK" : "FAIL"} ${game}: ${scrub(outcome.why)}`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${game}: ${scrub((e as Error).message ?? String(e))}`);
    }
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
