/**
 * Intro-demo tap check: do coordinate demos recorded on an older layout still land on
 * the same targets in today's layout? A design tool for deciding which saved puzzle
 * demos to stop replaying (wordInput.ts presentation revisions); not a CI check, since
 * it needs two dev servers.
 *
 *   git worktree add /tmp/old <commit the demos were recorded on>   (cp scripts/shots/demo-mount.tsx into it)
 *   (cd /tmp/old && npx vite dev --port 5192)   and today's tree on another port
 *   bun scripts/shots/demo-taps.ts --old=http://127.0.0.1:5192 --url=http://127.0.0.1:5191 [games…]
 *       [--sizes=375x667,390x844,430x932]
 *
 * A saved demo stores each touch as a fraction of the play area it was recorded in, with
 * that area's size and column layout. For every place a demo can touch (each tap target's
 * centre, each board cell's centre, points across a swipe area), the old tree's practice
 * screen gives the fraction and what is there. Then the real intro-demo player
 * (PuzzleIntroDemo, scripts/shots/demo-mount.tsx) is mounted in each tree with a
 * demo of that size and layout, and the same fraction is resolved the way the player
 * fires a touch (document.elementFromPoint on its stage). The old tree's own player is
 * the control (it must land every touch where it was recorded); a touch that lands
 * elsewhere in today's player is a miss. Demos are recorded on each game's fixed intro
 * example, which this uses too.
 */
import { chromium, type Browser, type Page } from "playwright";

import { gameDisplayName } from "../../src/lib/duel/gameNames";
import type { PuzzleType } from "../../src/lib/duel/types";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const OLD = (opt("old") ?? "http://127.0.0.1:5192").replace(/\/$/, "");
const NEW = (opt("url") ?? "http://127.0.0.1:5191").replace(/\/$/, "");
const SIZES = (opt("sizes") ?? "375x667,390x844,430x932")
  .split(",")
  .map((s) => s.split("x").map(Number) as [number, number]);
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

/**
 * Where each game's demo can touch: `taps` = tap targets (identity: aria-label or text),
 * `board` = a grid whose cells are drag ends or placement taps, `area` = a swipe surface
 * (identity: inside it or not), `rings` = Turntable's deck (identity: the ring band).
 */
interface Spec {
  taps?: string;
  board?: { sel: string; cols: number };
  area?: string;
  rings?: string;
}
const SPECS: Record<string, Spec> = {
  unblock: { board: { sel: ".unblock-grid", cols: 7 } },
  blockparty: {
    taps: '[aria-label^="Piece"], button',
    board: { sel: '[data-game-arena="fixed"] > div', cols: 6 },
  },
  iceslide: { taps: "button", area: ".ice-board" },
  gravity: { taps: "button" },
  tiles: { taps: "button" },
  rings: { taps: "button", rings: '[data-game-arena="board"] svg' },
  laser: {
    taps: "button",
    board: { sel: '[data-polish="laser"] [data-game-arena] > div', cols: 10 },
  },
  flow: { taps: "button", board: { sel: '[data-polish="flow"] [data-game-arena] > div', cols: 9 } },
  pipes: { taps: "button" },
  push: { taps: "button", area: '[data-game-arena="board"] > div' },
  reaction: { taps: "button" },
  numhunt: { taps: "button" },
  stopwatch: { taps: '[aria-label="Stop the marker"], button' },
  symscan: { taps: "button" },
  spotdiff: { taps: 'rect[aria-label^="Cell"], button' },
  countup: { taps: "button" },
  chain: { taps: "button" },
};
/** Turntable deck: the middle of each ring's band, as a share of the deck's half-width (record = 0.86 of half). */
const RING_BANDS = [0.25, 0.42, 0.58, 0.74, 0.9].map((r) => r * 0.86);

interface Probe {
  kind: "tap" | "cell" | "area" | "ring";
  id: string;
  fx: number;
  fy: number;
}

