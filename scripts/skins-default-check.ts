/**
 * skins-default-check (wave 2, E1; display only): with no skin equipped, each of the seven skinnable games draws
 * exactly as it did on main before the skin hook. Every frame of scripts/skins/frames.ts (each game's states through
 * the stage's own draw calls and its scene, both its oldest and dealt stamps, at 1× and 2×) is drawn twice, once with
 * no look argument (as every replay, reveal and intro demo calls it) and once with the default look, and both must
 * match main's own renderers drawn in the same run on the same machine (scripts/skins/base.ts: the merge base of the
 * branch and main, fetched shallowly if the checkout lacks it; Joe, 11 Nov 2026). The canvas library's raster path
 * depends on the CPU, so digests from one machine don't hold on another: the stored digests
 * (scripts/fixtures/skins-default-frames.json, recorded on main before any renderer changed, never re-recorded) are
 * this container's record, also asserted whenever main draws them here exactly (the same rasteriser); elsewhere they
 * are reported as a NOTE.
 *
 *   bun scripts/skins-default-check.ts            (~10 s, no browser; main's frames ~4 s of it, cached per base)
 *
 * One child process per game (@napi-rs/canvas returns its native memory only when the process exits).
 */
import { readFileSync } from "node:fs";
import { SKIN_GAMES, drawFrames, digest, type SkinGame } from "./skins/frames";
import { baseDigests, baseLine, type BaseDigests } from "./skins/base";

const one = process.argv.find((a) => a.startsWith("--game="))?.slice(7) as SkinGame | undefined;
if (one) {
  const { NO_LOOK } = await import("../src/lib/arcade/skins/look");
  const plain = await drawFrames(one, undefined);
  const looked = await drawFrames(one, NO_LOOK);
  const out = { plain: Object.fromEntries(plain.map((f) => [f.name, digest(f)])), looked: Object.fromEntries(looked.map((f) => [f.name, digest(f)])) };
  console.log("JSON " + JSON.stringify(out));
  process.exit(0);
}

const stored = JSON.parse(readFileSync("scripts/fixtures/skins-default-frames.json", "utf8")) as Record<string, Record<string, string>>;
let passes = 0;
const failures: string[] = [];
let base: BaseDigests | null = null;
try {
  base = baseDigests();
  console.log(`  ${baseLine(base)}`);
} catch (e) {
  failures.push(`main's renderers could not be drawn: ${e instanceof Error ? e.message : String(e)}`);
}
// The stored digests are this machine's record: asserted when main's live frames are exactly them (the same rasteriser).
const storedHere = !!base && SKIN_GAMES.every((g) => Object.entries(stored[g] ?? {}).every(([n, d]) => base!.frames[g]?.[n] === d) && Object.keys(base!.frames[g] ?? {}).length === Object.keys(stored[g] ?? {}).length);
if (base) console.log(storedHere ? "  ok main's live frames are the stored digests exactly (this machine drew them): checked against both" : "  NOTE main draws differently on this machine than where the stored digests were recorded (CPU-dependent rasterising): checked against main live only");
const want = base ? base.frames : stored;
for (const g of SKIN_GAMES) {
  const child = Bun.spawnSync(["bun", import.meta.path, `--game=${g}`], { stdout: "pipe", stderr: "inherit" });
  const line = child.stdout.toString().split("\n").find((l) => l.startsWith("JSON "));
  if (child.exitCode !== 0 || !line) {
    failures.push(`${g}: did not draw (exit ${child.exitCode})`);
    console.log(`  FAIL ${g}: did not draw`);
    continue;
  }
  const got = JSON.parse(line.slice(5)) as { plain: Record<string, string>; looked: Record<string, string> };
  const names = Object.keys(want[g] ?? {});
  let bad = 0;
  for (const name of names) {
    for (const mode of ["plain", "looked"] as const) {
      if (got[mode][name] !== want[g]![name]) {
        bad++;
        failures.push(`${g} ${name} (${mode === "plain" ? "no look argument" : "the default look"}) differs from main`);
      }
      if (storedHere && got[mode][name] !== stored[g]![name]) {
        bad++;
        failures.push(`${g} ${name} (${mode === "plain" ? "no look argument" : "the default look"}) differs from the stored digest`);
      }
    }
  }
  if (names.length === 0 || Object.keys(got.plain).length !== names.length || names.length !== Object.keys(stored[g] ?? {}).length) {
    bad++;
    failures.push(`${g}: frame list changed (${Object.keys(got.plain).length} drawn, ${names.length} recorded)`);
  }
  if (bad) console.log(`  FAIL ${g}: ${bad} frame(s) differ`);
  else {
    passes++;
    console.log(`  ok ${g}: ${names.length} frames identical to main${storedHere ? " (live and stored)" : " (live)"}, with no look and with the default look`);
  }
}
if (failures.length) {
  for (const f of failures.slice(0, 20)) console.log(`  FAIL ${f}`);
  console.log(`FAIL skins-default-check: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log(`PASS skins-default-check: ${passes} games draw exactly as on main with no skin equipped`);
