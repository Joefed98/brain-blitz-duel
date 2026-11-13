/**
 * skins-check (wave 2, E1; docs/skins.md): the 23 game skins and 4 world themes.
 *
 *   1. Catalogue: exactly the catalogue's 20 game skins, 3 card backs and 4 world themes (docs/art/wave-2/catalogue.json),
 *      each skin and theme on its game, the card backs on the account's one `card-back` slot, and the animated ones
 *      exactly the catalogue's animated items.
 *   2. Renders: every look draws every frame of scripts/skins/frames.ts (each game's states through the live stage's
 *      draw and its scene, oldest and dealt stamps) without an error, and differs from the default (the look is drawn).
 *      Full House's deck (scripts/skins/deck-frames.ts): with no back it draws main's pixels exactly (main's own
 *      renderer drawn live in the same run, scripts/skins/base.ts; and scripts/fixtures/skins-deck-frames.json,
 *      recorded on main, wherever main draws those digests), and each card back changes every deck frame, each its
 *      own, inside the default back's box.
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
import { looksFor, lookName } from "./skins/looks";

const one = process.argv.find((a) => a.startsWith("--game="))?.slice(7) as SkinGame | undefined;
if (one) {
  const L = { ...(await import("../src/lib/arcade/skins/look")), ...(await import("../src/lib/arcade/skins/motion.renderer")) };
  const looks = looksFor(one, false);
  const out: { look: string; error: string; differs: boolean; still: boolean; moves: boolean }[] = [];
  L.setSkinReducedMotion(true);
  L.setSkinClock(() => 0);
  const base = (await drawFrames(one, L.NO_LOOK)).map(digest);
  for (const look of looks) {
    const name = lookName(look);
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

const L = { ...(await import("../src/lib/arcade/skins/look")), ...(await import("../src/lib/arcade/skins/motion.renderer")) };

// 1. The catalogue.
{
  const cat = JSON.parse(readFileSync("docs/art/wave-2/catalogue.json", "utf8")) as { items: { id: string; kind: string; game: string | null; animated: boolean; png: string; html: string }[] };
  const names: Record<string, string> = { Apex: "racing", "Crazy Golf": "minigolf", "Cue Ball": "pool", "Curl Champ": "curling", "Full House": "pokersquares", "Top Bins": "freekick" };
  const skins = cat.items.filter((i) => i.kind === "game-skin");
  const worlds = cat.items.filter((i) => i.kind === "world-theme");
  const backs = cat.items.filter((i) => i.kind === "card-back");
  const ours = (m: Readonly<Record<string, readonly string[]>>) => Object.entries(m).flatMap(([g, ids]) => ids.map((id) => `${g}:${id}`)).sort();
  check(skins.length === 20 && worlds.length === 4 && backs.length === 3, `the catalogue holds 20 game skins, 4 world themes and 3 card backs (${skins.length}, ${worlds.length}, ${backs.length})`);
  check(JSON.stringify(ours(L.GAME_SKIN_IDS)) === JSON.stringify(skins.map((i) => `${names[i.game!]}:${i.id}`).sort()), "every catalogue skin is drawn, on its own game, and nothing else");
  check(JSON.stringify(ours(L.WORLD_THEME_IDS)) === JSON.stringify(worlds.map((i) => `${names[i.game!]}:${i.id}`).sort()), "every catalogue world theme is drawn, on its own game, and nothing else");
  check(JSON.stringify([...L.CARD_BACK_IDS].sort()) === JSON.stringify(backs.map((i) => i.id).sort()), "every catalogue card back is drawn, and nothing else");
  check(backs.every((i) => i.game === null && i.id.startsWith("card-back.") && i.png.startsWith("items/card-back/") && i.html.startsWith("items/card-back/")), "the card backs belong to no game, with their art under items/card-back/");
  check(!cat.items.some((i) => i.id.startsWith("game-skin.free-cell.") || i.game === "Free Cell"), "no catalogue item is a Free Cell skin any more");
  check(JSON.stringify([...L.ANIMATED_LOOKS].sort()) === JSON.stringify([...skins, ...worlds, ...backs].filter((i) => i.animated).map((i) => i.id).sort()), "the animated looks are exactly the catalogue's animated items");
  check(Object.keys(L.SKIN_GAME_NAMES).sort().join() === Object.values(names).sort().join(), "the six games with skins (Free Cell has none)");
  check(L.CARD_BACK_GAMES.join() === "pokersquares,tripeaks,pyramid,fivehands", "the card back draws on Full House, Summit, Thirteen and Five Hands (face-down cards)"); // Changed with Joe's approval, 13 Nov 2026: card backs reach Summit, Thirteen and Five Hands (docs/cosmetics-review).
  const slotsSrc = readFileSync("src/lib/economy/slots.ts", "utf8");
  check(/"card-back"/.test(slotsSrc) && !/"Free Cell"\s*:/.test(slotsSrc), "the slot config has the card-back slot and no Free Cell game slot");
}

// 2 and 5. Renders and motion (a child process per game: @napi-rs/canvas frees its memory only on exit).
for (const g of SKIN_GAMES.filter(L.isSkinnableGame)) {
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
    check(r.differs, `${g} ${r.look}: drawn (its frames differ from the default's)`);
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
  const pairsFor = (g: SkinGame, look: { skin: string | null; world: string | null; back?: string | null }) =>
    g === "pool" ? P.poolContrast(look) : g === "minigolf" ? M.minigolfContrast(look) : g === "curling" ? C.curlingContrast(look) : g === "racing" ? R.racingContrast(look) : g === "freekick" ? F.freekickContrast(look) : K.cardsContrast(look);
  const report: string[] = [];
  for (const g of SKIN_GAMES.filter(L.isSkinnableGame)) {
    const looks = [L.NO_LOOK, ...L.GAME_SKIN_IDS[g].map((skin) => ({ skin, world: null })), ...L.WORLD_THEME_IDS[g].map((world) => ({ skin: null, world })), ...L.WORLD_THEME_IDS[g].flatMap((world) => L.GAME_SKIN_IDS[g].map((skin) => ({ skin, world }))), ...looksFor(g, false).filter((l) => l.back)];
    for (const look of looks) {
      for (const pair of pairsFor(g, look)) {
        const ratio = L.bestContrast(pair);
        const name = lookName(look);
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

// Full House's deck: the card back's one place.
{
  const { deckFrames } = await import("./skins/deck-frames");
  // Main's deck, drawn live on this machine by main's own renderer (scripts/skins/base.ts: the merge base, fetched if
  // missing). The stored digests (scripts/fixtures/skins-deck-frames.json, recorded on main, never re-recorded) are
  // this container's record, also asserted when main draws them here exactly; elsewhere the rasteriser differs by CPU.
  const stored = new Map(Object.entries((JSON.parse(readFileSync("scripts/fixtures/skins-deck-frames.json", "utf8")) as { frames: Record<string, string> }).frames));
  const { baseDigests, baseLine } = await import("./skins/base");
  let live: Map<string, string> | null = null;
  try {
    const b = baseDigests();
    console.log(`  ${baseLine(b)}`);
    live = new Map(Object.entries(b.deck));
  } catch (e) {
    check(false, `pokersquares deck: main's renderer could not be drawn (${e instanceof Error ? e.message : String(e)})`);
  }
  const storedHere = !!live && live.size === stored.size && [...stored].every(([n, d]) => live!.get(n) === d);
  if (live) console.log(storedHere ? "  ok main's live deck frames are the stored digests exactly: checked against both" : "  NOTE main's deck draws differently on this machine than where the stored digests were recorded: checked against main live only");
  const want = live ?? stored;
  for (const [label, look] of [["no look argument", undefined], ["the default look", L.NO_LOOK]] as const) {
    const got = await deckFrames(process.cwd(), look);
    const bad = got.filter((f) => want.get(f.name) !== f.digest || (storedHere && stored.get(f.name) !== f.digest)).map((f) => f.name);
    check(got.length === want.size && got.length === stored.size && bad.length === 0, `pokersquares deck, ${label}: main's ${want.size} deck frames exactly${bad.length ? ` (differ: ${bad.join(", ")})` : ""}`);
  }
  const plain = await deckFrames(process.cwd(), L.NO_LOOK);
  // The deck's back is drawn at the deck's place: the alpha box of what a back changes, against the default's back box.
  const changed = (a: { data: Uint8ClampedArray; w: number; h: number }, b: { data: Uint8ClampedArray }) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < a.data.length; i += 4)
      if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) {
        const p = i / 4, x = p % a.w, y = Math.floor(p / a.w);
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
    return { x0, y0, x1: x1 + 1, y1: y1 + 1 };
  };
  const per: string[][] = [];
  for (const back of L.CARD_BACK_IDS) {
    const got = await deckFrames(process.cwd(), { skin: null, world: null, back });
    per.push(got.map((f) => f.digest));
    const same = got.filter((f, i) => f.digest === plain[i]!.digest).map((f) => f.name);
    check(same.length === 0, `pokersquares deck, ${back}: drawn on every deck frame${same.length ? ` (unchanged: ${same.join(", ")})` : ""}`);
    // What a back changes stays inside the deck card's own box (the renderer's: next card's place, 6 right and 4 down).
    const R = await import("../src/lib/arcade/cards/pokerSquares.renderer");
    const dx = R.PS_WORLD_W / 2 - R.PS_NEXT_W / 2 + 6, dy = R.PS_NEXT_Y + 4;
    for (const [i, f] of got.entries()) {
      const box = changed(f, plain[i]!);
      const k = f.name.endsWith("@2") ? 2 : 1;
      const inside = box.x0 / k >= dx - 1 && box.y0 / k >= dy - 1 && box.x1 / k <= dx + R.PS_NEXT_W + 1 && box.y1 / k <= dy + R.PS_NEXT_H + 1;
      check(inside, `pokersquares deck, ${back} ${f.name}: only the deck's card changes, inside its ${R.PS_NEXT_W} × ${R.PS_NEXT_H} box (${box.x0 / k},${box.y0 / k} → ${box.x1 / k},${box.y1 / k})`);
    }
  }
  check(per.every((d, i) => per.every((e, j) => i === j || d.every((x, k) => x !== e[k]))), "pokersquares deck: each card back draws its own back");
  const again = await deckFrames(process.cwd(), undefined);
  check(again.every((f) => want.get(f.name) === f.digest), "pokersquares deck: the default deck is unchanged after a back's draw (the look ends with the draw)");
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
  const backOf = async (slots: Record<string, string | null>, game: Parameters<typeof E.gameLookOf>[0]) => (await lookWith(slots, game)).back ?? null;
  check((await backOf({ "card-back": "card-back.neon" }, "pokersquares")) === "card-back.neon", "an equipped card back draws on Full House's deck");
  check((await backOf({ "card-back": "card-back.neon" }, "pool")) === null && (await backOf({ "card-back": "card-back.neon" }, "freecell" as never)) === null, "the card back draws on no other game (Free Cell deals face up)");
  check((await backOf({ "card-back": "card-back.made-up" }, "pokersquares")) === null && (await backOf({ "card-back": "game-skin.full-house.neon-felt" }, "pokersquares")) === null, "an unknown item or another kind in the card-back slot draws the default");
  check((await backOf({ "card-back": "game-skin.free-cell.neon-card-back" }, "pokersquares")) === null, "an old Free Cell id draws nothing (the migration moved it to card-back.neon)");
  E.setGameLookSource(null);
  // Stored looks (replays and ghosts): a player's skin and back, the viewer's world.
  const stored = L.lookFromStored("pool", { skin: "game-skin.cue-ball.galaxy-set", world: "world-theme.cue-ball.neon-table" });
  check(stored.skin === "game-skin.cue-ball.galaxy-set" && stored.world === "world-theme.cue-ball.neon-table", "a stored look reads back as it was saved");
  check(L.lookFromStored("pool", { skin: "game-skin.apex.molten-gold" }) === L.NO_LOOK && L.lookFromStored("pool", null) === L.NO_LOOK && L.lookFromStored("freecell", { back: "card-back.neon" }) === L.NO_LOOK && L.lookFromStored("pool", "x") === L.NO_LOOK, "a stored look keeps only this game's items (anything else, or none, is the default)");
  const viewer = { skin: "game-skin.cue-ball.pixel-pool", world: null, back: null };
  const seen = L.playerLookIn(stored, viewer);
  check(seen.skin === "game-skin.cue-ball.galaxy-set" && seen.world === null, "a replay or ghost shows the player's skin in the viewer's own world (here the default table)");
  const seen2 = L.playerLookIn(L.NO_LOOK, { skin: null, world: "world-theme.cue-ball.neon-table" });
  check(seen2.skin === null && seen2.world === "world-theme.cue-ball.neon-table", "a player with nothing equipped shows the default skin in the viewer's world");
  check(L.playerLookIn(L.lookFromStored("pokersquares", { back: "card-back.holo-foil" }), L.NO_LOOK).back === "card-back.holo-foil", "a replay shows the player's own card back");
  const fitted = B.normaliseLoadout({ avatarId: "captain-joulz", colour: 3, slots: { "card-art": "card-art.grid", "game-skin:pool": "game-skin.cue-ball.pixel-pool", "world-theme:racing": null, "game-skin:curling": "frame.gold", "game-skin:pool;drop": "x", "card-back": "card-back.royal-damask" } });
  check(fitted?.gameLooks?.["game-skin:pool"] === "game-skin.cue-ball.pixel-pool" && fitted.gameLooks["world-theme:racing"] === null, "the identity backend keeps the per-game slots");
  check(fitted?.gameLooks !== undefined && !("game-skin:curling" in fitted.gameLooks) && Object.keys(fitted.gameLooks).length === 3 && fitted.gameLooks["card-back"] === "card-back.royal-damask", "the identity backend keeps the card-back slot, and the identity backend drops a slot holding the wrong kind of item and malformed slots");
}

// 7. Card backs on Summit, Thirteen and Five Hands (13 Nov 2026, Joe; docs/cosmetics-review): the account's back draws on
// their face-down cards, never on a face, so nothing a player can read about the cards changes.
{
  const { BACK_ONLY_GAMES } = await import("./skins/frames");
  for (const g of BACK_ONLY_GAMES) {
    check(L.isCardBackGame(g) && !L.isSkinnableGame(g), `${g}: draws the account's card back and has no skins or world themes`);
    const child = Bun.spawnSync(["bun", import.meta.path, `--game=${g}`], { stdout: "pipe", stderr: "inherit" });
    const line = child.stdout.toString().split("\n").find((l) => l.startsWith("JSON "));
    if (child.exitCode !== 0 || !line) {
      check(false, `${g}: the card backs did not draw (exit ${child.exitCode})`);
      continue;
    }
    const rows = JSON.parse(line.slice(5)) as { look: string; error: string; differs: boolean; still: boolean; moves: boolean }[];
    check(rows.length === L.CARD_BACK_IDS.length && rows.every((r) => L.CARD_BACK_IDS.includes(r.look)), `${g}: every card back is drawn (${rows.map((r) => r.look).join(", ")})`);
    for (const r of rows) {
      const animated = L.ANIMATED_LOOKS.includes(r.look);
      check(!r.error, `${g} ${r.look}: draws every frame without an error${r.error ? ` (${r.error})` : ""}`);
      check(r.differs, `${g} ${r.look}: drawn on the face-down cards (its frames differ from the default's)`);
      check(r.still, `${g} ${r.look}: still under Reduce Motion`);
      check(animated ? r.moves : !r.moves, `${g} ${r.look}: ${animated ? "moves with Reduce Motion off" : "never moves (not animated)"}`);
    }
  }
  // Every face, at the sizes these games draw, is the same pixels with any back equipped: a back is only ever drawn on a
  // face-down card.
  const { createCanvas } = await import("@napi-rs/canvas");
  const C = await import("../src/lib/arcade/cards/cards.renderer");
  const K = await import("../src/lib/arcade/skins/cards.skins");
  const faceDigest = (look: { skin: string | null; world: string | null; back: string | null }, down: boolean, w: number, h: number) => {
    const c = createCanvas(Math.ceil(w * 2) + 8, Math.ceil(h * 2) + 8);
    const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    ctx.scale(2, 2);
    const hash = createHash("sha256");
    for (let card = 0; card < 52; card++) {
      ctx.clearRect(0, 0, w + 4, h + 4);
      C.withCardsLook(look, () => C.drawCard(ctx, card, 2, 2, w, h, { down }));
      hash.update(c.getContext("2d").getImageData(0, 0, c.width, c.height).data);
      if (down) break;
    }
    return hash.digest("hex");
  };
  for (const [w, h] of [[48, 76], [40, 60], [60, 84]] as const) {
    const plainFaces = faceDigest(L.NO_LOOK as never, false, w, h);
    const plainBack = faceDigest(L.NO_LOOK as never, true, w, h);
    for (const back of L.CARD_BACK_IDS) {
      const look = { skin: null, world: null, back };
      check(faceDigest(look, false, w, h) === plainFaces, `${back}: all 52 faces at ${w} × ${h} draw exactly as with no back`);
      check(faceDigest(look, true, w, h) !== plainBack, `${back}: the face-down card at ${w} × ${h} draws the back`);
    }
  }
  for (const back of L.CARD_BACK_IDS)
    for (const pair of K.cardsContrast({ skin: null, world: null, back }).filter((p) => p.object === "deck's card back")) {
      const ratio = L.bestContrast(pair);
      check(ratio >= L.SKIN_MIN_CONTRAST, `${back} on the default table (Summit, Thirteen, Five Hands): ${ratio.toFixed(2)}:1 (at least ${L.SKIN_MIN_CONTRAST}:1)`);
    }
}

console.log(`skins-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: every game skin and world theme draws, reads at 3:1, keeps the default's sizes and stops under Reduce Motion");
