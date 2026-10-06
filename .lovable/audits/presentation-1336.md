# Wordsmith / Bubble Pop / Bomb Defusal — Oct 6, 13:36

## Wordsmith
- The previous measured 700-weight fit remains the reference; visible font size is multiplied by 0.7 after fitting, including the centre letter.
- Visible glyph weight is 500 (500/700 ≈ 71%). There was no separate glyph stroke; weight controls the font's intrinsic strokes. Polygon outlines remain 1px and untouched.
- Lighter-weight glyphs have their own hidden probes for correct centring, without changing the bold reference fit.
- Shared live, intro and reveal geometry is unchanged. Fourteen source/SSR checks pass at 390×700 and 375×667; device appearance remains unverified.

## Bubble Pop
- Cause: buildArcadeReveal received BubbleResult, where the starting count is on state.startCount, not the top level. Missing total defaulted to zero, so a correct remaining count still produced 0%.
- Fixed only the reveal builder to read flat startCount or nested state.startCount. Percentage is rounded and clamped to 0–100 from starting and remaining board counters; popped/dropped are not mistaken for the initial total.
- The authoritative current partial score is clamp(round(130 × (start − remaining)/start), 0, 130); completion retains 130 plus its time bonus. The requested 150-minus relation is not applicable to the current game, so no score rule was changed.
- Before: 1,410 row fixtures passed the old weak end-of-line score check despite the bad percentage. After: 1,410 pass with Bubble's percentage and rendered line additionally checked, plus 15 partial-board snapshots using the real score function. Examples: 50/67 left → 25%/33 points; 17/67 left → 75%/97 points; 3/67 left → 96%/124 points.
- These are server-graded row fixtures, not queries of historical database rows. Existing persisted reveal summaries were not rewritten.

## Every changed Bomb Defusal template

Only template 16 changed (72 ordered instances across the nine actions):
- Before: `{X} immediately after {Y}.`
- After: `{Y}, then {X} as the VERY NEXT action.`

Concrete requested directions:
- `Press B immediately after cut wire 6.` → `Cut wire 6, then press B as the VERY NEXT action.`
- `Cut wire 6 immediately after press B.` → `Press B, then cut wire 6 as the VERY NEXT action.`

This same single form covers cut→cut and press→press instances. No "straight after" or "right after" templates exist. Negative constraints (not consecutive / never same-colour cuts in a row) and spatial wire adjacency remain untouched.

All 72 IDs/wordings rebuild correctly; 40 generated panels pass wording, unique solution, necessity, family and pair checks. The source fingerprint matches the baseline when just the template string is restored: IDs, predicates, template count, generation and uniqueness code are unchanged.

## Scope verification
321 protected gameplay/puzzle files remain byte-identical. Only the presentation summary builder and Bomb's text literal differ among the 323 fingerprinted files. No simulation, input, grader logic, score function or identity-proof changes; no browsers ran. Preview build OK.