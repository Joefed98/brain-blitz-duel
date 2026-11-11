/**
 * The player's own equipped game skins and world themes, for the live stage (wave 2, E1; display only).
 *
 * The skinnable games' stages call useGameLook(game) and pass the answer to their renderer; every other drawing of
 * those games (replays, reveals, intro demos, tiles, other players' ghosts) passes nothing and shows the default.
 *
 * This module never imports the coins-and-items code (economy-neutral-check walks src/puzzles' imports): the app
 * registers where the look comes from once (setGameLookSource, src/lib/identity/gameLooks.ts, through A1's loadout),
 * and until then, for a guest, or when the read fails, every game shows its default.
 */
import { useEffect, useState } from "react";
import { lookFor, NO_LOOK, type GameLook, type SkinnableGame } from "@/lib/arcade/skins/look";

/** The account's per-game slots (`game-skin:<game>`, `world-theme:<game>` → an item id or null), or null (a guest). */
export type GameLookSlots = Readonly<Record<string, string | null>>;
type Source = () => Promise<GameLookSlots | null>;

let source: Source | null = null;
let held: { at: number; slots: Promise<GameLookSlots | null> } | null = null;
/** How long a read is reused (a new round after equipping something reads again). */
const FRESH_MS = 20_000;

/** Where the slots come from (the app sets it once; checks stand in with their own). */
export function setGameLookSource(fn: Source | null): void {
  source = fn;
  held = null;
}

/** Forget the last read (sign-in, sign-out, after equipping). */
export function forgetGameLooks(): void {
  held = null;
}

function readSlots(now = Date.now()): Promise<GameLookSlots | null> {
  if (!source) return Promise.resolve(null);
  if (held && now - held.at < FRESH_MS) return held.slots;
  const slots = source().catch(() => null);
  held = { at: now, slots };
  return slots;
}

/** The look a game draws in for this player: its equipped skin and world theme, kept to items that game knows. */
export async function gameLookOf(game: SkinnableGame): Promise<GameLook> {
  const slots = await readSlots();
  if (!slots) return NO_LOOK;
  return lookFor(game, slots[`game-skin:${game}`], slots[`world-theme:${game}`]);
}

/** The live stage's look (the default until the read answers). */
export function useGameLook(game: SkinnableGame): GameLook {
  const [look, setLook] = useState<GameLook>(NO_LOOK);
  useEffect(() => {
    let live = true;
    void gameLookOf(game).then((l) => {
      if (live) setLook((was) => (was.skin === l.skin && was.world === l.world ? was : l));
    });
    return () => {
      live = false;
    };
  }, [game]);
  return look;
}

/** The live stage's look and a ref to it (game draws read the ref, so a look arriving never rebuilds the game). */
export function useGameLookRef(game: SkinnableGame): readonly [GameLook, { readonly current: GameLook }] {
  const look = useGameLook(game);
  const [ref] = useState(() => ({ current: look }));
  ref.current = look;
  return [look, ref] as const;
}
