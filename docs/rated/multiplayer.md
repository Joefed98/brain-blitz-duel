# Rated 4- and 8-player matches (wave 3, session W3d)

Built 11 Nov 2026 behind two switches, **both off at launch** (decided 11 Nov: a small beta isn't split across many
queues). Mockups: `docs/mockups/wave-3/08`, `09`, `10` (read with wave 2: avatars, the five-tab bar and the Joules line
win where they differ).

## Switching a size on

W3b's switches, `src/config/matchmakingConfig.ts`: set `RATED_FORMATS_ON.ffa4` (4 players) and/or `.ffa8` (8 players) to
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

## Connected to W3b and W3a

- **W3b's queue** (`src/lib/rated/rated.server.ts`, three marked hooks): `joinQueue` refuses 4 and 8 players during
  placement; `pollQueue` hands an ffa searcher to `pollMultiQueue` (`src/lib/rated/multi/multiQueue.server.ts`), which
  groups players with W3b's own pairing rule between every two of them (`groupFor` in `queue.ts`: the same format and
  choice, never placement, the band widening as for 1v1), claims them atomically (`mm_queue_claim`) and makes the
  match with W3b's `createLiveMatch` (an ordinary started room, the same deals for everyone); `settleMatch` hands a
  finished ffa match to `settleMultiMatch`, which builds W3a's placings result (`multiRatedResult`) from the stored
  scores and stores every player's run (the source for recorded seats).
- **W3a**: the result is W3a's `RatedMatchResult` (`src/lib/data/ratings.ts`); W3a's `recordRatedMatch(adminDb(),
  result)` wasn't on its draft branch yet (11 Nov 2026, types only), so `bindRatedMulti` (`contracts.ts`) connects it
  when it lands; until then settling an ffa match retries later (and the switches are off).
- **Recorded seats (parked; question for W3b):** a 1v1 against a recorded run deals that run's stored puzzles. A 4- or
  8-player match has one set of deals, so its recorded seats must be the other players of one earlier match on the same
  deals (every settled ffa match now stores all its players' runs, `rated:<match>:<user>`). W3b's recorded match holds
  one recorded owner (`mm_matches.recorded_owner`), so seating several needs W3b's tables and playback to carry more
  than one. Until then a short group keeps searching, after 15 s too. The rule for choosing them is ready
  (`fillPlan`, `fromW3bCandidate`, rated-multi-check).

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
