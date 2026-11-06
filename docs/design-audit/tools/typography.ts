/**
 * Design audit: the typography in use, read from the browser's computed styles (6 Nov 2026; read-only).
 * Opens the Play, Practice and Profile tabs and a room's standings through the screen harness at 390×844
 * and records, for each named element, the computed font-family, the face actually rendered (first family
 * in the stack that document.fonts has loaded), weight, stretch, size, line-height, letter-spacing and
 * text-transform. Writes docs/design-audit/typography.json and the 2× close-up of the Play page's top
 * (wordmark, title, first card) as docs/design-audit/screenshots/typography_play_closeup.png.
 *
 *   bun docs/design-audit/tools/typography.ts
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import type { Page } from "playwright";

import { startSafeAreaServer } from "../../../scripts/safe-area-server";
import { GOOGLE_FONTS_CSS } from "../../../src/lib/offline/assets";
import { CHROMIUM_PATHS, fixThemeClock, openThemeScreen, room, THEME_SCREENS, type ThemeViewport } from "../../../scripts/theme-screens";

const PHONE: ThemeViewport = { name: "390x844", w: 390, h: 844, scale: 2 };
const theme = (n: string) => THEME_SCREENS.find((s) => s.name === n)!;

/** [element, how found]: `css:<selector>` or `text:<exact own text>` (optionally `@<ancestor selector>`). */
const PROBES: Record<string, [string, string][]> = {
  play: [
    ["JOULZ wordmark", "css:.ap-wordmark-text"],
    ["Page title (Play: \"Play live with friends\")", "css:h1"],
    ["Section heading (\"Today\")", "text:Today"],
    ["Section heading (\"Next public game\")", "text:Next public game"],
    ["Card title (\"Daily Puzzle\")", "text:Daily Puzzle"],
    ["Card title (public game: \"Saturday night quiz\")", "text:Saturday night quiz"],
    ["Body text (Play lede)", "css:h1 + p, h1 ~ p"],
    ["Card meta line (\"Wed 28 Oct · 7:00 pm UK · 6 rounds\")", "textStarts:Wed 28 Oct"],
    ["Primary button (\"Create a room\")", "text:Create a room"],
    ["Secondary button (\"Join\")", "text:Join"],
    ["Link (\"All public games\")", "text:All public games"],
    ["Input text / placeholder (\"Your name\")", "css:input"],
    ["Date tile number (\"28\")", "text:28"],
    ["Date tile label (\"WED\")", "text:WED"],
    ["Tab bar label (\"Play\", current)", "navText:Play"],
    ["Tab bar label (\"Practice\")", "text:Practice"],
  ],
  practice: [
    ["Page title (\"Practice\")", "css:h1"],
    ["Small label (\"BEST\")", "text:BEST"],
    ["Switch label (\"Puzzles 51\")", "css:[data-practice-side] "],
    ["Category chip", "css:[data-practice-filter]"],
    ["Section heading (category name)", "css:[data-practice-section] h2, section h2"],
    ["Row title (game name, \"Strikeout\")", "text:Strikeout"],
    ["Best score number (\"148\")", "text:148"],
  ],
  profile: [
    ["Page title (\"Profile\")", "css:h1"],
    ["Stat number (\"3\")", "text:3"],
    ["Small label (stat caption, \"Rooms\")", "textStarts:Rooms"],
  ],
  intro: [
    ["Game header name (\"Box Six\")", "text:Box Six"],
    ["Game header context (\"Logic · Round 1 of 1\")", "textStarts:Logic"],
    ["Intro label (\"Goal\")", "text:Goal"],
    ["Intro goal line", "textStarts:Fill the"],
    ["Ready button", "text:Ready"],
  ],
  game: [
    ["Game header name (\"Box Six\")", "text:Box Six"],
    ["Timer ring number", "css:.game-timer-seconds"],
    ["Goal line (live round)", "css:[data-goal-text]"],
  ],
  standings: [
    ["Screen title (\"Standings\")", "text:Standings"],
    ["Player name", "css:.th-name"],
    ["Score / total (Duelz Mono)", "css:.th-score"],
  ],
};

