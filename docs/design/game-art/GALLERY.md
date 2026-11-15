# Game key art · gallery

Phase 2 step 4 (15 Nov 2026). Glossy 3D key art for all 83 live games, one square tile (320 × 320) and one wide hero
(960 × 600) each, made in the art kit's renderer. How it was made and how to re-render: [README.md](README.md).
**Not wired into the app.**

## Today against new

The Games catalogue (Cue Ball as the game of the day, then six tiles) and Cue Ball's game page, with today's live
board previews (`public/tiles/`) on the left and the new key art on the right.

![Catalogue: today and new](mocks/catalogue.webp)

![Game page: today and new](mocks/game-page.webp)

## Contact sheets

Each game's tile and hero, shown small, by category (arcade games by group).

### Word

![Word](sheets/word.webp)

### Number

![Number](sheets/number.webp)

### Speed

![Speed](sheets/speed.webp)

### Attention

![Attention](sheets/attention.webp)

### Pattern

![Pattern](sheets/pattern.webp)

### Logic

![Logic](sheets/logic.webp)

### Arcade · Retro

![Arcade · Retro](sheets/retro.webp)

### Arcade · Sports

![Arcade · Sports](sheets/sports.webp)

### Arcade · Cards & Board

![Arcade · Cards & Board](sheets/cards.webp)

### Arcade · Action

![Arcade · Action](sheets/action.webp)

### Arcade · Strategy

![Arcade · Strategy](sheets/strategy.webp)

## Every file

`tile/<id>.webp` and `hero/<id>.webp`, where `<id>` is the game's id in `src/lib/duel/catalogue.ts` (Cue Ball is
`pool`, Polypotions `tubes`). The full list is `source/games.data.mjs`.