/* In-page: every place a demo can touch, as fractions of `frame` (the recorded play area). */
function listProbes([spec, bands, frameSel]: [Spec, number[], string]): {
  w: number;
  h: number;
  probes: Probe[];
} {
  const frame = document.querySelector(frameSel)!;
  const f = frame.getBoundingClientRect();
  const stage = frame.querySelector("[data-game-stage]") ?? frame;
  const probes: Probe[] = [];
  const at = (x: number, y: number) => ({ fx: (x - f.left) / f.width, fy: (y - f.top) / f.height });
  const label = (el: Element) =>
    el.getAttribute("aria-label") ?? (el.textContent ?? "").trim().slice(0, 24);
  if (spec.taps) {
    for (const el of Array.from(stage.querySelectorAll(spec.taps))) {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8 || getComputedStyle(el).visibility === "hidden") continue;
      if (
        Array.from(el.querySelectorAll(spec.taps)).some((c) => c.getBoundingClientRect().width >= 8)
      )
        continue;
      probes.push({
        kind: "tap",
        id: label(el),
        ...at(r.left + r.width / 2, r.top + r.height / 2),
      });
    }
  }
  if (spec.board) {
    const board = stage.querySelector(spec.board.sel);
    if (board) {
      const r = board.getBoundingClientRect();
      const n = spec.board.cols;
      for (let row = 0; row < n; row++)
        for (let col = 0; col < n; col++)
          probes.push({
            kind: "cell",
            id: `cell ${row},${col}`,
            ...at(r.left + ((col + 0.5) * r.width) / n, r.top + ((row + 0.5) * r.height) / n),
          });
    } else probes.push({ kind: "cell", id: "board missing", fx: -1, fy: -1 });
  }
  if (spec.area) {
    const area = stage.querySelector(spec.area);
    if (area) {
      const r = area.getBoundingClientRect();
      for (const sx of [0.1, 0.5, 0.9])
        for (const sy of [0.1, 0.5, 0.9])
          probes.push({
            kind: "area",
            id: "swipe area",
            ...at(r.left + sx * r.width, r.top + sy * r.height),
          });
    }
  }
  if (spec.rings) {
    const deck = stage.querySelector(spec.rings);
    if (deck) {
      const r = deck.getBoundingClientRect();
      const half = r.width / 2;
      bands.forEach((band, ring) =>
        probes.push({
          kind: "ring",
          id: `ring ${ring}`,
          ...at(r.left + half, r.top + r.height / 2 + half * band),
        }),
      );
    }
  }
  return { w: Math.round(f.width), h: Math.round(f.height), probes };
}

/* In-page: what the demo player's touch at each fraction lands on. */
function resolveProbes([spec, bands, probes]: [Spec, number[], Probe[]]): string[] {
  const stageEl = document.querySelector(
    '#demo-taps-host .intro-demo > div[aria-hidden="true"]',
  ) as HTMLElement | null;
  if (!stageEl) return probes.map(() => "no demo stage");
  const s = stageEl.getBoundingClientRect();
  const stage = stageEl.querySelector("[data-game-stage]") ?? stageEl;
  const label = (el: Element) =>
    el.getAttribute("aria-label") ?? (el.textContent ?? "").trim().slice(0, 24);
  return probes.map((p) => {
    const x = s.left + p.fx * s.width;
    const y = s.top + p.fy * s.height;
    const hit = document.elementFromPoint(x, y);
    if (!hit || !stageEl.contains(hit)) return "outside the play area";
    if (p.kind === "tap") {
      const target = spec.taps ? hit.closest(spec.taps) : null;
      return target && stage.contains(target)
        ? label(target)
        : `no target (${hit.tagName.toLowerCase()})`;
    }
    const within = (sel: string) => {
      const el = stage.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        r,
        inside: x >= r.left && x < r.right && y >= r.top && y < r.bottom && el.contains(hit),
      };
    };
    if (p.kind === "cell" && spec.board) {
      const b = within(spec.board.sel);
      if (!b) return "board missing";
      if (!b.inside) return "off the board";
      const n = spec.board.cols;
      return `cell ${Math.floor(((y - b.r.top) / b.r.height) * n)},${Math.floor(((x - b.r.left) / b.r.width) * n)}`;
    }
    if (p.kind === "area" && spec.area)
      return within(spec.area)?.inside ? "swipe area" : "off the swipe area";
    if (p.kind === "ring" && spec.rings) {
      const d = within(spec.rings);
      if (!d) return "deck missing";
      const half = d.r.width / 2;
      const radius = Math.hypot(x - (d.r.left + half), y - (d.r.top + d.r.height / 2)) / half;
      let best = 0;
      bands.forEach((band, i) => {
        if (Math.abs(band - radius) < Math.abs(bands[best]! - radius)) best = i;
      });
      const edge = (bands[best]! + (bands[best + 1] ?? 1)) / 2;
      return radius > edge && best === bands.length - 1 ? "off the record" : `ring ${best}`;
    }
    return "unknown";
  });
}

