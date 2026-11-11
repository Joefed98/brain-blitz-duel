/**
 * The game skins' source (wave 2, E1): the signed-in account's per-game slots from A1's loadout, through the identity
 * backend (the one way to A1). Installed once by the root; src/lib/skins/equipped.ts reads it for the live stages.
 * A guest has no loadout, so every game shows its default.
 */
import { setGameLookSource } from "@/lib/skins/equipped";
import { identityBackend } from "./backend";

export function installGameLookSource(): void {
  setGameLookSource(async () => {
    const backend = await identityBackend();
    const loadout = backend ? await backend.getMyLoadout() : null;
    return loadout?.gameLooks ?? null;
  });
}
