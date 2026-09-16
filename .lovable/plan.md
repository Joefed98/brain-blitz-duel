# Scope no-scroll behavior to active rounds

## What will change
- Restore normal document scrolling by removing fixed viewport height and hidden overflow from the global page and shared phone shell.
- Add a fixed-height, overflow-hidden mode to the phone shell and use it only during puzzle play and answer reveal.
- Leave Home, name entry, practice list, lobby, round intro, standings, final/podium, and practice result as naturally scrolling screens.

## Verification
- Check `/practice` at 390×700 can scroll to its final item.
- Check 10-player lobby and standings layouts scroll at 390×700.
- Check puzzle play and answer reveal remain locked to the viewport without document scrolling.
- Confirm the preview build remains healthy.
