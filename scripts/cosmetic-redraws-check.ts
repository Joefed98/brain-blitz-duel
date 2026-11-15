/**
 * cosmetic-redraws-check (phase 2 step 4, 15 Nov 2026; docs/design/cosmetics-redraws/): the redrawn cosmetics sit
 * beside today's art behind one switch per item, and a switch changes only the drawing. No browser, ~2 s.
 *
 * 1. src/design/identity/redrawnArt.data.ts is what scripts/cosmetic-redraws.ts builds, and every 3D piece it names
 *    is a WebP in public/cosmetics/redrawn (none unused, none over 80 KB), kept out of the offline download.
 * 2. The switches: every listed item is a catalogue item; every identity item has its redraw in the right map; every
 *    in-game look is drawn behind its switch in src/lib/arcade/skins; with a switch off its item draws exactly the
 *    approved art (liveArt's maps hold the approved values), with it on the redraw.
 * 3. A switch changes only the drawing: nothing that sells, gives, owns, prices or withdraws an item (the economy,
 *    shop, pass, Plus, seasons, badges, tournaments, rated rewards, migrations) reads it.
 * 4. The redraws' markup: ids prefixed per drawing, every url(#…) defined, every frame and its crest inside the
 *    card's 300 × 112 box (nothing over the score beside a strip), every name colour keeps a dark edge, every motion
 *    stops under prefers-reduced-motion, and every item the catalogue marks animated still moves.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}

/* 1. the build and its pieces */
const built = spawnSync("bun", ["scripts/cosmetic-redraws.ts", "--check"], { cwd: ROOT, encoding: "utf8" });
check(built.status === 0, `redrawnArt.data.ts is what the sources build (${(built.stdout + built.stderr).trim()})`);

const R = await import("../src/design/identity/redrawnArt.data");
const live = await import("../src/design/identity/liveArt");
const card = await import("../src/design/identity/playerCardArt.data");
const approved = await import("../src/design/identity/cosmeticsArt.data");
const { REDRAWN_ART_ON, redrawnArtOn } = await import("../src/config/cosmeticRedraws");
const { keepPublicFile } = await import("../src/lib/offline/assets");

const PIECES = join(ROOT, "public/cosmetics/redrawn");
const files = readdirSync(PIECES);
const allMarkup = JSON.stringify([R.REDRAWN_CARD_ARTS, R.REDRAWN_FRAMES, R.REDRAWN_FINISHES, R.REDRAWN_ACCESSORIES, R.REDRAWN_REACTIONS, R.REDRAWN_CELEBRATIONS, R.REDRAWN_TILE_STYLES]);
const referenced = new Set([...allMarkup.matchAll(/\/cosmetics\/redrawn\/([\w.-]+)\.webp/g)].map((m) => m[1]!));
check([...referenced].sort().join() === [...R.REDRAWN_PIECES].sort().join(), `REDRAWN_PIECES lists exactly the pieces the markup draws (${referenced.size})`);
for (const piece of R.REDRAWN_PIECES) {
  const f = join(PIECES, `${piece}.webp`);
  if (!existsSync(f)) {
    check(false, `${piece}.webp exists`);
    continue;
  }
  const head = readFileSync(f).subarray(0, 12);
  check(head.toString("latin1", 0, 4) === "RIFF" && head.toString("latin1", 8, 12) === "WEBP", `${piece} is a WebP`);
  check(statSync(f).size <= 80 * 1024, `${piece} is at most 80 KB (${(statSync(f).size / 1024).toFixed(1)} KB)`);
}
check(files.every((f) => referenced.has(f.replace(/\.webp$/, ""))), `no unused piece in public/cosmetics/redrawn (${files.filter((f) => !referenced.has(f.replace(/\.webp$/, ""))).join(", ") || "none"})`);
check(!keepPublicFile("/cosmetics/redrawn/card-art.lava.webp") && keepPublicFile("/tiles/pool.webp"), "the pieces stay out of the offline download (other public files kept)");

