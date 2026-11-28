/**
 * The ten gems (S5 PR A): two phone shots of the ten gems (five each) on an avatar, at the sizes the app draws them (96 px, the
 * full card's size, and 40 px, a row's), 375 × 667, dark and light, DPR 2. Not a check.
 *
 *   bun scripts/shots/gem-sheet-shots.ts --tag=before|after [--root=<checkout>] [--out=<dir>] [--avatar=apex]
 *
 * --root draws another checkout's avatars (main's flat drawings for "before"), served from its own public/.
 */
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { chromium } from "playwright";

import { CHROMIUM_PATHS } from "../theme-screens";

const args = process.argv.slice(2);
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const tag = opt("tag") ?? "shot";
const root = resolve(opt("root") ?? ".");
const out = opt("out") ?? ".shots/identity";
const avatar = opt("avatar") ?? "apex";

const av = await import(join(root, "src/design/identity/avatars.ts"));
const gems: { id: string; name: string }[] = av.GEMS;
const THEMES = { dark: { bg: "#04060C", text: "#EEF2FF", well: "#090D1A" }, light: { bg: "#F3F4F8", text: "#0B1020", well: "#FFFFFF" } };

const server = Bun.serve({
  port: 0,
  fetch(req) {
    const path = new URL(req.url).pathname;
    if (path.startsWith("/fonts/") || path.startsWith("/identity/")) return new Response(Bun.file(join(root, "public", path)));
    return new Response("<!doctype html><html></html>", { headers: { "content-type": "text/html" } });
  },
});

function page(theme: keyof typeof THEMES, half: number): string {
  const t = THEMES[theme];
  const cell = (g: { id: string; name: string }, i: number) => {
    const look = { id: avatar, colour: 7, gem: g.id };
    const big = av.avatarMarkup(look, `b${i}-`);
    const small = av.avatarMarkup(look, `s${i}-`);
    return `<div class="c"><div class="w" style="width:96px;height:96px">${big}</div><div class="w" style="width:40px;height:40px">${small}</div><span>${g.name}</span></div>`;
  };
  return `<!doctype html><html><head><style>
    @font-face { font-family: Archivo; src: url(/fonts/archivo-var-latin.woff2); font-weight: 100 900; }
    body { margin: 0; background: ${t.bg}; color: ${t.text}; font: 600 13px Archivo, sans-serif; }
    h1 { font-size: 16px; margin: 14px 16px 6px; }
    .g { display: grid; grid-template-columns: 1fr; gap: 8px; padding: 0 16px; }
    .c { display: flex; align-items: center; gap: 10px; background: ${t.well}; border-radius: 10px; padding: 6px 10px; }
    .w { flex: none; }
    span { min-width: 0; }
  </style></head><body><h1>Gems ${half * 5 + 1}–${half * 5 + 5} · ${avatar} · ${tag}</h1><div class="g">${gems.slice(half * 5, half * 5 + 5).map((g, i) => cell(g, half * 5 + i)).join("")}</div></body></html>`;
}

const exe = CHROMIUM_PATHS.find((p) => p && existsSync(p));
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const dir = join(out, tag);
mkdirSync(dir, { recursive: true });
for (const theme of ["dark", "light"] as const) for (const half of [0, 1]) {
  const p = await browser.newPage({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 });
  await p.goto(`http://localhost:${server.port}/`);
  await p.setContent(page(theme, half));
  await p.evaluate(() => Promise.all([...document.querySelectorAll("image")].map((i) => new Promise((r) => { const im = new Image(); im.onload = r; im.onerror = r; im.src = i.getAttribute("href")!; }))));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  const file = join(dir, `gems-${half + 1}-of-2${theme === "light" ? "-light" : ""}.png`);
  await p.screenshot({ path: file });
  console.log(file);
  await p.close();
}
await browser.close();
server.stop();
