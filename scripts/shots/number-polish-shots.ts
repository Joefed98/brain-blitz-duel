/**
 * Number polish contact sheets and arena gaps (13 Oct 2026). Not a check: CI never runs it.
 *
 * Opens /practice on a running dev server, swaps the generate request to the fixed intro
 * example (the same puzzle every run, as the October snapshots did) and seeds Math.random.
 * For each game and viewport it captures:
 *   intro      the RoundIntro about 2.5 s in, before Ready;
 *   play       after Ready and a few scripted moves (the game's driver);
 *   complete   the driver solves the puzzle; the shot is taken ~350 ms after the solving
 *              move (practice's grade request is held back 1.6 s so the stage stays up
 *              long enough to photograph; nothing in the app is changed);
 *   reveal     the AnswerReveal ~1.5 s after the server's score arrives.
 * and measures, at every viewport:
 *   gaps       the painted play area's distance from the top bar (the game region's top)
 *              and from the controls below it (or the region's bottom when none follow);
 *   reveal     whether the reveal scrolls, the smallest text size and the lowest contrast.
 *
 *   bun scripts/shots/number-polish-shots.ts --url=http://127.0.0.1:5173 --tag=after [games…]
 *   bun scripts/shots/number-polish-shots.ts --sheets      (compose before/after sheets)
 *
 * Writes raw frames and gaps-<tag>-<game>.json to --out (default the scratch folder
 * /tmp/number-polish-shots); --sheets writes JPEG sheets to screenshots/polish-number.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { DRIVERS, type DriverCtx } from "./number-drivers";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const ORIGIN = arg("url") ?? "http://127.0.0.1:5173";
const TAG = arg("tag") ?? "after";
const OUT = arg("out") ?? "/tmp/number-polish-shots";
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const GAMES = ["target", "equation", "balance", "numpyramid", "trail", "measure", "checkout", "numline", "tendrop"] as const;
const NAMES: Record<string, string> = {
  target: "Exact", equation: "Operator", balance: "Counterweight", numpyramid: "Integer Pyramid", trail: "Trail",
  measure: "Brimful", checkout: "Checkout", numline: "Ballpark", tendrop: "Tenfall",
};
const SHOT_VIEWPORTS = [[375, 667], [390, 844]] as const;
const ALL_VIEWPORTS = [[375, 667], [390, 844], [430, 932]] as const;
const PHASES = ["intro", "play", "complete", "reveal"] as const;

/** The full example puzzles (with solutions), built exactly as practice builds them. */
async function examples(): Promise<Record<string, unknown>> {
  const { generatePuzzle } = await import("@/lib/duel/generate.server");
  const { withSeededRandom } = await import("@/lib/duel/random");
  const { INTRO_EXAMPLE_SEED } = await import("@/lib/duel/puzzleDemo");
  const { bankedIntroExample } = await import("@/lib/duel/puzzleBank.server");
  const out: Record<string, unknown> = {};
  for (const t of GAMES) out[t] = bankedIntroExample(t as never) ?? withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(t as never, {}));
  return out;
}

const INIT = `(() => {
  let s = 20261013 >>> 0;
  Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
})();`;

/** In-page: painted bounds of the play area and its gaps; reveal legibility. */
const MEASURE = `(() => {
  const region = document.querySelector("[data-game-region]");
  const stage = region && region.querySelector("[data-game-stage]");
  if (!region || !stage) return null;
  const r = region.getBoundingClientRect();
  const controls = Array.from(stage.querySelectorAll("[data-game-controls]"));
  const isControl = (el) => controls.some((c) => c === el || c.contains(el));
  const SHAPES = new Set(["path","rect","circle","ellipse","line","polyline","polygon","text","image","use","CANVAS","IMG"]);
  let top = Infinity, bottom = -Infinity, left = Infinity, right = -Infinity;
  const visible = (el) => { for (let n = el; n && n !== stage; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false; } return true; };
  for (const el of stage.querySelectorAll("*")) {
    if (isControl(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.position === "fixed") continue;
    const b = el.getBoundingClientRect();
    if (b.width < 1 || b.height < 1) continue;
    const bg = cs.backgroundColor; const bgOn = (bg && !/rgba\\(.*,\\s*0\\)$/.test(bg) && bg !== "transparent") || cs.backgroundImage !== "none";
    const border = parseFloat(cs.borderTopWidth) > 0 && !/rgba\\(.*,\\s*0\\)$/.test(cs.borderTopColor);
    const leafText = el.children.length === 0 && (el.textContent || "").trim().length > 0;
    const shape = SHAPES.has(el.tagName) || SHAPES.has(el.tagName.toUpperCase());
    if (!(bgOn || border || leafText || shape)) continue;
    if (!visible(el)) continue;
    top = Math.min(top, b.top); bottom = Math.max(bottom, b.bottom); left = Math.min(left, b.left); right = Math.max(right, b.right);
  }
  const below = controls.map((c) => c.getBoundingClientRect()).filter((c) => c.height > 0 && c.top >= bottom - 2).sort((a, b) => a.top - b.top)[0];
  const ctl = controls.map((c) => c.getBoundingClientRect()).filter((c) => c.height > 0);
  const lowestCtl = ctl.length ? Math.max(...ctl.map((c) => c.bottom)) : null;
  const arena = stage.querySelector("[data-game-arena]");
  const a = arena ? arena.getBoundingClientRect() : null;
  return {
    regionTop: r.top, regionBottom: r.bottom,
    play: { top, bottom, left, right, width: right - left, height: bottom - top },
    arena: a ? { top: a.top, bottom: a.bottom, width: a.width, height: a.height } : null,
    above: Math.round(top - r.top),
    below: Math.round((below ? below.top : r.bottom) - bottom),
    belowTo: below ? "controls" : "region bottom",
    controlsClear: lowestCtl === null ? true : lowestCtl <= r.bottom + 0.5,
    controlsBottom: lowestCtl,
  };
})()`;

