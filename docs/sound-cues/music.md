# Music: screens and games

Music beds loop on the music channel (`src/lib/sound.ts`). Screen beds go through
`startMusic`; round beds belong to the round's phase state (`useRoundMusic`), are chosen by
`roundMusicFor` (`src/lib/fx/theme.ts`) and ramp with the clock. A slot with `url: null`
is silent (or borrows the track named under **Plays today**) until a file is set; see
[README.md](README.md).

Slot names: `music_<screen>` for a screen, `music_<gameId>` for an arcade game and
`music_<category>_<gameId>` for a puzzle (so a puzzle's own bed keeps the puzzle volume
ramp). A game's own slot, once it has a file, takes over from the shared bed it plays today.

## Screens

| Cue | Screen | Plays today | Slot | Length |
|---|---|---|---|---|
| `music.home` | Home / join (`/`), and since 1 Nov 2026 the app-wide home bed: Play, Practice's list, Tournaments, Profile and the settings sheet | `music_home` (`music_menu.mp3`) | `music_home` | 60 s loop |
| `music.practice` | Practice game list (`/practice`) | `music_home` (the home bed carries on; the slot is not started since 1 Nov 2026) | `music_practice` | 60 s loop |
| `music.lobby` | Room lobby | `lobby_loop` (crossfades the home bed out over 400 ms; leaving the lobby for a tab page crossfades it out and the home bed resumes where it was) | `lobby_loop` | loop |
| `music.prepare` | Prepare to Duel | none (stopped for the voice line) | `music_prepare` | 6 s (screen) |
| `music.roundTitle` | Round title | none (stopped for the voice line) | `music_round_title` | 3 s (screen) |
| `music.intro` | Round intro (rooms and practice) | `intro_loop` | `intro_loop` | loop |
| `music.round` | Live round | per game, see below | | |
| `music.reveal` | Answer reveal (rooms and practice) | none (stopped as the score lands) | `music_reveal` | 8 s (screen) |
| `music.standings` | Round result and standings | `standings_loop` | `standings_loop` | loop |
| `music.winner` | Winner reveal | none (drum roll and voice) | `music_winner` | 6.3 s (screen) |
| `music.podium` | Podium / final result | `podium_loop` | `podium_loop` | loop |
| `music.tension` | Tension bed (not placed) | registered, no file, never started (`startMusic` refuses it) | `tension_loop` | loop |

