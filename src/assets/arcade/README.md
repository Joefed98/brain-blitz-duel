# Arcade sprite art

One folder per arcade world (`retro`, `space`, `realworld`, `kitchen`, `fairground`,
`underwater`, `cavelava`, `orchard`, `toybox`). PNG/WebP files here are bundled by Vite
and drawn by `src/lib/arcade/sprites.renderer.ts`; a missing file falls back to the
game's code-drawn art. Packs, licences and the exact file names to add are in
`docs/art-assets.md`.
