# Ricochet: the ninja wall-climb (`ricoRev` 2, 1 Nov 2026)

Ricochet is back from retirement as an active arcade game in the **Action** group, under its existing id
(`ricochet`) on a new stamp, `ricoRev` 2. A puzzle without the stamp is the original ball-and-spikes shaft
(`src/lib/arcade/ricochet.ts`, `replayRicoRun`): its sim, grading, reveal, replay and 150-point score are unchanged,
so any stored Ricochet run replays exactly as before. The same id was kept (rather than a new one) because the
registry, names, tile, practice bests and history already carry it, and the stamp is the codebase's way to change a
game's rules (rule 2 in CLAUDE.md).

Code: sim `src/lib/arcade/ricochetNinja.ts`, art `ricochetNinja.renderer.ts` (and the play-screen fill
`ricochetNinjaScene.renderer.ts`), round plumbing `src/lib/duel/ricochet.ts` (`encodeNinjaRun`, `replayNinjaRun`),
stage and reveal `src/puzzles/ricochet.tsx` (dispatching on the stamp), sounds `ninjaSounds` in `gameSounds.ts`.

## The game

- 60 s, the old Ricochet's round length (63 s round clock). Two temple walls of dark stone at night, a moon and a
  distant pagoda behind; "HEIGHT N m" at the top left, coins, lanterns and scrolls at the top right.
- **Tap**: leap to the other wall (26 ticks of sideways travel on an arc, about +108 px, 2.7 m, a leap).
- **Tap again in the air**: the one double jump of that leap: new upward speed and a 10-tick hang (the sideways travel
  pauses), to clear a blade or reach a higher lantern or scroll.
- **Clinging** slides the ninja slowly down (0.375 px a tick on stone); **moss** slides fast (2.5 px a tick);
  **ice** gives no grip (5.5 px a tick: leap off at once). The floor stops the slide.
- **Katanas** stuck in the walls (a gold guard and a steel blade 48 px long that glints) and **shurikens** spinning
  across the gap on seeded paths (a back-and-forth crossing, level or slanting) knock the ninja down 120 px (3 m)
  over a third of a second, then a 1 s stun and a ¾ s grace (blinking, no hit). No game over.
- **The ninja is the Joulz hero** (`drawHero`, `src/lib/arcade/hero.renderer.ts`, the figure of the score celebrations:
  gold cape, gold-outlined black limbs, chest bolt, gold gloves and boots, black head with the gold ring, mask band and
  eye slits) in ninja gear: a dark wrap round the head that leaves the hero's face showing, a red headband with trailing
  tails, a red sash and a small katana on the back. Poses: clinging (hands and feet on the wall), leaping (stretched along
  the arc), double jump (a tuck turning a full circle through the hang) and stunned (arms dropped, swaying, stars). The
  tile icon and the intro still draw the same figure.
