/**
 * skins-check (wave 2, E1; docs/skins.md): the 23 game skins and 4 world themes.
 *
 *   1. Catalogue: exactly the catalogue's 23 skins and 4 world themes (docs/art/wave-2/catalogue.json), each on its game,
 *      and the animated ones are exactly the catalogue's animated items.
 *   2. Renders: every look draws every frame of scripts/skins/frames.ts (each game's states through the live stage's
 *      draw and its scene, oldest and dealt stamps) without an error, and differs from the default (the look is drawn;
 *      Free Cell's backs are drawn directly, as a Free Cell deal never shows one).
 *   3. Contrast: every look's objects (the ball, stone, car, card back or card face) reach 3:1 against the background
 *      they are played on (WCAG non-text contrast), as the default does.
 *   4. Sizes: a skinned ball paints nothing outside the default ball's draw radius; a skinned stone and car paint inside
 *      the default stone's and car's own box (alpha over half, 1 px).
 *   5. Reduce Motion: with it on, an animated look draws the same frame at any time; with it off, it moves; a look that
 *      is not animated never moves.
 *   6. Ownership: the live stage's look comes only from the account's equipped slots (A1's loadout, which holds owned
 *      items only): a guest, an item of another game, an unknown id or a theme for a game without themes all draw the
 *      default; the identity backend keeps the per-game slots and drops anything malformed.
 *
 *   bun scripts/skins-check.ts      (~20 s, no browser; one child process per game for the frames)
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { SKIN_GAMES, drawFrames, digest, type SkinGame } from "./skins/frames";

const one = process.argv.find((a) => a.startsWith("--game="))?.slice(7) as SkinGame | undefined;
if (one) {
  const L = await import("../src/lib/arcade/skins/look");
  const looks = [...L.GAME_SKIN_IDS[one].map((skin) => ({ skin, world: null })), ...L.WORLD_THEME_IDS[one].map((world) => ({ skin: null, world })), ...L.WORLD_THEME_IDS[one].map((world) => ({ skin: L.GAME_SKIN_IDS[one][0]!, world }))];
  const out: { look: string; error: string; differs: boolean; still: boolean; moves: boolean }[] = [];
  L.setSkinReducedMotion(true);
  L.setSkinClock(() => 0);
  const base = (await drawFrames(one, L.NO_LOOK)).map(digest);
  for (const look of looks) {
    const name = [look.skin, look.world].filter(Boolean).join(" + ");
    let error = "";
    const at = async (ms: number, reduced: boolean) => {
      L.setSkinReducedMotion(reduced);
      L.setSkinClock(() => ms);
      try {
        return (await drawFrames(one, look)).map(digest);
      } catch (e) {
        error ||= String(e);
        return [];
      }
    };
    const a = await at(1000, true);
    const b = await at(2700, true);
    const c = await at(1000, false);
    const d = await at(2700, false);
    out.push({ look: name, error, differs: a.some((x, i) => x !== base[i]), still: a.join() === b.join(), moves: c.join() !== d.join() });
  }
  console.log("JSON " + JSON.stringify(out));
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

const L = await import("../src/lib/arcade/skins/look");

// 1. The catalogue.
{
  const cat = JSON.parse(readFileSync("docs/art/wave-2/catalogue.json", "utf8")) as { items: { id: string; kind: string; game: string | null; animated: boolean }[] };
  const names: Record<string, string> = { Apex: "racing", "Crazy Golf": "minigolf", "Cue Ball": "pool", "Curl Champ": "curling", "Free Cell": "freecell", "Full House": "pokersquares", "Top Bins": "freekick" };
  const skins = cat.items.filter((i) => i.kind === "game-skin");
  const worlds = cat.items.filter((i) => i.kind === "world-theme");
  const ours = (m: Readonly<Record<string, readonly string[]>>) => Object.entries(m).flatMap(([g, ids]) => ids.map((id) => `${g}:${id}`)).sort();
  check(skins.length === 23 && worlds.length === 4, `the catalogue holds 23 skins and 4 world themes (${skins.length}, ${worlds.length})`);
  check(JSON.stringify(ours(L.GAME_SKIN_IDS)) === JSON.stringify(skins.map((i) => `${names[i.game!]}:${i.id}`).sort()), "every catalogue skin is drawn, on its own game, and nothing else");
  check(JSON.stringify(ours(L.WORLD_THEME_IDS)) === JSON.stringify(worlds.map((i) => `${names[i.game!]}:${i.id}`).sort()), "every catalogue world theme is drawn, on its own game, and nothing else");
  check(JSON.stringify([...L.ANIMATED_LOOKS].sort()) === JSON.stringify([...skins, ...worlds].filter((i) => i.animated).map((i) => i.id).sort()), "the animated looks are exactly the catalogue's animated items");
  check(Object.keys(L.SKIN_GAME_NAMES).sort().join() === [...SKIN_GAMES].sort().join(), "the seven skinnable games");
}

// 2 and 5. Renders and motion (a child process per game: @napi-rs/canvas frees its memory only on exit).
for (const g of SKIN_GAMES) {
  const child = Bun.spawnSync(["bun", import.meta.path, `--game=${g}`], { stdout: "pipe", stderr: "inherit" });
  const line = child.stdout.toString().split("\n").find((l) => l.startsWith("JSON "));
  if (child.exitCode !== 0 || !line) {
    check(false, `${g}: the looks did not draw (exit ${child.exitCode})`);
    continue;
  }
  const rows = JSON.parse(line.slice(5)) as { look: string; error: string; differs: boolean; still: boolean; moves: boolean }[];
  for (const r of rows) {
    const animated = r.look.split(" + ").some((id) => L.ANIMATED_LOOKS.includes(id));
    check(!r.error, `${g} ${r.look}: draws every frame without an error${r.error ? ` (${r.error})` : ""}`);
    if (g !== "freecell") check(r.differs, `${g} ${r.look}: drawn (its frames differ from the default's)`);
    check(r.still, `${g} ${r.look}: still under Reduce Motion`);
    check(animated ? r.moves : !r.moves, `${g} ${r.look}: ${animated ? "moves with Reduce Motion off" : "never moves (not animated)"}`);
  }
  console.log(`  ${g}: ${rows.length} looks drawn`);
}

// 3. Contrast.
{
  const P = await import("../src/lib/arcade/skins/pool.skins");
  const M = await import("../src/lib/arcade/skins/minigolf.skins");
  const C = await import("../src/lib/arcade/skins/curling.skins");
  const R = await import("../src/lib/arcade/skins/racing.skins");
  const F = await import("../src/lib/arcade/skins/freekick.skins");
  const K = await import("../src/lib/arcade/skins/cards.skins");
  const pairsFor = (g: SkinGame, look: { skin: string | null; world: string | null }) =>
    g === "pool" ? P.poolContrast(look) : g === "minigolf" ? M.minigolfContrast(look) : g === "curling" ? C.curlingContrast(look) : g === "racing" ? R.racingContrast(look) : g === "freekick" ? F.freekickContrast(look) : K.cardsContrast(g, look);
  const report: string[] = [];
  for (const g of SKIN_GAMES) {
    const looks = [L.NO_LOOK, ...L.GAME_SKIN_IDS[g].map((skin) => ({ skin, world: null })), ...L.WORLD_THEME_IDS[g].map((world) => ({ skin: null, world })), ...L.WORLD_THEME_IDS[g].flatMap((world) => L.GAME_SKIN_IDS[g].map((skin) => ({ skin, world })))];
    for (const look of looks) {
      for (const pair of pairsFor(g, look)) {
        const ratio = L.bestContrast(pair);
        const name = [look.skin, look.world].filter(Boolean).join(" + ") || "default";
        report.push(`${g} ${name} ${pair.object} ${ratio.toFixed(2)}`);
        check(ratio >= L.SKIN_MIN_CONTRAST, `${g} ${name}: ${pair.object} at ${ratio.toFixed(2)}:1 (at least ${L.SKIN_MIN_CONTRAST}:1)`);
      }
    }
  }
  console.log(`  contrast: ${report.length} object/look pairs, lowest ${report.map((r) => Number(r.split(" ").pop())).reduce((a, b) => Math.min(a, b), 99).toFixed(2)}:1`);
  if (process.argv.includes("--report")) for (const r of report) console.log(`    ${r}`);
}

// 4. Sizes.
{
  const { createCanvas } = await import("@napi-rs/canvas");
  const P = await import("../src/lib/arcade/skins/pool.skins");
  const B = await import("../src/lib/arcade/skins/ballArt");
  const { POOL_BALL_DRAW_R } = await import("../src/lib/arcade/pool.renderer");
  const { MG_BALL_R } = await import("../src/lib/arcade/minigolf");
  const S = 4;
  const outside = (paint: (ctx: CanvasRenderingContext2D) => void, r: number) => {
    const size = Math.ceil((r + 6) * 2 * S);
    const c = createCanvas(size, size);
    const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    ctx.scale(S, S);
    paint(ctx);
    const d = c.getContext("2d").getImageData(0, 0, size, size).data;
    let n = 0;
    const cx = size / 2;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) if (d[(y * size + x) * 4 + 3]! > 127 && Math.hypot(x + 0.5 - cx, y + 0.5 - cx) > (r + 0.5) * S) n++;
    return n;
  };
  for (const kind of ["pixel", "galaxy", "neon", "neon8", "neontable"] as const)
    for (const id of [0, 8, 3, 11]) {
      const r = POOL_BALL_DRAW_R;
      const n = outside((ctx) => P.paintPoolSkinBall(ctx, kind, id, r + 6, r + 6, r, 0, kind === "neontable"), r);
      check(n === 0, `pool ${kind} ball ${id}: inside the default ball's draw radius${n ? ` (${n} px outside)` : ""}`);
    }
  const mgR = MG_BALL_R + 1.5;
  for (const art of ["watermelon", "disco", "neon-glow", "plasma", "comet", "retro-leather", "neon-football"] as const)
    for (const r of [mgR, 14]) {
      const n = outside((ctx) => B.paintBallArt(ctx, art, r + 6, r + 6, r, 0.7), r);
      check(n === 0, `${art} ball at radius ${r}: inside the ball's draw radius${n ? ` (${n} px outside)` : ""}`);
    }
  const box = (paint: (ctx: CanvasRenderingContext2D) => void, w: number, h: number) => {
    const c = createCanvas(w * S, h * S);
    const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    ctx.scale(S, S);
    paint(ctx);
    const d = c.getContext("2d").getImageData(0, 0, w * S, h * S).data;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let y = 0; y < h * S; y++)
      for (let x = 0; x < w * S; x++)
        if (d[(y * w * S + x) * 4 + 3]! > 127) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
    return { x0: x0 / S, y0: y0 / S, x1: (x1 + 1) / S, y1: (y1 + 1) / S };
  };
  const within = (a: { x0: number; y0: number; x1: number; y1: number }, b: typeof a) => a.x0 >= b.x0 - 1 && a.y0 >= b.y0 - 1 && a.x1 <= b.x1 + 1 && a.y1 <= b.y1 + 1;
  const Cu = await import("../src/lib/arcade/curling.renderer");
  const Cs = await import("../src/lib/arcade/curling");
  const stoneLooks = [...L.GAME_SKIN_IDS.curling.map((skin) => ({ skin, world: null })), ...L.WORLD_THEME_IDS.curling.map((world) => ({ skin: null, world }))];
  for (const rev of [1, Cs.CURLING_REV])
    for (const [x, y] of [[0, 2400], [40, 0]] as const)
      for (const mine of [true, false]) {
        const v = Cu.curlViewFor(rev);
        const def = box((ctx) => Cu.paintCurlingStoneIn(L.NO_LOOK, ctx, x, y, mine, rev), Cs.CURLING_W, v.h);
        for (const look of stoneLooks) {
          const got = box((ctx) => Cu.paintCurlingStoneIn(look, ctx, x, y, mine, rev), Cs.CURLING_W, v.h);
          check(within(got, def), `curling ${look.skin ?? look.world} ${mine ? "your" : "opponent's"} stone (rev ${rev}, ${x}, ${y}): inside the default stone's box`);
        }
      }
  const Ra = await import("../src/lib/arcade/racing.renderer");
  for (const w of [60, 120])
    for (const braking of [false, true]) {
      const def = box((ctx) => Ra.paintRacingCarIn(L.NO_LOOK, ctx, 100, 120, w, braking), 200, 140);
      for (const skin of L.GAME_SKIN_IDS.racing) {
        L.setSkinReducedMotion(false);
        for (const t of [0, 900, 1800]) {
          L.setSkinClock(() => t);
          const got = box((ctx) => Ra.paintRacingCarIn({ skin, world: null }, ctx, 100, 120, w, braking), 200, 140);
          check(within(got, def), `racing ${skin} car (${w} px${braking ? ", braking" : ""}, t ${t}): inside the default car's box`);
        }
      }
    }
  L.setSkinReducedMotion(null);
  L.setSkinClock(null);
}

// Free Cell's backs: each skin paints its own back, unlike the default.
{
  const { createCanvas } = await import("@napi-rs/canvas");
  (globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = class {
    constructor(w: number, h: number) {
      return createCanvas(Math.max(1, w), Math.max(1, h));
    }
  };
  const Cr = await import("../src/lib/arcade/cards/cards.renderer");
  const back = (look: { skin: string | null; world: string | null }) => {
    const c = createCanvas(80, 112);
    const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    Cr.withCardsLook(look, () => Cr.drawCard(ctx, 0, 6, 6, 68, 100, { down: true }));
    return createHash("sha256").update(c.getContext("2d").getImageData(0, 0, 80, 112).data).digest("hex");
  };
  const plain = back(L.NO_LOOK);
  const skins = L.GAME_SKIN_IDS.freecell.map((skin) => back({ skin, world: null }));
  check(skins.every((d) => d !== plain) && new Set(skins).size === skins.length, "freecell: each card-back skin paints its own back");
  check(back(L.NO_LOOK) === plain, "freecell: the default back is unchanged after a skinned draw (the look ends with the draw)");
}

// 6. Ownership: the look comes only from the equipped slots, kept to items the game knows.
{
  const E = await import("../src/lib/skins/equipped");
  const B = await import("../src/lib/identity/backend");
  const lookWith = async (slots: Record<string, string | null> | null, game: Parameters<typeof E.gameLookOf>[0]) => {
    E.setGameLookSource(async () => slots);
    return E.gameLookOf(game);
  };
  const same = (a: { skin: string | null; world: string | null }, skin: string | null, world: string | null) => a.skin === skin && a.world === world;
  check(same(await lookWith(null, "pool"), null, null), "a guest (no loadout) sees the default");
  E.setGameLookSource(null);
  check(same(await E.gameLookOf("pool"), null, null), "no source (the app not yet started, or a check) draws the default");
  check(same(await lookWith({ "game-skin:pool": "game-skin.cue-ball.galaxy-set", "world-theme:pool": "world-theme.cue-ball.neon-table" }, "pool"), "game-skin.cue-ball.galaxy-set", "world-theme.cue-ball.neon-table"), "an equipped skin and theme draw on their game");
  check(same(await lookWith({ "game-skin:pool": "game-skin.cue-ball.galaxy-set" }, "racing"), null, null), "another game's skin never draws on this game");
  check(same(await lookWith({ "game-skin:pool": "game-skin.apex.molten-gold" }, "pool"), null, null), "an item for another game in this game's slot draws the default");
  check(same(await lookWith({ "game-skin:pool": "game-skin.cue-ball.made-up" }, "pool"), null, null), "an unknown item draws the default");
  check(same(await lookWith({ "world-theme:freekick": "world-theme.apex.neon-night" }, "freekick"), null, null), "a world theme on a game without themes draws the default");
  E.setGameLookSource(async () => {
    throw new Error("offline");
  });
  check(same(await E.gameLookOf("racing"), null, null), "a failed read draws the default");
  E.setGameLookSource(null);
  const fitted = B.normaliseLoadout({ avatarId: "captain-joulz", colour: 3, slots: { "card-art": "card-art.grid", "game-skin:pool": "game-skin.cue-ball.pixel-pool", "world-theme:racing": null, "game-skin:curling": "frame.gold", "game-skin:pool;drop": "x" } });
  check(fitted?.gameLooks?.["game-skin:pool"] === "game-skin.cue-ball.pixel-pool" && fitted.gameLooks["world-theme:racing"] === null, "the identity backend keeps the per-game slots");
  check(fitted?.gameLooks !== undefined && !("game-skin:curling" in fitted.gameLooks) && Object.keys(fitted.gameLooks).length === 2, "the identity backend drops a slot holding the wrong kind of item and malformed slots");
}

console.log(`skins-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: every game skin and world theme draws, reads at 3:1, keeps the default's sizes and stops under Reduce Motion");
