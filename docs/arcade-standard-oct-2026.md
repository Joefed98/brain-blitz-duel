# Arcade scoring standard, batch C (29 Oct 2026)

Jaywalk, Wavefront, Roofbound, Rainbow Bridge, Orbit and Ball Tracker move onto Joe's arcade scoring standard. One
page per game in `docs/arcade-standard/` gives exactly how each part counts and the assumptions made.

## The standard

- The core (the game's main measure) pays on a **straight line** (`stdLine` in `src/lib/arcade/arcadeStandard.ts`):
  full at a fixed figure, or at the Near-perfect level's median where there is none.
- Each feature pays a fixed equal share of its own maximum per item. No rising scales or skill-points curves.
- Speed counts only on a completed run (`stdSpeed`).
- The parts' maximums sum to exactly 200. A played run scores at least 1; no input scores 0 (`stdTotal`).
- Everyone in a room plays the identical seeded run.
- arcade-standard-check proves, for each game (`scripts/arcade-standard/<type>.ts`): the parts sum to 200, rooms deal the
  new stamp, perfect runs score 200 (replayed through the server), a played run scores at least 1, idle 0, and the help
  names every part and says the parts total 200.

## The six games

| Game | Stamp | Core | Features | Core full at |
|---|---|---|---|---|
| Jaywalk | crossRev 10 (play change) | Rows and crossings 150 | Coins 30 (1.5 × 20), crossing streak 10 (2 per clean crossing after a clean one, 5), close calls 10 (1 × 10) | 92 units (Near-perfect median 91.5, measured on crossRev 10) |
| Wavefront | wavRev 12 | Ships, hits and waves 150 | Boss destroyed 10, boss speed 10 (full ≤ 20 s after arrival, 0 at 40 s), saucers 20 (4 × 5), cannons and weak points 10 (6 shares), power-ups 0; −5 a life lost | 294 units: everything before the mothership |
| Roofbound | flipRev 10 | Time survived 150 | Gold stars 15 (1.5 × 10), star trails 15 (3.75 × 4), sweet landings 10 (1.25 × 8), double flips 10 (1 × 10) | The full minute (120 half seconds) |
| Rainbow Bridge | inkRev 12 | Levels potted 140 (14 each) | Speed 10 (all ten only; full with 45 s left), ink stars 20 (2.5 × 8), trick shots 12 (3 × 4), shamrock 10, silver coins 8 (0.5 × 16) | All 10 levels |
| Orbit | orbitRev 13 | Planets reached 130 (sixteenths of a planet, so part of a flight counts) | Speed 20 (sun only; full with half the time left), stardust 15 (0.5 × 30), slingshots 12 (3 × 4), asteroid fields 12 (4 × 3), perfect orbits 11 (11/21 each of 21) | The sun (40 planets) |
| Ball Tracker | btRev 8 | Marbles home 140 | Gold marbles 25 (6 shares), combos 20 (1 per marble home from the third in a row), boosted marbles 15 (15/36 per boosted marble home) | All 36 |

Only Jaywalk's play changes: crossing 1 has half crossRev 9's traffic, 2 two thirds, 3 five sixths, 4 full, 5 13/12, 6 14/12,
7+ 15/12, each crossing still proved passable (a crossing that fails steps back toward 12/12; `scripts/cross-std-density.ts`).
The others keep their previous stamp's play exactly (states add `std: 1` outside the checksum).

## Skill-band medians, before → after

`bun scripts/arcade-skill-bands.ts <games> --rev=now --levels=all --seeds=30`, before on main 73f6bb7 (the stamps then
dealt), after on this branch. Medians (p10–p90 after).

| Game | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---|---|---|---|---|---|---|
| Jaywalk | 49 → 88 (59–110) | 78 → 117 (90–129) | 122 → 133 (113–149) | 146 → 144 (124–171) | 168 → 181 (157–189) | 189 → 187 (163–192) | 200 → 194 (185–195) |
| Wavefront | 77 → 136 (108–158) | 129 → 155 (130–175) | 158 → 173 (159–185) | 168 → 186 (169–191) | 184 → 191 (187–196) | 186 → 194 (188–198) | 198 → 196 (192–200) |
| Roofbound | 64 → 117 (105–164) | 100 → 167 (42–171) | 138 → 175 (153–181) | 165 → 184 (177–188) | 174 → 189 (184–193) | 194 → 195 (192–197) | 200 → 198 (195–200) |
| Rainbow Bridge | 36 → 28 (14–59) | 38 → 31 (14–56) | 61 → 52 (28–104) | 107 → 110 (55–162) | 173 → 179 (134–191) | 183 → 190 (144–198) | 200 → 200 (200–200) |
| Orbit | 34 → 13 (3–47) | 62 → 51 (14–104) | 92 → 105 (48–152) | 146 → 157 (114–180) | 175 → 183 (166–191) | 179 → 191 (180–195) | 195 → 194 (186–200) |
| Ball Tracker | 47 → 52 (31–61) | 66 → 75 (51–95) | 103 → 137 (100–172) | 132 → 172 (147–188) | 173 → 193 (177–197) | 188 → 198 (190–200) | 199 → 200 (195–200) |

Every game's medians rise weak < average < good < great < near-perfect < elite < flawless. Gaps at the top are 3–8 points: the straight cores are full for
near-perfect play, so the top is separated by the features alone. Wavefront's core is full from the average player up and
Roofbound's (time survived) from the good player up, so their middle runs high. Flawless bot medians below 200 are the
bots' own misses; each game's oracle or built perfect run scores 200 (arcade-standard-check).

## Open items for Joe

- The Jaywalk, Wavefront, Roofbound and Orbit intro demos stay stopped until recorded on the new stamps.
- Jaywalk's in-game ×2–×4 streak pill and "STREAK ×n" pop are unchanged; no multiplier pays on crossRev 10.
- Roofbound: the 10 s survival pause after a checkpoint save is dropped (time survived is literal), so a saved crash costs nothing.
- Ball Tracker: on 11 of the 300 bank courses not every marble can be routed through a booster (top 196–199 there).
- Wavefront deals 5 saucers a run, not 6, so each pays 4.
