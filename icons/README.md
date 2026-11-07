# Joulz icons v1

Approved on the "Joulz – competitive layer" design canvas. 36 icons plus filled active versions of the four tab icons, in `svg/`.

## How they're drawn
- 24 × 24 viewBox, one 2 px stroke, round joins and caps, `currentColor` throughout, so colour comes from CSS tokens.
- Filled parts (dots, small bolts, the visor) also use `currentColor`.
- Use at 18, 20, 22 or 24 px only. Never scale the stroke.

## Rules
- Tabs: outline icon in `--jz-text-3` when inactive; the `-on` filled icon in `--jz-gold` when active.
- Wrong (`cross.svg`) is always `--jz-red`. Close (`close.svg`) is the plain ✕ and never means wrong.
- Done (`check.svg`) is `--jz-cyan` when it marks success.
- Profile, Friends and Add friend use Captain Joulz's helmet.
- Every icon is decorative (`aria-hidden`) unless it is the only content of a button, in which case the button carries the `aria-label`.
- Emoji stay in chat reactions only.

## Names
`names.json` maps each file to its label. `icons-source.py` is the code that drew them.
