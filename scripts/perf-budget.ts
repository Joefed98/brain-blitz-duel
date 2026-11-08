/**
 * Speed budget (a tool, not a check; docs/audit-nov-2026/performance.md findings 1 and 5).
 *
 *   bun scripts/perf-budget.ts [--out=.output] [--json]
 *
 * First screen: reads the production build's TanStack Start manifest (run `bun run build` first) and adds up
 * every file the Play tab's first load asks for: the root route's and "/"'s preloads and CSS, the app
 * stylesheet the root links, and every JS file those import statically (followed through the chunks
 * themselves, so nothing the browser must fetch before the first screen is missed). Dynamic `import()`s
 * (the game chunks) are not followed. Raw bytes from stat, gzip from zlib at level 9.
 *
 * First tap: the sound files the first tap fetches and decodes (`firstTapSoundUrls` in src/lib/sound.ts,
 * or every effect and voice file with --all-sounds, the rule before the split), with their decoded size as
 * Web Audio holds it: duration × channels × 48 kHz × 4 bytes, durations from ffprobe.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const OUT = arg("out") ?? ".output";
const json = process.argv.includes("--json");
const allSounds = process.argv.includes("--all-sounds");

function routeLoad(routes: string[]): { files: number; raw: number; gzip: number; largest: [string, number, number][] } {
  const serverDir = join(OUT, "server");
  const manifestFile = readdirSync(serverDir).find((f) => f.startsWith("_tanstack-start-manifest"));
  if (!manifestFile) throw new Error(`no TanStack Start manifest in ${serverDir}: run bun run build first`);
  const manifestSrc = readFileSync(join(serverDir, manifestFile), "utf8");
  const routeBlock = (id: string): string => {
    const at = manifestSrc.indexOf(`${id}: {`);
    if (at < 0) throw new Error(`route ${id} not in the manifest`);
    const next = manifestSrc.indexOf("\n\t\"/", at + 1);
    const nextRoot = manifestSrc.indexOf("\n\t__", at + 1);
    const ends = [next, nextRoot].filter((n) => n > at);
    return manifestSrc.slice(at, ends.length ? Math.min(...ends) : undefined);
  };
  const assetsIn = (block: string) => [...block.matchAll(/"(\/assets\/[^"]+)"/g)].map((m) => m[1]!);
  const wanted = new Set<string>(routes.flatMap((r) => assetsIn(routeBlock(r))));
  // The app stylesheet the root links (styles.css?url), found in the server's router chunk.
  const ssrDir = join(serverDir, "_ssr");
  for (const file of existsSync(ssrDir) ? readdirSync(ssrDir) : []) {
    if (!file.startsWith("router-")) continue;
    for (const m of readFileSync(join(ssrDir, file), "utf8").matchAll(/"(\/assets\/styles-[^"]+\.css)"/g)) wanted.add(m[1]!);
  }
  const pub = join(OUT, "public");
  const queue = [...wanted];
  while (queue.length) {
    const asset = queue.pop()!;
    if (!asset.endsWith(".js")) continue;
    const src = readFileSync(join(pub, asset), "utf8");
    // Static imports only: `import ... from "./x.js"` and `import "./x.js"` (never `import("./x.js")`).
    for (const m of src.matchAll(/(?:\bfrom|\bimport)\s*["'](\.\/[^"']+\.js)["']/g)) {
      const dep = `/assets/${m[1]!.slice(2)}`;
      if (!wanted.has(dep)) {
        wanted.add(dep);
        queue.push(dep);
      }
    }
  }
  let raw = 0;
  let gzip = 0;
  const sizes: [string, number, number][] = [];
  for (const asset of wanted) {
    const path = join(pub, asset);
    const bytes = statSync(path).size;
    const gz = gzipSync(readFileSync(path), { level: 9 }).length;
    raw += bytes;
    gzip += gz;
    sizes.push([asset, bytes, gz]);
  }
  sizes.sort((a, b) => b[1] - a[1]);
  return { files: wanted.size, raw, gzip, largest: sizes.slice(0, 8) };
}

async function firstTap(): Promise<{ files: number; bytes: number; decodedMb: number; seconds: number }> {
  const { SOUND_MANIFEST } = await import("../src/lib/fx/manifest");
  let urls: string[];
  if (allSounds) {
    urls = [...new Set(Object.values(SOUND_MANIFEST).flatMap((e) => (e.url && e.channel !== "music" ? [e.url] : [])))];
  } else {
    const { firstTapSoundUrls } = await import("../src/lib/sound");
    urls = firstTapSoundUrls();
  }
  let bytes = 0;
  let decoded = 0;
  let seconds = 0;
  for (const url of urls) {
    const path = join("public", url);
    if (!existsSync(path)) continue;
    bytes += statSync(path).size;
    const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=duration,channels", "-of", "csv=p=0", path], { encoding: "utf8" });
    const [channels, duration] = out.trim().split("\n")[0]!.split(",").map(Number);
    seconds += duration ?? 0;
    decoded += (duration ?? 0) * (channels ?? 1) * 48_000 * 4;
  }
  return { files: urls.length, bytes, decodedMb: decoded / 1024 / 1024, seconds };
}

const built = existsSync(join(OUT, "server"));
const screen = built ? routeLoad(["__root__", '"/"']) : null;
// The route chunks a room and practice add on top (their own static imports), before any game's chunk.
const room = built ? routeLoad(["__root__", '"/duel/$code"']) : null;
const practice = built ? routeLoad(["__root__", '"/practice"']) : null;
const tap = await firstTap();
if (json) {
  console.log(JSON.stringify({ firstScreen: screen, room, practice, firstTap: tap }, null, 2));
} else {
  const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;
  if (screen) {
    console.log(`First screen (/): ${screen.files} files, ${kb(screen.raw)} raw, ${kb(screen.gzip)} gzip`);
    for (const [name, r, g] of screen.largest) console.log(`  ${name}  ${kb(r)} raw  ${kb(g)} gzip`);
    if (room) console.log(`Room screen (/duel/$code, before any game): ${room.files} files, ${kb(room.raw)} raw, ${kb(room.gzip)} gzip`);
    if (practice) console.log(`Practice list (/practice, before any game): ${practice.files} files, ${kb(practice.raw)} raw, ${kb(practice.gzip)} gzip`);
  } else {
    console.log(`First screen: no build at ${OUT} (run bun run build)`);
  }
  console.log(
    `First tap: ${tap.files} sound files, ${kb(tap.bytes)} fetched, ${tap.seconds.toFixed(0)} s of audio, ~${tap.decodedMb.toFixed(1)} MB decoded`,
  );
}
