# Rated 4- and 8-player matches (wave 3, session W3d)

Built 11 Nov 2026 behind two switches, **both off at launch** (decided 11 Nov: a small beta isn't split across many
queues). Mockups: `docs/mockups/wave-3/08`, `09`, `10` (read with wave 2: avatars, the five-tab bar and the Joules line
win where they differ).

## Switching a size on

`src/config/ratedMultiConfig.ts`: set `RATED_FOUR_PLAYERS_ENABLED` and/or `RATED_EIGHT_PLAYERS_ENABLED` to `true` and
merge. Off, the picker doesn't show the size (`ratedMultiSizesFn`) and the server refuses a queue request, filling and
finishing for it (`joinMultiQueue`, `assertMultiOn` in `src/lib/rated/multi/multi.server.ts`). There is no browser or
console override. rated-multi-check's first assertion pins both off; switching one on is a deliberate change to that
line (Joe's call, recorded with the date beside it).

## The rules (`src/lib/rated/multi/rules.ts`, pure)

| | |
|---|---|
| Filling | Wait up to 15 s (`FILL_WAIT_MS`) for live players (W3b's queue widens as for 1v1), then every empty seat takes a recorded run W3b offers, best first, labelled "Recorded run". Never a player twice (live or recorded), only runs on every deal of the match. A full live match takes none. |
| Each game | Placing points by place: 8 players 10, 7, 5, 4, 3, 2, 1, 0; 4 players 5, 3, 1, 0 (the rooms' Placings table). Level scores share the place and its higher points. |
| Final placings | Most points; level points split by the total score; still level, the place is shared. |
| Ratings | Every pair once: the better place a win, a shared place a draw, weight 1 / (size − 1). On equal ratings 1st moves exactly as a 1v1 win and last as a 1v1 loss. Recorded seats are opponents only; their owners' ratings never move. |
| Joules | 1.5 × best of 3: 225 for the top half, 150 below. Live players only, one credit a player a match (`rated_multi:<match>:<player>`). |
| Podium Regular | A live finish in places 1–3 counts (C2's `podium-regular`, 25 needed). |

## Contracts (`src/lib/rated/multi/contracts.ts`)

W3a's `docs/rated/ratings-interface.md` and W3b's `docs/rated/matchmaking-interface.md` weren't on any branch when this
was built. The port names what this session needs: `enqueue` and `recordedCandidates` (W3b), `recordRatedMatch` (W3a),
`creditJoules` (the pass). `bindRatedMulti(backend)` binds them once, when the train merges; until then every call is
"not ready" (and refused anyway while the switches are off).

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
