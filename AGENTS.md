<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Tile Grid is tap-only: rack tile, then empty cell; placed tile, then empty cell or rack.
- Sum Hunt uses deterministic 4×4 stage boards with 1–3 orthogonal target paths of 3–6 cells; server replay regenerates them.
- ArrowPad owns the device-local arrows/joystick preference so every arrow-controlled puzzle behaves consistently.
- Balance placement uses only fixed, non-tilting distance buttons; their peg indices feed the existing server-validated placement encoding.
- PhoneShell's gameScreen mode owns selection and iOS callout suppression for duel and practice round screens, keeping the behavior consistent across puzzle types.
