/**
 * Saves the Speed games' intro demos (scripts/fixtures/speed-demos.json) through the app's own Save demo server function,
 * for the manual "Save intro demos" workflow (the merge captain's rule, 15 Nov 2026, modelled on Action's
 * action-demos-save). Never prompts and never prints a secret.
 *
 *   DEMOS_URL=<dev server origin> INTRO_DEMO_KEY=<key> bun scripts/speed-demos-save.ts [--url=…] [--key=…] [--games=a,b] [--dry]
 *
 * Inputs: DEMOS_URL (a dev server's origin), INTRO_DEMO_KEY, and optionally DEMOS_GAMES=a,b and DEMOS_DRY=1. Flags win over
 * the environment. For each game it opens the dev server in headless Chromium and calls, from the page, the app's own
 * server functions as the practice screen does: practiceGenerateFn with `example: true` (the server's fixed intro
 * example, sealed by the server) and, unless dry, saveIntroDemoFn with that sealed deal and the fixture's run. A deal that
 * is not the fixture's (the stamps moved on since it was recorded) fails that game without saving. Prints OK or FAIL a
 * game; exits 0 when every game is saved (or, dry, would be), 1 if any failed, 2 if the URL or key is missing.
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { SPEED_DEMO_FIXTURE, type SpeedDemoFixture } from "./speed-demos-record";

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const url = (flag("url") ?? process.env["DEMOS_URL"] ?? "").trim().replace(/\/$/, "");
const key = flag("key") ?? process.env["INTRO_DEMO_KEY"] ?? "";
const gamesText = flag("games") ?? process.env["DEMOS_GAMES"] ?? "";
const dry = args.includes("--dry") || flag("dry") === "1" || (!args.some((a) => a.startsWith("--dry")) && process.env["DEMOS_DRY"] === "1");

if (!url || !key) {
  console.log(`FAIL speed-demos-save: ${!url ? "DEMOS_URL (or --url)" : "INTRO_DEMO_KEY (or --key)"} is missing`);
  process.exit(2);
}

const fixture = JSON.parse(readFileSync(SPEED_DEMO_FIXTURE, "utf8")) as SpeedDemoFixture;
const wanted = gamesText.split(",").map((g) => g.trim()).filter(Boolean);
const unknown = wanted.filter((g) => !fixture.rows.some((r) => r.game_type === g));
const rows = wanted.length ? fixture.rows.filter((r) => wanted.includes(r.game_type)) : fixture.rows;

/** Never let the key reach a log line, whatever an error message carries. */
const clean = (text: string) => (key ? text.split(key).join("[key]") : text).split("\n")[0]!.slice(0, 240);

let failed = unknown.length;
for (const game of unknown) console.log(`FAIL ${game}: not in ${SPEED_DEMO_FIXTURE}`);

const browser = await chromium.launch({ executablePath: process.env["PLAYWRIGHT_CHROMIUM"] || undefined, args: ["--no-sandbox"] }).catch(() =>
  chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] }),
);
try {
  const page = await browser.newPage();
  // A cold dev server compiles the app on its first request; give it time once.
  await page.goto(`${url}/practice`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  for (const row of rows) {
    try {
      const result = await page.evaluate(
        async ({ type, expected, run, saveKey, dryRun }) => {
          const mod = (await import(/* @vite-ignore */ "/src/lib/duel/practice.functions.ts")) as {
            practiceGenerateFn: (o: { data: unknown }) => Promise<{ puzzle: unknown; sealed: string }>;
            saveIntroDemoFn: (o: { data: unknown }) => Promise<{ ok: boolean }>;
          };
          const deal = await mod.practiceGenerateFn({ data: { type, example: true } });
          if (JSON.stringify(deal.puzzle) !== expected) return { ok: false, reason: "the server's intro example is not the fixture's deal (re-record with bun scripts/speed-demos-record.ts)" };
          if (dryRun) return { ok: true, reason: "dry run: the deal matches, nothing saved" };
          const saved = await mod.saveIntroDemoFn({ data: { puzzle: deal.puzzle, sealed: deal.sealed, answer: run, dev: true, key: saveKey } });
          return saved?.ok ? { ok: true, reason: "saved" } : { ok: false, reason: "the save answered without ok" };
        },
        { type: row.game_type, expected: JSON.stringify(row.puzzle), run: row.input_log.run, saveKey: key, dryRun: dry },
      );
      if (!result.ok) failed++;
      console.log(`${result.ok ? "OK" : "FAIL"} ${row.game_type}: ${clean(result.reason)}`);
    } catch (error) {
      failed++;
      console.log(`FAIL ${row.game_type}: ${clean(String((error as Error)?.message ?? error))}`);
    }
  }
} catch (error) {
  failed = Math.max(failed, 1);
  console.log(`FAIL speed-demos-save: ${clean(String((error as Error)?.message ?? error))}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
