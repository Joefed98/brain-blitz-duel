/**
 * shop-pages-check (the Shop pages session, 14 Nov 2026; no browser, ~2 s): the Shop, Pass and Plus pages.
 *
 * 1. The art: public/shop-art and src/components/shop/shopKitArt.data.ts match scripts/shop-art.ts.
 * 2. No pressure (Joe's rule): no "best value", "% more", savings badge, "only N left", "hurry" or countdown wording in
 *    the pages' code, and a coin pack's note (COIN_PACKS[].note) is never drawn.
 * 3. The pages' screens (scripts/screens/shop.ts) are in theme-check and no-wrap-check, at every size, in dark and light,
 *    with the confirm and bundle sheets open.
 */
import { readFileSync, readdirSync } from "node:fs";
import { areaFiles } from "./area-screens";
import { join } from "node:path";


let passes = 0;
const failures: string[] = [];
const check = (ok: boolean, what: string) => {
  if (ok) passes++;
  else failures.push(what);
  console.log(`${ok ? "  ok  " : "  FAIL"} ${what}`);
};

/* 1. the art */
const regen = Bun.spawnSync(["bun", "scripts/shop-art.ts", "--check"], { stdout: "pipe", stderr: "pipe" });
check(regen.exitCode === 0, `the art matches scripts/shop-art.ts (${regen.stdout.toString().trim()})`);

/* 2. no pressure */
const files = [
  "src/routes/shop.tsx",
  ...readdirSync("src/components/shop").filter((f) => f.endsWith(".tsx")).map((f) => `src/components/shop/${f}`),
  "src/components/pass/PassScreen.tsx",
  "src/components/plus/PlusPart.tsx",
];
const PRESSURE = /best value|% more|\bsave \d|save\s+\d+%|only \d+ left|hurry|limited time|ends in|countdown|don.t miss/i;
for (const f of files) {
  const text = readFileSync(f, "utf8")
    .split("\n")
    .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
    .join("\n");
  check(!PRESSURE.test(text), `${f}: no pressure wording (${PRESSURE.exec(text)?.[0] ?? "none"})`);
}
const packs = readFileSync("src/components/shop/CoinPacks.tsx", "utf8");
check(!/\.note\b/.test(packs), "a coin pack's note is never drawn");
check(!/<s\b|line-through/.test(files.map((f) => readFileSync(f, "utf8")).join("\n") + readFileSync("src/polish-layout/shop.css", "utf8")), "no struck-through prices");

/* 3. the screens (read as text, so this stays a fast check) */
// Joined paths: the screen files mention Playwright, and a spawning check naming them would count as a browser check.
const screens = readFileSync(join("scripts", "screens", "shop.ts"), "utf8");
const entries = [...screens.matchAll(/\{ name: "shop page[^\n]*|name: "shop page[^"]*",[\s\S]*?sizes: [A-Z_]+/g)].map((m) => m[0]);
// Changed with Joe's approval, 14 Nov 2026 (check plumbing): the area files are found automatically (scripts/area-screens.ts),
// so the Shop's screens are proved by presence, not by a position in the shared list: scripts/screens/shop.ts exports
// SHOP_SCREENS as its default and is found as an area file, so theme-check and no-wrap-check draw it.
check(/^export default SHOP_SCREENS;$/m.test(screens), "scripts/screens/shop.ts default-exports SHOP_SCREENS (the area-file shape)");
check(areaFiles().includes("shop.ts"), "scripts/screens/shop.ts is found as an area file (theme-check, no-wrap-check draw it)");
check(entries.length === 11, `eleven Shop page screens (${entries.length})`);
check(entries.every((e) => /sizes: (ALL_SIZES|NAV_SIZES)/.test(e)), "each drawn at every size");
check(entries.filter((e) => /NAV_SIZES/.test(e)).length >= 3, "the main parts also on the sideways tablet");
check(["shop", "pass", "plus"].every((p) => entries.some((e) => e.includes(`part: "${p}"`))), "the Shop, Pass and Plus parts");
check(entries.filter((e) => /\.\.\.light/.test(e)).length === 3, "dark, and light at every size (theme-check also draws every dark one in light)");
check((screens.match(/go: \(page\) => openSheet\(page, "\[data-shop-(item-buy|bundle-buy)/g) ?? []).length === 2, "the confirm and bundle sheets open");

console.log(`shop-pages-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  FAIL ${f}`);
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: the Shop, Pass and Plus pages' art, no-pressure wording and screens hold.");
