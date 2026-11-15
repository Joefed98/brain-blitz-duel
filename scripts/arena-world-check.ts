/**
 * The arena's fairness rule (phase 2 step 4 pass 2, 15 Nov 2026; lib/gameFrame/arena.ts): every device plays the
 * identical game world. A bigger screen draws the same world larger, never more of it. Headless Chromium, the safe-area
 * harness's room rounds, every active arcade play screen (the arcade games and the engine games on the arcade stage) on
 * a phone (390×844, touch), a sideways tablet (1180×820, touch: the arena) and a computer (1440×900, a mouse: the
 * arena). Fails unless, for each game:
 *  - the world's size (the arena slot's --arena-w and --arena-h, set from the game's own world) is the same on all three;
 *  - the drawn world shows exactly that world: its box has the world's aspect ratio within a pixel (turned through
 *    90° on a rotate game's computer and tablet, so the turned box has the swapped ratio), so nothing extra and
 *    nothing cut;
 *  - the whole world is on screen, inside every clipping ancestor;
 *    (within 2.5 px: the rotor and the slot round the world's box down to whole pixels);
 *  - on the tablet and the computer, it is drawn at least as large as on the phone (the arena uses the space), except a
 *    game whose computer world is capped for its frame rate (desktopModes.ts maxWorldWidth: Apex), on the computer.
 *
 *   bun scripts/arena-world-check.ts [--part=k/n] [game ids…]
 */
import { existsSync } from "node:fs";
import type { Browser } from "playwright";

import { ACTIVE_PUZZLE_TYPES } from "../src/lib/duel/registry";
import { puzzleDef } from "../src/lib/duel/catalogue";
import { DESKTOP_MODES } from "../src/lib/duel/desktopModes";
import type { PuzzleType } from "../src/lib/duel/types";
import { startSafeAreaServer } from "./safe-area-server";
import { roomRound } from "./desktop-layout-screens";
import { CHROMIUM_PATHS, fixThemeClock, openThemeScreen, type ThemeViewport } from "./theme-screens";

const args = process.argv.slice(2);
const PART = args.find((a) => a.startsWith("--part="))?.slice(7) ?? "1/1";
const [PART_K, PART_N] = PART.split("/").map(Number) as [number, number];
const ONLY = args.filter((a) => !a.startsWith("--"));
const CHROMIUM = CHROMIUM_PATHS.find((p): p is string => Boolean(p && existsSync(p)));
if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}

const arcadeScreen = (t: PuzzleType) => {
  const d = puzzleDef(t);
  return d.category === "arcade" || Boolean(d.arcadeRun);
};
const ALL = ACTIVE_PUZZLE_TYPES.filter(arcadeScreen);
const GAMES = (ONLY.length ? ALL.filter((t) => ONLY.includes(t)) : ALL).filter((_, i) => i % PART_N === PART_K - 1);

const DEVICES: { name: string; vp: ThemeViewport; arena: boolean }[] = [
  { name: "phone 390x844", vp: { name: "390x844", w: 390, h: 844 }, arena: false },
  { name: "sideways tablet 1180x820", vp: { name: "1180x820", w: 1180, h: 820 }, arena: true },
  { name: "computer 1440x900", vp: { name: "1440x900", w: 1440, h: 900, desktop: true }, arena: true },
];

interface Seen {
  worldW: number;
  worldH: number;
  box: { x: number; y: number; w: number; h: number } | null;
  turned: boolean;
  clipped: string | null;
  arena: boolean;
}

