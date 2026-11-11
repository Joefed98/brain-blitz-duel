/**
 * cosmetics-art-check (wave 2, session E2, 13 Nov 2026): the remaining wave 2 cosmetics' art, without a browser.
 *
 * - src/design/identity/cosmeticsArt.data.ts is exactly what scripts/cosmetics-art.ts builds from the approved
 *   sources (docs/art/wave-2/items), and holds every avatar finish, accessory, special edition, reaction pack,
 *   celebration and tile style in the catalogue;
 * - each piece puts back together into its source: a celebration's scene with its sample avatar and "1st" is the
 *   board's svg; a tile style's back, sample glyph and front are the board's tile;
 * - every finish on every one of the 32 avatars (its own colour and a player colour) and with the accessory and the
 *   special edition is well-formed SVG whose every url(#…) names an id defined in it, all ids prefixed;
 * - with nothing equipped, every avatar's markup is exactly what it was before E2 (the same formula);
 * - every motion class the items use stops under prefers-reduced-motion;
 * - emote codes round-trip, a room shows an emote only from a player who equipped its pack, and a stand-in fetch
 *   decides that (never a guess).
 * ~2 s.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { Window } from "happy-dom";

let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}

/* 1. the data file is the build's */
const built = spawnSync("bun", ["scripts/cosmetics-art.ts", "--check"], { encoding: "utf8" });
check(built.status === 0, `cosmeticsArt.data.ts is what the sources build (${(built.stdout + built.stderr).trim()})`);

const art = await import("../src/design/identity/cosmeticsArt.data");
const cos = await import("../src/design/identity/cosmetics");
const av = await import("../src/design/identity/avatars");
const { PLAYER_COLOURS } = await import("../src/lib/duel/playerLook");

type Item = { id: string; kind: string; html: string };
const items = (JSON.parse(readFileSync("docs/art/wave-2/catalogue.json", "utf8")) as { items: Item[] }).items;
const of = (kind: string) => items.filter((i) => i.kind === kind).map((i) => i.id).sort().join();
check(Object.keys(art.FINISHES).sort().join() === of("avatar-finish") && Object.keys(art.FINISHES).length === 7, "all 7 avatar finishes");
check(Object.keys(art.ACCESSORIES).sort().join() === of("avatar-accessory"), "the accessory (Neon Bolt)");
check(Object.keys(art.SPECIAL_EDITIONS).sort().join() === of("avatar-special-edition"), "the special edition (Neon Captain Joulz)");
check(Object.keys(art.REACTIONS).sort().join() === of("reaction") && Object.keys(art.REACTIONS).length === 9, "all 9 reaction packs");
check(Object.keys(art.CELEBRATIONS).sort().join() === of("celebration") && Object.keys(art.CELEBRATIONS).length === 7, "all 7 celebrations");
check(Object.keys(art.TILE_STYLES).sort().join() === of("tile-style") && Object.keys(art.TILE_STYLES).length === 6, "all 6 tile styles");
check(art.PODIUM_ENTRANCES.join() === "celebration.circuit-overload", "Circuit Overload is the podium entrance");

/* 2. the pieces put back together into their sources */
const bodyOf = (item: Item) => {
  const html = readFileSync(`docs/art/wave-2/${item.html}`, "utf8");
  return /<div style="[^"]*" data-item="\d+">([\s\S]*)<\/div>\s*<\/body>/.exec(html)![1]!;
};
const unprefix = (s: string) => s.replaceAll("{{p}}", "");
for (const item of items.filter((i) => i.kind === "celebration")) {
  const c = art.CELEBRATIONS[item.id]!;
  const back = unprefix(c.svg)
    .replace("{{avatar}}", c.sample)
    .replace("{{place}}", "1st")
    .replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 150" width="100%" height="100%" style="display: block" aria-hidden="true">', '<svg width="240" height="150" viewBox="0 0 240 150" role="img" aria-label="celebration" style="display: block">');
  check(back === bodyOf(item), `${item.id}: the scene with its sample avatar is the board's drawing`);
}
for (const item of items.filter((i) => i.kind === "tile-style")) {
  const t = art.TILE_STYLES[item.id]!;
  const back = `<svg width="90" height="90" viewBox="0 0 90 90" aria-hidden="true" style="overflow: visible">${unprefix(t.back)}${t.sample}${unprefix(t.front)}</svg>`;
  check(back === bodyOf(item), `${item.id}: back, sample glyph and front are the board's tile`);
}
for (const item of items.filter((i) => i.kind === "reaction")) {
  const joined = art.REACTIONS[item.id]!.map((e) => unprefix(e.svg)).join("");
  check(joined === bodyOf(item), `${item.id}: its emotes are the board's (${art.REACTIONS[item.id]!.length})`);
}

