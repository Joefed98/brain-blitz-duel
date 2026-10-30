/**
 * The Sports group's deals (30 Oct 2026; server-only): each game deals from its bank of proven courses, tables and
 * sheets (every one played to 200 by its oracle through the server's replay; minigolf-check, pool-check and
 * curling-check replay the proofs), so everyone in a room plays the identical run and a perfect run is always there.
 */
import { MINIGOLF_REV } from "@/lib/arcade/minigolf";
import { POOL_REV } from "@/lib/arcade/pool";
import { CURLING_REV } from "@/lib/arcade/curling";
import { arcadeSeed } from "./arcade.server";
import { CURLING_BANK } from "./curlingBank.server";
import { MINIGOLF_BANK } from "./minigolfBank.server";
import { POOL_BANK } from "./poolBank.server";
import type { CurlingPuzzleData, MinigolfPuzzleData, PoolPuzzleData } from "./types";

export function generateMinigolf(): MinigolfPuzzleData {
  const entry = MINIGOLF_BANK[arcadeSeed() % MINIGOLF_BANK.length]!;
  return { type: "minigolf", seed: entry.seed, golfRev: MINIGOLF_REV, pars: [...entry.pars] };
}

export function generatePool(): PoolPuzzleData {
  return { type: "pool", seed: POOL_BANK[arcadeSeed() % POOL_BANK.length]!, poolRev: POOL_REV };
}

export function generateCurling(): CurlingPuzzleData {
  return { type: "curling", seed: CURLING_BANK[arcadeSeed() % CURLING_BANK.length]!, curlRev: CURLING_REV };
}
