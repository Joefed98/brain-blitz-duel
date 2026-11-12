/**
 * skins-replay-check (wave 2, E1; the economy doc's fairness rule): every game skin, world theme and card back scores
 * exactly as the default. For each of the seven games (Free Cell now draws only its default: its backs became the
 * account's card back, drawn on Full House's deck), the recorded runs (scripts/fixtures/skins-replay-runs.json, two
 * on the oldest and two on the dealt stamp of each game, recorded by scripts/skins/record-runs.ts) are replayed tick by
 * tick in the default look and in every look scripts/skins/looks.ts lists (each skin, world theme, a skin with its theme,
 * and on Full House each card back, alone and with a felt). Along the way the
 * live stage's own draw (the calls the stage makes, in that look) paints the state every few ticks and on the last
 * tick, on a deep-frozen copy, so a draw that wrote to the game's state would throw. For every look:
 *   - the final score equals the recorded score and the server replay's (src/lib/duel/<game>.ts, the scorer rooms and
 *     practice store), which is computed once and is the same for every look;
 *   - the final state and every checkpoint equal the default look's, byte for byte (JSON);
 *   - the look's frames differ from the default's (the look really was drawn).
 * Also: the deal, its stamps and the scoring never reach the skins (no file of the deal, the graders, the replays or the
 * sims imports a skin module or the equipped look), and the look modules import nothing that deals or scores.
 *
 *   bun scripts/skins-replay-check.ts          (~1 min, no browser; one child process per game)
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { SKIN_GAMES, type SkinGame } from "./skins/frames";

const one = process.argv.find((a) => a.startsWith("--game="))?.slice(7) as SkinGame | undefined;
const FIXTURE = JSON.parse(readFileSync("scripts/fixtures/skins-replay-runs.json", "utf8")) as { runs: { game: string; rev: number; seed: number; raw: string; score: number }[] };

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
}

if (one) {
  const { createCanvas } = await import("@napi-rs/canvas");
  const { runSpecs } = await import("./skins/runs");
  const { decodeInputEvents } = await import("../src/lib/arcade/engine");
  const { setSkinReducedMotion, setSkinClock } = await import("../src/lib/arcade/skins/motion.renderer");
  setSkinReducedMotion(false);
  let clock = 0;
  setSkinClock(() => clock);
  const specs = (await runSpecs()).filter((s) => s.game === one);
  const { looksFor } = await import("./skins/looks");
  const looks = looksFor(one);
  const lines: string[] = [];
  let bad = 0;
  for (const run of FIXTURE.runs.filter((r) => r.game === one)) {
    const spec = specs.find((s) => s.rev === run.rev)!;
    const server = spec.replay(run.seed, run.raw).score;
    const byTick = new Map(decodeInputEvents((run.raw.split("~")[0] ?? "").split("|")[2] ?? "").map((e) => [e.t, e]));
    const canvas = createCanvas(spec.w, spec.h);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    let base: { state: string; cps: string; frames: string } | null = null;
    const scores: number[] = [];
    for (const look of looks) {
      const game = spec.sim(run.seed);
      let state = game.init(run.seed);
      const cps: unknown[] = [];
      const frames = createHash("sha256");
      const every = Math.max(1, Math.floor(game.runTicks / 24));
      let error = "";
      const paint = () => {
        clock += 1700;
        const frozen = deepFreeze(structuredClone(state));
        try {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, spec.w, spec.h);
          spec.draw(ctx, frozen, look);
        } catch (e) {
          error ||= String(e);
        }
        frames.update(canvas.getContext("2d").getImageData(0, 0, spec.w, spec.h).data);
      };
      paint();
      while (!game.isOver(state) && state.tick < game.runTicks) {
        const t = state.tick + 1;
        state = game.step(state, byTick.get(t) ?? null);
        if (state.tick % spec.interval === 0) cps.push(spec.checkpoint(state));
        if (state.tick % every === 0) paint();
      }
      paint();
      const score = game.score(state);
      scores.push(score);
      const got = { state: JSON.stringify(state), cps: JSON.stringify(cps), frames: frames.digest("hex") };
      const name = `${one} rev ${run.rev} seed ${run.seed} ${[look.skin, look.world, look.back].filter(Boolean).join(" + ") || "default"}`;
      const problems: string[] = [];
      if (error) problems.push(`a draw failed: ${error}`);
      if (score !== run.score) problems.push(`score ${score}, recorded ${run.score}`);
      if (score !== server) problems.push(`score ${score}, server replay ${server}`);
      if (!base) base = got;
      else {
        if (got.state !== base.state) problems.push("final state differs from the default look's");
        if (got.cps !== base.cps) problems.push("checkpoints differ from the default look's");
        if (got.frames === base.frames) problems.push("frames identical to the default's (the look was not drawn)");
      }
      if (problems.length) {
        bad++;
        lines.push(`FAIL ${name}: ${problems.join("; ")}`);
      }
    }
    lines.push(`run ${one} rev ${run.rev} seed ${run.seed}: ${looks.length} looks, every score ${[...new Set(scores)].join("/")} (recorded ${run.score}, server ${server})`);
  }
  console.log("JSON " + JSON.stringify({ bad, lines }));
  process.exit(0);
}

let passes = 0;
const failures: string[] = [];
const check = (ok: boolean, label: string) => {
  if (ok) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
};

for (const g of SKIN_GAMES) {
  const child = Bun.spawnSync(["bun", import.meta.path, `--game=${g}`], { stdout: "pipe", stderr: "inherit" });
  const line = child.stdout.toString().split("\n").find((l) => l.startsWith("JSON "));
  if (child.exitCode !== 0 || !line) {
    check(false, `${g}: the replays did not finish (exit ${child.exitCode})`);
    continue;
  }
  const res = JSON.parse(line.slice(5)) as { bad: number; lines: string[] };
  for (const l of res.lines) console.log(`  ${l}`);
  check(res.bad === 0 && res.lines.length > 0, `${g}: identical scores, states and checkpoints in every skin and world theme`);
}

// The deal, the stamps and the scoring never reach the skins: walk the imports of every deal, grade, replay and sim file.
{
  const ROOT = resolve(".");
  const SRC = join(ROOT, "src");
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : /\.(ts|tsx)$/.test(n) ? [join(dir, n)] : []));
  const RE = /(?:import|export)\s[^'"`;]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
  const resolveSpec = (from: string, spec: string) => {
    const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
    if (!base) return null;
    for (const ext of ["", ".ts", ".tsx", "/index.ts"]) if (existsSync(base + ext) && statSync(base + ext).isFile()) return base + ext;
    return null;
  };
  const via = new Map<string, string>();
  const reach = (roots: string[]) => {
    const seen = new Set<string>();
    via.clear();
    const q = [...roots];
    while (q.length) {
      const f = q.shift()!;
      if (seen.has(f)) continue;
      seen.add(f);
      for (const m of readFileSync(f, "utf8").matchAll(RE)) {
        const p = resolveSpec(f, m[1] ?? m[2] ?? m[3] ?? "");
        if (p && !seen.has(p)) {
          if (!via.has(p)) via.set(p, f);
          q.push(p);
        }
      }
    }
    return seen;
  };
  const pathTo = (p: string) => {
    const out = [rel(p)];
    for (let f = via.get(p); f && out.length < 12; f = via.get(f)) out.unshift(rel(f));
    return out.join(" → ");
  };
  const rel = (p: string) => relative(ROOT, p);
  const isSkin = (p: string) => /^src\/lib\/(arcade\/skins|skins)\//.test(rel(p)) || rel(p) === "src/lib/identity/gameLooks.ts";
  const all = walk(SRC);
  const sims = ["pool", "minigolf", "curling", "racing", "freekick", "sportsKit", "engine", "cards/freecell", "cards/pokerSquares", "cards/cards"].map((n) => join(SRC, `lib/arcade/${n}.ts`));
  // The server replays that store these games' scores (src/lib/duel/<game>.ts, cards.ts, arcadeRun.ts) and their deal
  // banks and arcade deal (*.server.ts). The registry and generatePuzzle reach the stage modules, and so the look, by
  // design (that is the phone's bundle); the deal itself is proved unchanged by deal-identity-check against main.
  const dealAndScore = all.filter((p) => /^src\/lib\/duel\/(pool|minigolf|curling|racing|freekick|cards|sports|arcadeRun)[A-Za-z0-9]*(\.server)?\.ts$/.test(rel(p)));
  const roots = [...sims, ...dealAndScore];
  check(roots.length > 30 && sims.every((s) => existsSync(s)), `${roots.length} sim, server-replay and deal-bank roots`);
  const leaks = [...reach(roots)].filter(isSkin);
  check(leaks.length === 0, `no deal, stamp, grading, replay or sim file reaches a skin module${leaks.length ? `: ${pathTo(leaks[0]!)}` : ""}`);
  const skinFiles = all.filter((p) => isSkin(p) && rel(p) !== "src/lib/identity/gameLooks.ts");
  const back = [...reach(skinFiles)].filter((p) => /^src\/lib\/(economy|identity|data)\//.test(rel(p)));
  check(back.length === 0, `the look modules reach no economy, identity or data code${back.length ? `: ${pathTo(back[0]!)}` : ""}`);
  const rendererSide = all.filter((p) => /^src\/lib\/arcade\//.test(rel(p)));
  const equipped = [...reach(rendererSide)].filter((p) => /^src\/lib\/skins\//.test(rel(p)));
  check(equipped.length === 0, `no renderer or sim reads who has what equipped (only the live stages pass a look)${equipped.length ? `: ${pathTo(equipped[0]!)}` : ""}`);
}

console.log(`skins-replay-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: every skin and world theme replays every recorded run to the identical score");
