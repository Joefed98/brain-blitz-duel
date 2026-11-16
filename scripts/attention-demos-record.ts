/**
 * Records the Attention intro demos (scripts/fixtures/attention-demos.json) on a running dev server, the way a person
 * records one: practice in "Intro examples" mode with the dev demo key, a flawless run of each game's intro example
 * played by Playwright's (trusted) touches, then the app's own "Save as intro demo" pressed. The save request is caught
 * and aborted (nothing is ever written to a database); its log, with the practice grade's answer and the stored score,
 * becomes the game's row.
 *
 *   INTRO_DEMO_KEY=local-key NODE_OPTIONS=--max-old-space-size=6144 bunx vite dev --port 5317 …   (the dev server)
 *   DEMOS_URL=http://127.0.0.1:5317 INTRO_DEMO_KEY=local-key bun scripts/attention-demos-record.ts [games…]
 *
 * The key only has to match the dev server's own (any local value): it never leaves this machine.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { DEMO_GAMES, DEMOS_FIXTURE, exampleDeal, exampleDealFull, wireBody, type DemoGame, type DemoRow } from "./attention-demos-lib";
import type { PuzzleData } from "../src/lib/duel/types";

const url = (process.env["DEMOS_URL"] ?? "").replace(/\/$/, "");
const key = process.env["INTRO_DEMO_KEY"] ?? "";
if (!url || !key) {
  console.log("FAIL DEMOS_URL and INTRO_DEMO_KEY must be set");
  process.exit(2);
}
const games = (process.argv.slice(2).length ? process.argv.slice(2) : [...DEMO_GAMES]) as DemoGame[];

/** The export a server-function request calls (its URL's last segment, base64url JSON). */
function exportOf(requestUrl: string): string {
  try {
    const seg = new URL(requestUrl).pathname.split("/").pop() ?? "";
    return String((JSON.parse(Buffer.from(seg, "base64url").toString("utf8")) as { export?: string }).export ?? "");
  } catch {
    return "";
  }
}

const tapRole = async (page: Page, name: RegExp) => {
  await page.getByRole("button", { name }).first().click();
  await page.waitForTimeout(260);
};

/** A flawless run of one game's example, by touches only. */
async function play(page: Page, game: DemoGame, p: PuzzleData): Promise<void> {
  const pause = (ms = 260) => page.waitForTimeout(ms);
  if (p.type === "symscan") {
    for (let i = 0; i < p.stages.length; i++) {
      for (const c of [...(p.targets?.[i] ?? [])].sort((a, b) => a - b)) {
        await page.locator(`[data-game-stage] button[aria-label="Cell ${c + 1}"]`).click();
        await pause(220);
      }
      await page.getByRole("button", { name: /^Submit$/ }).click();
      await pause(1400);
    }
  } else if (p.type === "spotdiff") {
    for (const scene of [0, 1]) {
      const cells = (p.differences ?? []).filter((d) => (d.scene ?? 0) === scene).map((d) => d.cells[0]!);
      if (p.bonus && (p.bonus.scene ?? 0) === scene) cells.push(p.bonus.cells[0]!);
      for (const c of cells) {
        await page.locator(`[data-game-stage] [data-dt-panel] rect[aria-label="Cell ${c + 1}"]`).first().click();
        await pause(700);
      }
      // The last picture locks in by itself once nothing is left to find (spotRev 4); Done only if it still shows.
      const next = page.getByRole("button", { name: scene === 0 ? /Next picture/ : /Done/ });
      if (scene === 0) await tapRole(page, /Next picture/);
      else await next.first().click({ timeout: 1500 }).catch(() => undefined);
      await pause(900);
    }
  } else if (p.type === "countup") {
    const { countUpStageTruth } = await import("../src/lib/duel/attentionRev");
    for (const stage of p.stages) {
      for (const d of String(countUpStageTruth(stage))) await tapRole(page, new RegExp(`^${d}$`));
      await tapRole(page, /^Enter$/);
      await pause(900);
    }
  } else if (p.type === "maze") {
    const cols = p.cols ?? 19;
    const route = p.solution ?? [];
    for (let i = 1; i < route.length; i++) {
      const d = route[i]! - route[i - 1]!;
      const name = d === -cols ? "Up" : d === cols ? "Down" : d === -1 ? "Left" : "Right";
      await page.getByRole("button", { name, exact: true }).click();
      await pause(110);
    }
  } else if (p.type === "bomb") {
    const { decodeBombActions, isCut, cutIndex } = await import("../src/lib/duel/bomb");
    for (const a of decodeBombActions(p.sequence ?? "")) {
      if (isCut(a)) await page.locator(`[data-bomb-wire-row="${cutIndex(a) + 1}"]`).click();
      else await page.locator(`[aria-label^="Button ${a.slice(1)},"]`).click();
      await pause(650);
    }
    await tapRole(page, /^Defuse$/);
  } else if (p.type === "pairmatch") {
    const { sameCard } = await import("../src/lib/duel/pairmatch");
    const done = new Set<number>();
    const cards = page.locator("[data-game-stage] [data-pair-card]");
    for (let i = 0; i < p.cards.length; i++) {
      if (done.has(i)) continue;
      const j = p.cards.findIndex((c, k) => k !== i && sameCard(c, p.cards[i]));
      done.add(i).add(j);
      await cards.nth(i).click();
      await pause(240);
      await cards.nth(j).click();
      await pause(420);
    }
  }
}

