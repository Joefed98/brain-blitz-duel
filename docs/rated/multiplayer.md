# Rated 4- and 8-player matches (wave 3, session W3d)

Built 11 Nov 2026 behind two switches, **both off at launch** (decided 11 Nov: a small beta isn't split across many
queues). Mockups: `docs/mockups/wave-3/08`, `09`, `10` (read with wave 2: avatars, the five-tab bar and the Joules line
win where they differ).

## Switching a size on

W3b's switches, `src/config/ratedConfig.ts`: set `RATED_FORMATS_ON.ffa4` (4 players) and/or `.ffa8` (8 players) to
`true` and merge (rated play itself also needs `RATED_PLAY_FOR_EVERYONE`, or the player on the tester list). Off, the
picker doesn't show the size (`ratedMultiSizesFn`, W3b's `openOptions`) and the server refuses a queue request, filling
and finishing for it (`joinMultiQueue`, `assertMultiOn` in `src/lib/rated/multi/multi.server.ts`; W3b's
`ratedOptionRefusal` too). There is no browser or console override. rated-multi-check's first assertion pins both off;
switching one on is a deliberate change to that line (Joe's call, recorded with the date beside it).

## The rules (`src/lib/rated/multi/rules.ts`, pure)

| | |
|---|---|
| Filling | Wait up to 15 s (`FILL_WAIT_MS`) for live players (W3b's queue widens as for 1v1), then every empty seat takes a recorded run W3b offers, best first, labelled "Recorded run". Never a player twice (live or recorded), only runs on every deal of the match. A full live match takes none. |
| Each game | Placing points by place: 8 players 10, 7, 5, 4, 3, 2, 1, 0; 4 players 5, 3, 1, 0 (the rooms' Placings table). Level scores share the place and its higher points. |
| Final placings | Most points; level points split by the total score; still level, the place is shared. |
| Ratings | W3a's `recordRatedMatch` gets a `placings` match (`multiRatedResult`): format `{ kind: "placings", players }`, every player live or a recorded run, every game's stored scores, the final placings. W3a applies the rule: every pair once, the better place a win, a shared place a draw, weight spread over the other players so the match moves about as much as one 1v1 (`ratingPairs` writes the rule out; the check proves it on a reference Elo). A recorded run's owner moves only as W3a allows (rated runs, at most half). |
| Joules | W3a's outcome: 1.5 × best of 3, first place the win (225), everyone else 150; live players only; D2's pass credits it. |
| Podium Regular | A live finish in places 1–3 counts (C2's `podium-regular`, 25 needed), awarded through W3a's outcome. |

## Contracts (`src/lib/rated/multi/contracts.ts`)

On W3a's `docs/rated/ratings-interface.md` (its types, `src/lib/data/ratings.ts`: `RatedMatchResult`,
`RatedMatchOutcome`) and W3b's `docs/rated/matchmaking-interface.md` (`RATED_FORMATS_ON`, `RecordedCandidate` through
`fromW3bCandidate`). Their server functions weren't on their draft branches yet (11 Nov 2026), so `bindRatedMulti`
connects W3a's `recordRatedMatch(adminDb(), result)` and W3b's ffa queue join and recorded-run list when they land;
until then every call is "not ready" (and refused anyway while the switches are off).

**Open question for W3b:** a 1v1 against a recorded run deals that run's own stored puzzles. A 4- or 8-player match
has one set of deals, so every recorded seat must have runs on exactly those deals (`fillPlan` takes a candidate only
when its deal keys cover the match's). The natural source is the other players of one earlier match or room on the
same deals; W3b's `recordedCandidates` for ffa needs to offer runs that way.

## Screens (`src/components/rated/multi/MultiScreens.tsx`, `src/polish-layout/rated-multi.css`)

`MultiFilling` (08), `MultiStandings` (09), `MultiFinal` (10). The final placings are drawn on the first render; wave 2's
equipped podium entrance and celebration (E2) draws only inside the podium's own box (`entrance`, pointer events off,
decorative) and not at all under reduced motion. No motion of the screens' own.

## Analytics

`multiplayer_match_started` (props size, live_seats, recorded_seats; once a match) and `multiplayer_match_finished`
(props size, placing; once a live player), server only, through `recordEvents`. Migration
`20261114400000_analytics_multiplayer_events.sql` adds them to the list as it stands.

## Check

rated-multi-check (~2 s, no browser).
