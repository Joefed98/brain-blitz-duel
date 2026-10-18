/**
 * Shared by arcade-room-practice-check and fission-repeat-check (18 Oct 2026): opens an arcade
 * play screen in practice or in a room through the real routes (safe-area-harness.tsx, the
 * network edge stubbed) as an iPhone 11 home-screen app, and measures where everything on it is.
 */
import type { Browser, Page } from "playwright";

import { DEVICE_INIT, IPHONE11_APP, emulateDevice } from "./device-emulation";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { splitPuzzle } from "../src/lib/duel/secrets";
import type { PuzzleData } from "../src/lib/duel/types";

export const SCREEN_H = IPHONE11_APP.screenH;
/** The column and the lowest control end this far above the screen's bottom. */
export const BOTTOM_GAP = 16;

const iso = (ms: number) => new Date(ms).toISOString();

/** A two-player room on round 2 of 6, every round this game, in the round intro (Ready tapped). */
function roomFor(type: string, puzzle: unknown) {
  const now = Date.now();
  const player = (slot: number, name: string) => ({
    id: `p${slot}`, duel_id: "d", player_slot: slot, display_name: name, user_id: `u${slot}`, ready_round: 1,
    intro_ready_round: 2, muted_by_host: false, last_reaction_at: null, last_seen_at: iso(now), status: "active",
    joined_at: iso(now - 60_000),
  });
  return {
    duel: {
      id: "d", room_code: "SAFE", status: "in_progress", selected_categories: [], tournament_history: [], disbanded_at: null,
      host_user_id: "u1", max_players: 10, round_count: 6, round_order: Array(6).fill(type), no_maths: false,
      puzzles_public: Array(6).fill(puzzle), current_round: 2, phase: "intro", phase_started_at: iso(now + 500),
      round_started_at: iso(now + 500), next_duel_id: null, created_at: iso(now - 60_000),
    },
    players: [player(1, "Me"), player(2, "Jo")],
    results: [],
  };
}

export function puzzleFor(type: string): PuzzleData {
  return splitPuzzle(withSeededRandom(41, () => generatePuzzle(type as never))).pub as PuzzleData;
}

/** A fresh page on the harness with the iPhone 11 app geometry, its harness state set. */
export async function harnessPage(browser: Browser, origin: string, mode: "practice" | "room", type: string, puzzle: PuzzleData): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: IPHONE11_APP.w, height: IPHONE11_APP.h } });
  await context.addInitScript(DEVICE_INIT);
  const page = await context.newPage();
  await page.addInitScript(
    (r) => {
      (window as unknown as Record<string, unknown>)["__harness"] = {
        puzzles: r.puzzles, verdict: { isCorrect: false, score: 40 }, latencyMs: 50, submissions: [], verdictAt: null, room: r.room,
      };
      try {
        localStorage.setItem("duelz_onboarding_seen", "1");
      } catch {
        /* the harness works without it */
      }
    },
    { puzzles: { [type]: puzzle }, room: mode === "room" ? roomFor(type, puzzle) : null },
  );
  // The page clock flows as usual until a check pauses it (freezeClock), so a run that ends on its own
  // without input (Hover, Snake) stays on its play screen while it is measured.
  await page.clock.install();
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await page.goto(`${origin}/safe-area.html?mode=${mode}`, { timeout: 180_000 });
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  await emulateDevice(page, IPHONE11_APP);
  return page;
}

/** From the practice list (or a result screen's Play again) through Ready to the live round. */
export async function startPractice(page: Page, type: string, again = false): Promise<void> {
  if (again) await page.getByRole("button", { name: "Play again" }).click({ timeout: 60_000 });
  else await page.getByRole("button", { name: gameDisplayName(type), exact: true }).first().click({ timeout: 120_000 });
  await page.getByRole("button", { name: /^Ready/ }).first().click({ timeout: 60_000 });
  await page.waitForSelector("[data-arcade-play] [data-game-stage]", { timeout: 60_000 });
}

/** The room's intro (chat bar showing), then the server moves the round live. */
export async function startRoom(page: Page): Promise<void> {
  await page.waitForSelector("[data-chat-bar]", { timeout: 120_000 });
  await page.evaluate(() =>
    (window as unknown as { __harness: { update: (f: (r: { duel: Record<string, unknown> }) => void) => void } }).__harness.update((r) => {
      const at = new Date(Date.now() + 300).toISOString();
      r.duel["phase"] = "puzzle";
      r.duel["phase_started_at"] = at;
      r.duel["round_started_at"] = at;
    }),
  );
  await page.waitForSelector("[data-arcade-play] [data-game-stage]", { timeout: 60_000 });
}

