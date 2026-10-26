# Sound cues: replays

No audio is attached yet. Every replay effect, animation or moment dispatches

```js
window.dispatchEvent(new CustomEvent("duelz-sound", { detail: { cue: "<name>" } }));
```

through `soundCue()` in `src/lib/replay/cues.ts`. Shared screens use `shared.<event>`; a
game's own moment uses `<gameId>.<momentId>` (the ids in `MOMENT_TABLE`,
src/lib/replay/moments.ts). Lengths are how long the thing the cue marks lasts on screen, for
sizing a sound; "instant" means a one-shot at that moment.

## Shared cues

| Cue | Trigger | Length |
|---|---|---|
| `shared.highlight.start` | The results-screen highlight has replayed the winner's run and starts playing | the whole highlight, about 7.5 s at most (two moments of about 3.7 s, or one of about 7.3 s; shorter when the results screen has less time left) |
| `shared.highlight.clip` | Each highlight clip (and the play of the game's clip) begins | the clip, about 3.7 s (up to 7.3 s for a single moment; 10–15 s on the podium) |
| `shared.slowmo` | Playback enters the half-speed stretch around a moment's key tick | 1.4 s on the results screen for two moments (0.35 s of sim either side; 2 s for one moment), 3 s on the podium |
| `shared.slowmo.end` | Playback leaves the half-speed stretch | instant |
| `shared.highlight.skip` | Skip tapped on a highlight, card or time-lapse | instant |
| `shared.highlight.end` | The highlight finished on its own | instant |
| `shared.replay.open` | "Watch \<name\>'s run" opened the full-run player | the run, up to 60–90 s at 1x (until Close or the room moves on) |
| `shared.replay.speed` | Slow / 1x / 2x tapped in the full-run player | instant |
| `shared.replay.seek` | The seek bar moved the playback | instant |
| `shared.replay.close` | The full-run player closed | instant |
| `shared.momentcard` | Not fired by replays since 18 Oct 2026 (puzzle replays are silent); the slot stays for NewBestMoment and `room.award`. Was: a moment card (Flash, Bang On, Nucleus, Forage) appears | the pop-in, about 0.4 s; the card stays up until the screen moves on (6 s on the podium) |
| `shared.timelapse.start` | Not fired since 18 Oct 2026 (puzzle replays are silent). Was: A puzzle time-lapse starts | about 7.5 s, within the results screen's time left (5–10 s on the podium) |
| `shared.timelapse.move` | Not fired since 18 Oct 2026 (puzzle replays are silent). Was: Each move of a time-lapse lands on the board | instant, every 25–600 ms (about 7.5 s ÷ moves) |
| `shared.timelapse.end` | Not fired since 18 Oct 2026 (puzzle replays are silent). Was: The time-lapse reached the winner's last move | instant (the final board holds 1.5 s) |
| `shared.playofthegame` | The podium picked the play of the game and starts it | 10–15 s (arcade), 5–10 s (time-lapse), 6 s (card) |
| `shared.playofthegame.skip` | Skip tapped on the play of the game | instant |
| `shared.playofthegame.end` | The play of the game finished on its own | instant |

## Game moment cues

Fired once per clip when playback reaches the moment's key tick (results highlight and
podium play of the game). The final-second save fires as `<gameId>.final-second` for whichever
game the round was.