async function probe(page: Page, list: [string, string][]) {
  return page.evaluate((items) => {
    const own = (el: Element) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    };
    const find = (how: string): Element | null => {
      const [kind, ...rest] = how.split(":");
      const arg = rest.join(":");
      const all = [...document.querySelectorAll("body *")].filter(visible);
      if (kind === "css") return [...document.querySelectorAll(arg)].find(visible) ?? null;
      if (kind === "text") return all.find((e) => own(e) === arg) ?? all.find((e) => e.textContent?.trim() === arg && e.children.length <= 1) ?? null;
      if (kind === "navText") return [...document.querySelectorAll("nav *")].filter(visible).find((e) => own(e) === arg) ?? null;
      if (kind === "textStarts") return all.find((e) => own(e).startsWith(arg)) ?? null;
      return null;
    };
    const rendered = (family: string, weight: string, style: string) => {
      for (const f of family.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""))) {
        if (/^(system-ui|sans-serif|serif|monospace|ui-\w+|-apple-system|BlinkMacSystemFont)$/i.test(f)) return `${f} (generic)`;
        try {
          if (document.fonts.check(`${style} ${weight} 16px "${f}"`)) {
            const loaded = [...document.fonts].some((ff) => ff.family.replace(/"/g, "") === f && ff.status === "loaded");
            if (loaded) return f;
          }
        } catch {
          /* ignore */
        }
      }
      return "fallback (no listed face loaded)";
    };
    return items.map(([name, how]) => {
      const el = find(how);
      if (!el) return { name, found: false };
      const cs = getComputedStyle(el);
      // An SVG wordmark has no text metrics of its own: report its box and the text style inherited.
      const box = el.getBoundingClientRect();
      return {
        name,
        found: true,
        tag: el.tagName.toLowerCase(),
        className: (el.getAttribute("class") ?? "").slice(0, 120),
        text: (el.textContent ?? "").trim().slice(0, 40),
        fontFamily: cs.fontFamily,
        rendered: rendered(cs.fontFamily, cs.fontWeight, cs.fontStyle),
        fontWeight: cs.fontWeight,
        fontStretch: cs.fontStretch,
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        textTransform: cs.textTransform,
        fontVariantNumeric: cs.fontVariantNumeric,
        fontFeatureSettings: cs.fontFeatureSettings,
        color: cs.color,
        box: `${Math.round(box.width)}×${Math.round(box.height)}`,
      };
    });
  }, list);
}

fixThemeClock();
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-design-audit-type", buildId: "design-audit-type" });
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM_PATHS.find((p): p is string => Boolean(p && existsSync(p))) });
const result: Record<string, unknown> = {};
try {
  const screens = {
    play: theme("play"),
    practice: theme("practice list"),
    profile: theme("profile"),
    intro: { name: "intro", mode: "room" as const, room: (() => { const make = room("in_progress", "intro", { players: 4 }); return () => { const r = make(); const start = Date.now() - 8_000; r.duel.phase_started_at = new Date(start).toISOString(); r.duel.round_started_at = r.duel.phase_started_at; r.results = []; return r; }; })(), waitMs: 1200 },
    game: { name: "game", mode: "room" as const, room: room("in_progress", "puzzle", { players: 4, rounds: 1 }), waitMs: 3500 },
    standings: { name: "standings", mode: "room" as const, room: room("in_progress", "standings", { players: 6, rounds: 2 }), waitMs: 2800 },
  };
  for (const [key, screen] of Object.entries(screens)) {
    const { context, page } = await openThemeScreen(browser, server.origin, screen, PHONE, async (c) => {
      await c.addInitScript((href) => {
        document.addEventListener("DOMContentLoaded", () => {
          const l = document.createElement("link");
          l.rel = "stylesheet";
          l.href = href;
          document.head.appendChild(l);
        });
      }, GOOGLE_FONTS_CSS);
    });
    await page.waitForTimeout(800);
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    result[key] = await probe(page, PROBES[key]!);
    // The wordmark is an SVG/glyph group: also record its font if drawn as text.
    if (key === "play") {
      result.wordmarkMarkup = await page.evaluate(() => {
        const h = document.querySelector("header");
        return h ? h.innerHTML.slice(0, 1500) : null;
      });
      // 2× close-up: from the top to the bottom of the first card (the Quick play panel).
      const bottom = await page.evaluate(() => {
        const cand = [...document.querySelectorAll("main section, main > div > div, [data-app-page] section, .ap-panel")]
          .map((e) => e.getBoundingClientRect())
          .filter((r) => r.top > 150 && r.height > 120)
          .sort((a, b) => a.top - b.top)[0];
        return cand ? Math.ceil(cand.bottom + 12) : 460;
      });
      mkdirSync("docs/design-audit/screenshots", { recursive: true });
      await page.screenshot({ path: "docs/design-audit/screenshots/typography_play_closeup.png", clip: { x: 0, y: 0, width: 390, height: Math.min(bottom, 844) } });
    }
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
writeFileSync("docs/design-audit/typography.json", JSON.stringify(result, null, 2) + "\n");
for (const [k, v] of Object.entries(result))
  if (Array.isArray(v))
    for (const r of v as Record<string, string>[])
      console.log(k, "|", r.name, "|", r.found === (false as unknown) ? "NOT FOUND" : [r.tag, r.rendered, r.fontWeight, r.fontStretch, r.fontSize, r.lineHeight, r.letterSpacing, r.textTransform, r.fontVariantNumeric, r.text].join(" | "));
