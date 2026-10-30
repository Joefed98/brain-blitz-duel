/**
 * The server's own replay call for each replayable engine game, exactly as
 * src/lib/duel/grade.ts makes it (same arguments from the stored puzzle). Used by
 * scripts/replay-check.ts to prove the phone's replay stepper against it.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PuzzleData } from "../src/lib/duel/types";
import { clashVariantOf } from "../src/lib/arcade/colourClash";
import { replayHoverRun } from "../src/lib/duel/hover";
import { replaySkylineRun } from "../src/lib/duel/skyline";
import { replayBinTossRun } from "../src/lib/duel/binToss";
import { replayBullseyeRun } from "../src/lib/duel/bullseye";
import { replayMatchupRun } from "../src/lib/duel/matchup";
import { replayBreakerRun } from "../src/lib/duel/breaker";
import { replayPinballRun } from "../src/lib/duel/pinball";
import { replayMinesweeperRun } from "../src/lib/duel/minesweeper";
import { replayMahjongRun } from "../src/lib/duel/mahjong";
import { replayHomerunRun } from "../src/lib/duel/homerun";
import { replayFreekickRun } from "../src/lib/duel/freekick";
import { replayRacingRun } from "../src/lib/duel/racing";
import { replayFreecellRun, replayPokerSquaresRun, replayTripeaksRun } from "../src/lib/duel/cards";
import { replayRallyRun } from "../src/lib/duel/rally";
import { replaySliceRun } from "../src/lib/duel/slice";
import { replayBubbleRun } from "../src/lib/duel/bubble";
import { replayBeatRun } from "../src/lib/duel/beat";
import { replaySnakeRun } from "../src/lib/duel/snake";
import { replayCrossRun } from "../src/lib/duel/cross";
import { replayWavefrontRun } from "../src/lib/duel/wavefront";
import { replayFlipRun } from "../src/lib/duel/flip";
import { replayJunctionRun } from "../src/lib/duel/junction";
import { replayInkBridgeRun } from "../src/lib/duel/inkBridge";
import { replayBurstRun } from "../src/lib/duel/burst";
import { replayOrbitRun } from "../src/lib/duel/orbit";
import { replaySwingRun } from "../src/lib/duel/swing";
import { replaySnipRun } from "../src/lib/duel/snip";
import { replayTiltRun } from "../src/lib/duel/tilt";
import { replayBallTrackRun } from "../src/lib/duel/ballTrack";
import { replayWhackRun } from "../src/lib/duel/whack";
import { replayClayRun } from "../src/lib/duel/clayShoot";
import { replayTenDropRun } from "../src/lib/duel/tenDrop";
import { replayWordfallRun } from "../src/lib/duel/wordfall";
import { replayColourClashRun } from "../src/lib/duel/colourClash";
import { replayMinigolfRun } from "../src/lib/duel/minigolf";
import { replayPoolRun } from "../src/lib/duel/pool";
import { replayCurlingRun } from "../src/lib/duel/curling";

export interface ServerReplay {
  score: number;
  replayTick: number;
  state: unknown;
}

const TABLE: Record<string, (p: any, a: string) => ServerReplay> = {
  hover: (p, a) => replayHoverRun(p.seed, a, p.hoverRev),
  skyline: (p, a) => replaySkylineRun(p.seed, a, p.skylineRev),
  bintoss: (p, a) => replayBinTossRun(p.seed, a, p.binRev),
  bullseye: (p, a) => replayBullseyeRun(p.seed, a, p.winds, p.bullRev),
  matchup: (p, a) => replayMatchupRun(p.seed, a, p.matchupRev),
  breaker: (p, a) => replayBreakerRun(p.seed, a, p.brkRev),
  pinball: (p, a) => replayPinballRun(p.seed, a, p.pinRev),
  minesweeper: (p, a) => replayMinesweeperRun(p.seed, a, p.minesRev),
  mahjong: (p, a) => replayMahjongRun(p.seed, a, p.mahjongRev),
  homerun: (p, a) => replayHomerunRun(p.seed, a, p.homerunRev),
  freekick: (p, a) => replayFreekickRun(p.seed, a, p.freekickRev),
  racing: (p, a) => replayRacingRun(p.seed, a, p.racingRev),
  freecell: (p, a) => replayFreecellRun(p.seed, a, p.freecellRev),
  tripeaks: (p, a) => replayTripeaksRun(p.seed, a, p.tripeaksRev),
  pokersquares: (p, a) => replayPokerSquaresRun(p.seed, a, p.pokerSquaresRev),
  rally: (p, a) => replayRallyRun(p.seed, a, p.rallyRev),
  slice: (p, a) => replaySliceRun(p.seed, a, p.sliceRev),
  bubble: (p, a) => replayBubbleRun(p.seed, a, p.bubbleRev),
  beat: (p, a) => replayBeatRun(p.seed, a, p.beatRev),
  snake: (p, a) => replaySnakeRun(p.seed, a, p.snakeRev),
  cross: (p, a) => replayCrossRun(p.seed, a, p.crossRev),
  wavefront: (p, a) => replayWavefrontRun(p.seed, a, p.wavRev),
  flip: (p, a) => replayFlipRun(p.seed, a, p.flipRev),
  junction: (p, a) => replayJunctionRun(p.seed, a, p.junctionRev),
  inkbridge: (p, a) => replayInkBridgeRun(p.seed, a, p.inkRev),
  burst: (p, a) => replayBurstRun(p.seed, a, p.burstRev),
  orbit: (p, a) => replayOrbitRun(p.seed, a, p.orbitRev, p.planets, p.holes, p.extras),
  swing: (p, a) => replaySwingRun(p.seed, a, p.swingRev),
  snip: (p, a) => replaySnipRun(p.seed, a, p.snipRev),
  tilt: (p, a) => replayTiltRun(p.seed, a, p.tiltRev),
  balltrack: (p, a) => replayBallTrackRun(p.course, p.seed, a, p.btRev),
  whack: (p, a) => replayWhackRun(p.seed, a, p.whackRev),
  clayshoot: (p, a) => replayClayRun(p.seed, a, p.clayRev),
  tendrop: (p, a) => replayTenDropRun(p.seed, a, p.tenRev),
  wordfall: (p, a) => replayWordfallRun(p.seed, a, p.wordfallRev),
  stroop: (p, a) => replayColourClashRun(p.seed, a, clashVariantOf(p)),
  // The Sports group (30 Oct 2026).
  minigolf: (p, a) => replayMinigolfRun(p.seed, a, p.pars),
  pool: (p, a) => replayPoolRun(p.seed, a, p.poolRev),
  curling: (p, a) => replayCurlingRun(p.seed, a, p.curlRev),
};

export function serverReplay(puzzle: PuzzleData, answer: string): ServerReplay {
  const fn = TABLE[puzzle.type];
  if (!fn) throw new Error(`no server replay for ${puzzle.type}`);
  const r = fn(puzzle, answer);
  return { score: r.score, replayTick: r.replayTick, state: r.state };
}