const browser = await chromium.launch(existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {});
const rows: DemoRow[] = existsSync(DEMOS_FIXTURE) ? (JSON.parse(readFileSync(DEMOS_FIXTURE, "utf8")) as { rows: DemoRow[] }).rows : [];
let failed = 0;
for (const game of games) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let saved: Record<string, unknown> | null = null;
  let graded: Record<string, unknown> | null = null;
  let gradeAnswerText: string | null = null;
  await page.route("**/_serverFn/**", async (route) => {
    const req = route.request();
    const name = exportOf(req.url());
    if (name.startsWith("savePuzzleDemoFn")) {
      saved = wireBody(req.postData() ?? "{}") as Record<string, unknown>;
      await route.abort();
      return;
    }
    if (name.startsWith("practiceGradeFn")) {
      const body = wireBody(req.postData() ?? "{}") as { data?: { answer?: string } };
      gradeAnswerText = body.data?.answer ?? null;
      const res = await route.fetch();
      try {
        graded = wireBody(await res.text()) as Record<string, unknown>;
      } catch {
        graded = null;
      }
      await route.fulfill({ response: res });
      return;
    }
    await route.continue();
  });
  try {
    await page.goto(`${url}/practice?dev=1&key=${encodeURIComponent(key)}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const toggle = page.locator("label:has-text('Intro examples') input");
    await toggle.waitFor({ timeout: 120_000 });
    await toggle.check();
    await page.evaluate((g) => {
      history.pushState({}, "", `/practice?game=${g}`);
      dispatchEvent(new PopStateEvent("popstate"));
    }, game);
    // The link opens the round, or sometimes the game's page first: then its Play starts the round.
    const stage = page.locator("[data-game-stage]");
    const playButton = page.locator("[data-game-page] button:has-text('Play')");
    for (let i = 0; i < 360 && !(await stage.count()); i++) {
      if (await playButton.count()) await playButton.first().click().catch(() => undefined);
      await page.waitForTimeout(500);
    }
    await stage.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(1200);
    const full = await exampleDealFull(game);
    await play(page, game, full);
    const save = page.getByRole("button", { name: /Save as intro demo/ });
    await save.waitFor({ timeout: 120_000 });
    for (let i = 0; i < 60 && !graded; i++) await page.waitForTimeout(500);
    await save.click();
    for (let i = 0; i < 40 && !saved; i++) await page.waitForTimeout(250);
    const data = (saved as { data?: { puzzle?: unknown; log?: unknown } } | null)?.data;
    const result = (graded as { result?: Record<string, unknown> } | null)?.result ?? (graded as Record<string, unknown> | null);
    if (!data?.log || !gradeAnswerText || !result) throw new Error(`nothing captured (save ${!!data?.log}, answer ${!!gradeAnswerText}, grade ${!!result})`);
    const row: DemoRow = {
      game_type: game,
      // The save stores the server's public half of the sealed example (the phone's copy may hold the revealed answer).
      puzzle: await exampleDeal(game),
      input_log: data.log as DemoRow["input_log"],
      answer: gradeAnswerText,
      msRemaining: Number(result["msRemaining"] ?? result["ms_remaining"] ?? 0),
      score: Number(result["score"]),
      isCorrect: Boolean(result["isCorrect"] ?? result["is_correct"]),
    };
    const at = rows.findIndex((r) => r.game_type === game);
    if (at >= 0) rows[at] = row;
    else rows.push(row);
    console.log(`OK ${game}: ${row.input_log.actions.length} touches, ${row.score} points${row.isCorrect ? ", finished" : ""}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${game}: ${(e as Error).message.split("\n")[0]}`);
    await page.screenshot({ path: `/tmp/attention-demo-${game}.png` }).catch(() => undefined);
  }
  await page.close();
}
await browser.close();
rows.sort((a, b) => DEMO_GAMES.indexOf(a.game_type) - DEMO_GAMES.indexOf(b.game_type));
writeFileSync(DEMOS_FIXTURE, JSON.stringify({ recorded: "the Attention overhaul's demos, recorded by scripts/attention-demos-record.ts", rows }, null, 1) + "\n");
process.exit(failed ? 1 : 0);
