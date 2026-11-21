/**
 * The Retro overhaul's screens (phase 2 step 4, 15 Nov 2026; docs/design/retro-overhaul.md): each Retro game's page in
 * the Games catalogue (its art, name, the intro's goal and how-to lines, its challenges and Play), so the reworded
 * intros (Rally's lives and spin shots, Tempo's and Fission's scoring) are drawn by theme-check and no-wrap-check at the
 * core sizes. Drawn after the core list (scripts/area-screens.ts finds this file).
 */
import { gamesChallengesFixture, gamesProgressFixture } from "./games";
import { readFileSync } from "node:fs";
import { room, type ThemeScreen } from "../theme-screens";
import { openYourRun } from "./reveals";
import type { PuzzleData } from "../../src/lib/duel/types";

/** The ten Retro games, in the review's order (docs/design/game-reviews/retro.md). */
export const RETRO_GAMES = ["hover", "breaker", "rally", "wavefront", "burst", "beat", "snake", "cross", "pinball", "blockfall"] as const;

export default function retroScreens(): ThemeScreen[] {
  const globals = { __harnessProgress: gamesProgressFixture(), __DUELZ_CHALLENGES__: gamesChallengesFixture() };
  return [...RETRO_GAMES.map((type): ThemeScreen => ({ name: `retro: game page, ${type}`, mode: "practice", plain: true, search: { page: type }, globals, waitMs: 900 })), ...retroRevealScreens()];
}

/**
 * Stage 2 (15 Nov 2026): each Retro game's answer reveal in a two-player room after its round, this device's result a
 * real stored run on the dealt stamp (scripts/fixtures/replay-runs.json) scored as the server stored it, so the run
 * summary (RetroRunSummary.tsx: key numbers, the timeline, the final frame) draws with real data.
 */
export function retroRevealScreens(): ThemeScreen[] {
  const runs = (JSON.parse(readFileSync("scripts/fixtures/replay-runs.json", "utf8")) as { runs: { type: string; puzzle: PuzzleData; answer: string }[] }).runs;
  const out: ThemeScreen[] = [];
  for (const type of RETRO_GAMES) {
    const run = runs.filter((r) => r.type === type).at(-1);
    if (!run) continue;
    const score = Math.max(1, Math.min(200, Number.parseInt(run.answer.split("|")[1] ?? "0", 10) || 1));
    out.push({
      name: `retro: reveal, ${type}`,
      mode: "room",
      room: room("in_progress", "reveal", { arcade: true, arcadeType: type, arcadeRun: run, players: 2, scores: (slot) => (slot === 1 ? score : Math.max(1, score - 23)) }),
      waitMs: 1600,
      // The answer reveal has no card of its own (as the core list's reveal screens).
      plain: true,
      // Changed with Joe's approval, 21 Nov 2026: opens "Your run" (a room's reveal opens on the Room view), so the run summary is what is judged;
      // Hover stays on the Room view, so a Retro room reveal's chart view is still drawn.
      ...(type === "hover" ? {} : { go: openYourRun }),
    });
  }
  return out;
}
