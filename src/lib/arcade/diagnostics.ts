/**
 * Arcade diagnostics, shared by the phone and the server.
 *
 * The phone appends its own final counters to the run it submits, after a "~".
 * Every run decoder ignores everything after the "~", so the counters can never
 * change a replay; the server only stores them next to its own counters.
 */

import { beatCheckpoint } from "./beat";
import { binTossCheckpoint } from "./binToss";
import { brkCheckpoint } from "./breaker";
import { pinCheckpointAny } from "./pinball4";
import { minesCheckpoint } from "./minesweeper";
import { mahjongCheckpoint } from "./mahjong";
import { fcCheckpoint } from "./cards/freecell";
import { tpCheckpoint } from "./cards/tripeaks";
import { psCheckpoint } from "./cards/pokerSquares";
import { fhCheckpoint } from "./cards/fiveHands";
import { pyCheckpoint } from "./cards/pyramid";
import { gsCheckpoint } from "./cards/golfSol";
import { mgCheckpoint } from "./cards/muggins";
import { bubCheckpoint } from "./bubble";
import { bullseyeCheckpoint } from "./bullseye";
import { crossCheckpoint } from "./cross";
import { dualCheckpoint } from "./dual";
import { hoverCheckpoint } from "./hover";
import { matchupCheckpoint } from "./matchup";
import { rallyCheckpoint } from "./rally";
import { ricoCheckpoint } from "./ricochet";
import { moonCheckpoint, MOON_REV, ninjaCheckpoint, NINJA_REV } from "./ricochetNinja";
import { skylineCheckpoint } from "./skyline";
import { sliceCheckpoint } from "./slice";
import { snakeCheckpoint } from "./snake";
import { stdCheckpoint } from "./steady";
import { swerveCheckpoint } from "./swerve";
import { whackCheckpoint } from "./whack";
import { tenDropCheckpoint } from "./tenDrop";
import { wordfallCheckpoint } from "./wordfall";
import { clayCheckpoint } from "./clayShoot";
import { wavCheckpoint } from "./wavefront";
import { basCheckpoint } from "./bastion";
import { bastionTankCheckpoint, BASTION_REV_TANK } from "./bastionTank";
import { roofCheckpoint } from "./rooftop";
import { flipCheckpoint } from "./flip";
import { juncCheckpoint } from "./junction";
import { inkCheckpoint } from "./inkBridge";
import { burstCheckpoint } from "./burst";
import { orbitCheckpoint } from "./orbit";
import { swingCheckpoint } from "./swing";
import { tiltCheckpoint } from "./tilt";
import { hotfloorCheckpoint } from "./hotFloor";
import { snipCheckpoint } from "./snip";
import { btCheckpoint } from "./ballTrack";
import { homerunCheckpoint } from "./homerun";
import { freekickCheckpoint } from "./freekick";
import { racingCheckpoint } from "./racing";
import { minigolfCheckpoint } from "./minigolf";
import { poolCheckpoint } from "./pool";
import { curlingCheckpoint } from "./curling";
import { bfCheckpoint } from "./blockfall";
import { arCheckpoint } from "./alleyroll";
import type { InputDiag } from "./engine";
import { devDisplayAllowed } from "../devDisplay";

export type ArcadeCounters = Record<string, number>;

