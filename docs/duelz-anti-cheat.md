# Duelz — Anti-Cheat and Integrity (updated 23 Sept 2026)

What protects the game today, what has been designed but not built, and what real-money play would need. Not legal advice; the money stage also needs the compliance items in the go-to-market roadmap.

## Built today

- **Server is the arbiter.** Puzzles are generated server-side; answers and solutions live in a private secrets table the client can never read; the client receives only what it needs to render.
- **No client-trusted scores.** Every score is computed by the server from what the player did: typed answers, move lists, placements, word lists, taps. Clients never send `is_correct` or `score`.
- **Move replay.** For interactive types (Unblock, Push, Ice Slide, Tower, Word Ladder, Laser and Mirrors, Pipes, Lights Out, Block Party, Colour Connect, Word Hunt paths, and the batch 20/21 games) the server replays the submitted moves/placements against the stored puzzle and checks legality and outcome itself.
- **Arcade engine (built 20–23 Sept, sixteen games).** One simulation module per game in `src/lib/arcade/` imported by both the game screen and the server grading path. Fixed 60-tick timestep, integer 1/256-pixel physics with every constant defined once as an integer, seeded mulberry32 carried in the state, no `Math.random` and no floats in the sim. Generalised input events `{t, k, a, b, c, d}` (taps, lane moves, swipes, drag positions, aim vectors, swaps, button presses) recorded on the sim tick they applied; the client sim reads only from that recorded array and the same array is what is submitted. The server replays the full log (up to 6,000 events; a 400,000-character payload allowance for arcade runs — a 4,000-character cap was silently truncating busy runs until 23 Sept) and stores its own score; out-of-range or out-of-order events are clamped/repaired and counted, never silently dropped. The run ends only by sim tick or game-over, never wall clock; the HUD clock is sim time. Desync checkpoints every 300 ticks: the server stores events received/repaired, replay end tick, first mismatching checkpoint and the client's counters beside its own; visible only with `?dev=1`. A 16-game self-replay proof (30 random runs each, including bad inputs) passes. Lessons: a stale home-screen bundle can mask a fix; a React parent re-rendering once a second tore down the game loop until callbacks were moved into refs. Open item: confirm the seed is delivered at puzzle-phase start, not at room creation — irrelevant for free play, one line for the money stage.
- **Identical puzzles for everyone.** All randomness (puzzle content, reaction delays, layouts, arcade seeds) is generated once at room start and stored; no luck in the draw.
- **Timing.** Each device measures its submission against the shared round start using a calibrated server clock offset; the server rejects any `ms_remaining` more than 1.5 s better than its own receipt-time estimate and clamps/logs it. Receipt time is never used as the score basis.
- **Data access.** Row-level security: a player can read only their own room, its players, their own results at any time, and others' results only after a round ends. No direct client writes — all through server functions. Phase advance is idempotent.
- **Word validation** server-side against the dictionary and blocklist.

## Designed, not yet built

- **Accounts:** upgrade anonymous device identities to real accounts in place.
- **`stake` / `mode` fields** so money and free results never mix.
- **Arcade input-rhythm analysis:** the stored input logs make bot detection possible later (humans have jitter, scripts don't) — nothing analyses them yet.
- **Payload integrity check:** the client's own final counters now travel with the log; a mismatch that is not a desync (e.g. truncation in transit) should raise an alert rather than silently grade low.

## Needed before real money (not yet discussed in detail)

**Identity**
- KYC and age verification; one verified account per person.
- Multi-account detection: device fingerprinting, payment-method matching, behavioural similarity; enforceable bans.

**Solver / outside assistance (the hard problem for skill games)**
- Cannot be prevented by cryptography; a player with a solver on a laptop or a second phone looks like a strong player on any single round.
- Detection is statistical and behavioural: flag superhuman times for the specific puzzle (e.g. minimum-push Sokoban in seconds); flag implausible consistency or overnight improvement; input-rhythm analysis (humans have jitter, scripts don't); compare money-room performance with the player's free-play history; per-game "credibility" thresholds.
- Design levers: money rotations can lean on games that can't be outsourced in real time (Reaction Time, Stop Watch, Go/No-Go, Colour Clash, Number Hunt, arcade runs); shorter time limits raise the cost of relaying a puzzle to a solver.

**Client integrity**
- Native wrapper with **App Attest** (iOS) and **Play Integrity** (Android) so the server knows it is talking to the unmodified app; certificate pinning; obfuscated build. The open web app is fine for free play, not for money.

**Collusion**
- Random room assignment in money tournaments (players can't choose opponents); IP/location checks for players in the same room; head-to-head record analysis; detection of deliberate losing.

**Evidence and process**
- Store the full input log and timings for every money round; replayable on demand and showable to the player (arcade rounds already store the tap log).
- Clear rules page, cheating reports, appeals, ability to freeze payouts on a room under review, audit log of admin actions. Acquirers and regulators will ask for these.

**Operational**
- Rate limiting and abuse controls on room creation and joins; monitoring dashboards for the flags above; a human review queue.

## Summary
Technical cheating (faking scores, reading answers, editing data) is already largely closed, including for arcade games now that the engine replays input logs server-side. Human cheating (solvers, multi-accounting, collusion) is where the real-money work lies — mostly detection, statistics and process, layered on identity and client attestation.