export interface Geometry {
  html: number;
  body: number;
  shell: number;
  column: number;
  /** The arena slot, the world and every control below it: "name top..bottom left..right". */
  boxes: string[];
  /** The lowest control's bottom, or null for a game with none under its arena. */
  lowest: number | null;
  /** The lowest point anything is clipped to (html and body included), and by what. */
  clip: { bottom: number; by: string } | null;
  short: string;
}

/** Measured in the page. */
export function measure(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    const round = (n: number) => Math.round(n * 10) / 10;
    const shell = document.querySelector("[data-arcade-play]");
    const slot = document.querySelector("[data-arcade-play] [data-arena-slot]");
    const world = slot?.querySelector(":scope > [data-game-arena]") ?? null;
    const slotBottom = slot?.getBoundingClientRect().bottom ?? 0;
    const controls = [...document.querySelectorAll("[data-arcade-play] [data-game-stage] button, [data-arcade-play] [data-game-stage] [data-game-controls]")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.height > 0 && r.top >= slotBottom - 1;
      });
    const box = (name: string, el: Element) => {
      const r = el.getBoundingClientRect();
      return `${name} ${round(r.top)}..${round(r.bottom)} ${round(r.left)}..${round(r.right)}`;
    };
    const named = (el: Element) => (el.getAttribute("aria-label") ?? el.getAttribute("data-game-controls") ?? el.textContent ?? "").trim().slice(0, 24);
    const boxes = [
      ...(slot ? [box("slot", slot)] : []),
      ...(world ? [box("world", world)] : []),
      ...controls.map((el) => box(named(el), el)),
    ];
    const bottoms = controls.map((el) => el.getBoundingClientRect().bottom);
    const clipOf = (window as unknown as { __clipBottom: (el: Element) => { bottom: number; by: string } }).__clipBottom;
    const lowestEl = controls[bottoms.indexOf(Math.max(...bottoms))] ?? world;
    const column = shell?.querySelector(":scope > [data-game-column]");
    return {
      html: round(document.documentElement.getBoundingClientRect().height),
      body: round(document.body.getBoundingClientRect().height),
      shell: round(shell?.getBoundingClientRect().height ?? 0),
      // The column's content edge (its box carries the 16px strip as bottom padding).
      column: round((column?.getBoundingClientRect().bottom ?? 0) - (column ? parseFloat(getComputedStyle(column).paddingBottom) || 0 : 0)),
      boxes,
      lowest: bottoms.length ? round(Math.max(...bottoms)) : null,
      clip: lowestEl ? clipOf(lowestEl) : null,
      short: document.documentElement.style.getPropertyValue("--standalone-short"),
    };
  });
}

/** What is wrong with a play screen's geometry on the iPhone 11 app (empty when nothing). */
export function judge(g: Geometry): string[] {
  const out: string[] = [];
  const want = SCREEN_H - BOTTOM_GAP;
  if (Math.abs(g.html - SCREEN_H) > 0.5) out.push(`html is ${g.html}px, not the screen's ${SCREEN_H}px`);
  if (Math.abs(g.body - SCREEN_H) > 0.5) out.push(`body is ${g.body}px, not ${SCREEN_H}px`);
  if (Math.abs(g.shell - SCREEN_H) > 0.5) out.push(`the play screen is ${g.shell}px, not ${SCREEN_H}px`);
  if (Math.abs(g.column - want) > 0.5) out.push(`the column ends at ${g.column}, not ${want}`);
  if (g.lowest !== null && Math.abs(g.lowest - want) > 0.5) out.push(`the lowest control ends at ${g.lowest}, not ${want} (16px above the bottom)`);
  if (g.clip && g.lowest !== null && g.clip.bottom < g.lowest - 0.5) out.push(`the lowest control is cut at ${g.clip.bottom} by ${g.clip.by}`);
  if (g.clip && g.clip.bottom < want - 0.5) out.push(`clipped at ${g.clip.bottom} by ${g.clip.by}, above ${want}`);
  return out;
}

/**
 * WebKit can change a home-screen app's layout viewport while a play screen is up (after a few
 * rounds, the keyboard, or once its bug is fixed): the whole screen (896) or short again (848).
 * The page's resize listeners run; the screen, the insets and navigator.standalone stay.
 */
export async function layoutViewport(page: Page, height: number): Promise<void> {
  await page.setViewportSize({ width: IPHONE11_APP.w, height });
  await page.evaluate(() => {
    window.dispatchEvent(new Event("resize"));
    window.visualViewport?.dispatchEvent(new Event("resize"));
  });
  await page.waitForTimeout(300);
}

/** Two measurements agree box for box (within 0.5px). */
export function sameBoxes(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const nums = (s: string) => s.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  return a.every((box, i) => {
    const x = nums(box);
    const y = nums(b[i]!);
    return box.replace(/-?\d+(\.\d+)?/g, "#") === b[i]!.replace(/-?\d+(\.\d+)?/g, "#") && x.every((v, k) => Math.abs(v - y[k]!) <= 0.5);
  });
}
