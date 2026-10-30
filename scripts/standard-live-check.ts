/**
 * standard-live-check (29 Oct 2026): the scoring standard as the live app grades it.
 *
 * Joe's Colour Flood round on the live app (par 12, 13 moves, 56.8 s) scored "120 + 2 speed" = 122: the deal was the
 * standard's (the par + 6 limit), the grade the pre-standard formula. Cause: the standard's graders were registered by
 * side-effect imports (`import "./standard/games.server"` → `import "./word.server"` …), and package.json's
 * "sideEffects": false let the production build drop them, so `gradeStandard` found no game and every standard puzzle
 * fell back to the older path. Every check passed because bun and the Vite dev server never tree-shake. This check runs
 * what the phone talks to:
 *
 *   1. builds the app for production (`vite build`, Nitro's node-server preset: the same Vite and Rollup bundling and
 *      tree-shaking as Lovable's Cloudflare build, in a form Node can run here) into .output (gitignored);
 *   2. starts that server and, in headless Chromium, plays practice rounds through the app: the Practice list, the
 *      game's live practice deal (whose sealed half the check opens with the server's secret, set by the check, to know
 *      the solution), Ready, then either
 *        - "ui": the game's real-UI solve driver (scripts/shots/drivers), the round submitted by its solving input, or
 *        - "answer": the round runs to the buzzer and the full answer (word-answers.ts for the Word games, the fairness
 *          kits' perfect play otherwise) is swapped into the practice grade request, as the screenshot tool's "full"
 *          phase does: the real server grades it and the real reveal shows it;
 *   3. fails unless the server's stored breakdown (the grade response's parts) is a finish on the standard's 150 base,
 *      the stored score is at least 150, and any breakdown the reveal prints starts "150 + ".
 *
 * Room rounds: the production bundle's own room deal (`buildRoomPuzzles`, rooms of every puzzle category from fixed
 * seeds) and room grader (`gradeRoomAnswer`, an answer received in the puzzle phase), so the room path is proved on the
 * built code too; only the database round trip is left out. The daily and challenges grade through the same function.
 *
 * Default games: at least one from each standard category (Logic, Pattern, Number, Word, Speed and Attention), so every
 * category's grader module is proved present in the production bundle. Rooms, the daily and challenges grade through
 * the same gradeAnswer in the same server chunk (a room needs the database, which a check cannot reach). Pass game ids
 * to play only those; `--all` plays every standard puzzle that grades on the standard's modules (Mixed Signals and
 * Tenfall score in their sims and are left out).
 *
 *   bun scripts/standard-live-check.ts [games…] [--all] [--shots=<dir>]
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import type { Browser, Page } from "playwright";

import { decodeSides, rotateMask, tileOpenings } from "../src/lib/duel/logic";
import { encodePipesTapAnswer, pipesAfterTaps } from "../src/lib/duel/depth4/pipesTaps";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { encodeGradient } from "../src/lib/duel/jumbled";
import { gradientRoute } from "../src/lib/duel/jumbled.server";
import { topsyStart, topsyTilt } from "../src/lib/duel/topsy";
import { topsySearch } from "../src/lib/duel/topsy.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { STANDARD_STAMPS } from "../src/lib/duel/standard/stamps";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { makeRng, type Skill } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import type { Driver } from "./shots/driver";
import { DRIVERS } from "./shots/drivers";
import { wordAnswer } from "./shots/word-answers";

const args = process.argv.slice(2);
const ALL = args.includes("--all");
/** `--shots=<dir>`: a screenshot of any round that fails. */
const SHOTS = args.find((a) => a.startsWith("--shots="))?.slice(8);
/** Engine games: scored in their sims (tenRev 5, clashRev 10), never by the standard's grader modules. */
const SIM_SCORED = new Set<PuzzleType>(["tendrop", "stroop"]);
/** At least one per category: Logic, Pattern, Number, Word, Speed and Attention; real-UI solves where a driver has one. */
const DEFAULT_GAMES: PuzzleType[] = ["flood", "lightsout", "unblock", "tiles", "equation", "wordslide", "codeword", "spotdiff", "chain"];
const named = args.filter((a) => !a.startsWith("--")) as PuzzleType[];
const games: PuzzleType[] = named.length
  ? named
  : ALL
    ? (Object.keys(STANDARD_STAMPS) as PuzzleType[]).filter((t) => !SIM_SCORED.has(t))
    : DEFAULT_GAMES;

