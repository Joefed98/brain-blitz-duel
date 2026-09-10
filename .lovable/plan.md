# Add Reverse Recall, Odd Shape Out, and Chain Calculation

## Goal
Add three registry-backed puzzle types without changing duel phases, scoring rules, categories, or the secured read/write flow.

## Implementation
- Extend the shared puzzle types with `reverse`, `oddshape`, and `chaincalc` data shapes.
- Add each type to the existing registry under `memory`, `attention`, and `number` respectively, so round selection continues choosing three distinct categories automatically.
- Reuse the Sequence Recall playback/input component with a reverse mode. Generate five unique tiles, validate taps against the reversed order, and add the fixed two-grid intro and reveal.
- Build Odd Shape Out with a responsive 5×5 inline-SVG grid supporting circle, square, triangle, star, hexagon, and arrow variants. Generate one visible difference and a stored answer position; add the fixed intro and reveal explanation.
- Build Chain Calculation with four valid operations, positive whole-number intermediate results, and a 1–400 final answer. Add the vertical numeric-input play view, fixed intro, and reveal with intermediate workings.
- Update answer splitting so Reverse Recall’s correct tapping order, Odd Shape Out’s position/explanation, and Chain Calculation’s intermediates/final answer remain in `duel_secrets`. Public puzzle data will contain only what is needed to play.
- Keep generation inside duel creation, checking/scoring inside secure answer submission, and full reveal data behind the existing post-round reveal function.

## Validation
- Run generator checks across many samples: Reverse Recall uses five unique tiles and is never palindromic; every Chain Calculation stays positive, integral, and within bounds.
- Verify public/private splitting never exposes the three answers before reveal.
- Force all three types through a two-phone duel, including a 390px viewport check for Odd Shape Out visibility, synchronized public content, answer reveals, and round results.
- Confirm type checks and the app build remain clean.

## Technical details
- Existing standard scoring remains unchanged; these three types use the registry’s normal `check()` plus standard time-based score path.
- No database migration or new category is required because puzzle payloads are JSON and the existing categories already cover all three types.