/* 2. the switches */
type Item = { id: string; kind: string; animated?: boolean };
const catalogue = [
  ...(JSON.parse(readFileSync(join(ROOT, "docs/art/wave-2/catalogue.json"), "utf8")).items as Item[]),
  ...(JSON.parse(readFileSync(join(ROOT, "docs/art/wave-4/catalogue.json"), "utf8")).items as Item[]),
];
const byId = new Map(catalogue.map((i) => [i.id, i]));
const ids = Object.keys(REDRAWN_ART_ON);
check(ids.length > 0 && ids.every((id) => byId.has(id)), `every switch names a catalogue item (${ids.length} items)`);
check(ids.every((id) => typeof REDRAWN_ART_ON[id] === "boolean"), "every switch is true or false");
check(!redrawnArtOn("card-art.circuit") && !redrawnArtOn(null) && !redrawnArtOn("nothing"), "an item with no switch draws today's art");
// The switch file holds one line per item, so each is a one-line change.
const configText = readFileSync(join(ROOT, "src/config/cosmeticRedraws.ts"), "utf8");
for (const id of ids) check(new RegExp(`^  "${id.replace(/\./g, "\\.")}": (true|false),$`, "m").test(configText), `${id}: its switch is one line`);

const MAP_OF: Record<string, [Record<string, unknown>, Record<string, unknown>, Record<string, unknown>]> = {
  "card-art": [live.CARD_ARTS, card.CARD_ARTS, R.REDRAWN_CARD_ARTS],
  frame: [live.FRAMES, card.FRAMES, R.REDRAWN_FRAMES],
  "name-colour": [live.NAME_COLOURS, card.NAME_COLOURS, R.REDRAWN_NAME_COLOURS],
  "avatar-finish": [live.FINISHES, approved.FINISHES, R.REDRAWN_FINISHES],
  "avatar-accessory": [live.ACCESSORIES, approved.ACCESSORIES, R.REDRAWN_ACCESSORIES],
  reaction: [live.REACTIONS, approved.REACTIONS, R.REDRAWN_REACTIONS],
  celebration: [live.CELEBRATIONS, approved.CELEBRATIONS, R.REDRAWN_CELEBRATIONS],
  "tile-style": [live.TILE_STYLES, approved.TILE_STYLES, R.REDRAWN_TILE_STYLES],
};
const GAME_KINDS = ["game-skin", "world-theme", "card-back"];
const skinsSrc = readdirSync(join(ROOT, "src/lib/arcade/skins"))
  .map((f) => readFileSync(join(ROOT, "src/lib/arcade/skins", f), "utf8"))
  .join("\n");
for (const id of ids) {
  const kind = byId.get(id)!.kind;
  if (GAME_KINDS.includes(kind)) {
    check(new RegExp(`skinRedrawn\\(\\s*["']${id.replace(/\./g, "\\.")}["']`).test(skinsSrc) || new RegExp(`["']${id.replace(/\./g, "\\.")}["']`).test(skinsSrc), `${id}: drawn behind its switch in src/lib/arcade/skins`);
    continue;
  }
  const m = MAP_OF[kind];
  if (!m) {
    check(false, `${id}: a kind the redraws know (${kind})`);
    continue;
  }
  const [liveMap, base, red] = m;
  check(id in red, `${id}: its redraw is in the ${kind} map`);
  // Off: exactly the approved art (or nothing where there was none: the Championship frame draws the Plain frame).
  if (!redrawnArtOn(id)) check(liveMap[id] === base[id], `${id}: switch off, today's art exactly`);
  else check(liveMap[id] === red[id], `${id}: switch on, the redraw`);
}
// Every item's switch drives the maps both ways (liveMap with the switch forced).
const forced = live.liveMap(card.CARD_ARTS, R.REDRAWN_CARD_ARTS, () => true);
const none = live.liveMap(card.CARD_ARTS, R.REDRAWN_CARD_ARTS, () => false);
check(none === card.CARD_ARTS, "every switch off: the approved map itself");
check(Object.keys(R.REDRAWN_CARD_ARTS).every((id) => forced[id] === R.REDRAWN_CARD_ARTS[id]) && forced["card-art.circuit"] === card.CARD_ARTS["card-art.circuit"], "a switch on: that item's redraw, every other item's approved art");
check(live.liveCss("base", { a: "x" }, () => false) === "base" && live.liveCss("base", { a: "x" }, () => true) === "base\nx", "a redraw's motion is added only with its switch on");
if (ids.every((id) => !redrawnArtOn(id))) {
  check(live.CARD_MOTION_CSS === card.CARD_MOTION_CSS && live.COSMETICS_MOTION_CSS === approved.COSMETICS_MOTION_CSS, "every switch off: the motion CSS is exactly today's");
  for (const [kind, [l, b]] of Object.entries(MAP_OF)) check(l === b, `every switch off: the live ${kind} map is the approved map itself`);
}

