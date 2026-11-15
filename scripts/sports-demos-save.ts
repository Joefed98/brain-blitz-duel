/**
 * Saves the Sports overhaul's intro demos (scripts/fixtures/sports-demos.json, proved by sports-demos-check) through the
 * app's own Save demo server function, for the manual "Save intro demos" workflow after the final merge (the merge
 * captain's demo pattern, 15 Nov 2026). Nobody saves demos to the live database by hand.
 *
 *   DEMOS_URL=<a dev server's origin> INTRO_DEMO_KEY=<the key> bun scripts/sports-demos-save.ts [--games=pool,racing] [--dry]
 *
 * Settings (flags win over the environment; it never prompts):
 *   DEMOS_URL / --url=       the dev server's origin (its server must allow demo saves: INTRO_DEMO_SAVES=1 in production)
 *   INTRO_DEMO_KEY / --key=  the private intro-demo key (never printed)
 *   DEMOS_GAMES / --games=   a comma list of the fixture's games (default all three)
 *   DEMOS_DRY=1 / --dry      deal and compare only; nothing is saved
 *
 * For each game, in a headless Chromium page on the dev server (the app's own server-function calls, as the phone makes
 * them): the server deals the game's intro example (practiceGenerateFn, example) and seals it; the dealt puzzle must be
 * the fixture's exactly (else FAIL, nothing saved); then saveIntroDemoFn stores the fixture's run with that sealed deal.
 * Prints OK or FAIL per game. Exit 0 when every game is saved (or, dry, matched), 1 if any failed, 2 if the URL or key is
 * missing.
 */
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright";

import { CHROMIUM_PATHS } from "./theme-screens";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const url = (arg("url") ?? process.env["DEMOS_URL"] ?? "").replace(/\/$/, "");
const key = arg("key") ?? process.env["INTRO_DEMO_KEY"] ?? "";
const dry = process.argv.includes("--dry") || process.env["DEMOS_DRY"] === "1";
const gamesArg = arg("games") ?? process.env["DEMOS_GAMES"] ?? "";

if (!url || (!key && !dry)) {
  console.log(`FAIL sports-demos-save: ${!url ? "DEMOS_URL (or --url=)" : "INTRO_DEMO_KEY (or --key=)"} is missing`);
  process.exit(2);
}

type Row = { game_type: string; puzzle: Record<string, unknown>; input_log: { run: string }; score: number };
const fixture = JSON.parse(readFileSync("scripts/fixtures/sports-demos.json", "utf8")) as { demos: Row[] };
const wanted = gamesArg ? gamesArg.split(",").map((g) => g.trim()).filter(Boolean) : fixture.demos.map((d) => d.game_type);
const unknown = wanted.filter((g) => !fixture.demos.some((d) => d.game_type === g));

/** The same JSON whatever the key order (the server's puzzle against the fixture's). */
const canon = (v: unknown): string =>
  Array.isArray(v) ? `[${v.map(canon).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`).join(",")}}` : JSON.stringify(v);

let failed = unknown.length;
for (const g of unknown) console.log(`  FAIL ${g}: not in scripts/fixtures/sports-demos.json`);

// The pre-installed Chromium (as the other browser scripts launch it), else Playwright's own.
const executablePath = CHROMIUM_PATHS.find((p): p is string => !!p && existsSync(p));
const browser = await chromium.launch(executablePath ? { executablePath } : {});
try {
  const page = await browser.newPage();
  // The app signs this browser in (anonymously) as it does any phone; the calls below carry that session.
  await page.goto(`${url}/practice`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.waitForTimeout(3000);
  for (const d of fixture.demos.filter((x) => wanted.includes(x.game_type))) {
    const type = d.game_type;
    try {
      // First the comparison: deal the example and check it is the fixture's (a mismatched deal is never saved).
      const out = await page.evaluate(async (type) => {
        const mod = (await import(/* @vite-ignore */ "/src/lib/duel/practice.functions.ts")) as {
          practiceGenerateFn: (a: { data: { type: string; example: boolean } }) => Promise<{ puzzle: unknown; sealed: string }>;
        };
        return { puzzle: (await mod.practiceGenerateFn({ data: { type, example: true } })).puzzle };
      }, type);
      if (canon(out.puzzle) !== canon(d.puzzle)) {
        failed++;
        console.log(`  FAIL ${type}: the server dealt a different intro example from the fixture's (re-record with scripts/sports-demos-record.ts)`);
        continue;
      }
      if (dry) {
        console.log(`  OK ${type}: the dealt example matches the fixture (dry run, nothing saved)`);
        continue;
      }
      const saved = await page.evaluate(
        async ({ type, run, key }) => {
          const mod = (await import(/* @vite-ignore */ "/src/lib/duel/practice.functions.ts")) as {
            practiceGenerateFn: (a: { data: { type: string; example: boolean } }) => Promise<{ puzzle: unknown; sealed: string }>;
            saveIntroDemoFn: (a: { data: { puzzle: unknown; sealed: string; answer: string; dev: boolean; key: string } }) => Promise<{ ok: boolean }>;
          };
          const dealt = await mod.practiceGenerateFn({ data: { type, example: true } });
          const r = await mod.saveIntroDemoFn({ data: { puzzle: dealt.puzzle, sealed: dealt.sealed, answer: run, dev: true, key } });
          return r.ok === true;
        },
        { type, run: d.input_log.run, key },
      );
      if (saved) console.log(`  OK ${type}: saved (a ${d.score}-point run)`);
      else {
        failed++;
        console.log(`  FAIL ${type}: the server did not confirm the save`);
      }
    } catch (e) {
      failed++;
      // The server's own message only (it never contains the key).
      const msg = String((e as Error).message ?? e).split("\n")[0]!.replaceAll(key || "\u0000", "***");
      console.log(`  FAIL ${type}: ${msg}`);
    }
  }
} finally {
  await browser.close();
}
console.log(failed ? `FAIL sports-demos-save: ${failed} game(s) failed` : `PASS sports-demos-save: ${wanted.length} game(s) ${dry ? "matched (dry run)" : "saved"}`);
process.exit(failed ? 1 : 0);
