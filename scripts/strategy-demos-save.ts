/**
 * Saves the Strategy games' intro demos (scripts/fixtures/strategy-demos.json, proved by strategy-demos-check) through the
 * app's own Save demo server function on a running dev server (the merge captain's plan, 15 Nov 2026, modelled on
 * Action's demos script): the manual "Save intro demos" workflow runs it after the final merge. Nothing here writes to a
 * database directly.
 *
 *   DEMOS_URL=<dev server origin> INTRO_DEMO_KEY=<key> bun scripts/strategy-demos-save.ts [--url=…] [--key=…]
 *     [--games=tilt,matchup] [--dry]
 *
 * Settings: DEMOS_URL (the dev server's origin), INTRO_DEMO_KEY (the private demo key), optionally DEMOS_GAMES=a,b and
 * DEMOS_DRY=1; a flag wins over its variable. It never prompts and never prints the key.
 *
 * For each game it opens the app in headless Chromium (so the page signs in as the app always does), asks the server for
 * the game's intro example deal (`practiceGenerateFn` with `example: true`, the only deal the save accepts a run on),
 * refuses to save unless the server's deal matches the fixture's exactly, then saves the fixture's run with
 * `saveIntroDemoFn` (dry: everything but the save). It prints OK or FAIL for each game and exits 0 when all are saved
 * (or would be, dry), 1 if any failed, and 2 if the URL or key is missing.
 *
 * The dev server needs NODE_OPTIONS=--max-old-space-size=6144.
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

import { DEMOS_FIXTURE, type DemoEntry } from "./strategy-demos-record";

const flag = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const url = (flag("url") ?? process.env["DEMOS_URL"] ?? "").replace(/\/+$/, "");
const key = flag("key") ?? process.env["INTRO_DEMO_KEY"] ?? "";
const gamesArg = flag("games") ?? process.env["DEMOS_GAMES"] ?? "";
const dry = process.argv.includes("--dry") || process.env["DEMOS_DRY"] === "1";

if (!url || !key) {
  console.error(`FAIL: missing ${!url ? "DEMOS_URL (or --url)" : ""}${!url && !key ? " and " : ""}${!key ? "INTRO_DEMO_KEY (or --key)" : ""}`);
  process.exit(2);
}

/** Stable JSON (sorted keys), so two equal deals compare equal whatever their key order. */
function canon(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canon).join(",")}]`;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canon(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const all = JSON.parse(readFileSync(DEMOS_FIXTURE, "utf8")) as DemoEntry[];
const wanted = gamesArg ? gamesArg.split(",").map((g) => g.trim()).filter(Boolean) : all.map((d) => d.type);
const demos = all.filter((d) => wanted.includes(d.type));
const missing = wanted.filter((g) => !all.some((d) => d.type === g));

const browser = await chromium.launch();
let any = missing.length > 0;
for (const g of missing) console.log(`FAIL ${g}: no demo in ${DEMOS_FIXTURE}`);
try {
  const page = await browser.newPage();
  // The practice page: the app signs in as it always does, so the server functions carry the session.
  await page.goto(`${url}/practice?dev=1`, { waitUntil: "load", timeout: 300_000 });
  await page.waitForTimeout(2_000);
  for (const demo of demos) {
    try {
      const deal = (await page.evaluate(async (type) => {
        const m = await import(/* @vite-ignore */ "/src/lib/duel/practice.functions.ts");
        return await m.practiceGenerateFn({ data: { type, example: true } });
      }, demo.type)) as { puzzle: Record<string, unknown>; sealed: string };
      if (!deal || canon(deal.puzzle) !== canon(demo.puzzle)) {
        console.log(`FAIL ${demo.type}: the server's intro example deal differs from the fixture (re-record with bun scripts/strategy-demos-record.ts)`);
        any = true;
        continue;
      }
      if (dry) {
        console.log(`OK ${demo.type}: deal matches (dry run, not saved; scores ${demo.score})`);
        continue;
      }
      const saved = (await page.evaluate(
        async ({ deal, run, k }) => {
          const m = await import(/* @vite-ignore */ "/src/lib/duel/practice.functions.ts");
          return await m.saveIntroDemoFn({ data: { puzzle: deal.puzzle, sealed: deal.sealed, answer: run, dev: true, key: k } });
        },
        { deal, run: demo.run, k: key },
      )) as { ok?: boolean } | undefined;
      if (saved?.ok) console.log(`OK ${demo.type}: saved (scores ${demo.score})`);
      else {
        console.log(`FAIL ${demo.type}: the save did not confirm`);
        any = true;
      }
    } catch (error) {
      // The server's message only (never the request, which carries the key).
      const message = String((error as Error)?.message ?? error).split("\n")[0]!.replaceAll(key, "***");
      console.log(`FAIL ${demo.type}: ${message}`);
      any = true;
    }
  }
} finally {
  await browser.close();
}
process.exit(any ? 1 : 0);
