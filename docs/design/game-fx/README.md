# Game effects kit and the shared game frame

Phase 2, step 4 (15 Nov 2026). The shared layer every family session uses when it overhauls its games. Build on this;
don't make a second one.

- Kit: `src/lib/fx/kit.ts` (`gameFx`, `planGameFx`, `countUpText`, `releaseGameFx`), React pieces in
  `src/components/fx/GameFx.tsx` (`FxCountUp`, `FxStars`, `FxNewBest`, `ResultPayoff`, `useGameFxOnce`).
- Look: `src/polish-layout/game-fx.css` (particles, payoff, the frame's style guide pass, the computer arena panel).
- Showcase: `/dev-design` (development only), the **Effects** section: every effect on a sample piece in every
  variant, and the payoff.
- Check: `bun scripts/fx-check.tsx` (~2 s, happy-dom).
- Pictures: [docs/design/pages-review/game-frame/GALLERY.md](../pages-review/game-frame/GALLERY.md).

## The API

```ts
import { gameFx, releaseGameFx, countUpText } from "@/lib/fx/kit";

gameFx("tap", el);                              // a press that registered
gameFx("pickUp", flask);                        // lifts and stays up…
gameFx("drop", flask);                          // …until it lands
gameFx("slide", tile, { from: { x: dx, y: dy } }); // FLIP: move it in the layout first, pass where it was
gameFx("pour", flask, { tilt: -40 });           // tilt, hold, return (≤ 900 ms)
gameFx("match", gem);                           // swell, fade out, sparks (held faded; releaseGameFx(gem) to reuse)
gameFx("wrong", cell);                          // short shake, muted tone, error haptic
gameFx("combo", el, { count: streak });         // grows to the 8th, the tone a step higher each time
gameFx("nearMiss", target);                     // two soft pulses and a light tick
gameFx("win", resultBlock);                     // the round-end payoff: scale 0.9 → 1, gold burst
gameFx("newBest", badge);                       // drop 16 px and land with a squash
gameFx("stars", star, { count: n, delayMs: (n - 1) * 160 });
countUpText(scoreEl, 0, 176);                   // text only, ticks, pops when it lands
```

Options: `count` (combo, stars), `from` (slide), `tilt` (pour), `delayMs`, `silent` (leave the sound out when the
game plays its own), `noHaptic` (the screen has its own moment), `inGame` (default true: haptics only while a live
board is on screen, never in a demo, replay or reveal).

`gameFx` returns the `Animation` (await `.finished` to chain), never throws, and replaces any kit effect already
running on that element. With no element it plays only the sound and haptic.

React:

```tsx
<ResultPayoff score={176} label="Your score" stars={{ earned: 2 }} newBest won />
<FxCountUp value={total} />            // markup holds the final number
<FxStars earned={2} total={3} />
<FxNewBest />
useGameFxOnce("win", ref, iWon, { silent: true });
```

Every React piece renders its **final state in the markup** (server render, reduced motion and screenshots all read
the end state) and plays its effect once after mount.

## When to use each

| Kind | Use for | Sound (shared slot) | Haptic |
|---|---|---|---|
| tap | a press that changed something | `tick` | none |
| pickUp / drop | a piece lifted and placed (tubes, cards, blocks) | `move` / `place` | none |
| slide | a piece moving between cells (sliders, swaps, gravity) | `move` | none |
| pour | liquid or anything flowing from one holder to another | `move` | none |
| match | a line, pair or group cleared | `correct` | none |
| wrong | a refused move | `wrong` (quiet) | error |
| combo | a streak; pass the count | `combo`, rising | none |
| countUp | a score or total arriving | `tick`s, `reveal_score` | none |
| nearMiss | a shot or answer just off | `tick` | tick |
| win | the round's result, the winner's moment | `complete` | success |
| newBest | a new personal best | `shared.momentcard` | celebrate |
| stars | each mastery star landing | `stage_complete`, rising | none |

Rules from the style guide: the physical action shows what happens and never costs time (the next input is taken at
once; queue it, don't block it); no effect over a board while a game runs except on the pieces themselves; gold means
you or first place. A game with its own recording for a moment passes `silent` and plays its cue (sound cues:
`docs/sound-cues/README.md`); never add a new manifest slot for a kit effect.

Haptics: only through the kit's one call site (or the existing listed sites). Never on taps, drags or routine moves
(haptics-check pins this).

## Variants

The first that applies. Every variant still shows the state change; only the flourish goes.

| Variant | When | What |
|---|---|---|
| reduced | `prefers-reduced-motion` | a 120 ms crossfade (opacity only), no particles; sound and haptics stay |
| calm | the celebrations switch off (`FX_CELEBRATIONS`), payoff kinds only (combo, countUp, win, newBest, stars) | the lite movement, no particles |
| lite | reduced effects (a slow phone, `lowEnd.ts`) or the battery saver | smaller and shorter, a third of the particles |
| full | otherwise | as designed |

`forceGameFxVariant(v)` forces one (the showcase); never call it in app code.

## Performance budget

- Transform and opacity only, through the Web Animations API (composited; no layout, no paint of the board). fx-check
  fails on any other property, and on a layout transition in the kit's files or the result screens.
- At most 32 kit particles alive (spans in one fixed `[data-fx-kit-layer]`, pointer-events none, `contain: strict`).
- No frame loop of its own: the browser runs the animations; the count-up's rAF runs only while it counts (≤ 600 ms).
- Nothing reads or writes a sim, a clock, a seed, an answer or a score. Effects observe; the sim and server decide.
- Effects never move a control or a hit area: animate the piece's own element, not its container, and never the
  arena (`[data-game-arena]`), the stage or the frame.
- arcade-lowend-check and the frame-time checks must stay green; inside a canvas game, use the game's own renderer
  effects (`arcadeFeedback`, the success layer) and the kit only for DOM pieces and result screens.

## The shared frame

Every context (practice, rooms, rated, the Daily, tournaments, offline) draws the same frame:

- **In play** (`GameLayout` in `PhoneShell.tsx`, `GameFrame.tsx`, `game-frame.css` + `game-fx.css` section 2): one
  60 px header, name and context left, the 48 px timer ring centred, the score block and the game menu right; puzzles
  add the goal line, the tray and the dock; `HudPills` are solid surface chips. Round 2 of the style guide's type:
  names and scores in 800, captions in 600, text 2 for secondary lines. Every box keeps its size, so no board, world,
  control or check measure moves.
- **RoundIntro**: behaviour unchanged (Play's straight-to-3-2-1 path included).
- **Results** (`RoundResult`, `RoundResultsTable`, `FinalResult`, `AsyncResults`, `OfflineRunResult`): the kit's
  payoff: totals count up (`FxCountUp`), the winner's card, row or headline gets `win`, an offline run confirmed as a
  new best shows `FxNewBest`; score bars fill by `scaleX`, never by width.

## The computer arena

On a computer (`data-layout="desktop"`) a live round outside a room gets a side panel right of the play column
(`ArenaSidePanel`): the game, its goal, the time left and the score, larger than the header's. It mirrors the header
(no second timer, sound or effect) and is shown only where the space right of the centred column holds it (puzzles from
1452 px wide, tall arcade worlds from 1332 px), so the column, the world and every control stay where the desktop checks
expect them. A room keeps its 380 px room panel (standings for 16, round progress, chat). Sideways tablets keep the
phone game screen (desktop-layout-check pins it).

## Examples for family sessions

Polypotions (the style guide's pour, 900 ms at most, input queued, never blocked):

```ts
gameFx("pickUp", from);                         // tap a flask
await gameFx("pour", from, { tilt: dir * 40 })?.finished;
gameFx("drop", from);
if (solvedColour) gameFx("match", to);
```

A swap puzzle (FLIP):

```ts
const before = tile.getBoundingClientRect();
commitSwap();                                   // React re-renders the tile in its new cell
const after = tile.getBoundingClientRect();
gameFx("slide", tile, { from: { x: before.left - after.left, y: before.top - after.top } });
```

A streak on a word game: `gameFx("combo", chip, { count: wordsInARow })`; a refused word: `gameFx("wrong", row)`.