/* 3. well-formed, every reference defined, ids prefixed */
const win = new Window();
const parser = new win.DOMParser();
function wellFormed(svg: string, label: string): void {
  const doc = parser.parseFromString(svg, "image/svg+xml");
  const ok = !doc.querySelector("parsererror") && doc.documentElement?.nodeName.toLowerCase() === "svg";
  const ids = new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!));
  const refs = [...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]!);
  const missing = refs.filter((r) => !ids.has(r));
  const dup = [...svg.matchAll(/\sid="([^"]+)"/g)].length !== ids.size;
  if (!ok || missing.length || dup) check(false, `${label}: ${!ok ? "not well-formed" : ""}${missing.length ? ` undefined ${missing.slice(0, 2).join(",")}` : ""}${dup ? " duplicate ids" : ""}`);
  else passes++;
}
const all = JSON.stringify([art.FINISHES, art.ACCESSORIES, art.SPECIAL_EDITIONS, art.REACTIONS, art.CELEBRATIONS, art.TILE_STYLES]);
check(![...all.matchAll(/\sid=\\"([^"\\]+)\\"/g)].some((m) => !m[1]!.startsWith("{{p}}")), "every id in the art is prefixed per drawing");
let dressed = 0;
for (const a of av.AVATARS) {
  for (const colour of [-1, 5]) {
    for (const finish of Object.keys(art.FINISHES)) {
      const svg = av.avatarMarkup({ id: a.id, colour, gem: null, finish, accessory: "avatar-accessory.neon-bolt" }, `t${dressed}-`);
      wellFormed(svg, `${a.id} (colour ${colour}) in ${finish} with the Neon Bolt`);
      const f = art.FINISHES[finish]!;
      if (f.filter && !svg.includes("filter: drop-shadow")) check(false, `${a.id} ${finish}: the glow`);
      if (f.outer && !svg.includes(f.outer.slice(0, 30).replaceAll("{{p}}", `t${dressed}-`))) check(false, `${a.id} ${finish}: the outer art`);
      if (f.paint && svg.includes(`fill="url(#t${dressed}-${/id="([^"]*av\d+m)"/.exec(a.svg)?.[1]?.replace("{{p}}", "") ?? "??"})"`))
        check(false, `${a.id} ${finish}: the main colour still unpainted`);
      dressed++;
    }
  }
  const special = av.avatarMarkup({ id: a.id, colour: 2, gem: null, special: "avatar-special-edition.neon-captain-joulz" }, "sp-");
  wellFormed(special, `${a.id} as the special edition`);
  check(special.includes("#2A0838") && !special.includes("aria-label"), `${a.id}: the special edition draws in its place`);
}
check(dressed === 32 * 2 * 7, `${dressed} dressed avatars drawn`);

/* 4. nothing equipped: exactly as before */
let same = 0;
for (const a of av.AVATARS) {
  for (const colour of [-1, 0, 7, 31]) {
    const look = { id: a.id, colour, gem: null };
    const [m0, m1, m2] = av.avatarStops(look);
    const before = a.svg.replaceAll("{{p}}", "x-").replace("{{m0}}", m0).replace("{{m1}}", m1).replace("{{m2}}", m2);
    if (av.avatarMarkup(look, "x-") === before && av.avatarMarkup({ ...look, finish: null, accessory: null, special: null }, "x-") === before) same++;
    if (av.avatarMarkup({ ...look, finish: "avatar-finish.nope" }, "x-") === before) same++;
  }
}
check(same === 32 * 4 * 2, `with nothing equipped (or an unknown item) every avatar is exactly as before (${same} of ${32 * 4 * 2})`);
check(!cos.hasCosmetics(null) && !cos.hasCosmetics({}) && cos.hasCosmetics({ finish: "avatar-finish.chrome" }), "hasCosmetics");

/* 5. motion stops under reduced motion */
const css = art.COSMETICS_MOTION_CSS;
const reduced = /@media \(prefers-reduced-motion: reduce\)\{([^}]*\}[^}]*\})/.exec(css)?.[1] ?? "";
const used = new Set([...all.matchAll(/class=\\"([^"\\]+)\\"/g)].flatMap((m) => m[1]!.split(/\s+/)).filter((c) => /^(lg|cl)-/.test(c)));
for (const cls of used) {
  const base = cls.replace(/\d+$/, "");
  check(reduced.includes(`.jzc .${base}`) || !/^(lg-glow|lg-tw|cl-fall|lg-zap)$/.test(base), `.${cls}: stops under prefers-reduced-motion`);
}
check(/\.jzc\[data-rest\] \*\{animation:none !important\}/.test(css), "a celebration that has played rests on its still");
check(art.ANIMATED_COSMETICS.includes("avatar-finish.lightning-core") && art.ANIMATED_COSMETICS.includes("reaction.live-wire") && art.ANIMATED_COSMETICS.includes("celebration.power-surge"), "the Legendaries and Live Wire animate");

/* 6. emotes and who may send them */
const code = cos.emoteCode("reaction.banter", 2);
check(cos.emoteOf(code)?.label === "HOW?!" && cos.emoteOf(code)?.pack === "reaction.banter", "an emote code round-trips (Banter's HOW?!)");
check(cos.emoteOf("reaction.banter#9") === null && cos.emoteOf("reaction.nope#0") === null && cos.emoteOf("👍") === null && cos.emoteOf("<svg>") === null, "unknown codes are nothing");
const store = await import("../src/lib/cosmetics/cosmeticsStore");
const { isRoomReaction } = await import("../src/lib/duel/roomReactions");
let asked: string[] = [];
store.setCosmeticsFetcher(async (ids) => {
  asked = ids;
  return ids.filter((id) => id === "owner").map((id) => ({ userId: id, avatar: null, finish: null, accessory: null, special: null, celebration: null, entrance: null, reactions: ["reaction.banter"], plusMark: false }));
});
check(isRoomReaction("👍", "anyone"), "the room's emoji are for everyone");
check(!isRoomReaction(code, "owner"), "an emote from a player not yet known is not shown (and they are asked for)");
await new Promise((r) => setTimeout(r, 10));
check(asked.includes("owner"), "the sender's cosmetics are fetched");
check(isRoomReaction(code, "owner"), "then the owner's emote shows");
store.loadCosmetics(["other"]);
await new Promise((r) => setTimeout(r, 10));
check(!isRoomReaction(code, "other"), "never from a player who didn't equip the pack");
check(!isRoomReaction(cos.emoteCode("reaction.live-wire", 0), "owner"), "nor a pack the owner didn't equip");
store.setCosmeticsFetcher(null);
store.resetCosmetics();

/* 7. a scene and a tile with a real avatar */
const scene = cos.celebrationScene("celebration.power-surge", "c-", av.avatarMarkup({ id: "orbit", colour: 4, gem: null }, "c-v-"), "2nd");
check(!!scene && !scene.includes("{{") && scene.includes(">2nd<") && scene.includes('x="102" y="56" width="36" height="36"'), "a celebration draws the player's own avatar and place");
if (scene) wellFormed(scene, "a celebration scene with a real avatar");
const tile = cos.tileStyleArt("tile-style.neon-grid", "g-");
check(!!tile && !tile.back.includes("{{") && !tile.back.includes('width="9" height="9"'), "a tile style without its sample glyph");
check(cos.tileStyleArt("tile-style.nope", "") === null && cos.celebrationScene("celebration.nope", "", null, "1st") === null, "unknown ids draw nothing");

console.log(`cosmetics-art-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS");
process.exit(0);
