/**
 * D3's level-aware Attention players for the ladder (d3-ladder-lib.ts): a game listed here is played by its own player.
 *
 *  - Labyrinth's elite traces the maze as the kit does (about 0.25 s a square at near-perfect pace, the kit's floor) with
 *    no 0.4 s hold between squares: a trace is one continuous drag, not a tap a square (the spec's person-like solver
 *    draws at 0.2 s a square). Its keys (Hard and Expert from D3) are fetched on the way (mazeKeysPlay).
 */
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, type Rng } from "./puzzle-fairness/kit";
import { ATTENTION_ELITE, type D3Players } from "./d3-ladder-lib";
import type { PuzzleData } from "../src/lib/duel/types";

// The skills are read when a play starts (never at load: d3-ladder-lib imports this file before it defines them).
export const ATTENTION_PLAYERS: D3Players = {
  maze: { elite: (p: PuzzleData, rng: Rng, limit: number) => KITS.maze!.play(p, rng, ATTENTION_ELITE, limit) },
};
void SKILLS;
