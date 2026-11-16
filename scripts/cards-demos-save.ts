/**
 * Saves the Cards & Board intro demos (scripts/fixtures/cards-demos.json; the overhaul's stage 3, 15 Nov 2026) through
 * the app's own Save demo server function on a running dev server, for the manual "Save intro demos" workflow. It never
 * prompts. For each game it asks the server for the intro example deal (practiceGenerateFn with example: true, sealed
 * by the server), refuses to save unless that deal matches the fixture's puzzle exactly, then sends the fixture's run
 * with the sealed deal to saveIntroDemoFn (the server's own checks: the key, the sealed example, the run's length).
 *
 *   DEMOS_URL=<dev server origin> INTRO_DEMO_KEY=<key> bun scripts/cards-demos-save.ts [--url=…] [--key=…] [--games=a,b] [--dry]
 *
 * Settings: DEMOS_URL, INTRO_DEMO_KEY, DEMOS_GAMES (a,b), DEMOS_DRY=1; a flag wins over its setting. --dry checks
 * every deal but saves nothing. Prints OK or FAIL for each game and never the key. Exit 0 when every game is saved
 * (or, dry, matched), 1 if any failed, 2 if the URL or key is missing. The dev server must run with
 * NODE_OPTIONS=--max-old-space-size=6144 and the server's INTRO_DEMO_KEY set.
 */
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright";

/** The browser (the repo's browser checks' own lookup). */
const CHROMIUM = [process.env["PLAYWRIGHT_CHROMIUM"], "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find((p) => p && existsSync(p));

interface Demo {
  type: string;
  puzzle: Record<string, unknown>;
  run: string;
  score: number;
}

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const url = (flag("url") ?? process.env.DEMOS_URL ?? "").replace(/\/+$/, "");
const key = flag("key") ?? process.env.INTRO_DEMO_KEY ?? "";
const gamesArg = flag("games") ?? process.env.DEMOS_GAMES ?? "";
const dry = args.includes("--dry") || process.env.DEMOS_DRY === "1";

if (!url || !key) {
  console.log(`FAIL ${!url ? "DEMOS_URL (or --url=)" : "INTRO_DEMO_KEY (or --key=)"} is missing`);
  process.exit(2);
}

/** Never let the key reach the log. */
const clean = (text: string) => (key ? text.split(key).join("[key]") : text);

/** Keys sorted at every depth, so two equal deals compare equal whatever their key order. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v);
}

const all = JSON.parse(readFileSync(new URL("./fixtures/cards-demos.json", import.meta.url), "utf8")) as Demo[];
const wanted = gamesArg ? new Set(gamesArg.split(",").map((g) => g.trim()).filter(Boolean)) : null;
const demos = wanted ? all.filter((d) => wanted.has(d.type)) : all;
if (wanted) for (const g of wanted) if (!all.some((d) => d.type === g)) console.log(`FAIL ${g}: no demo in the fixture`);

let failed = wanted ? [...wanted].filter((g) => !all.some((d) => d.type === g)).length : 0;
const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
try {
  const page = await browser.newPage();
  await page.goto(`${url}/practice`, { waitUntil: "load", timeout: 180_000 });
  for (const demo of demos) {
    try {
      // The server's sealed example deal, kept in the page for the save; only its public half comes back here.
      const out = (await page.evaluate(async (type) => {
        const fns = (await import(/* @vite-ignore */ "/src/lib/duel/practice.functions.ts")) as Record<string, (o: { data: unknown }) => Promise<unknown>>;
        const deal = (await fns.practiceGenerateFn!({ data: { type, example: true } })) as { puzzle: unknown; sealed: string };
        (globalThis as Record<string, unknown>).__cardsDemoDeal = deal;
        return { puzzle: deal.puzzle };
      }, demo.type)) as { puzzle: unknown };
      if (canonical(out.puzzle) !== canonical(demo.puzzle)) {
        console.log(`FAIL ${demo.type}: the server's example deal does not match the fixture (nothing saved)`);
        failed++;
        continue;
      }
      if (dry) {
        console.log(`OK ${demo.type}: the example deal matches (dry run, nothing saved)`);
        continue;
      }
      await page.evaluate(
        async ({ demo, key }) => {
          const fns = (await import(/* @vite-ignore */ "/src/lib/duel/practice.functions.ts")) as Record<string, (o: { data: unknown }) => Promise<unknown>>;
          const deal = (globalThis as Record<string, unknown>).__cardsDemoDeal as { puzzle: unknown; sealed: string };
          await fns.saveIntroDemoFn!({ data: { puzzle: deal.puzzle, sealed: deal.sealed, answer: demo.run, dev: true, key } });
        },
        { demo, key },
      );
      console.log(`OK ${demo.type}: saved (scores ${demo.score})`);
    } catch (error) {
      console.log(`FAIL ${demo.type}: ${clean(String((error as Error)?.message ?? error)).split("\n")[0]}`);
      failed++;
    }
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
