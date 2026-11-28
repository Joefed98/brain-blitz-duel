/**
 * identity-art-check (S5 PR A, 28 Nov 2026): the rendered avatars' files, as cosmetics-art-check section 4 now
 * checks only which files an avatar's markup uses.
 *
 * 1. Every avatar id has every one of its files (the tint and Neon Glow layers, six finishes, ten gems), 280 px,
 *    within the size budget, and each file's content hash is the one the app puts on its URL.
 * 2. Every wrapper points at its image: the plain avatar at its three tint layers, each finish at its render (Neon
 *    Glow at its three layers), each gem at its render, all with the file's hash; nothing else is pointed at.
 * 3. The tinted composite (the base, the player's colour multiplied in the mask, the gloss screened on top), worked
 *    out here from the three files, matches the stored reference: Chromium drawing the app's own markup for four
 *    colours (scripts/fixtures/identity-art-reference.json.gz, `bun scripts/identity-art-record.ts`), compared in
 *    10 × 10 px blocks.
 *
 * No browser; ~10 s.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import { loadImage } from "@napi-rs/canvas";

import { AVATAR_ART, AVATAR_ART_BYTES } from "../src/design/identity/avatarArt.data";
import { AVATAR_ART_DIR, AVATARS, avatarMarkup, avatarStops } from "../src/design/identity/avatars";
import { GEMS } from "../src/design/identity/playerCardArt.data";
import { BLOCK, PX, REFERENCE_COLOURS, REFERENCE_PATH, blocksOf, composite } from "./identity-art-lib";

let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) passes++;
  else failures.push(label);
}

/** Every file a rendered avatar has. */
const FINISH_FILES: Record<string, string[]> = {
  "avatar-finish.chrome": ["chrome"],
  "avatar-finish.carbon": ["carbon"],
  "avatar-finish.comic-ink": ["comic-ink"],
  "avatar-finish.holographic": ["holographic"],
  "avatar-finish.wireframe": ["wireframe"],
  "avatar-finish.lightning-core": ["lightning-core"],
  "avatar-finish.neon-glow": ["neon-base", "neon-gloss", "neon-mask"],
};
const GEM_IDS = GEMS.map((g) => g.id);
const VARIANTS = [
  "tint-base",
  "tint-gloss",
  "tint-mask",
  ...Object.values(FINISH_FILES).flat(),
  ...GEM_IDS.map((g) => `gem-${g}`),
].sort();
/** The size budget: 24 KB a file (the largest is ~21.5 KB), 9 MB for the set. */
const FILE_BUDGET = 24 * 1024;
const TOTAL_BUDGET = 9 * 1024 * 1024;