- **The body is a box**, 26 × 52 px (`NINJA_HW` 13, `NINJA_HH` 26; about twice the first drawing), and every pose is
  drawn inside it (the arcade bounds rule): a katana's blade or a coin, lantern or scroll touching the box is a touch.
  Shurikens are 11 px to their points (steel grey, a dark outline, a red centre ring, a bright bevel so the turning
  reads, a faint dotted line along each one's seeded path); a hit is the box within 1 px of a point.
- **Moss and ice** patches are 14 px into the stone. Moss: green with tufts and drips. Ice: pale blue, frosted
  (speckles and crystal streaks), a glint running down it and icicles off its lower edge.
- **Coins** (60) sit three to an arc along twenty good leaps; **gold lanterns** (10) hang on the walls where the
  route clings, about half sliding slowly up and down; **scrolls** (4, rare) sit at the top of double-jump lines,
  never off the route.
- Everyone in a room climbs the identical tower: everything is dealt from the room seed in the sim at init; nothing
  random is drawn during play.

## The deal and its proof

`ninjaBuildDeal(seed)`: surfaces first (moss and ice patches up each wall, closer together higher up); then a route
is planned through the real movement code (`planRoute`): at each landing a wait (none on ice, 0–2 ticks on moss,
otherwise usually none, sometimes a short or a longer wait), and about one leap in three double jumps. Coins,
lanterns and scrolls are laid on that route (sliding lanterns phased to be where the route clings when it clings).
Hazards are laid clear of the route (a katana or shuriken that would touch it, with a margin, is moved or dropped):
katanas where a plain leap would land on the route's double-jump leaps (so the double jump is the way past),
shurikens across where a leap-at-once would be on the route's longer waits (so waiting is the way past), and more of
both up the tower, closer together higher up. Finally the route is played through the real `step`: the deal is kept
only if it takes every item, takes no hit and climbs at least NINJA_CORE_FULL_M, 241 m (else the next attempt's seed). So
**a perfect run reaches 200 on every dealt tower**; arcade-standard-check plays 24 towers' witnesses through the
server replay (200 with `CHECKS_FULL=1`), all at 200 with every part at its maximum. A deal takes about 20–60 ms
(the stage and the server cache the last eight).

## Scoring (the arcade standard)

| Part | Maximum | How |
| --- | --- | --- |
| Height | 130 | metres climbed (best height above the start, 40 px a metre) on a straight line, full at **241 m** |
| Coins | 30 | shared across 60 coins (floor(30 × coins ÷ 60)) |
| Lanterns | 20 | 2 for each of 10 gold lanterns |
| Scrolls | 20 | 5 for each of 4 scrolls |
| **Total** | **200** | any input scores at least 1; no input 0 |

A hit costs only the height and time it takes (no points). The core's full figure, 241 m, is the near-perfect
level's median (below); every dealt tower's witness reaches it (the witnesses climb 278–324 m on 40 test towers).

## Skill bands

`bun scripts/ninja-bands.ts --seeds=40` (room seeds n = 0…39 through the server's encode and replay; bot
`scripts/arcade-skill-bands/bots/ricochet.ts`: at each landing it weighs 104 plans of wait and double-jump timing on
the real sim, looking one leap further for its ten best, with the level's reaction, timing error, judgement and
slips; elite and flawless weigh the items higher, since height past 241 m pays nothing):

| Level | Score | Height (130) | Coins (30) | Lanterns (20) | Scrolls (20) | Metres | Hits |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Random tapper | 44 | 33 | 5 | 4 | 5 | 62 | 22 |
| Weak | 67 | 51 | 8 | 4 | 5 | 96 | 20 |
| Average | 105 | 78 | 11 | 8 | 8 | 145 | 17 |
| Good | 143 | 108 | 16 | 10 | 10 | 201 | 14 |
| Great | 161 | 120 | 17 | 10 | 15 | 222 | 13 |
| Near-perfect | 176 | 130 | 20 | 12 | 15 | 241 | 11 |
| Elite | 184 | 130 | 22 | 14 | 18 | 254 | 10 |
| Flawless | 188 | 130 | 25 | 14 | 20 | 269 | 10 |

Before the hero body (a 15 px circle, the first PR push), the same run gave 42 / 64 / 94 / 132 / 153 / 170 / 177 / 182
with the core full at 296 m: the larger body is easier to hit and catches items more readily, so the climb is
lower (near-perfect 296 → 241 m) and the full mark moved with it.

The witness (the deal's own route) scores 200 on every tower. The bots' flawless level stays below it because its
plan looks only two leaps ahead and finds the sliding lanterns hard to time; the gaps at the top are 8 (near →
elite) and 4 (elite → flawless).

## Decisions and assumptions

- The same id, `ricochet`, on `ricoRev` 2 (see the top). ROUND_MAX is 200 for the id (the reveal chart, help and
  awards read it); an unstamped round still scores at most 150 on its own sim.
- World 390 × 730 (the taller worlds' size), in the `realworld` success-layer world; Action's red is the tile border
  and intro colour through the Action group (`arcadeGroups.ts`).
- The mockup (ricochet-mockup.png) was not in the repository or the session; the look follows the brief's words.
- Music borrows Grappler's bed (`music_swing`) until `music_ricochet` has a file. Slots with no file yet (silent, or
  the shared sound they fall back to): `ricochet.leap`, `ricochet.doubleJump`, `ricochet.hit`, `ricochet.coin`,
  `ricochet.lantern`, `ricochet.scroll`, `ricochet.land`, `ricochet.slip`, `music_ricochet`.
- Haptics: `impact` on a hit (the sound observer's `feel`) and the shared arcade buzzer; nothing else.
- Desktop: `tall` (upright at full height; the stone wall carried on beside the world); Space, ↑ or W leaps, as does
  a click.
- No intro demo yet (the intro shows a still frame of seed 0's witness climb); listed in
  `docs/demo-replay-audit.md` "Demos still needed".
