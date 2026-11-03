# Moon Climb: ricoRev 3 (3 Nov 2026)

Ricochet is shown as **Moon Climb** since 3 Nov 2026 (`gameNames.ts`; the id stays `ricochet`). Rooms and practice deal
`ricoRev` 3 (`MOON_REV`); a ricoRev 2 round (the ninja wall-climb, below) and an unstamped one (the old shaft) replay and
score exactly as before (moon-blockzone-check replays 12 ricoRev 2 runs recorded on main). Rev 3 has its own step
(`stepMoon`), deal (`moonBuildDeal`), parts (`moonStdParts`), checkpoint and run plumbing (`replayMoonRun`); nothing in
rev 2's code path changed. Joe's mockup (the moon, the pagoda, the pills, the sky lantern, a mid-ledge) set the look.

## What changed

- **No coins and no gold lanterns.** **Scrolls** stay, rarer: three a tower (the brief's 2–4; a fixed count, the arcade
  rule), at the top of double-jump lines on the route, never off it.
- **Sky lanterns** (six a tower, `MOON_SKY`): paper lanterns glowing orange that float slowly up the middle of the shaft
  (0.75 px a tick, for 15 s each), seeded in place, height and time from the room seed, the same for everyone. A leap
  that touches one (the ninja's body box within 14 px of its centre) grabs it: the ninja hangs under it and rides up
  3 px a tick for 105 ticks (1.75 s). A tap leaps off: towards the left wall if the tap is on the screen's left half,
  the right wall on the right half (the input's `a`, −1 / 1; ← → or A / D on a computer, Space the wall it was heading
  for). Riding to the end lets go towards the wall the leap was heading for (a drop, not a leap). One ride a lantern.
- **Mid-ledges:** short hanging stone pieces in the middle of the shaft, 18 px wide (`MOON_LEDGE_HW` 9), 130–180 px tall.
  A leap that meets one clings to its near side (the body box overlapping the ledge by at least 2 px); a tap from there
  leaps back to the wall the ninja came from, a shorter hop (the sideways ticks are in proportion to the distance, so a
  hop to a ledge and back climbs faster than crossing the whole gap). Clinging on a ledge slides as stone and holds at
  its lower end.
- **Flow:** every landing (a wall, a ledge or a lantern grabbed) adds one to the streak; a hit, or taking off after
  sliding 16 px or more since the landing (waiting too long, or moss and ice), sets it to 0. "Flow ×N" in the HUD (gold
  while a streak runs), beside "Height N m". Every 7 in a row pays.
- **No triple jump;** the double jump is unchanged. Everything else (walls, leaps, katanas, shurikens, moss, ice, the
  knock-down and stun, 60 s) is rev 2's.
- **The look:** a larger moon high in the shaft and the pagoda under it (`paintMoonSky`), the ledges, the lanterns
  (`drawSkyLantern`, inside the touch radius; the glow is light only), the hanging pose (pose 4), the two pills.
- **The tile:** the Joulz hero ninja mid-leap towards a sky lantern, a mid-ledge and a katana, on the night temple with
  the moon and the pagoda (`scripts/shots/tile-scenes/arcade2.tsx`, `backgrounds.ts`).

## The deal and its proof

`moonBuildDeal(seed)`: the surfaces as rev 2, then a route planned through the real movement (`planMoon`): six leaps
(from walls, about every 500 ticks) meet a sky lantern placed to be where the leap will be in mid-gap (seeded float and
lead time; clear of the route before it), ridden 30–90 ticks and left towards a seeded wall; several leaps meet a ledge
placed in their way (clear of the route before it and of the lanterns' floats); waits never let a slide break the flow.
Scrolls go on three double-jump apexes; katanas and shurikens are laid clear of the route (and shurikens clear of the
ledges). The deal is kept only if the witness, played through the real step, rides all six lanterns, earns the whole
flow part, takes the three scrolls, takes no hit and climbs at least 245 m. **Every dealt tower has a route to 200**
(arcade-standard-check plays 24 witnesses through the server replay, 200 with `CHECKS_FULL=1`; moon-blockzone-check 12,
60 at full depth). A deal takes about 25 ms (cached, eight seeds).

## Parts (200 in all)

| Part | Max | How |
| --- | ---: | --- |
| Height (core) | 125 | metres climbed on a straight line, full at **245 m** |
| Flow | 30 | 3 for every 7 clean leaps in a row (Flow ×7, ×14, …), up to 10 |
| Lantern rides | 30 | 5 for each of 6 sky lanterns ridden |
| Scrolls | 15 | 5 for each of 3 scrolls |

Any input scores at least 1; no input 0. The core's full mark sits between the great (239 m) and near-perfect (259 m)
medians, fitted to the targets with the flow step (7).

## Medians, weak → flawless, before → after (fresh seeds 10000–10039, the server replay; `bun scripts/ninja-bands.ts --rev=3 --from=10000`)

| Level | ricoRev 2 | Moon Climb, ricoRev 3 | Target | Height | Flow | Rides | Scrolls | Metres | Hits | Best flow |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Random tapper | 44 | 34 | — | 31 | 0 | 0 | 0 | 60 | 21 | 6 |
| Weak | 76 | **55** | 30–60 | 48 | 0 | 0 | 5 | 96 | 21 | 6 |
| Average | 105 | **88** | ~90 | 75 | 6 | 5 | 5 | 148 | 18 | 9 |
| Good | 139 | **126** | 120–140 | 104 | 9 | 10 | 5 | 204 | 15 | 12 |
| Great | 162 | **165** | ~160 | 121 | 15 | 20 | 8 | 239 | 13 | 15 |
| Near-perfect | 175 | **178** | ~175 | 125 | 20 | 25 | 10 | 259 | 12 | 18 |
| Elite | 179 | **189** | 185–195 | 125 | 24 | 30 | 13 | 272 | 11 | 20 |
| Flawless | 187 | **200** | 200 | 125 | 30 | 30 | 15 | 316 | 0 | 110 |

The bot (`moonBot` in `scripts/arcade-skill-bands/bots/ricochet.ts`) weighs, at each landing, waits and double-jump
moments, and on a lantern how long to ride and which wall to leap towards, on the real sim, valuing height against time,
rides, scrolls and Flow steps (less the streak a plan throws away), with the level's reaction, timing, judgement and
slips. Flawless plays the deal's witness (the route the deal proved), as Blockfall's and Golf Solitaire's oracles do.

## Sounds and haptics

New slots `ricochet.lanternGrab`, `ricochet.lanternRide` (a loop while riding), `ricochet.ledge`, `ricochet.flow`;
`ricochet.leap`, `.doubleJump`, `.land`, `.hit`, `.slip`, `.scroll` kept; `ricochet.coin` and `ricochet.lantern`
removed; `music_ricochet` is the bed (Grappler's track until Joe's file). Every slot plays a library sound until its
file is set (`docs/sound-cues/moon-climb-blockzone.md`). Haptics unchanged: `impact` on a hit and the arcade buzzer.

## Decisions and assumptions

- Lantern-ride direction is chosen by the tap's side of the screen (the brief: "tap to leap off towards either wall").
- The flow's "no slide" is a slide of 16 px before the take-off (about 0.7 s waiting on stone, a moment on moss, none
  on ice): short waits for a shuriken keep the flow.
- Moon Climb's intro still is seed 0's witness riding its first lantern; no intro demo is recorded yet.

---

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
