/**
 * Saves the Retro intro demos (scripts/retro-demos.json) through the app's own Save demo server function, saveIntroDemoFn
 * (the Retro overhaul, stage 3, 16 Nov 2026). Never run by the checks or CI against a real server: the manual "Save intro
 * demos" workflow runs it after the final merge, against a dev server of main (NODE_OPTIONS=--max-old-space-size=6144).
 *
 *   DEMOS_URL=http://localhost:8080 INTRO_DEMO_KEY=… [DEMOS_GAMES=hover,breaker] [DEMOS_DRY=1] bun scripts/retro-demos-save.ts [--dry]
 *
 * Never prompts. For each game it asks the server for the intro example deal (practiceGenerateFn with `example: true`),
 * refuses unless that deal matches the fixture's exactly, then saves the fixture's run on the server's sealed deal (a dry
 * run stops before the save). Prints OK or FAIL per game; exits 0 when all saved (or would be), 1 when any failed, 2 when
 * DEMOS_URL or INTRO_DEMO_KEY is missing. Never prints the key. The server functions are called from a page of the dev
 * server (headless Chromium), the way the app calls them.
 */
import { readFileSync } from "node:fs";

import type { RetroDemoFixture } from "./retro-demos-lib";

const url = process.env["DEMOS_URL"] ?? "";
const secret = process.env["INTRO_DEMO_KEY"] ?? "";
const dry = process.argv.includes("--dry") || process.env["DEMOS_DRY"] === "1";
if (!url || !secret) {
  console.log("FAIL: DEMOS_URL and INTRO_DEMO_KEY must both be set (nothing saved).");
  process.exit(2);
}

const fixture = JSON.parse(readFileSync("scripts/retro-demos.json", "utf8")) as RetroDemoFixture;
const only = (process.env["DEMOS_GAMES"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const demos = fixture.demos.filter((d) => !only.length || only.includes(d.type));
if (only.length && demos.length !== only.length) console.log(`FAIL: unknown game in DEMOS_GAMES (${only.filter((g) => !demos.some((d) => d.type === g)).join(", ")})`);

const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage();
let failed = only.length !== demos.length;
try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  for (const demo of demos) {
    const result = await page.evaluate(
      async ({ demo, secret, dry }) => {
        const canon = (v: unknown): string =>
          JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
        try {
          const fns = (await import(/* @vite-ignore */ "/src/lib/duel/practice.functions.ts")) as {
            practiceGenerateFn: (a: { data: unknown }) => Promise<{ puzzle: unknown; sealed: string }>;
            saveIntroDemoFn: (a: { data: unknown }) => Promise<{ ok: boolean }>;
          };
          const deal = await fns.practiceGenerateFn({ data: { type: demo.type, example: true } });
          if (canon(deal.puzzle) !== canon(demo.puzzle)) return { ok: false, why: "the server's example deal differs from the fixture's" };
          if (dry) return { ok: true, why: "dry run: the deal matches, nothing saved" };
          const saved = await fns.saveIntroDemoFn({ data: { puzzle: deal.puzzle, sealed: deal.sealed, answer: demo.run, dev: true, key: secret } });
          return saved?.ok ? { ok: true, why: "saved" } : { ok: false, why: "the server did not confirm the save" };
        } catch (error) {
          return { ok: false, why: error instanceof Error ? error.message : "the call failed" };
        }
      },
      { demo, secret, dry },
    );
    if (!result.ok) failed = true;
    console.log(`${result.ok ? "OK  " : "FAIL"} ${demo.type.padEnd(10)} ${demo.field} ${demo.rev}: ${result.why}`);
  }
} catch (error) {
  failed = true;
  console.log(`FAIL: could not reach the dev server (${error instanceof Error ? error.message.split("\n")[0] : "unknown"})`);
} finally {
  await browser.close();
}
if (failed) process.exit(1);
process.exit(0);