/* 3. a switch never reaches what is offered, owned, priced or withdrawn */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}
const readers = walk(join(ROOT, "src"))
  .filter((f) => /\.(ts|tsx)$/.test(f))
  .filter((f) => /from ["'][^"']*(cosmeticRedraws|redrawnArt\.data)["']/.test(readFileSync(f, "utf8")))
  .map((f) => f.slice(ROOT.length + 1))
  .sort();
const ALLOWED = [/^src\/config\/cosmeticRedraws\.ts$/, /^src\/design\/identity\/(liveArt|redrawnArt\.data)\.ts$/, /^src\/lib\/arcade\/skins\//];
check(readers.every((f) => ALLOWED.some((re) => re.test(f))), `only drawing code reads the switches (${readers.join(", ")})`);
const migrations = readdirSync(join(ROOT, "supabase/migrations"));
check(migrations.every((f) => !/cosmeticRedraws|cosmetic-redraws|cosmetics\/redrawn/.test(readFileSync(join(ROOT, "supabase/migrations", f), "utf8"))), "no migration mentions the redraws (nothing restored, withdrawn, given or priced)");

/* 4. the markup */
function wellFormed(id: string, markup: string): void {
  const filled = markup.replaceAll("{{p}}", "X-");
  const defined = new Set([...filled.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!));
  const used = [...filled.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]!);
  check(used.every((u) => defined.has(u)), `${id}: every url(#…) is defined`);
  check([...defined].every((d) => d.startsWith("X-")), `${id}: every id is prefixed per drawing`);
}
for (const [id, m] of Object.entries(R.REDRAWN_CARD_ARTS)) wellFormed(id, m);
for (const [id, f] of Object.entries(R.REDRAWN_FRAMES)) {
  wellFormed(id, f.markup);
  for (const img of f.markup.matchAll(/<image [^>]*x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)) {
    const [x, y, w, h] = img.slice(1, 5).map(Number) as [number, number, number, number];
    check(x >= -2 && y >= -2 && x + w <= 302 && y + h <= 114, `${id}: its pieces stay inside the card's box (${x},${y} ${w}×${h})`);
  }
}
for (const [id, c] of Object.entries(R.REDRAWN_CELEBRATIONS)) {
  wellFormed(id, c.svg);
  check(c.svg.includes("{{avatar}}") && c.svg.includes("{{place}}"), `${id}: draws the winner's avatar and place`);
}
for (const [id, t] of Object.entries(R.REDRAWN_TILE_STYLES)) wellFormed(id, t.back + t.front);
for (const [id, f] of Object.entries(R.REDRAWN_FINISHES)) wellFormed(id, `<svg>${f.defs}${f.overlay ?? ""}${f.outer}</svg>`);
for (const [id, n] of Object.entries(R.REDRAWN_NAME_COLOURS)) check(/#06080F/.test(n.style["filter"] ?? ""), `${id}: the name keeps a dark edge`);
for (const [id, pack] of Object.entries(R.REDRAWN_REACTIONS)) {
  const before = approved.REACTIONS[id]!;
  check(pack.length === before.length && pack.every((e, i) => e.label === before[i]!.label), `${id}: the same emotes, in order, with their labels`);
  const size = (s: string) => /<svg width="(\d+)" height="(\d+)"/.exec(s)?.slice(1).join("x");
  check(pack.every((e, i) => size(e.svg) === size(before[i]!.svg)), `${id}: each emote at its approved size`);
}
const css = [...Object.values(R.REDRAWN_CARD_CSS), ...Object.values(R.REDRAWN_COSMETICS_CSS)].join("\n");
for (const cls of new Set([...css.matchAll(/\.(rd-[\w-]+)\{animation/g)].map((m) => m[1]!)))
  check(new RegExp(`prefers-reduced-motion[^\\n]*\\.${cls}\\b`).test(css), `.${cls} stops under prefers-reduced-motion`);
for (const id of ids) {
  const it = byId.get(id)!;
  if (!it.animated || GAME_KINDS.includes(it.kind)) continue;
  check(!!(R.REDRAWN_CARD_CSS[id] ?? R.REDRAWN_COSMETICS_CSS[id]), `${id}: animated in the catalogue, its redraw still moves`);
}

console.log(`\ncosmetic-redraws-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
