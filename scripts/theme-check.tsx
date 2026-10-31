/**
 * The page skin (19 Oct 2026, presentation only; polish-layout/theme.css, src/lib/theme.ts).
 *
 *  1. The fonts (no browser): every file THEME_FONTS names is in public/fonts and is a woff2; each
 *     @font-face in theme.css points at a file there with font-display: swap; the root route
 *     preloads THEME_FONTS; each font token ends in a generic fallback family; no package was
 *     added for them.
 *  2. On every skinned screen (scripts/theme-screens.ts: the four tab screens, settings, lobby and
 *     its confirm dialog, link join, the answer reveal, the round leaderboard, standings, final
 *     results and podium), drawn in headless Chromium as an iPhone 11 home-screen app (414×896):
 *     - the fonts load: Saira, Manrope and Duelz Mono (JetBrains Mono) are each loaded wherever
 *       they are used, and every one is used somewhere;
 *     - the tokens are used: the screen carries data-skin, its background, text and gold tokens are
 *       the skin's (#07070A, #F5F5F7, #F2C75C), headings are Saira, body text Manrope, scores
 *       and codes Duelz Mono, and its cards are the skin's cards;
 *     - contrast: every visible piece of text (not dimmed on purpose, not in a game's own art)
 *       is at least 4.5:1 against what is drawn behind it, measured from a screenshot of the
 *       screen with all text hidden (gradients, glows and tints included);
 *     - touch targets: every button, link, input and summary is at least 44 × 44 px (an invisible
 *       hit area round it counts);
 *     - no blue tap highlight (as #114): -webkit-tap-highlight-color is transparent on every control;
 *     - the round leaderboard (10 players): every closed row shows its time · verdict · summary line
 *       under the name, on one line with an ellipsis.
 *
 *   bun scripts/theme-check.tsx [screen name filter…] [--verbose] [--shots=<dir>]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { createCanvas, loadImage } from "@napi-rs/canvas";

import { startSafeAreaServer } from "./safe-area-server";
import { CHROMIUM_PATHS, THEME_SCREENS, VIEWPORTS, fixThemeClock, openThemeScreen } from "./theme-screens";
import { APP_PAGE_FAMILY, THEME_FAMILIES, THEME_FONTS } from "../src/lib/theme";

const args = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
const SHOTS = args.find((a) => a.startsWith("--shots="))?.slice(8);
const ONLY = args.filter((a) => !a.startsWith("--"));
const failures: string[] = [];
const fail = (message: string) => failures.push(message);

/* ------------------------------------------------------------------ 1. the fonts */
const css = readFileSync("src/polish-layout/theme.css", "utf8");
// The tab screens' Archivo (Prompt R, 23 Oct 2026) has its @font-face with their look.
const appCss = readFileSync("src/polish-layout/app-pages.css", "utf8");
const root = readFileSync("src/routes/__root.tsx", "utf8");
const faces = [...`${css}\n${appCss}`.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]!);
if (faces.length < 3) fail(`theme.css: ${faces.length} @font-face rules, expected one per family`);
for (const face of faces) {
  const family = /font-family:\s*"([^"]+)"/.exec(face)?.[1] ?? "?";
  const url = /url\("([^"]+)"\)/.exec(face)?.[1];
  if (!/font-display:\s*swap/.test(face)) fail(`@font-face ${family}: no font-display: swap`);
  if (!url) {
    fail(`@font-face ${family}: no url`);
    continue;
  }
  const file = `public${url}`;
  if (!existsSync(file)) fail(`@font-face ${family}: ${url} is not in public/fonts`);
  else if (readFileSync(file).subarray(0, 4).toString("latin1") !== "wOF2")
    fail(`${url} is not a woff2 file`);
}
for (const href of THEME_FONTS) {
  if (!faces.some((face) => face.includes(`url("${href}")`)))
    fail(`THEME_FONTS ${href} has no @font-face`);
  if (!existsSync(`public${href}`)) fail(`THEME_FONTS ${href} is not in public/fonts`);
}
if (!/THEME_FONTS\.map\([\s\S]{0,80}rel:\s*"preload"[\s\S]{0,80}as:\s*"font"/.test(root))
  fail("the root route does not preload THEME_FONTS");
for (const [token, generic] of [
  ["--th-font-head", "sans-serif"],
  ["--th-font-body", "sans-serif"],
  ["--th-font-mono", "monospace"],
  ["--ap-font", "sans-serif"],
] as const) {
  const value = new RegExp(`${token}:\\s*([^;]+);`).exec(token === "--ap-font" ? appCss : css)?.[1] ?? "";
  if (!value.trim().endsWith(generic))
    fail(`${token} has no fallback stack ending in ${generic}: ${value}`);
}
const pkg = readFileSync("package.json", "utf8");
if (/fontsource|@fontsource|typeface-/.test(pkg))
  fail("package.json: a font package was added (fonts are self-hosted files)");
console.log(
  `${failures.length ? "FAIL" : "PASS"} fonts: ${THEME_FONTS.length} preloaded woff2 files, ${faces.length} @font-face rules with font-display: swap`,
);

/* ------------------------------------------------------------------ 2. the screens */
const CHROMIUM = CHROMIUM_PATHS.find((path): path is string => Boolean(path && existsSync(path)));
if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}
const SCREENS = ONLY.length
  ? THEME_SCREENS.filter((s) => ONLY.some((o) => s.name.includes(o)))
  : THEME_SCREENS;
