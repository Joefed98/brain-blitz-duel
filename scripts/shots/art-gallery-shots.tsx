/**
 * The reward art gallery for review (design foundation F5, 6 Nov 2026; a design tool, not a check): the real
 * Emblem, Medal, Trophy and Badge components rendered to static HTML over tokens.css and components.css and
 * photographed in headless Chromium at 2x. /dev-design shows the same set in the running app.
 *
 *   bun scripts/shots/art-gallery-shots.tsx [--out=screenshots/art-f5-nov-2026/reward-gallery.png]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import { Badge, Emblem, Trophy, TROPHY_SIZES } from "../../src/design/art";
import { Medal } from "../../src/design/components/Medal";
const R = resolve(".");
const css = readFileSync(`${R}/src/design/tokens.css`, "utf8").replace(/url\("\/fonts\//g, `url("file://${R}/public/fonts/`) + readFileSync(`${R}/src/design/components.css`, "utf8");
const tiers = ["spark", "charge", "volt", "surge", "storm", "lightning"] as const;
const L = (t: string) => <div className="lab">{t}</div>;
const page = (
  <div className="wrap">
    <h1>Joulz art v1 · the reward set (design foundation F5)</h1>
    {L("Rank emblems, 150 px: division II, Lightning #37")}
    <div className="row">{tiers.map((t) => <Emblem key={t} tier={t} size={150} division={t === "lightning" ? undefined : 2} rank={t === "lightning" ? 37 : undefined} />)}</div>
    {L("Divisions III, II, I (Volt, 64 px) · at standings size, 28 px")}
    <div className="row">{([3, 2, 1] as const).map((d) => <Emblem key={d} tier="volt" size={64} division={d} />)}<span style={{ width: 32 }} />{tiers.map((t) => <Emblem key={t} tier={t} size={28} marker={false} />)}</div>
    {L("Medals at 22, 36 and 64 px: gold, silver, bronze, 4th, shared 1st")}
    {(["s", "m", "l"] as const).map((s) => <div key={s} className="row">{[1, 2, 3, 4].map((p) => <Medal key={p} place={p} size={s} />)}<Medal place={1} shared size={s} /></div>)}
    {L("Trophies at their board sizes")}
    <div className="row bottom">{(["bronze", "silver", "gold", "championship"] as const).map((k) => <Trophy key={k} kind={k} size={TROPHY_SIZES[k]} />)}</div>
    {L("Badges, 104 px (founder #0042 and #1337 are data) and 48 px")}
    <div className="row">{(["winner", "arena", "club", "founder"] as const).map((k) => <Badge key={k} kind={k} player={42} />)}<Badge kind="founder" player={1337} /></div>
    <div className="row">{(["winner", "arena", "club", "founder"] as const).map((k) => <Badge key={k} kind={k} player={42} size={48} />)}</div>
  </div>
);
const html = `<!doctype html><meta charset=utf-8><style>${css}
body{margin:0;background:var(--jz-bg);color:var(--jz-text);font-family:var(--jz-font)}
.wrap{padding:24px;width:960px;display:flex;flex-direction:column;gap:12px}
h1{font-size:22px;font-weight:800;margin:0 0 4px}.lab{font-size:12px;font-weight:600;color:var(--jz-text-3);margin-top:10px}
.row{display:flex;gap:20px;align-items:center;flex-wrap:wrap;background:var(--jz-surface);border-radius:8px;padding:14px}.bottom{align-items:flex-end}
</style>${renderToStaticMarkup(page)}`;
const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/art-f5-nov-2026/reward-gallery.png";
mkdirSync(dirname(OUT), { recursive: true });
const HTML = resolve(".shots/art-gallery.html");
mkdirSync(dirname(HTML), { recursive: true });
writeFileSync(HTML, html);
const CHROMIUM = [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find((path): path is string => Boolean(path && existsSync(path)));
const b = await chromium.launch({ executablePath: CHROMIUM }); const p = await b.newPage({ viewport: { width: 1008, height: 800 }, deviceScaleFactor: 2 });
await p.goto(`file://${HTML}`); await p.waitForTimeout(500);
await p.screenshot({ path: OUT, fullPage: true }); await b.close();
