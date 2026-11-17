/**
 * Crazy Golf's screens (the Crazy Golf overhaul, phase 2 step 4, 15 Nov 2026; docs/design/pages-review/crazy-golf/)
 * for theme-check and no-wrap-check: the redesigned answer
 * reveal in a room (the scorecard that switches holes, the hole map, the key numbers), after a played golfRev 3 run
 * (a composed course's witness, every hole under par) and after an empty one, at every size.
 */
import { readFileSync } from "node:fs";
import type { Page } from "playwright";

import { minigolfGameFor, MINIGOLF_REV_COURSE } from "../../src/lib/arcade/minigolf";
import { encodeSportsRun } from "../../src/lib/arcade/sportsKit";
import { MINIGOLF_HOLES_BANK } from "../../src/lib/duel/minigolfHolesBank.server";
import { pickMinigolfHoles } from "../../src/lib/duel/sports.server";
import { playCourseV3, WITNESS_FILE, type WitnessFile } from "../minigolf-holes-bank";
import { ALL_SIZES, room, type ThemeScreen } from "../theme-screens";

/** A room at the reveal of one Crazy Golf round, my own answer a played run (or none). */
function golfRoom(played: boolean) {
  let x = 11;
  const holes = pickMinigolfHoles("normal", () => ((x = (Math.imul(x, 1103515245) + 12345) >>> 0), x >>> 3)).map((e) => e.id);
  const pars = holes.map((id, i) => MINIGOLF_HOLES_BANK[i]!.find((e) => e.id === id)!.pars[1]!);
  const puzzle = { type: "minigolf", seed: 4242, golfRev: MINIGOLF_REV_COURSE, holes, pars };
  let answer = "";
  if (played) {
    const w = JSON.parse(readFileSync(WITNESS_FILE, "utf8")) as WitnessFile;
    const { events, state, checkpoints } = playCourseV3(holes, pars, "normal", w);
    answer = encodeSportsRun({ seed: 4242, claimedScore: minigolfGameFor(pars, MINIGOLF_REV_COURSE, { holes }).score(state), events, endTick: state.tick, checkpoints });
  }
  return () => {
    const r = room("in_progress", "reveal", { arcade: true, arcadeType: "minigolf", players: 4, revealParts: true })();
    r.duel.puzzles_public = r.duel.puzzles_public.map(() => puzzle) as never;
    r.results = r.results.map((x) => (x.player_slot === 1 ? { ...x, answer } : x)) as never;
    return r;
  };
}

/** Opens hole 3 on the scorecard (the switcher). */
const pickHole3 = async (page: Page) => {
  await page.locator("[data-minigolf-reveal] [data-scorecard] button").nth(2).click();
  await page.waitForTimeout(300);
};

export default function crazyGolfScreens(): ThemeScreen[] {
  // Changed with Joe's approval, 16 Nov 2026 (round intros aren't page-skinned): the round intro is no longer drawn
  // here (these checks judge page-skinned screens only); crazy-golf-v3-check proves its text, demo-intro-check its layout.
  return [
    { name: "crazy golf: reveal after a played run", mode: "room", room: golfRoom(true), plain: true, waitMs: 1200, sizes: ALL_SIZES },
    { name: "crazy golf: reveal, hole 3 chosen", mode: "room", room: golfRoom(true), plain: true, waitMs: 1200, sizes: ALL_SIZES, go: pickHole3 },
    { name: "crazy golf: reveal after an empty run", mode: "room", room: golfRoom(false), plain: true, waitMs: 1200, sizes: ALL_SIZES },
  ];
}