const CHROMIUM = [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find((p) => p && existsSync(p));
/** The build's own output folder (gitignored); the Nitro node-server preset writes here. */
const OUT = ".output";
const PORT = 4391;
const ORIGIN = `http://127.0.0.1:${PORT}`;
/** The server's sealing secret here, so the check can open a deal's sealed half (its solution) as the server does. */
const SEAL_SECRET = "standard-live-check";
const PERFECT: Skill = { level: "near", pace: 0.3, err: 0, reactionMs: 150, reactionSd: 1 };

const failures: string[] = [];
const report: string[] = [];

function build(): void {
  const res = spawnSync("bunx", ["vite", "build"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NITRO_PRESET: "node-server" },
    encoding: "utf8",
    timeout: 600_000,
  });
  if (res.status !== 0 || !existsSync(`${OUT}/server/index.mjs`)) {
    console.log(`${res.stdout?.slice(-2000) ?? ""}\n${res.stderr?.slice(-2000) ?? ""}`);
    throw new Error("production build failed");
  }
}

async function startServer(): Promise<ChildProcess> {
  const proc = spawn("node", [`${OUT}/server/index.mjs`], {
    stdio: "ignore",
    // A sealing secret, as the deployed server has (practice seals the private half with it). No Supabase URL: the
    // beta recording is skipped quietly and nothing else needs the database.
    env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", NITRO_PORT: String(PORT), NITRO_HOST: "127.0.0.1", SUPABASE_SERVICE_ROLE_KEY: SEAL_SECRET },
  });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${ORIGIN}/practice`)).ok) return proc;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  proc.kill();
  throw new Error("production server did not start");
}

/** Pipeline's kit sends side-sets; its stamp grades the tap log (as standard-pattern-check converts them). */
function pipesTapAnswer(p: Extract<PuzzleData, { type: "pipes" }>, sidesAnswer: string): string {
  const start = p.tiles.map(tileOpenings);
  const want = decodeSides(p.tiles, sidesAnswer).map(tileOpenings);
  const taps: number[] = [];
  want.forEach((mask, cell) => {
    for (let t = 0; t < 4; t++)
      if (rotateMask(start[cell]!, t) === mask) {
        for (let k = 0; k < t; k++) taps.push(cell);
        break;
      }
  });
  return encodePipesTapAnswer(pipesAfterTaps(p.tiles, taps), taps);
}

/** Topsy-Turvy (gravityRev 3+): each board's shortest tilt route, boards one after another (as standard-pattern-check). */
function topsyAnswer(p: Extract<PuzzleData, { type: "gravity" }>): string {
  const tokens: string[] = [];
  for (const board of p.boards ?? []) {
    let state = topsyStart(board);
    const route = topsySearch({ ...board, starts: state.balls, stars: [] }, false, 12, 200_000)?.solution ?? [];
    const walls = new Set(board.walls);
    for (const dir of route) {
      tokens.push(dir);
      state = topsyTilt(board, walls, state, dir).state;
    }
  }
  return tokens.join("");
}

/** The full answer a phone sends for a perfect run of the example (null when no source can build one). */
function fullAnswer(type: PuzzleType, p: PuzzleData): string | null {
  const word = wordAnswer(p);
  if (word) return word;
  // The D5 remodels: the kits play the legacy boards, so today's Gradient and Topsy-Turvy answers are built here.
  if (p.type === "tiles" && p.frame) return encodeGradient(gradientRoute(p.frame).map((n) => ({ a: Math.floor(n / 100), b: n % 100 })));
  if (p.type === "gravity" && p.boards) return topsyAnswer(p);
  const kit = KITS[type];
  if (!kit) return null;
  const steps = kit.play(p, makeRng(1), PERFECT, puzzleTimeLimitMs(p)).steps;
  const last = steps[steps.length - 1]?.answer ?? null;
  return last !== null && type === "pipes" ? pipesTapAnswer(p as Extract<PuzzleData, { type: "pipes" }>, last) : last;
}

interface Round {
  page: Page;
  close: () => Promise<void>;
  errors: string[];
  /** The practice grade response's body, once it arrives. */
  graded: () => string | null;
  /** The live deal, public and sealed halves together (what the server grades). */
  deal: PuzzleData;
}

/** A server function's response node (seroval): the objects, arrays, strings, numbers and constants a deal holds. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodeNode(node: any): unknown {
  switch (node?.t) {
    case 0:
    case 1:
      return node.s;
    case 2:
      return node.s === 2 ? true : node.s === 3 ? false : node.s === 0 ? null : undefined;
    case 9:
      return (node.a as unknown[]).map(decodeNode);
    case 10: {
      const out: Record<string, unknown> = {};
      (node.p.k as string[]).forEach((k, i) => (out[k] = decodeNode(node.p.v[i])));
      return out;
    }
    default:
      return undefined;
  }
}

/** The practice deal's response → the whole puzzle: its public half and its sealed half opened with the secret. */
async function openDeal(text: string): Promise<PuzzleData> {
  const out = decodeNode(JSON.parse(text)) as { result: { puzzle: Record<string, unknown>; sealed: string } };
  const [iv, cipher] = out.result.sealed.split(".");
  const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", new TextEncoder().encode(SEAL_SECRET)), "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(iv!) }, key, bytes(cipher!));
  const { __example: _example, ...priv } = JSON.parse(new TextDecoder().decode(plain)) as Record<string, unknown>;
  return { ...out.result.puzzle, ...priv } as unknown as PuzzleData;
}

/** Opens a practice round of `game` on the fixed intro example and presses Ready; `answer` swaps the graded answer. */
async function openRound(browser: Browser, game: PuzzleType, clock: boolean, swap: (() => string | null) | null): Promise<Round> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    try {
      localStorage.setItem("duelz-arrow-control", "arrows");
    } catch {
      /* ignore */
    }
  });
  const page = await context.newPage();
  const errors: string[] = [];
  let gradeBody: string | null = null;
  let deal: PuzzleData | null = null;
  page.on("pageerror", (e) => errors.push(String(e.message ?? e).split("\n")[0]!));
  if (clock) await page.clock.install();
  // A production build names server functions by hash: the practice deal is found by its body ({type, example}),
  // the practice grade by its {puzzle, sealed, answer}. The deal is the live one (the bank seed, the depth and standard
  // stamps, exactly Joe's path); its sealed half is opened with the server's secret so the solution is known.
  await page.route("**/_serverFn/**", async (route) => {
    const body = route.request().postData() ?? "";
    if (/"k":\["type","example"\]/.test(body)) {
      const response = await route.fetch();
      const text = await response.text();
      try {
        deal = await openDeal(text);
      } catch (e) {
        errors.push(`deal: ${(e as Error).message} (${text.slice(0, 200)})`);
      }
      return route.fulfill({ response, body: text });
    }
    if (/"sealed"/.test(body) && /"answer"/.test(body)) {
      let postData = body;
      const answer = swap?.();
      if (answer != null) {
        // Seroval body: data's keys and values sit side by side; swap the answer string (screenshot tool's "full").
        const parsed = JSON.parse(body) as { t: { p: { v: { p: { k: string[]; v: unknown[] } }[] } } };
        const inner = parsed.t.p.v[0]!.p;
        const at = inner.k.indexOf("answer");
        if (at >= 0) inner.v[at] = { t: 1, s: answer };
        postData = JSON.stringify(parsed);
      }
      const response = await route.fetch({ postData });
      gradeBody = await response.text();
      return route.fulfill({ response, body: gradeBody });
    }
    return route.continue();
  });
  await page.goto(`${ORIGIN}/practice`, { waitUntil: "domcontentloaded" });
  const button = page.getByRole("button", { name: gameDisplayName(game), exact: true }).first();
  await button.waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1500); // hydration
  await button.click();
  const ready = page.getByRole("button", { name: /^Ready/ }).first();
  await ready.waitFor({ timeout: 60_000 });
  await ready.click();
  await page.locator("[data-game-stage], [data-arcade-play]").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1200);
  if (!deal) throw new Error(`no practice deal opened${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  return { page, close: () => context.close(), errors, graded: () => gradeBody, deal };
}

const REVEAL_SCORE = "[data-reveal-score]:not([data-reveal-score='pending'])";

/** The buzzer: jump the page clock past the round, stepping it for games whose loop needs frames. */
async function timeUp(page: Page) {
  await page.clock.fastForward(300_000);
  for (let i = 0; i < 400 && !(await page.locator(REVEAL_SCORE).count()); i++) await page.clock.runFor(500);
}

/** The stored parts in a grade response (the result's extraJson, escaped inside the seroval body): kind, base, standard. */
function storedParts(body: string | null): { kind: string; base: number; standard: boolean } | null {
  const flat = (body ?? "").replace(/\\+"/g, '"');
  const m = flat.match(/"parts":\{"kind":"(\w+)","base":(\d+)/);
  return m ? { kind: m[1]!, base: Number(m[2]), standard: /"standard":1\b/.test(flat) } : null;
}

async function playOne(browser: Browser, game: PuzzleType): Promise<void> {
  const driver: Driver | undefined = DRIVERS[game];
  // A real-UI solve where the driver can play it from the start of a fresh production round (seeded drivers need the
  // dev server's seed module); otherwise the full answer at the buzzer.
  const ui = Boolean(driver?.solve && !driver.seedNearSolved && !driver.seedMid);
  let answer: string | null = null;
  const run = await openRound(browser, game, !ui, ui ? null : () => answer);
  const full = run.deal;
  if (!ui) {
    answer = fullAnswer(game, full);
    if (answer === null) {
      await run.close();
      report.push(`${game.padEnd(12)} not played (no solve driver and no full answer)`);
      failures.push(`${game}: no way to play a full round`);
      return;
    }
  }
  let step = ui ? "solve" : "buzzer";
  try {
    if (ui) {
      const ctx = { page: run.page, puzzle: full, wait: (ms: number) => run.page.waitForTimeout(ms) };
      if (!driver!.solveFromStart && driver!.partial) await driver!.partial(ctx);
      await driver!.solve!(ctx);
    } else {
      await timeUp(run.page);
    }
    step = "reveal";
    const scoreEl = run.page.locator(REVEAL_SCORE).first();
    await scoreEl.waitFor({ timeout: 30_000 });
    await run.page.waitForTimeout(600);
    const score = Number(await scoreEl.getAttribute("data-reveal-score"));
    const text = ((await run.page.locator("body").innerText()) || "").replace(/\s+/g, " ");
    // The breakdown the reveal prints from the stored parts (scorePartsText): "150 + 40 par + 10 speed", "120 + 2 speed".
    const shown = text.match(/\b(\d{2,3}) \+ \d+ [a-z][a-z ]*?(?: \+ \d+ [a-z][a-z ]*?)*(?= [A-Z0-9]|$)/);
    const parts = storedParts(run.graded());
    const ok = parts?.kind === "finish" && parts.base === 150 && parts.standard && score >= 150 && (!shown || shown[1] === "150");
    report.push(
      `${game.padEnd(12)} ${ui ? "ui    " : "answer"} score ${String(score).padStart(3)}  stored ${parts ? `${parts.kind} base ${parts.base}${parts.standard ? " standard" : ""}` : "(no parts)"}  ${shown?.[0] ?? "(reveal prints no breakdown)"}`,
    );
    if (!ok)
      failures.push(
        `${game}: stored ${parts ? `${parts.kind} on base ${parts.base}` : "no parts"}, score ${score}, reveal "${shown?.[0] ?? "-"}": not the standard's 150 + speed + bonus`,
      );
    if (run.errors.length) failures.push(`${game}: page errors: ${run.errors.slice(0, 3).join(" | ")}`);
  } catch (e) {
    if (SHOTS) await run.page.screenshot({ path: `${SHOTS}/${game}-${step}.png` }).catch(() => {});
    throw new Error(`${step}: ${(e as Error).message.split("\n")[0]}${run.errors.length ? ` (page errors: ${run.errors.slice(0, 2).join(" | ")})` : ""}`);
  } finally {
    await run.close();
  }
}

/** Room seeds whose rooms (every puzzle category) the room rounds are dealt from. */
const ROOM_SEEDS = [6100, 6107, 6114];
const ROOM_CATEGORIES = ["word", "number", "speed", "attention", "pattern", "logic"] as const;

/**
 * Room rounds on the production bundle: the built server chunks' own `buildRoomPuzzles` deals a room from a seed (what
 * startGameFn stores) and their `gradeRoomAnswer` grades each round's full answer, received in the puzzle phase
 * half-way through the clock (what submitAnswerFn calls). Only the database round trip is left out.
 */
async function roomRounds(): Promise<number> {
  const dir = resolve(OUT, "server/_ssr");
  const chunk = (prefix: string) => {
    const name = readdirSync(dir).find((f) => f.startsWith(prefix) && f.endsWith(".mjs"));
    if (!name) throw new Error(`no ${prefix}*.mjs in the production build`);
    return resolve(dir, name);
  };
  const gen = (await import(chunk("generate.server-"))) as { buildRoomPuzzles: (o: object) => { puzzles: PuzzleData[] } };
  const room = (await import(chunk("roomGrade.server-"))) as {
    gradeRoomAnswer: (p: PuzzleData, r: { phase: string; phaseStartedAt: string | null; nowMs: number }, a: string, ms: number) => { graded: { score: number; isCorrect: boolean; extra?: Record<string, unknown> } };
  };
  let rounds = 0;
  for (const seed of ROOM_SEEDS) {
    const { puzzles } = gen.buildRoomPuzzles({ seed, categories: ROOM_CATEGORIES });
    for (const p of puzzles) {
      if (!STANDARD_STAMPS[p.type] || SIM_SCORED.has(p.type)) continue;
      const answer = fullAnswer(p.type, p);
      if (answer === null) continue;
      const limit = puzzleTimeLimitMs(p);
      const now = Date.now();
      // Received with half the clock left (the prep time before the clock starts is added back by the receipt).
      const { graded } = room.gradeRoomAnswer(p, { phase: "puzzle", phaseStartedAt: new Date(now - limit / 2 - 10_000).toISOString(), nowMs: now }, answer, limit / 2);
      const parts = graded.extra?.["parts"] as { kind?: string; base?: number } | undefined;
      const ok = graded.isCorrect && parts?.kind === "finish" && parts.base === 150 && graded.extra?.["standard"] === 1 && graded.score >= 150;
      report.push(`${p.type.padEnd(12)} room   score ${String(graded.score).padStart(3)}  stored ${parts ? `${parts.kind} base ${parts.base}${graded.extra?.["standard"] === 1 ? " standard" : ""}` : "(no parts)"}  (room seed ${seed})`);
      if (!ok) failures.push(`${p.type} (room seed ${seed}): the production room grade stored ${parts ? `${parts.kind} on base ${parts.base}` : "no parts"}, score ${graded.score}: not the standard's 150 + speed + bonus`);
      rounds++;
    }
  }
  return rounds;
}

if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}
console.log(`building the production server (${OUT})…`);
build();
const server = await startServer();
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  for (const game of games) {
    try {
      await playOne(browser, game);
    } catch (e) {
      failures.push(`${game}: ${(e as Error).message.split("\n")[0]}`);
      report.push(`${game.padEnd(12)} ERROR ${(e as Error).message.split("\n")[0]}`);
    }
  }
} finally {
  await browser.close();
  server.kill();
}
let roomCount = 0;
try {
  roomCount = await roomRounds();
} catch (e) {
  failures.push(`room rounds: ${(e as Error).message.split("\n")[0]}`);
}
console.log(report.join("\n"));
if (failures.length) {
  console.log(failures.map((f) => `FAIL ${f}`).join("\n"));
  console.log(`FAIL standard-live-check: ${failures.length} problem(s) in ${games.length} practice and ${roomCount} room round(s) on the production build`);
  process.exit(1);
}
console.log(`PASS standard-live-check: ${games.length} practice rounds (through the app) and ${roomCount} room rounds (the built room deal and grader) on the production build score the standard's 150 + speed + bonus`);
