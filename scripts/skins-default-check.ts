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
 *
 * Overhauled games (changed with Joe's approval, 15 Nov 2026: routine consequence of the Sports overhaul, phase 2
 * step 4): a game whose default look was redrawn on purpose (Cue Ball, Curl Champ, Apex) is listed in
 * scripts/fixtures/skins-default-frames-overhaul.json with its new default digests. For it the check still proves the
 * skin hook draws nothing of its own (no look argument and the default look identical, frame for frame) and pins the
 * new default to that record wherever this machine draws the other games' stored digests exactly (the same
 * rasteriser); main's live frames are its reference only once main draws the record itself. The original stored
 * digests stay in skins-default-frames.json untouched. Every other game is checked exactly as before.
 *
 * Re-recorded for Cue Ball and Curl Champ (changed with Joe's approval, 22 Nov 2026: the polish plan's A3, a brighter
 * baize and darker stone shadows in their code art): `--record-overhaul=pool,curling`.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { SKIN_GAMES, drawFrames, digest, type SkinGame } from "./skins/frames";
import { baseDigests, baseLine, type BaseDigests } from "./skins/base";

const one = process.argv.find((a) => a.startsWith("--game="))?.slice(7) as SkinGame | undefined;
// `--record-overhaul=pool,curling,racing`: writes those games' new default digests (drawn here, with no look) to the
// overhaul record. Only for a game whose default was redrawn on purpose, with Joe's approval.
const recordArg = process.argv.find((a) => a.startsWith("--record-overhaul="))?.slice(18);
if (one) {
  const { NO_LOOK } = await import("../src/lib/arcade/skins/look");
  const plain = await drawFrames(one, undefined);
  const looked = await drawFrames(one, NO_LOOK);
  const out = { plain: Object.fromEntries(plain.map((f) => [f.name, digest(f)])), looked: Object.fromEntries(looked.map((f) => [f.name, digest(f)])) };
  console.log("JSON " + JSON.stringify(out));
  process.exit(0);
}

if (recordArg) {
  const path = "scripts/fixtures/skins-default-frames-overhaul.json";
  const rec = (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { why: "", games: {} }) as { why: string; games: Record<string, Record<string, string>> };
  rec.why = "Defaults redrawn on purpose (routine consequence of the Sports overhaul, phase 2 step 4, Joe's approval of 15 Nov 2026); drawn on this branch with no look argument.";
  for (const g of recordArg.split(",") as SkinGame[]) {
    const child = Bun.spawnSync(["bun", import.meta.path, `--game=${g}`], { stdout: "pipe", stderr: "inherit" });
    const out = child.stdout.toString().split("\n").find((l) => l.startsWith("JSON "));
    if (!out) throw new Error(`${g} did not draw`);
    rec.games[g] = (JSON.parse(out.slice(5)) as { plain: Record<string, string> }).plain;
    console.log(`  recorded ${g}: ${Object.keys(rec.games[g]!).length} frames`);
  }
  writeFileSync(path, JSON.stringify(rec, null, 1) + "\n");
  process.exit(0);
}
const stored = JSON.parse(readFileSync("scripts/fixtures/skins-default-frames.json", "utf8")) as Record<string, Record<string, string>>;
/**
 * Changed with Joe's approval, 15 Nov 2026 (routine consequence of the Cards and Board overhaul: a fixture for screens
 * deliberately redesigned). Free Cell, Summit, Thirteen and Five Hands draw real cards since the overhaul, so main's
 * frames no longer apply to them. For these four the check holds what the hook must keep, that no look and the default
 * look draw identically, and pins the redesigned frames to their own record (scripts/fixtures/skins-default-frames-cards.json,
 * `--record-cards` writes it), asserted on the machine that drew main's stored digests (the same rasteriser). Every
 * other game is checked against main exactly as before.
 */
