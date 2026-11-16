/**
 * Saves the Word games' intro demos (the merge captain's plan, 15 Nov 2026; the manual "Save intro demos" workflow runs
 * it against a dev server after the final merge). For each game in scripts/fixtures/word-demos.json it opens practice in
 * dev mode with the demo key, switches on Intro examples, plays the fixture run's moves on the real stage in headless
 * Chromium (scripts/word-demos-players.ts), so the app's own recorder takes them as touches, and saves them through the
 * reveal's "Save as intro demo" (savePuzzleDemoFn, the server's check that the run is on its sealed intro example).
 *
 * It refuses to save a game whose served deal isn't the fixture's (the public half's digest) or whose submitted answer
 * isn't the run's last answer. It never prompts and never prints the key.
 *
 *   DEMOS_URL=<dev server origin> INTRO_DEMO_KEY=<key> bun scripts/word-demos-save.ts
 *     [--url=<origin>] [--key=<key>] [--games=a,b] (or DEMOS_GAMES=a,b) [--dry] (or DEMOS_DRY=1)
 *
 * Flags win over the environment. --dry plays and checks everything but presses no Save. Exits 0 when every game was
 * saved (or, dry, would be), 1 if any failed, 2 if the URL or the key is missing. The dev server needs
 * NODE_OPTIONS=--max-old-space-size=6144 and INTRO_DEMO_KEY set to the same key.
 */
import { existsSync, readFileSync } from "node:fs";
import { chromium, type Page, type Route } from "playwright";

import { hashText } from "./puzzle-fairness/kit";
import { STEP_PLAYERS, sentBody } from "./word-demos-players";
import type { WordDemoRun } from "./word-demos-lib";

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const url = (flag("url") ?? process.env["DEMOS_URL"] ?? "").replace(/\/$/, "");
const key = flag("key") ?? process.env["INTRO_DEMO_KEY"] ?? "";
const gamesArg = flag("games") ?? process.env["DEMOS_GAMES"] ?? "";
const dry = args.includes("--dry") || process.env["DEMOS_DRY"] === "1";

if (!url || !key) {
  console.log(`word-demos-save: ${!url ? "DEMOS_URL (or --url)" : "INTRO_DEMO_KEY (or --key)"} is missing; nothing was saved.`);
  process.exit(2);
}

const fixture = JSON.parse(readFileSync(new URL("./fixtures/word-demos.json", import.meta.url), "utf8")) as { runs: WordDemoRun[] };
const wanted = gamesArg ? new Set(gamesArg.split(",").map((g) => g.trim()).filter(Boolean)) : null;
const runs = fixture.runs.filter((r) => !wanted || wanted.has(r.type));
if (wanted) for (const g of wanted) if (!runs.some((r) => r.type === g)) console.log(`FAIL ${g}: not in the fixture`);

/** A server function's name from its request URL (the id is the base64 of "<file>--<export>"). */
function serverFnName(url: string): string {
  const id = url.split("/_serverFn/")[1]?.split("?")[0] ?? "";
  try {
    return Buffer.from(decodeURIComponent(id), "base64").toString("utf8");
  } catch {
    return id;
  }
}

/**
 * A server function's seroval body or reply, decoded (the plain nodes a puzzle, an answer and their containers use:
 * objects, arrays, strings, numbers, booleans and null; anything else reads as undefined).
 */
type Node = { t: number; s?: unknown; i?: number; p?: { k: string[]; v: Node[] }; a?: (Node | null)[] };
function node(n: Node | null | undefined): unknown {
  if (!n) return undefined;
  switch (n.t) {
    case 0: return Number(n.s);
    case 1: return String(n.s);
    case 2: return ({ 0: null, 1: undefined, 2: true, 3: false } as Record<number, unknown>)[Number(n.s)];
    case 9: return (n.a ?? []).map((x) => node(x));
    case 10: {
      const out: Record<string, unknown> = {};
      (n.p?.k ?? []).forEach((k, i) => (out[k] = node(n.p!.v[i])));
      return out;
    }
    default: return undefined;
  }
}
function decode(text: string): unknown {
  try {
    const parsed = JSON.parse(text) as Node | { t: Node };
    return "p" in parsed || "a" in parsed || "s" in parsed ? node(parsed as Node) : node((parsed as { t: Node }).t);
  } catch {
    return null;
  }
}
const findKey = (value: unknown, name: string): unknown => {
  if (!value || typeof value !== "object") return undefined;
  if (name in (value as object)) return (value as Record<string, unknown>)[name];
  for (const v of Object.values(value as object)) {
    const hit = findKey(v, name);
    if (hit !== undefined) return hit;
  }
  return undefined;
};