/* eslint-disable @typescript-eslint/no-explicit-any */
const SNAPSHOTS: Record<string, (state: any) => object> = {
  beat: beatCheckpoint,
  bintoss: binTossCheckpoint,
  minigolf: minigolfCheckpoint,
  pool: poolCheckpoint,
  curling: curlingCheckpoint,
  breaker: brkCheckpoint,
  pinball: pinCheckpointAny,
  minesweeper: minesCheckpoint,
  mahjong: mahjongCheckpoint,
  homerun: homerunCheckpoint,
  freekick: freekickCheckpoint,
  racing: racingCheckpoint,
  freecell: fcCheckpoint,
  tripeaks: tpCheckpoint,
  pokersquares: psCheckpoint,
  fivehands: fhCheckpoint,
  pyramid: pyCheckpoint,
  golfsol: gsCheckpoint,
  muggins: mgCheckpoint,
  blockfall: bfCheckpoint,
  alleyroll: arCheckpoint,
  bubble: bubCheckpoint,
  bullseye: bullseyeCheckpoint,
  cross: crossCheckpoint,
  dual: dualCheckpoint,
  hover: hoverCheckpoint,
  matchup: matchupCheckpoint,
  rally: rallyCheckpoint,
  // Ricochet: Moon Climb (ricoRev 3), the ninja wall-climb (ricoRev 2) or the original shaft.
  ricochet: (s: any) => (s && s.rev === MOON_REV ? moonCheckpoint(s) : s && s.rev === NINJA_REV ? ninjaCheckpoint(s) : ricoCheckpoint(s)),
  skyline: skylineCheckpoint,
  slice: sliceCheckpoint,
  snake: snakeCheckpoint,
  steady: stdCheckpoint,
  swerve: swerveCheckpoint,
  whack: whackCheckpoint,
  tendrop: tenDropCheckpoint,
  wordfall: wordfallCheckpoint,
  clayshoot: clayCheckpoint,
  wavefront: wavCheckpoint,
  // bastionRev 2's state carries `rev`; the original Bastion's has none.
  bastion: (state: { rev?: number }) => (state.rev === BASTION_REV_TANK ? bastionTankCheckpoint(state as never) : basCheckpoint(state as never)),
  rooftop: roofCheckpoint,
  flip: flipCheckpoint,
  junction: juncCheckpoint,
  inkbridge: inkCheckpoint,
  burst: burstCheckpoint,
  orbit: orbitCheckpoint,
  swing: swingCheckpoint,
  tilt: tiltCheckpoint,
  hotfloor: hotfloorCheckpoint,
  snip: snipCheckpoint,
  balltrack: btCheckpoint,
};

export const ARCADE_DIAG_KEYS: ReadonlySet<string> = new Set(Object.keys(SNAPSHOTS));

/** A game's counters straight from its sim state (the same fields as a checkpoint). */
export function arcadeCounters(key: string, state: unknown, score: number): ArcadeCounters {
  const snap = SNAPSHOTS[key];
  const out: ArcadeCounters = { score };
  if (!snap || !state) return out;
  for (const [name, value] of Object.entries(snap(state))) {
    if (name === "checksum") continue;
    if (typeof value === "number" && Number.isFinite(value)) out[name] = value;
  }
  return out;
}

export function appendClientCounters(raw: string, counters: ArcadeCounters): string {
  const body = Object.entries(counters)
    .map(([name, value]) => `${name}=${Math.trunc(value)}`)
    .join(";");
  return `${raw}~${body}`;
}

export function splitClientCounters(raw: string): { run: string; counters: ArcadeCounters | null } {
  const text = String(raw ?? "");
  const at = text.indexOf("~");
  if (at < 0) return { run: text, counters: null };
  const counters: ArcadeCounters = {};
  for (const pair of text
    .slice(at + 1)
    .split(";")
    .slice(0, 40)) {
    const [name, value] = pair.split("=");
    const number = Number.parseInt(value ?? "", 10);
    if (name && /^[a-zA-Z]{1,24}$/.test(name) && Number.isInteger(number)) counters[name] = number;
  }
  return { run: text.slice(0, at), counters };
}

export interface ArcadeDiag {
  received: number;
  clamped: number;
  dropped: number;
  first: InputDiag["first"];
  replayEndTick: number;
  desyncTick: number | null;
  replayMs: number;
  client: ArcadeCounters | null;
  server: ArcadeCounters;
}

interface DiagSource {
  inputDiag: InputDiag;
  replayTick: number;
  desyncTick: number | null;
  score: number;
  state: unknown;
}

export function buildArcadeDiag(
  key: string,
  run: DiagSource,
  rawAnswer: string,
  replayMs: number,
): ArcadeDiag {
  return {
    received: run.inputDiag.received,
    clamped: run.inputDiag.clamped,
    dropped: run.inputDiag.dropped,
    first: run.inputDiag.first,
    replayEndTick: run.replayTick,
    desyncTick: run.desyncTick,
    replayMs: Math.round(replayMs * 10) / 10,
    client: splitClientCounters(rawAnswer).counters,
    server: arcadeCounters(key, run.state, run.score),
  };
}

/** Visible diagnostics require the server-accepted practice dev key. */
export function devDiagnosticsOn(): boolean {
  return devDisplayAllowed();
}
