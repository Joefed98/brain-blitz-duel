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
import { bubCheckpoint } from "./bubble";
import { bullseyeCheckpoint } from "./bullseye";
import { crossCheckpoint } from "./cross";
import { dualCheckpoint } from "./dual";
import { hoverCheckpoint } from "./hover";
import { matchupCheckpoint } from "./matchup";
import { rallyCheckpoint } from "./rally";
import { ricoCheckpoint } from "./ricochet";
import { skylineCheckpoint } from "./skyline";
import { sliceCheckpoint } from "./slice";
import { snakeCheckpoint } from "./snake";
import { stdCheckpoint } from "./steady";
import { swerveCheckpoint } from "./swerve";
import { whackCheckpoint } from "./whack";
import { wavCheckpoint } from "./wavefront";
import { basCheckpoint } from "./bastion";
import { roofCheckpoint } from "./rooftop";
import { sortCheckpoint } from "./sortRush";
import { flipCheckpoint } from "./flip";
import { parryCheckpoint } from "./parry";
import { juncCheckpoint } from "./junction";
import { inkCheckpoint } from "./inkBridge";
import { burstCheckpoint } from "./burst";
import type { InputDiag } from "./engine";

export type ArcadeCounters = Record<string, number>;

/* eslint-disable @typescript-eslint/no-explicit-any */
const SNAPSHOTS: Record<string, (state: any) => object> = {
  beat: beatCheckpoint,
  bintoss: binTossCheckpoint,
  breaker: brkCheckpoint,
  bubble: bubCheckpoint,
  bullseye: bullseyeCheckpoint,
  cross: crossCheckpoint,
  dual: dualCheckpoint,
  hover: hoverCheckpoint,
  matchup: matchupCheckpoint,
  rally: rallyCheckpoint,
  ricochet: ricoCheckpoint,
  skyline: skylineCheckpoint,
  slice: sliceCheckpoint,
  snake: snakeCheckpoint,
  steady: stdCheckpoint,
  swerve: swerveCheckpoint,
  whack: whackCheckpoint,
  wavefront: wavCheckpoint,
  bastion: basCheckpoint,
  rooftop: roofCheckpoint,
  sortrush: sortCheckpoint,
  flip: flipCheckpoint,
  parry: parryCheckpoint,
  junction: juncCheckpoint,
  inkbridge: inkCheckpoint,
  burst: burstCheckpoint,
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

/** Dev diagnostics only show with ?dev=1 on the URL. */
export function devDiagnosticsOn(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("dev") === "1";
}
