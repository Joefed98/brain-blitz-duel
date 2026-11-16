/**
 * Saves the Logic overhaul 2 intro demos (scripts/fixtures/logic2-demos.json) through the app's own Save demo path, for
 * the manual "Save intro demos" workflow (.github/workflows/save-intro-demos.yml). Never prompts.
 *
 *   DEMOS_URL=<dev server origin> INTRO_DEMO_KEY=… bun scripts/logic2-demos-save.ts [--url=…] [--games=a,b] [--dry]
 *
 * Environment: DEMOS_URL (a dev server's origin), INTRO_DEMO_KEY, and optionally DEMOS_GAMES=a,b and DEMOS_DRY=1; the
 * flags --url, --games and --dry win over them. The key is read from the environment only and never printed.
 *
 * For each game, a page on the dev server deals the fixed intro example (practiceGenerateFn with example: true, the
 * deal the server seals) and the demo is saved only when that deal's public half equals the fixture's puzzle exactly:
 * savePuzzleDemoFn takes the sealed deal, the recorded touches and the key. A dry run deals and compares, and saves
 * nothing. One line a game, OK or FAIL. Exit 0 when every game is saved (or, dry, matches), 1 when any failed or the
 * key was refused, 2 when the URL or key is missing or nothing was tried.
 */
import { existsSync, readFileSync } from "node:fs";

import { chromium } from "playwright";

import { LOGIC_DEMO_GAMES, LOGIC_DEMOS_FILE } from "./logic2-demos-lib";

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const url = (flag("url") ?? process.env["DEMOS_URL"] ?? "").replace(/\/$/, "");
const key = process.env["INTRO_DEMO_KEY"] ?? "";
const dry = args.includes("--dry") || process.env["DEMOS_DRY"] === "1";
const wanted = (flag("games") ?? process.env["DEMOS_GAMES"] ?? "")
  .split(",")
  .map((g) => g.trim())
  .filter(Boolean);

/** Never echo the key: any message that might carry it has it masked. */
const mask = (text: string) => (key ? text.split(key).join("***") : text).split("\n")[0]!.slice(0, 300);

if (!url || (!key && !dry)) {
  console.log(`FAIL setup: ${!url ? "DEMOS_URL (or --url) is missing" : "INTRO_DEMO_KEY is missing"}`);
  process.exit(2);
}

const fixture = JSON.parse(readFileSync(LOGIC_DEMOS_FILE, "utf8")) as Record<string, { puzzle: unknown; input_log: unknown }>;
const unknown = wanted.filter((g) => !(LOGIC_DEMO_GAMES as readonly string[]).includes(g));
for (const g of unknown) console.log(`FAIL ${g}: not one of this script's games (${LOGIC_DEMO_GAMES.join(", ")})`);
const games = (wanted.length ? wanted.filter((g) => !unknown.includes(g)) : [...LOGIC_DEMO_GAMES]).filter((g) => fixture[g]);
if (!games.length) {
  console.log("FAIL setup: no games to save");
  process.exit(2);
}

/** Same value, key order ignored. */
function sameJson(a: unknown, b: unknown): boolean {
  const norm = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(norm) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, norm((v as Record<string, unknown>)[k])])) : v;
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

const exe = process.env["PLAYWRIGHT_CHROMIUM"] ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
let failed = 0;
let tried = 0;
try {
  const page = await browser.newPage();
  await page.goto(`${url}/`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  for (const type of games) {
    tried++;
    try {
      const demo = fixture[type]!;
      // The deal the server seals: the fixed intro example, through the app's own server function.
      const dealt = (await page.evaluate(async (type) => {
        const fns = (await import(/* @vite-ignore */ "/src/lib/duel/practice.functions.ts")) as {
          practiceGenerateFn: (input: { data: { type: string; example: boolean } }) => Promise<{ puzzle: unknown; sealed: string }>;
        };
        return fns.practiceGenerateFn({ data: { type, example: true } });
      }, type)) as { puzzle: unknown; sealed: string };
      if (!sameJson(dealt.puzzle, demo.puzzle)) {
        failed++;
        console.log(`FAIL ${type}: the server's intro example differs from the fixture's puzzle (re-record with bun scripts/logic2-demos-record.ts)`);
        continue;
      }
      if (dry) {
        console.log(`OK ${type}: the deal matches the fixture (dry run, not saved)`);
        continue;
      }
      await page.evaluate(
        async ({ puzzle, sealed, log, key }) => {
          const fns = (await import(/* @vite-ignore */ "/src/lib/duel/practice.functions.ts")) as {
            savePuzzleDemoFn: (input: { data: { puzzle: unknown; sealed: string; log: unknown; dev: boolean; key: string } }) => Promise<{ ok: boolean }>;
          };
          const result = await fns.savePuzzleDemoFn({ data: { puzzle, sealed, log, dev: true, key } });
          if (!result?.ok) throw new Error("the save was not confirmed");
        },
        { puzzle: dealt.puzzle, sealed: dealt.sealed, log: demo.input_log, key },
      );
      console.log(`OK ${type}: saved`);
    } catch (error) {
      failed++;
      console.log(`FAIL ${type}: ${mask(String((error as Error)?.message ?? error))}`);
    }
  }
} catch (error) {
  failed++;
  console.log(`FAIL setup: ${mask(String((error as Error)?.message ?? error))}`);
} finally {
  await browser.close();
}
process.exit(!tried ? 2 : failed ? 1 : 0);