const REDESIGNED = new Set<string>(["freecell", "tripeaks", "pyramid", "fivehands"]);
const CARDS_FIXTURE = "scripts/fixtures/skins-default-frames-cards.json";
const cardsStored = existsSync(CARDS_FIXTURE) ? (JSON.parse(readFileSync(CARDS_FIXTURE, "utf8")) as Record<string, Record<string, string>>) : {};
const recordCards = process.argv.includes("--record-cards");
const cardsOut: Record<string, Record<string, string>> = {};
// Games redrawn on purpose and their new default digests (see the header).
const overhaul = JSON.parse(readFileSync("scripts/fixtures/skins-default-frames-overhaul.json", "utf8")) as { games: Record<string, Record<string, string>> };
const OVERHAULED = new Set(Object.keys(overhaul.games));
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
const storedHere = !!base && SKIN_GAMES.filter((g) => !OVERHAULED.has(g)).every((g) => Object.entries(stored[g] ?? {}).every(([n, d]) => base!.frames[g]?.[n] === d) && Object.keys(base!.frames[g] ?? {}).length === Object.keys(stored[g] ?? {}).length);
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
  if (REDESIGNED.has(g)) {
    const names = Object.keys(got.plain);
    cardsOut[g] = got.plain;
    let bad = 0;
    for (const name of names) {
      if (got.looked[name] !== got.plain[name]) {
        bad++;
        failures.push(`${g} ${name}: the default look draws differently from no look argument`);
      }
      if (!recordCards && storedHere && cardsStored[g] && cardsStored[g]![name] !== got.plain[name]) {
        bad++;
        failures.push(`${g} ${name}: differs from the overhaul's recorded frame`);
      }
    }
    if (names.length !== Object.keys(want[g] ?? {}).length || (!recordCards && storedHere && Object.keys(cardsStored[g] ?? {}).length !== names.length)) {
      bad++;
      failures.push(`${g}: frame list changed (${names.length} drawn)`);
    }
    if (bad) console.log(`  FAIL ${g}: ${bad} frame(s) differ`);
    else {
      passes++;
      console.log(`  ok ${g} (redesigned in the Cards and Board overhaul): ${names.length} frames, no look and the default look identical${storedHere ? ", the overhaul's record" : ""}`);
    }
    continue;
  }
  if (OVERHAULED.has(g)) {
    // A redrawn default: the hook neutral frame for frame, and the new record where this machine is the recorder's.
    const record = overhaul.games[g]!;
    const mainDrawsRecord = !!base && Object.entries(record).every(([n, d]) => base!.frames[g]?.[n] === d);
    let bad = 0;
    const names = Object.keys(record);
    if (names.length === 0 || Object.keys(got.plain).length !== names.length) {
      bad++;
      failures.push(`${g}: frame list changed (${Object.keys(got.plain).length} drawn, ${names.length} in the overhaul record)`);
    }
    for (const name of names) {
      if (got.plain[name] !== got.looked[name]) {
        bad++;
        failures.push(`${g} ${name}: the default look draws differently from no look argument`);
      }
      if ((storedHere || mainDrawsRecord) && got.plain[name] !== record[name]) {
        bad++;
        failures.push(`${g} ${name} differs from the overhaul record (scripts/fixtures/skins-default-frames-overhaul.json)`);
      }
    }
    if (bad) console.log(`  FAIL ${g}: ${bad} frame(s) differ`);
    else {
      passes++;
      console.log(`  ok ${g} (redrawn default): ${names.length} frames identical with no look and the default look${storedHere || mainDrawsRecord ? ", and to the overhaul record" : " (NOTE: the record is another rasteriser's, not compared here)"}`);
    }
    continue;
  }
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
if (recordCards) {
  writeFileSync(CARDS_FIXTURE, JSON.stringify(cardsOut, null, 1) + "\n");
  console.log(`  recorded ${CARDS_FIXTURE}`);
}
if (failures.length) {
  for (const f of failures.slice(0, 20)) console.log(`  FAIL ${f}`);
  console.log(`FAIL skins-default-check: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log(`PASS skins-default-check: ${passes} games draw exactly as on main (or, redrawn on purpose, as their overhaul record) with no skin equipped`);