const REVEAL_MEASURE = `(() => {
  const content = document.querySelector(".answer-reveal-content");
  const scrolls = [document.scrollingElement, ...document.querySelectorAll("*")].filter((el) => {
    if (!el) return false; const cs = getComputedStyle(el);
    return (el === document.scrollingElement || /(auto|scroll)/.test(cs.overflowY)) && el.scrollHeight > el.clientHeight + 1;
  }).map((el) => (el.className && String(el.className).slice(0, 60)) || el.tagName);
  const lum = (c) => { const m = c.match(/[\\d.]+/g); if (!m) return null; const [r,g,b] = m.slice(0,3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126*r + 0.7152*g + 0.0722*b; };
  const alpha = (c) => { const m = c.match(/[\\d.]+/g); return m && m.length > 3 ? Number(m[3]) : 1; };
  const bgOf = (el) => { for (let n = el; n; n = n.parentElement) { const bg = getComputedStyle(n).backgroundColor; if (bg && alpha(bg) > 0.5) return bg; } return "rgb(10,10,14)"; };
  let minFont = Infinity, minFontText = "", minContrast = Infinity, minContrastText = "";
  const root = document.querySelector("[data-reveal-score]")?.closest(".animate-phase-in") || document.body;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const text = t.textContent.trim(); if (!text) continue;
    const el = t.parentElement; if (!el) continue;
    const b = el.getBoundingClientRect(); if (b.width < 1 || b.height < 1) continue;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
    const size = parseFloat(cs.fontSize);
    if (size < minFont) { minFont = size; minFontText = text.slice(0, 40); }
    if (el.closest("svg")) continue;
    const fg = cs.color; const l1 = lum(fg), l2 = lum(bgOf(el)); if (l1 === null || l2 === null) continue;
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) * Math.min(1, alpha(fg)) + (1 - Math.min(1, alpha(fg)));
    if (ratio < minContrast) { minContrast = ratio; minContrastText = text.slice(0, 40); }
  }
  const board = content ? content.getBoundingClientRect() : null;
  return { scrolls, fits: scrolls.length === 0, minFont, minFontText, minContrast: Math.round(minContrast * 100) / 100, minContrastText,
    content: board ? { top: board.top, bottom: board.bottom, height: board.height, scrollHeight: content.scrollHeight } : null,
    viewportH: innerHeight };
})()`;