async function practice(page: Page, origin: string, game: string) {
  await page.route("**/_serverFn/**", (route) => {
    const body = route.request().postData() ?? "";
    return route.continue({
      postData: body.replace(
        /("k":\["type","example"\],"v":\[\{"t":1,"s":"\w+"\},)\{"t":2,"s":3\}/,
        '$1{"t":2,"s":2}',
      ),
    });
  });
  await page.goto(`${origin}/practice`, { waitUntil: "domcontentloaded" });
  const button = page
    .getByRole("button", { name: gameDisplayName(game as PuzzleType), exact: true })
    .first();
  await button.waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1500);
  return button;
}

/** The old layout's touch points, from its practice screen (where demos were recorded). */
async function recordedProbes(browser: Browser, game: string, size: [number, number]) {
  const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
  try {
    await (await practice(page, OLD, game)).click();
    await page
      .getByRole("button", { name: /^Ready/ })
      .first()
      .click({ timeout: 90_000 });
    await page.locator("[data-game-region] [data-game-stage]").first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(2500);
    return await page.evaluate(listProbes, [SPECS[game]!, RING_BANDS, "[data-game-region]"] as [
      Spec,
      number[],
      string,
    ]);
  } finally {
    await page.close();
  }
}

/** The demo player in one tree, showing a demo of that size at layout 1, resolving each touch. */
async function replayed(
  browser: Browser,
  origin: string,
  game: string,
  w: number,
  h: number,
  probes: Probe[],
) {
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  try {
    await practice(page, origin, game);
    const ok = await page.evaluate(
      async ([type, w, h]) => {
        const fns = (await import(/* @vite-ignore */ "/src/lib/duel/practice.functions.ts")) as {
          practiceGenerateFn: (a: unknown) => Promise<{ puzzle: unknown }>;
        };
        const made = await fns.practiceGenerateFn({ data: { type, example: true } });
        const mount = (await import(/* @vite-ignore */ "/scripts/shots/demo-mount.tsx")) as {
          mountDemo: (p: unknown, l: unknown, box: number) => void;
        };
        // One touch far in the future: the demo mounts and holds its starting position.
        mount.mountDemo(
          made.puzzle,
          {
            actions: [{ t: 600_000, action: "tap", args: { at: { x: 0.5, y: 0.5 } } }],
            w,
            h,
            layout: 1,
          },
          380,
        );
        return true;
      },
      [game, w, h] as const,
    );
    if (!ok) return probes.map(() => "mount failed");
    await page
      .locator('#demo-taps-host .intro-demo > div[aria-hidden="true"] > *')
      .first()
      .waitFor({ timeout: 20_000 });
    await page.waitForTimeout(2500);
    return await page.evaluate(resolveProbes, [SPECS[game]!, RING_BANDS, probes] as [
      Spec,
      number[],
      Probe[],
    ]);
  } finally {
    await page.close();
  }
}

const games = args.filter((a) => !a.startsWith("--"));
const browser = await chromium.launch({ executablePath: CHROMIUM });
const summary: string[] = [];
try {
  for (const game of games.length ? games : Object.keys(SPECS)) {
    if (!SPECS[game]) throw new Error(`no touch spec for ${game}`);
    let misses = 0,
      total = 0,
      controlMisses = 0;
    const examples: string[] = [];
    for (const size of SIZES) {
      try {
        const rec = await recordedProbes(browser, game, size);
        const control = await replayed(browser, OLD, game, rec.w, rec.h, rec.probes);
        const now = await replayed(browser, NEW, game, rec.w, rec.h, rec.probes);
        rec.probes.forEach((p, i) => {
          total++;
          if (control[i] !== p.id) {
            controlMisses++;
            if (examples.length < 4)
              examples.push(`${size.join("x")} control: ${p.id} -> ${control[i]}`);
          } else if (now[i] !== p.id) {
            misses++;
            if (examples.length < 4) examples.push(`${size.join("x")} ${p.id} -> ${now[i]}`);
          }
        });
      } catch (error) {
        examples.push(
          `${size.join("x")} ERROR ${String((error as Error).message ?? error).split("\n")[0]}`,
        );
        controlMisses++;
      }
    }
    const verdict = controlMisses ? "UNCHECKED (control missed)" : misses ? "MISSES" : "lands";
    const line = `${game}: ${verdict}: ${misses} of ${total} touches land elsewhere today; control ${controlMisses} off${examples.length ? ` · ${examples.join(" · ")}` : ""}`;
    summary.push(line);
    console.log(line);
  }
} finally {
  await browser.close();
}