const VIEWPORT = VIEWPORTS[0]!;

/** In-page: fonts, tokens, text to measure and controls. */
function themeProbe(families: { head: string; body: string; mono: string; app: string }) {
  const NOT_JUDGED = "[data-skin-off]";
  // The four tab screens' pages (data-app-page, Prompt R) use one family, Archivo, for everything.
  // (The share welcome card on Play keeps the skin's type, as share-check pins it.)
  // Polish batch R (25 Oct 2026): every other skinned screen (rooms, daily, challenge, terms, sheets) takes
  // the tab pages' Archivo too (polish-layout/room-screens.css).
  const roomLook = (el: Element) => !!el.closest("[data-skin]:not([data-tab-screen])");
  const familyFor = (el: Element, kind: "head" | "mono") =>
    (el.closest("[data-app-page]") || roomLook(el)) && !el.closest("[data-share-welcome]") ? families.app : families[kind];
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let n: Element | null = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0)
        return false;
    }
    return true;
  };
  /** Dimmed on purpose (an inactive player, a disabled control, a faded loser's card). */
  const dimmed = (el: Element) => {
    for (let n: Element | null = el; n; n = n.parentElement) {
      if (Number(getComputedStyle(n).opacity) < 0.99) return true;
      if ((n as HTMLButtonElement).disabled) return true;
    }
    return false;
  };
  // Any CSS colour (oklab, color-mix…) as sRGB rgba, through a canvas.
  const paint = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  const rgba = (colour: string) => {
    paint.clearRect(0, 0, 1, 1);
    paint.fillStyle = colour;
    paint.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = paint.getImageData(0, 0, 1, 1).data;
    return `rgba(${r}, ${g}, ${b}, ${(a! / 255).toFixed(3)})`;
  };
  const first = (family: string) =>
    family
      .split(",")[0]!
      .trim()
      .replace(/^["']|["']$/g, "");
  const describe = (el: Element) => {
    const cls = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 3).join(".");
    return `<${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""}>`;
  };
  const skins = [...document.querySelectorAll("[data-skin]")].filter(visible);
  const fades: { left: number; right: number; top: number; bottom: number }[] = [
    ...[...document.querySelectorAll(".room-sticky-footer, .room-footer")].map((f) => f.getBoundingClientRect()),
    // Under the chat bar, its home-bar strip (::after, pointer-events: none) is solid black.
    ...[...document.querySelectorAll(".room-chat-bar")].map((f) => {
      const r = f.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.bottom + 16, bottom: window.innerHeight };
    }),
  ];
  const problems: string[] = [];
  const used = new Set<string>();
  const texts: { text: string; color: string; points: [number, number][]; where: string }[] = [];
  const seen = new Set<Node>();
  for (const root of skins) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (seen.has(node)) continue;
      seen.add(node);
      const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
      const el = node.parentElement;
      // A badge's initial is judged by player-looks-check (every colour 4.5:1 under its glyph).
      if (!text || !el || el.closest(`${NOT_JUDGED}, [data-player-badge]`) || !visible(el))
        continue;
      // Emoji and symbol-only text (reactions, arrows) is not text to read.
      if (!/[\p{L}\p{N}]/u.test(text)) continue;
      const cs = getComputedStyle(el);
      used.add(first(cs.fontFamily));
      const range = document.createRange();
      range.selectNodeContents(node);
      const full = range.getBoundingClientRect();
      // Only what shows: the text's box cut to every box that clips it (a truncated name).
      let [l, t, rt, b] = [full.left, full.top, full.right, full.bottom];
      for (let n: Element | null = el; n && n !== root.parentElement; n = n.parentElement) {
        const ns = getComputedStyle(n);
        if (ns.overflowX === "visible" && ns.overflowY === "visible") continue;
        const c = n.getBoundingClientRect();
        [l, t, rt, b] = [
          Math.max(l, c.left),
          Math.max(t, c.top),
          Math.min(rt, c.right),
          Math.min(b, c.bottom),
        ];
      }
      const r = { left: l, top: t, right: rt, bottom: b, width: rt - l, height: b - t };
      if (r.width < 1 || r.height < 1) continue;
      if (
        r.bottom <= 0 ||
        r.top >= window.innerHeight ||
        r.right <= 0 ||
        r.left >= window.innerWidth
      )
        continue;
      if (dimmed(el)) continue;
      // The points of the text the player sees: on screen and not covered by something else (a
      // sheet, the tab bar, a sticky footer).
      const points: [number, number][] = [];
      // Inside the line box, where the glyphs are (not a box's rim at its edge).
      const step = Math.max(1, Math.min(r.width, r.height) / 6);
      const inset = r.height * 0.2;
      for (let y = r.top + inset; y < r.bottom - inset; y += step)
        for (
          let x = r.left + Math.min(inset, r.width / 4);
          x < r.right - Math.min(inset, r.width / 4);
          x += step
        ) {
          if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) continue;
          // A sticky footer's 16px fade (pointer-events: none) covers what scrolls under it.
          if (fades.some((f) => x >= f.left && x <= f.right && y >= f.top - 16 && y <= f.bottom))
            continue;
          const top = document.elementFromPoint(x, y);
          if (top && (top === el || el.contains(top) || top.contains(el))) points.push([x, y]);
        }
      if (points.length)
        texts.push({ text: text.slice(0, 40), color: rgba(cs.color), points, where: describe(el) });
    }
    const skin = getComputedStyle(root);
    // The room look (Polish batch R): the tab pages' palette, --primary neutral (gold only on play actions).
    const room = !root.hasAttribute("data-tab-screen");
    const want: [string, string][] = room
      ? [
          ["--background", "#0D0D0F"],
          ["--foreground", "#F3F1EC"],
          ["--primary", "#F3F1EC"],
        ]
      : [
          ["--background", "#07070A"],
          ["--foreground", "#F5F5F7"],
          ["--primary", "#F2C75C"],
        ];
    const norm = (v: string) => v.trim().toUpperCase();
    for (const [token, value] of want) {
      // The tokens resolve through var(--th-…): compare the resolved colour.
      const probe = document.createElement("span");
      probe.style.color = `var(${token})`;
      root.appendChild(probe);
      const got = getComputedStyle(probe).color;
      probe.remove();
      const hex = `#${(got.match(/\d+/g) ?? [])
        .slice(0, 3)
        .map((n) => Number(n).toString(16).padStart(2, "0"))
        .join("")}`.toUpperCase();
      if (hex !== norm(value))
        problems.push(
          `[data-skin="${root.getAttribute("data-skin")}"] ${token} is ${hex}, not ${value}`,
        );
    }
    const bodyFamily = room ? families.app : families.body;
    if (first(skin.fontFamily) !== bodyFamily)
      problems.push(`[data-skin] body text is ${first(skin.fontFamily)}, not ${bodyFamily}`);
  }
  for (const h of document.querySelectorAll("[data-skin] :is(h1, h2, h3)")) {
    if (h.closest(NOT_JUDGED) || !visible(h)) continue;
    const family = first(getComputedStyle(h).fontFamily);
    if (family !== familyFor(h, "head"))
      problems.push(`heading "${h.textContent?.trim()}" is ${family}, not ${familyFor(h, "head")}`);
  }
  for (const m of document.querySelectorAll("[data-skin] :is(.font-mono, .th-score)")) {
    if (m.closest(NOT_JUDGED) || !visible(m)) continue;
    const family = first(getComputedStyle(m).fontFamily);
    if (family !== familyFor(m, "mono"))
      problems.push(
        `score/code "${m.textContent?.trim().slice(0, 20)}" is ${family}, not ${familyFor(m, "mono")}`,
      );
  }
  for (const b of document.querySelectorAll(
    "[data-skin] :is(button, [role='button']).font-display",
  )) {
    if (b.closest(NOT_JUDGED) || !visible(b)) continue;
    const family = first(getComputedStyle(b).fontFamily);
    if (family !== familyFor(b, "head"))
      problems.push(
        `button "${b.textContent?.trim().slice(0, 20)}" is ${family}, not ${familyFor(b, "head")}`,
      );
  }
  // Touch targets and tap highlights.
  const controls: string[] = [];
  for (const c of document.querySelectorAll(
    "[data-skin] :is(button, a[href], input, select, textarea, summary, [role='button'], [role='radio'], [role='switch'])",
  )) {
    // The chat bar's reaction row (six 28px-wide emoji buttons beside the composer) is a decision for Joe.
    if (
      c.closest(`${NOT_JUDGED}, [data-chat-bar]`) ||
      !visible(c) ||
      (c as HTMLButtonElement).disabled
    )
      continue;
    const r = c.getBoundingClientRect();
    let [l, t, rt, b] = [r.left, r.top, r.right, r.bottom];
    for (const pseudo of ["::before", "::after"]) {
      const ps = getComputedStyle(c, pseudo);
      if (ps.content === "none" || ps.position !== "absolute" || ps.display === "none") continue;
      const px = (v: string) => (v.endsWith("px") ? parseFloat(v) : NaN);
      const [pt, pr, pb, pl] = [px(ps.top), px(ps.right), px(ps.bottom), px(ps.left)];
      if ([pt, pr, pb, pl].some(Number.isNaN)) continue;
      l = Math.min(l, r.left + pl);
      t = Math.min(t, r.top + pt);
      rt = Math.max(rt, r.right - pr);
      b = Math.max(b, r.bottom - pb);
    }
    const w = rt - l;
    const h = b - t;
    const name = (c.getAttribute("aria-label") ?? c.textContent ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 30);
    if (w < 43.5 || h < 43.5)
      controls.push(`"${name}" ${describe(c)} is ${Math.round(w)}×${Math.round(h)}px`);
    const tap = getComputedStyle(c).getPropertyValue("-webkit-tap-highlight-color");
    if (tap && !/rgba\(0, 0, 0, 0\)|transparent/.test(tap))
      problems.push(`"${name}" has a tap highlight ${tap}`);
  }
  return {
    skins: skins.length,
    // The tab pages' panels (Prompt R) and Practice's game tiles (shelves and grid, follow-up to #129) are its cards.
    // Polish batch R: the room screens' panels and lists (.rs-list), the error layout and the terms' page text.
    cards: document.querySelectorAll("[data-skin] .th-card, [data-skin] .th-sheet, [data-skin] .ap-panel, [data-skin] .ap-tile, [data-skin] .rs-list, [data-skin] .rs-grid, [data-skin] [data-error-screen], [data-skin] [data-terms]").length,
    // The round leaderboard's closed rows: each shows its verdict line under the name.
    rowLines: [...document.querySelectorAll("[data-skin] [aria-expanded='false'] [data-row-line]")].map((line) => ({
      shown: visible(line) && !!line.querySelector("[data-verdict]") && visible(line.querySelector("[data-verdict]")!),
      oneLine: getComputedStyle(line).whiteSpace === "nowrap" && getComputedStyle(line).textOverflow === "ellipsis",
    })),
    used: [...used],
    loaded: [...document.fonts]
      .filter((f) => f.status === "loaded")
      .map((f) => f.family.replace(/^["']|["']$/g, "")),
    problems,
    controls,
    texts,
    dpr: window.devicePixelRatio,
  };
}

// The wordmark's gold last letter is painted through its text (background-clip: text): with the text
// hidden its gradient would still be drawn, so it is dropped too and the letter is judged in its gold.
const HIDE_TEXT = `[data-skin] *, [data-skin] { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; }
[data-skin] svg, [data-skin] canvas, [data-skin] img, [data-player-badge], .game-icon { visibility: hidden !important; }
.ap-wordmark-last { background: none !important; }
* { transition: none !important; animation-play-state: paused !important; }`;

const lum = (c: number[]) => {
  const ch = c.slice(0, 3).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
};
const ratio = (a: number[], b: number[]) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const parseColor = (c: string) => {
  const m = c.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 1];
  return [m[0]!, m[1]!, m[2]!, m[3] ?? 1] as const;
};

const server = await startSafeAreaServer({
  cacheDir: "node_modules/.vite-theme",
  buildId: "theme-check",
});
// A fixed clock (scripts/fixed-clock.ts), as no-wrap-check: the dated screens draw the same text on any day.
fixThemeClock();
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
const familiesLoaded = new Set<string>();
const familiesUsed = new Set<string>();
let measured = 0;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
try {
  for (const screen of SCREENS) {
    const where = `${screen.name} (${VIEWPORT.name})`;
    const problems: string[] = [];
    try {
      const { context, page } = await openThemeScreen(browser, server.origin, screen, VIEWPORT);
      try {
        // Let a font in use finish loading (font-display: swap paints the fallback first).
        await page.waitForTimeout(300);
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        const probe = await page.evaluate(themeProbe, { ...THEME_FAMILIES, app: APP_PAGE_FAMILY });
        problems.push(
          ...probe.problems,
          ...probe.controls.map((c) => `touch target under 44px: ${c}`),
        );
        if (probe.skins === 0) problems.push("no skinned screen ([data-skin])");
        if (screen.name.includes("round leaderboard") && screen.name.includes("10 players")) {
          if (probe.rowLines.length < 10) problems.push(`only ${probe.rowLines.length} leaderboard rows show a time and verdict line`);
          if (probe.rowLines.some((l) => !l.shown)) problems.push("a closed leaderboard row hides its verdict line");
          if (probe.rowLines.some((l) => !l.oneLine)) problems.push("a closed leaderboard row's verdict line is not one line with an ellipsis");
        }
        if (probe.cards === 0 && !screen.plain)
          problems.push("no skin card or sheet (.th-card / .th-sheet) on the screen");
        for (const family of [...Object.values(THEME_FAMILIES), APP_PAGE_FAMILY]) {
          if (probe.used.includes(family)) {
            familiesUsed.add(family);
            if (!probe.loaded.includes(family)) problems.push(`${family} is used but not loaded`);
            else familiesLoaded.add(family);
          }
        }
        // Contrast: the screen with every text hidden is what each text is drawn over.
        if (SHOTS)
          writeFileSync(
            `${SHOTS}/theme-${screen.name.replace(/\W+/g, "-")}.png`,
            await page.screenshot(),
          );
        await page.addStyleTag({ content: HIDE_TEXT });
        await page.waitForTimeout(120);
        const png = await page.screenshot();
        if (SHOTS) writeFileSync(`${SHOTS}/theme-${screen.name.replace(/\W+/g, "-")}-bg.png`, png);
        const img = await loadImage(png);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);
        const k = img.width / VIEWPORT.w;
        for (const t of probe.texts) {
          const [r, g, b, a] = parseColor(t.color);
          const ratios: number[] = [];
          for (const [px, py] of t.points) {
            const x = Math.min(width - 1, Math.floor(px * k));
            const y = Math.min(height - 1, Math.floor(py * k));
            const i = (y * width + x) * 4;
            const bg = [data[i]!, data[i + 1]!, data[i + 2]!];
            const fg = [
              r * a + bg[0]! * (1 - a),
              g * a + bg[1]! * (1 - a),
              b * a + bg[2]! * (1 - a),
            ];
            ratios.push(ratio(fg, bg));
          }
          if (!ratios.length) continue;
          measured++;
          ratios.sort((p, q) => p - q);
          const low = ratios[Math.floor(ratios.length * 0.05)]!;
          if (low < 4.5)
            problems.push(
              `contrast ${low.toFixed(2)}:1 under 4.5 for "${t.text}" ${t.where} (${t.color})`,
            );
        }
      } finally {
        await context.close();
      }
    } catch (error) {
      problems.push(String((error as Error).message ?? error).split("\n")[0]!);
    }
    for (const p of problems) fail(`${where}: ${p}`);
    console.log(
      `${problems.length ? "FAIL" : "PASS"} ${where}${problems.length ? `: ${problems.length} problem(s), first: ${problems[0]}` : ": fonts loaded, skin tokens, contrast ≥ 4.5:1, targets ≥ 44px"}`,
    );
    if (VERBOSE) for (const p of problems.slice(1)) console.log(`    ${p}`);
  }
} finally {
  await browser.close();
  await server.close();
}
// Polish batch R: every skinned screen now uses Archivo (the tab pages' family); the skin's Saira, Manrope and
// Duelz Mono stay only for the share welcome card, which these screens don't draw.
if (!ONLY.length)
  for (const family of [APP_PAGE_FAMILY])
    if (!familiesUsed.has(family) || !familiesLoaded.has(family))
      fail(`${family} is never used and loaded on the skinned screens`);

for (const f of failures.slice(0, 80)) console.log(`  ${f}`);
if (failures.length) {
  console.log(`FAIL: ${failures.length} problem(s) with the page skin`);
  process.exit(1);
}
console.log(
  `PASS: ${SCREENS.length} skinned screens: ${[...familiesLoaded].join(", ")} loaded where used; skin tokens, cards and fonts in place; ${measured} texts at 4.5:1 or more; every control at least 44 × 44 px with no tap highlight`,
);