async function saveOne(page: Page, run: WordDemoRun): Promise<string | null> {
  let served: unknown = null;
  let answer: string | null = null;
  const onRoute = async (route: Route) => {
    const request = route.request();
    const name = serverFnName(request.url());
    if (process.env["DEMOS_DEBUG"]) console.log(`  [debug] ${name}`);
    if (/practiceGrade/.test(name)) {
      const body = decode(request.postData() ?? "");
      const a = findKey(body, "answer");
      if (typeof a === "string") answer = a;
      return route.continue();
    }
    if (/practiceGenerate/.test(name)) {
      const response = await route.fetch();
      const text = await response.text();
      served = findKey(decode(text), "puzzle") ?? null;
      if (process.env["DEMOS_DEBUG"]) console.log(`  [debug] reply ${text.slice(0, 300)}`);
      return route.fulfill({ response, body: text });
    }
    return route.continue();
  };
  await page.route("**/_serverFn/**", onRoute);
  try {
    // Open the game's page inside the app (a reload would lose the Intro examples switch), then Play.
    await page.evaluate((type) => {
      window.history.pushState({}, "", `/practice?page=${type}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, run.type);
    await page.locator(`[data-game-page-play="${run.type}"]`).click({ timeout: 30_000 });
    await page.locator("[data-game-stage]").first().waitFor({ timeout: 60_000 });
    if (!served || typeof served !== "object") return "the deal wasn't served";
    if ((served as { type?: string }).type !== run.type) return "the served deal is another game";
    if (hashText(JSON.stringify(served)) !== run.publicDigest) return "the served deal isn't the fixture's intro example";
    // The moves, each at its own round-clock time.
    const player = STEP_PLAYERS[run.type];
    if (!player) return "no step player";
    const t0 = Date.now();
    let before = "";
    for (const step of run.steps) {
      const wait = t0 + step.atMs - Date.now();
      if (wait > 0) await page.waitForTimeout(wait);
      await player.step(page, sentBody(before), sentBody(step.answer));
      before = step.answer;
    }
    await player.finish?.(page);
    // The reveal (open games wait for the buzzer).
    const save = page.getByRole("button", { name: /Save as intro demo/ });
    await save.waitFor({ timeout: 130_000 });
    const last = sentBody(run.steps[run.steps.length - 1]!.answer);
    if (answer === null) return "no answer was sent";
    if (sentBody(answer) !== last) return "the answer sent isn't the run's";
    if (dry) return null;
    await save.click();
    await page.getByRole("button", { name: /Saved ✓/ }).waitFor({ timeout: 30_000 });
    return null;
  } catch (error) {
    return String((error as Error).message ?? error).split("\n")[0]!;
  } finally {
    await page.unroute("**/_serverFn/**", onRoute);
  }
}

/** The pre-installed Chromium (PLAYWRIGHT_CHROMIUM, as the other browser scripts); Playwright's own elsewhere. */
const CHROMIUM = process.env["PLAYWRIGHT_CHROMIUM"] ?? "/opt/pw-browsers/chromium";

async function main(): Promise<number> {
  const browser = await chromium.launch(existsSync(CHROMIUM) ? { executablePath: CHROMIUM } : {});
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: false });
  const page = await context.newPage();
  let failed = wanted ? [...wanted].filter((g) => !runs.some((r) => r.type === g)).length : 0;
  try {
    await page.goto(`${url}/practice?dev=1&key=${encodeURIComponent(key)}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const status = page.getByText(/^Dev: key (accepted|refused)|^Dev: check failed/);
    await status.waitFor({ timeout: 60_000 });
    if (!/accepted/.test((await status.textContent()) ?? "")) {
      for (const run of runs) console.log(`FAIL ${run.type}: the server refused the demo key`);
      return 1;
    }
    const examples = page.locator("label", { hasText: "Intro examples" }).getByRole("switch");
    if (!(await examples.isChecked())) await examples.click();
    for (const run of runs) {
      const why = await saveOne(page, run);
      if (why) {
        failed++;
        console.log(`FAIL ${run.type}: ${why}`);
      } else console.log(`OK ${run.type}${dry ? " (dry run: not saved)" : ""}`);
      // Back to the list for the next game.
      await page.evaluate(() => {
        window.history.pushState({}, "", "/practice");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      await page.waitForTimeout(800);
    }
  } finally {
    await browser.close();
  }
  return failed > 0 ? 1 : 0;
}

process.exit(await main());