/* 1. the files */
check(GEM_IDS.length === 10, `ten gems (${GEM_IDS.length})`);
check(VARIANTS.length === 22, `22 files an avatar (${VARIANTS.length})`);
check(AVATARS.length === 32 && AVATARS.every((a) => AVATAR_ART[a.id]), `every one of the ${AVATARS.length} avatars is rendered`);
check(Object.keys(AVATAR_ART).every((id) => AVATARS.some((a) => a.id === id)), "no renders for an avatar that doesn't exist");
let total = 0;
let largest = 0;
for (const a of AVATARS) {
  const table = AVATAR_ART[a.id] ?? {};
  check(JSON.stringify(Object.keys(table).sort()) === JSON.stringify(VARIANTS), `${a.id}: exactly its 22 files listed`);
  const dir = join("public", AVATAR_ART_DIR, a.id);
  const onDisk = existsSync(dir) ? readdirSync(dir).sort() : [];
  check(JSON.stringify(onDisk) === JSON.stringify(VARIANTS.map((v) => `${v}.webp`)), `${a.id}: exactly its 22 files on disk`);
  for (const v of VARIANTS) {
    const file = join(dir, `${v}.webp`);
    if (!existsSync(file)) {
      check(false, `${a.id}/${v}: missing`);
      continue;
    }
    const bytes = readFileSync(file);
    total += bytes.length;
    largest = Math.max(largest, bytes.length);
    check(bytes.length <= FILE_BUDGET, `${a.id}/${v}: ${bytes.length} bytes, within ${FILE_BUDGET}`);
    check(createHash("sha256").update(bytes).digest("hex").slice(0, 10) === table[v], `${a.id}/${v}: its hash is the URL's`);
    check(bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP", `${a.id}/${v}: a WebP`);
    const im = await loadImage(bytes);
    check(im.width === PX && im.height === PX, `${a.id}/${v}: ${PX} px (${im.width}×${im.height})`);
  }
}
check(total === AVATAR_ART_BYTES, `the data file's total (${AVATAR_ART_BYTES}) is the files' (${total})`);
check(total <= TOTAL_BUDGET, `the set is ${(total / 1024 / 1024).toFixed(2)} MB, within ${TOTAL_BUDGET / 1024 / 1024} MB`);
const allFiles = readdirSync(join("public", AVATAR_ART_DIR)).flatMap((d) =>
  statSync(join("public", AVATAR_ART_DIR, d)).isDirectory() ? readdirSync(join("public", AVATAR_ART_DIR, d)) : [d],
);
check(allFiles.length === 32 * 22, `public${AVATAR_ART_DIR} holds the 704 files and nothing else (${allFiles.length})`);

/* 2. each wrapper points at its image */
const url = (id: string, v: string) => `${AVATAR_ART_DIR}/${id}/${v}.webp?v=${AVATAR_ART[id][v]}`;
const hrefs = (markup: string) => [...markup.matchAll(/<image href="([^"]+)"/g)].map((m) => m[1]).sort();
const same = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify([...b].sort());
let wrappers = 0;
for (const a of AVATARS) {
  const look = { id: a.id, colour: 7, gem: null };
  const plain = avatarMarkup(look, "w-");
  const tint = ["tint-base", "tint-gloss", "tint-mask"].map((v) => url(a.id, v));
  if (same(hrefs(plain), tint) && plain.includes(`data-avatar-layers="${a.id}"`)) wrappers++;
  else check(false, `${a.id}: the plain avatar points at its three tint layers`);
  for (const [finish, files] of Object.entries(FINISH_FILES)) {
    const m = avatarMarkup({ ...look, finish }, "w-");
    if (same(hrefs(m), files.map((v) => url(a.id, v)))) wrappers++;
    else check(false, `${a.id}: ${finish} points at ${files.join(", ")}`);
  }
  for (const gem of GEM_IDS) {
    const m = avatarMarkup({ ...look, gem }, "w-");
    if (same(hrefs(m), [url(a.id, `gem-${gem}`)]) && m.includes(`data-gem="${gem}"`)) wrappers++;
    else check(false, `${a.id}: gem ${gem} points at gem-${gem}`);
  }
  // A finish takes the gem's place.
  const both = avatarMarkup({ ...look, gem: GEM_IDS[0], finish: "avatar-finish.chrome" }, "w-");
  if (same(hrefs(both), [url(a.id, "chrome")])) wrappers++;
  else check(false, `${a.id}: a finish takes a gem's place`);
}
check(wrappers === 32 * (1 + 7 + 10 + 1), `every wrapper points at its image (${wrappers} of ${32 * 19})`);

/* 3. the tinted composite against the stored reference */
const ref = JSON.parse(gunzipSync(readFileSync(REFERENCE_PATH)).toString()) as {
  size: number;
  colours: number[];
  avatars: Record<string, Record<string, string>>;
};
check(ref.size === PX / BLOCK && JSON.stringify(ref.colours) === JSON.stringify(REFERENCE_COLOURS), "the reference's shape");
/** Allowed: a mean block difference of 1.5 and no block more than 12 off on any channel (0–255). */
const MAX_MEAN = 1.5;
const MAX_BLOCK = 12;
let worstMean = 0;
let worstBlock = 0;
let matched = 0;
for (const a of AVATARS) {
  for (const colour of REFERENCE_COLOURS) {
    const stored = ref.avatars[a.id]?.[String(colour)];
    if (!stored) {
      check(false, `${a.id} colour ${colour}: in the reference`);
      continue;
    }
    const want = Buffer.from(stored, "base64");
    const [, m1] = avatarStops({ id: a.id, colour, gem: null });
    const file = (v: string) => join("public", AVATAR_ART_DIR, a.id, `${v}.webp`);
    const got = await blocksOf(await composite(file("tint-base"), file("tint-mask"), file("tint-gloss"), m1));
    let sum = 0;
    let max = 0;
    for (let i = 0; i < got.length; i++) {
      const d = Math.abs(got[i] - want[i]);
      sum += d;
      max = Math.max(max, d);
    }
    const mean = sum / got.length;
    worstMean = Math.max(worstMean, mean);
    worstBlock = Math.max(worstBlock, max);
    if (want.length === got.length && mean <= MAX_MEAN && max <= MAX_BLOCK) matched++;
    else check(false, `${a.id} colour ${colour}: composite mean ${mean.toFixed(2)}, worst block ${max}`);
  }
}
check(matched === 32 * REFERENCE_COLOURS.length, `every tinted composite matches the reference (${matched} of ${32 * REFERENCE_COLOURS.length})`);
// The composite really is tinted: two colours differ inside the mask.
const f = (v: string) => join("public", AVATAR_ART_DIR, "apex", `${v}.webp`);
const [ca, cb] = await Promise.all(
  [0, 13].map(async (c) => blocksOf(await composite(f("tint-base"), f("tint-mask"), f("tint-gloss"), avatarStops({ id: "apex", colour: c, gem: null })[1]))),
);
check(ca.some((v, i) => Math.abs(v - cb[i]) > 20), "the composite takes the player's colour");

console.log(`NOTE largest file ${largest} bytes; set ${(total / 1024 / 1024).toFixed(2)} MB; composite worst mean ${worstMean.toFixed(2)}, worst block ${worstBlock}`);
for (const f of failures.slice(0, 40)) console.log(`FAIL ${f}`);
console.log(`identity-art-check: ${passes} passed, ${failures.length} failed`);
console.log(failures.length ? "FAIL" : "PASS");
process.exit(failures.length ? 1 : 0);