**The home bed** (1 Nov 2026, Joe: it restarted on every page change): one app-wide player, `holdHomeBed` /
`useHomeBed` in `src/lib/sound.ts` and `src/lib/useScreenMusic.ts`. Play, Practice's list, Tournaments and Profile each
hold it; moving from one to the next never stops or restarts it (a screen that lets go starts a 400 ms grace,
`HOME_BED_GRACE_MS`, which the next holder cancels). It changes only when another bed takes over: the room lobby's own
`lobby_loop` (since the follow-up of 1 Nov 2026, as before the home bed; a room page holds the home bed only while it
loads, then the lobby's bed crossfades it out over 400 ms), a round's intro (`intro_loop`) or a game's music, or the
room's own screens. Leaving the lobby for a tab page crossfades `lobby_loop` out over 400 ms (`releaseRoomMusic`) as
the home bed comes back in. When a holder comes back it resumes the home
bed from where it was left (the loop position is kept), not from the top. It is never released with a room's beds.
Mute, the music slider, pausing while the app is hidden and the audio's sleep after silence apply as to any other bed;
Battery saver leaves music as it was (it never touched music).

The sound settings sheet opens over the current screen and keeps its music. The prepare,
round-title and winner-reveal screens are silent on purpose today so their voice lines
carry; a file in their slot plays under the voice line (voice lines duck music).

## Games

| Cue | Game | Plays today | Slot | Length |
|---|---|---|---|---|
| `music.pinball` | Pinball (arcade) | `music_rally` (borrowed from Rally) | `music_pinball` | 60 s loop |
| `music.beat` | Tempo (arcade) | none: the chart's synthesised beat is the music | `music_beat` | 60 s loop |
| `music.swerve` | Swerve (retired, practice) | none | `music_swerve` | 60 s loop |
| `music.steady` | Steady (retired, practice) | none | `music_steady` | 60 s loop |
| `music.dual` | Dual (retired, practice) | none | `music_dual` | 60 s loop |
| `music.ricochet` | Ricochet (retired, practice) | none | `music_ricochet` | 60 s loop |
| `music.bastion` | Bastion (retired, practice) | none | `music_bastion` | 60 s loop |
| `music.rooftop` | Rooftop Run (retired, practice) | none | `music_rooftop` | 60 s loop |
| `music.hotfloor` | Hot Floor (retired, practice) | none | `music_hotfloor` | 60 s loop |
| `music.balltrack` | Ball Tracker | `music_balltrack` | `music_balltrack` | loop |
| `music.breaker` | Breaker | `music_breaker` | `music_breaker` | loop |
| `music.bubble` | Coral Pop | `music_bubble` | `music_bubble` | loop |
| `music.burst` | Fission | `music_burst` | `music_burst` | loop |
| `music.bullseye` | Flightpath | `music_bullseye` | `music_bullseye` | loop |
| `music.matchup` | Gemstone | `music_matchup` (`music_matchup2.mp3`, an energetic 150 BPM chiptune loop since 28 Oct 2026) | `music_matchup` | 51.2 s loop |
| `music.swing` | Grappler | `music_swing` | `music_swing` | loop |
| `music.skyline` | High Rise | `music_skyline` | `music_skyline` | loop |
| `music.hover` | Hover | `music_hover` | `music_hover` | loop |
| `music.cross` | Jaywalk | `music_cross` | `music_cross` | loop |
| `music.snake` | Meteor | `music_eatgrow` | `music_eatgrow` | loop |
| `music.orbit` | Orbit | `music_orbit` | `music_orbit` | loop |
| `music.inkbridge` | Rainbow Bridge | `music_inkbridge` | `music_inkbridge` | loop |
| `music.rally` | Rally | `music_rally` | `music_rally` | loop |
| `music.flip` | Roofbound | `music_flip` | `music_flip` | loop |
| `music.snip` | Scrumper | `music_snip` | `music_snip` | loop |
| `music.slice` | Slice | `music_slice` | `music_slice` | loop |
| `music.bintoss` | Swish | `music_bintoss` | `music_bintoss` | loop |
| `music.tilt` | Tilt | `music_tilt` | `music_tilt` | loop |
| `music.wavefront` | Wavefront | `music_wavefront` | `music_wavefront` | loop |
| `music.junction` | Junction (retired, practice) | `music_junction` | `music_junction` | loop |
| `music.minigolf` | Crazy Golf | `music_minigolf` | `music_minigolf` | 52.2 s loop |
| `music.pool` | Cue Ball | `music_pool` | `music_pool` | 49.1 s loop |
| `music.curling` | Curl Champ | `music_curling` | `music_curling` | 39.3 s loop |
| `music.homerun` | Home Run | `music_homerun` | `music_homerun` | 52.0 s loop |
| `music.freekick` | Top Bins | `music_freekick` | `music_freekick` | 53.7 s loop |
| `music.racing` | Apex | `music_racing` | `music_racing` | 56.0 s loop |
| `music.minesweeper` | Minefield | `music_minesweeper` | `music_minesweeper` | 55.9 s loop |
| `music.freecell` | Free Cell | `music_freecell` | `music_freecell` | 47.4 s loop |
| `music.mahjong` | Mahjong Solitaire | `music_mahjong` | `music_mahjong` | 48.0 s loop |
| `music.tripeaks` | Summit | `music_tripeaks` | `music_tripeaks` | 55.7 s loop |
| `music.pokersquares` | Full House | `music_pokersquares` | `music_pokersquares` | 55.2 s loop |
| `music.fivehands` | Five Hands | `music_fivehands` (Full House's bed, `music_pokersquares.mp3`) | `music_fivehands` | 55.2 s loop |

Every puzzle (Word, Number, Speed, Attention, Pattern, Logic, and the engine games Letterfall,
Tenfall, Bonk, Pull! and Mixed Signals) plays one of its category's three shared beds
(`music_<category>_1`–`3`, per game in `PUZZLE_MUSIC`; Dig, retired, plays `music_logic_1`);
none is silent. Chroma Lines, Heave and Pipeline are Pattern games that play Logic beds. Every
puzzle also has its own empty slot, `music_<category>_<gameId>` (for example `music_pattern_tiles`);
a file there replaces the shared bed for that game only. [cue-sheet.md](cue-sheet.md) lists the
shared bed each puzzle plays today.