function probe(): Seen {
  const slot = document.querySelector<HTMLElement>("[data-arena-slot]");
  const arena = document.querySelector<HTMLElement>("[data-game-arena]");
  const style = slot ? getComputedStyle(slot) : null;
  const worldW = Number(style?.getPropertyValue("--arena-w").trim() || NaN);
  const worldH = Number(style?.getPropertyValue("--arena-h").trim() || NaN);
  const r = arena?.getBoundingClientRect() ?? null;
  let clipped: string | null = null;
  if (r) {
    if (r.left < -0.75 || r.top < -0.75 || r.right > innerWidth + 0.75 || r.bottom > innerHeight + 0.75) clipped = "off screen";
    for (let el = arena!.parentElement; el && !clipped; el = el.parentElement) {
      const s = getComputedStyle(el);
      if (s.overflow === "visible" && s.overflowX === "visible" && s.overflowY === "visible") continue;
      const c = el.getBoundingClientRect();
      if (r.left < c.left - 0.75 || r.top < c.top - 0.75 || r.right > c.right + 0.75 || r.bottom > c.bottom + 0.75)
        clipped = `cut by ${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).split(" ")[0]}` : ""}`;
    }
  }
  return {
    worldW,
    worldH,
    box: r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null,
    turned: Boolean(arena?.closest("[data-arena-rotor]")),
    clipped,
    arena: Boolean(document.querySelector("[data-arena]")),
  };
}

const failures: string[] = [];
let proofs = 0;
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-arena-world", buildId: "arena-world-check" });
fixThemeClock();
const { chromium } = await import("playwright");
const browser: Browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  for (const type of GAMES) {
    const seen: (Seen & { device: string })[] = [];
    for (const device of DEVICES) {
      const screen = { ...roomRound(type, true), waitMs: 1500 };
      const { context, page } = await openThemeScreen(browser, server.origin, screen, device.vp);
      try {
        await page.locator("[data-game-arena]").first().waitFor({ timeout: 30_000 });
        await page.waitForTimeout(300);
        const s = await page.evaluate(probe);
        seen.push({ ...s, device: device.name });
        const where = `${type} on the ${device.name}`;
        if (s.arena !== device.arena) failures.push(`${where}: arena ${s.arena}, want ${device.arena}`);
        if (!s.box || !(s.worldW > 0 && s.worldH > 0)) {
          failures.push(`${where}: no world drawn (${s.worldW}×${s.worldH})`);
          continue;
        }
        const wantRotate = device.arena && DESKTOP_MODES[type].mode === "rotate";
        if (s.turned !== wantRotate) failures.push(`${where}: world ${s.turned ? "turned" : "upright"}, want ${wantRotate ? "turned" : "upright"}`);
        // The visible area is exactly the world: the box's ratio is the world's (swapped when turned).
        const [ww, wh] = s.turned ? [s.worldH, s.worldW] : [s.worldW, s.worldH];
        // Whole pixels: the computer rounds the world's width down to 2 px and its height to 1 px, so the box matches the
        // world's ratio within 2.5 px along one of its sides.
        const offBy = Math.min(Math.abs((s.box.w * wh) / ww - s.box.h), Math.abs((s.box.h * ww) / wh - s.box.w));
        if (offBy > 2.5) failures.push(`${where}: drawn ${s.box.w.toFixed(1)}×${s.box.h.toFixed(1)}, not the world's ${ww}:${wh} (more or less of the world shown)`);
        if (s.clipped) failures.push(`${where}: the world is ${s.clipped}`);
        proofs++;
      } catch (e) {
        failures.push(`${type} on the ${device.name}: harness: ${String((e as Error).message ?? e).split("\n")[0]}`);
      } finally {
        await context.close();
      }
    }
    // The identical world on every device, and the arena never smaller than the phone.
    const sizes = new Set(seen.map((s) => `${s.worldW}×${s.worldH}`));
    if (sizes.size > 1) failures.push(`${type}: a different world per device (${seen.map((s) => `${s.device} ${s.worldW}×${s.worldH}`).join(", ")})`);
    const phone = seen.find((s) => s.device.startsWith("phone"))?.box;
    for (const s of seen.filter((s) => !s.device.startsWith("phone"))) {
      if (!phone || !s.box) continue;
      if (s.device.startsWith("computer") && DESKTOP_MODES[type].maxWorldWidth) continue;
      const area = (b: { w: number; h: number }) => b.w * b.h;
      if (area(s.box) + 1 < area(phone)) failures.push(`${type}: drawn smaller on the ${s.device} (${s.box.w.toFixed(0)}×${s.box.h.toFixed(0)}) than on the phone (${phone.w.toFixed(0)}×${phone.h.toFixed(0)})`);
    }
  }
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  for (const f of failures) console.log(`  ${f}`);
  console.log(`FAIL: arena-world-check (part ${PART}): ${failures.length} problem(s)`);
  process.exit(1);
}
console.log(`PASS: arena-world-check (part ${PART}): ${GAMES.length} games × ${DEVICES.length} devices (${proofs} draws): the identical world on a phone, a sideways tablet and a computer, shown whole and never smaller in the arena.`);
process.exit(0);
