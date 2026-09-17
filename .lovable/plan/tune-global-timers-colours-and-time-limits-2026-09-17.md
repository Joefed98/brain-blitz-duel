# Tune global timers, colours, and time limits

## What will change
- Make the shared in-game timer area collision-safe on short phones, with per-type compact sizing down to 60% where dense screens need it; inputs and controls will retain their current size.
- Darken Brown globally to `#8B5A2B`, then add Yellow only to Colour Clash and Colour Connect while keeping the UI gold unchanged.
- Expand Colour Clash to eight colour words/swatches and enlarge its instruction pill by about 25%.
- Apply the requested time limits to all fifteen named puzzle types and update each affected fixed intro sentence to match.
- Leave puzzle rules, scoring, and practice behavior unchanged beyond these requested constants and palette options.

## Verification
- Source-audit every registered in-game stage for timer spacing at 390×700 and 375×667 without launching browser tests.
- Confirm Yellow appears only in Colour Clash and Colour Connect generation/display paths.
- Confirm each requested `timeLimitMs` and matching intro copy in code.
- Run focused source checks, TypeScript checks, and inspect the preview build result.

## Technical details
- Prefer a shared timer-slot constraint plus the existing dense-type list, adding narrower per-height scaling only where needed.
- Preserve the timer ring’s internal geometry and reserve layout space matching its transformed visual size so it cannot overlap adjacent content.
