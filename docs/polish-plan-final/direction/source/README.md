# Sources of the design-direction mockups (20 Nov 2026)

Design tools, not app code. Nothing here is imported by the app or run by a check.

- `base.css`, `game.css` and the `*.html` files are the page and game mockups. They read the app's own art through two links placed beside them when rendering: `pub` → the repo's `public/`, `art` → `docs/art/`. A page takes `?dir=e` (Esports, refined), `f` (colour-charged), `a` (Bright Spark), `b` or `c`, and Home and Games take `&v=2` for the second layout. The play pages take `&real=1` to draw only the board on the lit stage (the "drawn" studies, pasted under today's real header).
- `render.mjs` serves the folder and screenshots each page with Playwright: `node render.mjs "<name>:<file.html?query>:<phone|desktop>" …`.
- `directions.py` holds the four game art directions as image recipes applied to real screenshots of today's games (taken with `bun scripts/shots/capture.ts <ids> --sizes=390x844 --phases=play --dpr=2`); today's 60 px header is copied back untouched.
- `build-review.py` writes `../../review.html`; `build-difficulty-spec.py` writes `../../difficulty-spec.md` from `../../difficulty/*.json`.

Paths written `<scratch>/` were the session's scratch folder; point them at your own.