async function capture() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const games = GAMES.filter((g) => !only.length || only.includes(g));
  const full = await examples();
  mkdirSync(OUT, { recursive: true });
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  for (const game of games) {
    const gapsFile = `${OUT}/gaps-${TAG}-${game}.json`;
    const report: Record<string, unknown> = {};
    for (const [w, h] of ALL_VIEWPORTS) {
      const shots = SHOT_VIEWPORTS.some(([sw, sh]) => sw === w && sh === h);
      const key = `${game}@${w}x${h}`;
      const entry: Record<string, unknown> = {};
      report[key] = entry;
      const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: "no-preference" });
      const page = await context.newPage();
      await page.addInitScript(INIT);
      const cues: string[] = [];
      await page.exposeFunction("__cue", (c: string) => { cues.push(c); });
      await page.addInitScript(`window.addEventListener("duelz-sound", (e) => window.__cue && window.__cue(e.detail && e.detail.cue));`);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      let holdGrade = false;
      await page.route("**/_serverFn/**", async (route) => {
        const req = route.request();
        const url = req.url();
        const id = Buffer.from(url.split("/_serverFn/")[1]!.split("?")[0]!, "base64url").toString();
        if (id.includes("practiceGenerateFn")) {
          const body = (req.postData() ?? "").replace(/("k":\["type","example"\],"v":\[\{"t":1,"s":"[a-z]+"\},)\{"t":2,"s":3\}/, '$1{"t":2,"s":2}');
          return route.continue({ postData: body });
        }
        if (id.includes("practiceGradeFn") && holdGrade) await new Promise((r) => setTimeout(r, 1600));
        return route.continue();
      });
      const shot = async (phase: string) => {
        if (!shots) return;
        await page.screenshot({ path: `${OUT}/${game}-${phase}-${w}x${h}-${TAG}.png` });
      };
      try {
        await page.goto(`${ORIGIN}/practice`, { waitUntil: "domcontentloaded" });
        const button = page.getByRole("button", { name: NAMES[game]!, exact: true }).first();
        await button.waitFor({ timeout: 90_000 });
        await page.waitForTimeout(1500);
        await button.click();
        const ready = page.getByRole("button", { name: /ready/i });
        await ready.waitFor({ timeout: 90_000 });
        await page.waitForTimeout(2500);
        await shot("intro");
        await ready.click();
        await page.locator("[data-game-stage]").waitFor({ timeout: 30_000 });
        await page.waitForTimeout(1200);
        entry["gapsStart"] = await page.evaluate(MEASURE);
        const driver = DRIVERS[game];
        const ctx: DriverCtx = { page, puzzle: full[game] as never, wait: (ms) => page.waitForTimeout(ms) };
        if (driver?.partial) await driver.partial(ctx);
        await page.waitForTimeout(500);
        entry["gapsPlay"] = await page.evaluate(MEASURE);
        await shot("play");
        if (driver) {
          holdGrade = true;
          cues.length = 0;
          await driver.solve(ctx);
          await page.waitForTimeout(driver.completeShotMs ?? 350);
          await shot("complete");
          await page.waitForTimeout(900);
          entry["cuesAfterSolve"] = [...cues];
        }
        await page.locator("[data-reveal-score]").first().waitFor({ timeout: 150_000 });
        await page.waitForTimeout(1500);
        entry["reveal"] = await page.evaluate(REVEAL_MEASURE);
        await shot("reveal");
      } catch (error) {
        entry["error"] = String(error).split("\n")[0];
        await page.screenshot({ path: `${OUT}/${game}-error-${w}x${h}-${TAG}.png` }).catch(() => {});
      }
      if (errors.length) entry["pageErrors"] = errors.slice(0, 3);
      const g = entry["gapsStart"] as { above: number; below: number } | undefined;
      console.log(`${TAG} ${key}: ${g ? `above ${g.above} below ${g.below}` : "no gaps"}${entry["error"] ? ` ERROR ${entry["error"]}` : ""}`);
      await context.close();
    }
    writeFileSync(gapsFile, JSON.stringify(report, null, 1));
  }
  await browser.close();
}

async function sheets() {
  const { createCanvas, loadImage } = await import("@napi-rs/canvas");
  const dest = "screenshots/polish-number";
  mkdirSync(dest, { recursive: true });
  for (const game of GAMES) {
    for (const [w, h] of SHOT_VIEWPORTS) {
      const pad = 12, label = 30, head = 34;
      const W = pad + PHASES.length * (w + pad);
      const H = head + 2 * (label + h + pad);
      const canvas = createCanvas(W, H);
      const c = canvas.getContext("2d");
      c.fillStyle = "#16161c"; c.fillRect(0, 0, W, H);
      c.fillStyle = "#f4f4f6"; c.font = "bold 20px sans-serif";
      c.fillText(`${NAMES[game]} (${game}) · ${w}×${h}`, pad, 24);
      let found = false;
      for (const [row, tag] of (["before", "after"] as const).entries()) {
        const y0 = head + row * (label + h + pad);
        for (const [col, phase] of PHASES.entries()) {
          const x0 = pad + col * (w + pad);
          c.fillStyle = "#c9c9d2"; c.font = "16px sans-serif";
          c.fillText(`${tag} · ${phase === "complete" ? "completion" : phase === "play" ? "mid-play" : phase}`, x0, y0 + 20);
          const file = `${OUT}/${game}-${phase}-${w}x${h}-${tag}.png`;
          if (existsSync(file)) { c.drawImage(await loadImage(readFileSync(file)), x0, y0 + label); found = true; }
          else { c.strokeStyle = "#555"; c.strokeRect(x0, y0 + label, w, h); c.fillText("not captured", x0 + 12, y0 + label + 24); }
        }
      }
      if (found) writeFileSync(`${dest}/${game}-${w}x${h}.jpg`, await canvas.encode("jpeg", 82));
    }
  }
}

if (process.argv.includes("--sheets")) await sheets();
else await capture();