| Cue | Trigger | Length |
|---|---|---|
| `hover.zone` | New zone (every 7 barriers): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `hover.gold-star` | Gold star: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `hover.two-gap` | Through a two-gap barrier: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `hover.slipped-through` | Slipped through a moving barrier: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `hover.all-barriers` | Every barrier passed: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `hover.tight-gate` | Through a tight gate (hoverRev 9): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `hover.star-chain` | A whole star chain (hoverRev 9): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `hover.shield` | Shield picked up (hoverRev 9): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `hover.centre-line` | Along a tight gate's centre line (hoverRev 9): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `breaker.power-up` | Power-up caught: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `breaker.bricks` | Bricks streak (every 10): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `breaker.fireball` | Fireball caught: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `breaker.moving-target` | Brick out of a sliding row: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `breaker.row-clear` | Row cleared: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `breaker.wall-cleared` | Wall cleared: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `breaker.gold-brick` | Gold brick broken by a direct hit (brkRev 9): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `breaker.combo` | No-touch combo stepped up (×2, ×3; brkRev 9): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `rally.long-rally` | Long rally (every 10 returns): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `rally.gold` | Gold ball returned: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `rally.target` | Far-wall target struck: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `rally.bumper` | Off the bumper: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `beat.combo` | Combo (every 10): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `beat.swipe` | Swipe note hit: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `beat.full-combo` | Full combo: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `snake.stars` | Stars streak (every 10): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `snake.dodged` | Rock dodged: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `snake.shower` | Meteor shower incoming: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `snake.shower-dodged` | Meteor shower dodged: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `snake.all-eaten` | Every star eaten: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `burst.wave-cleared` | Wave cleared: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `burst.freeze` | Freeze caught: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `burst.flawless` | Flawless finish: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `burst.last-life-wave` | Wave cleared on the last life: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `wavefront.saucer` | Saucer shot down: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `wavefront.wave-cleared` | Wave cleared: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `wavefront.diver-down` | Diver shot mid-dive: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `wavefront.boss-hits` | Boss hit streak (every 6): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `wavefront.boss-down` | Boss destroyed (all waves on older rounds): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `orbit.planets` | Planets streak (every 10): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `orbit.all-planets` | All 40 planets: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `orbit.black-hole` | Through a black hole: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `skyline.perfect-drop` | Perfect drop: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `skyline.floors` | Floors streak (every 10): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `skyline.streak` | Perfect streak: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `skyline.wind-perfect` | Perfect drop in the wind: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `cross.crossing` | Road crossed: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `cross.bikes` | Past the cyclists: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `cross.cones` | Through the roadworks: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `junction.ambulance` | Ambulance through: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `junction.cleared` | Cars cleared (every 10): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `junction.bus` | Bus through: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `junction.new-roads` | New roads' traffic (every 5): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `inkbridge.level` | Level cleared: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `inkbridge.gold-star` | Coin through the gold star: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `inkbridge.all-levels` | All 10 levels: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `slice.combo` | Combo multiplier: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `slice.frenzy` | Sauce frenzy: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `slice.simmer` | Simmer (slow time): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `slice.sliced` | Sliced streak (every 25): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `slice.mayo` | Mayonnaise squeezed: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `slice.many-in-one` | Four or more in one cut: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `bintoss.in-a-row` | Buckets in a row (3+): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `bintoss.hoop` | Through the hoop: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `bintoss.spinner` | Past the spinner: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `bintoss.ten-of-ten` | Ten out of ten: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `bullseye.bullseye` | Bullseye: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `bullseye.inner-bull` | Inner bull: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `bullseye.balloon` | Balloon popped: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `bullseye.bulls-in-a-row` | Bulls in a row: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `bullseye.all-on-target` | All ten on target: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `bubble.big-pop` | Big pop (5+): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `bubble.big-drop` | Big drop (3+): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `bubble.joker` | Joker: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `bubble.mine` | Mine: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `bubble.torpedo` | Torpedo: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `bubble.reef-cleared` | Reef cleared: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `flip.seconds` | Survival streak (every 10 s): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `flip.survived` | Survived: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `flip.star` | Star taken: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `flip.all-stars` | All 10 stars: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `flip.just-in-time` | Off a crumbling tile just in time: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `swing.distance` | Distance (every 100 m): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `swing.star` | Star: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `swing.dodged` | Stalactite dodged: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `swing.over-lava` | Over the lava jet: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `swing.finish` | 500 m (dragon outrun): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `swing.gem` | High-route gem (swingRev 13): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `swing.speed-gate` | Speed gate lit (swingRev 13): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `swing.ledge` | Landed on a ledge (swingRev 13): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `swing.combo` | Swing combo point (swingRev 13): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `swing.section` | Set-route section cleared (swingRev 13): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `swing.par` | Section finished under par (swingRev 13): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `snip.leaf` | Leaf taken: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `snip.level` | Apple fed: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `snip.all-apples` | All 10 apples: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `snip.spring` | Off a springy branch: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `tilt.maze` | Maze done: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `tilt.all-mazes` | All 4 mazes: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `tilt.star` | Bonus star: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `tilt.first-marble` | First marble home: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `balltrack.home` | Marbles home (every 5): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `balltrack.all-home` | All 30 home: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `balltrack.turned-home` | Home off a turned tube: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `balltrack.switched-home` | Home past a switch: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `matchup.cascade` | Cascade (3+ steps): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `matchup.line-of-five` | Five or more in a line: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `matchup.jackpot-gem` | Jackpot gem made: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `matchup.jackpot` | Jackpot set off: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `matchup.par-smashed` | Par smashed: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `wordfall.word` | Word made: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `wordfall.long-word` | Six-letter (or longer) word: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `wordfall.par` | Par reached: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `whack.bonks` | Bonks streak (every 10): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `whack.clean-twenty` | Twenty bonks without a wrong tap: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `clayshoot.gold` | Gold clay: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `clayshoot.clays` | Clays streak (every 10): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `clayshoot.double` | Two clays with one shot: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `tendrop.ten` | Ten made: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `tendrop.all-cleared` | Every target cleared: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `stroop.sorted` | Sorted streak (every 5): the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `stroop.all-sorted` | Whole queue sorted: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `stroop.flawless` | Whole queue sorted without a mistake: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `<gameId>.final-second` | Final-second save: scored in the last two seconds: the clip reaches the moment's key tick | instant (the moment lands; about 0.5 s of half-speed play follows) |
| `<gameId>.final` | No moment fired in the winner's run: the stand-in clip of its last four seconds reaches the final tick | instant |
